import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type TestAgent from "supertest/lib/agent.js";
import { authenticatedAgent } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function createCustomer(agent: TestAgent, name = "Marko Marković") {
  const { body } = await agent.post("/api/customers").send({ name, phone: "0641234567" });
  return body as { id: string; name: string; phone: string };
}

/** Creates devices "Device 01" … "Device NN" through the API. */
async function createNumberedDevices(agent: TestAgent, count: number, ownerId?: string) {
  for (let n = 1; n <= count; n++) {
    const label = String(n).padStart(2, "0");
    await agent.post("/api/devices").send({ name: `Device ${label}`, ownerId });
  }
}

function names(response: { body: { items: { name: string }[] } }) {
  return response.body.items.map(({ name }) => name);
}

describe("devices: create and read", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get("/api/devices");

    expect(response.status).toBe(401);
  });

  it("creates a generic device that can then be read back", async () => {
    const { agent } = await authenticatedAgent();

    const created = await agent.post("/api/devices").send({ name: " Samsung Galaxy S21 " });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Samsung Galaxy S21", owner: null });
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body).not.toHaveProperty("legacyId");
    expect(created.body).not.toHaveProperty("legacyIsNew");

    const read = await agent.get(`/api/devices/${created.body.id}`);

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({
      id: created.body.id,
      name: "Samsung Galaxy S21",
      owner: null,
    });
  });

  it("creates a device owned by a customer, read back with the owner", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);

    const created = await agent.post("/api/devices").send({ name: "iPhone 12", ownerId: marko.id });

    expect(created.status).toBe(201);
    const owner = { id: marko.id, name: marko.name, phone: marko.phone };
    expect(created.body).toMatchObject({ name: "iPhone 12", owner });

    const read = await agent.get(`/api/devices/${created.body.id}`);

    expect(read.body).toMatchObject({ name: "iPhone 12", owner });
  });

  it("rejects a device without a name with 400", async () => {
    const { agent } = await authenticatedAgent();

    const missing = await agent.post("/api/devices").send({});
    const blank = await agent.post("/api/devices").send({ name: "  " });

    expect(missing.status).toBe(400);
    expect(missing.body.details.fieldErrors).toHaveProperty("name");
    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors).toHaveProperty("name");
  });

  it("rejects an owner that is not a customer with 400", async () => {
    const { agent } = await authenticatedAgent();

    const malformed = await agent.post("/api/devices").send({ name: "iPhone", ownerId: "nope" });
    const unknown = await agent.post("/api/devices").send({ name: "iPhone", ownerId: UNKNOWN_ID });

    expect(malformed.status).toBe(400);
    expect(malformed.body.details.fieldErrors).toHaveProperty("ownerId");
    expect(unknown.status).toBe(400);
    expect(unknown.body.details.fieldErrors).toHaveProperty("ownerId");
  });

  it("returns 404 for an unknown device", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent.get(`/api/devices/${UNKNOWN_ID}`);
    const malformed = await agent.get("/api/devices/not-a-uuid");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("devices: update and delete", () => {
  it("gives a generic device an owner, then makes it generic again", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    const { body: device } = await agent.post("/api/devices").send({ name: "Lenovo T480" });

    const owned = await agent
      .put(`/api/devices/${device.id}`)
      .send({ name: "Lenovo ThinkPad T480", ownerId: marko.id });

    expect(owned.status).toBe(200);
    expect(owned.body).toMatchObject({
      id: device.id,
      name: "Lenovo ThinkPad T480",
      owner: { id: marko.id, name: marko.name },
    });

    const generic = await agent
      .put(`/api/devices/${device.id}`)
      .send({ name: "Lenovo ThinkPad T480", ownerId: null });

    expect(generic.status).toBe(200);
    expect(generic.body).toMatchObject({ owner: null });
    expect((await agent.get(`/api/devices/${device.id}`)).body).toMatchObject({ owner: null });
  });

  it("moves a device to another owner", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const { body: device } = await agent
      .post("/api/devices")
      .send({ name: "iPhone 12", ownerId: marko.id });

    const moved = await agent
      .put(`/api/devices/${device.id}`)
      .send({ name: "iPhone 12", ownerId: ana.id });

    expect(moved.status).toBe(200);
    expect(moved.body.owner).toMatchObject({ id: ana.id, name: "Ana" });
  });

  it("rejects an update without a name or with an unknown owner with 400", async () => {
    const { agent } = await authenticatedAgent();
    const { body: device } = await agent.post("/api/devices").send({ name: "iPhone 12" });

    const blank = await agent.put(`/api/devices/${device.id}`).send({ name: "" });
    const unknownOwner = await agent
      .put(`/api/devices/${device.id}`)
      .send({ name: "iPhone 12", ownerId: UNKNOWN_ID });

    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors).toHaveProperty("name");
    expect(unknownOwner.status).toBe(400);
    expect(unknownOwner.body.details.fieldErrors).toHaveProperty("ownerId");
  });

  it("returns 404 when updating an unknown device", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.put(`/api/devices/${UNKNOWN_ID}`).send({ name: "iPhone 12" });

    expect(response.status).toBe(404);
  });

  it("deletes a generic device and an owned device", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    const { body: generic } = await agent.post("/api/devices").send({ name: "Generic" });
    const { body: owned } = await agent
      .post("/api/devices")
      .send({ name: "Owned", ownerId: marko.id });

    expect((await agent.delete(`/api/devices/${generic.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/devices/${owned.id}`)).status).toBe(204);
    expect((await agent.get(`/api/devices/${generic.id}`)).status).toBe(404);
    expect((await agent.get(`/api/devices/${owned.id}`)).status).toBe(404);
    // The owner stays.
    expect((await agent.get(`/api/customers/${marko.id}`)).status).toBe(200);
  });

  it("returns 404 when deleting an unknown device", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent.delete(`/api/devices/${UNKNOWN_ID}`);
    const malformed = await agent.delete("/api/devices/not-a-uuid");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("devices: paged list", () => {
  it("returns the first 10 devices by name with the total count and owners", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    await createNumberedDevices(agent, 11);
    await agent.post("/api/devices").send({ name: "Device 12", ownerId: marko.id });

    const response = await agent.get("/api/devices");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 12, page: 1, pageSize: 10 });
    expect(names(response)).toEqual([
      "Device 01",
      "Device 02",
      "Device 03",
      "Device 04",
      "Device 05",
      "Device 06",
      "Device 07",
      "Device 08",
      "Device 09",
      "Device 10",
    ]);

    const lastPage = await agent.get("/api/devices?page=2");

    expect(names(lastPage)).toEqual(["Device 11", "Device 12"]);
    expect(lastPage.body.items[0].owner).toBeNull();
    expect(lastPage.body.items[1].owner).toMatchObject({ id: marko.id, name: marko.name });
  });

  it("supports 25 and 50 rows per page and rejects other sizes", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedDevices(agent, 26);

    const page25 = await agent.get("/api/devices?pageSize=25&page=2");
    const page50 = await agent.get("/api/devices?pageSize=50");

    expect(page25.body).toMatchObject({ total: 26, page: 2, pageSize: 25 });
    expect(names(page25)).toEqual(["Device 26"]);
    expect(page50.body.items).toHaveLength(26);
    expect((await agent.get("/api/devices?pageSize=20")).status).toBe(400);
    expect((await agent.get("/api/devices?page=0")).status).toBe(400);
  });

  it("sorts by name in descending order", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedDevices(agent, 3);

    const response = await agent.get("/api/devices?sortDir=desc");

    expect(names(response)).toEqual(["Device 03", "Device 02", "Device 01"]);
  });

  it("searches by name, ignoring case", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/devices").send({ name: "Samsung Galaxy S21" });
    await agent.post("/api/devices").send({ name: "iPhone 12" });

    const match = await agent.get("/api/devices?search=GALAXY");
    const noMatch = await agent.get("/api/devices?search=nokia");

    expect(names(match)).toEqual(["Samsung Galaxy S21"]);
    expect(noMatch.body).toMatchObject({ items: [], total: 0 });
  });

  it("filters by owner and by generic, combined with search and paging", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    await createNumberedDevices(agent, 12, marko.id);
    await agent.post("/api/devices").send({ name: "Ana's phone", ownerId: ana.id });
    await agent.post("/api/devices").send({ name: "Generic phone" });
    await agent.post("/api/devices").send({ name: "Generic laptop" });

    const markos = await agent.get(`/api/devices?ownerId=${marko.id}&page=2`);
    const anas = await agent.get(`/api/devices?ownerId=${ana.id}`);
    const generic = await agent.get("/api/devices?generic=true");
    const genericPhones = await agent.get("/api/devices?generic=true&search=phone");
    const all = await agent.get("/api/devices?generic=false");

    expect(markos.body).toMatchObject({ total: 12, page: 2 });
    expect(names(markos)).toEqual(["Device 11", "Device 12"]);
    expect(names(anas)).toEqual(["Ana's phone"]);
    expect(names(generic)).toEqual(["Generic laptop", "Generic phone"]);
    expect(names(genericPhones)).toEqual(["Generic phone"]);
    expect(all.body.total).toBe(15);
  });

  it("rejects an invalid owner filter, or asking for an owner and generic at once, with 400", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);

    expect((await agent.get("/api/devices?ownerId=nope")).status).toBe(400);
    expect((await agent.get("/api/devices?generic=yes")).status).toBe(400);
    expect((await agent.get(`/api/devices?ownerId=${marko.id}&generic=true`)).status).toBe(400);
  });
});
