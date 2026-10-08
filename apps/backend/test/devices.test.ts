import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type TestAgent from "supertest/lib/agent.js";
import { authenticatedAgent } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

const GALAXY = {
  manufacturer: "Samsung",
  model: "Galaxy S21",
  serialNumber: "R58N1234ABC",
  description: "Blue, 128 GB",
};

async function createCustomer(agent: TestAgent, name = "Marko Marković") {
  const { body } = await agent.post("/api/customers").send({ name, phone: "0641234567" });
  return body as { id: string; name: string; phone: string };
}

async function createDevice(agent: TestAgent, device: Record<string, unknown>) {
  const { body } = await agent.post("/api/devices").send(device);
  return body as { id: string };
}

/** Creates devices with models "Device 01" … "Device NN" through the API. */
async function createNumberedDevices(agent: TestAgent, count: number, ownerId?: string) {
  const ids: string[] = [];
  for (let n = 1; n <= count; n++) {
    const label = String(n).padStart(2, "0");
    ids.push((await createDevice(agent, { model: `Device ${label}`, ownerId })).id);
  }
  return ids;
}

type DeviceRow = { manufacturer: string | null; model: string };

/** The listed devices as staff members see them: manufacturer, then model. */
function labels(response: { body: { items: DeviceRow[] } }) {
  return response.body.items.map(({ manufacturer, model }) =>
    [manufacturer, model].filter(Boolean).join(" "),
  );
}

describe("devices: create and read", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get("/api/devices");
    const bulk = await request(createApp())
      .post("/api/devices/bulk-delete")
      .send({ ids: [UNKNOWN_ID] });

    expect(response.status).toBe(401);
    expect(bulk.status).toBe(401);
  });

  it("creates a generic device with every field, then reads it back", async () => {
    const { agent } = await authenticatedAgent();

    const created = await agent.post("/api/devices").send({
      manufacturer: " Samsung ",
      model: " Galaxy S21 ",
      serialNumber: " R58N1234ABC ",
      description: " Blue, 128 GB ",
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...GALAXY, owner: null });
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body).not.toHaveProperty("name");
    expect(created.body).not.toHaveProperty("legacyId");

    const read = await agent.get(`/api/devices/${created.body.id}`);

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ id: created.body.id, ...GALAXY, owner: null });
  });

  it("stores a device with only a model, with blank optional fields as null", async () => {
    const { agent } = await authenticatedAgent();

    const created = await agent
      .post("/api/devices")
      .send({ manufacturer: " ", model: "USB-C cable", serialNumber: "", description: "" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      manufacturer: null,
      model: "USB-C cable",
      serialNumber: null,
      description: null,
    });
  });

  it("allows two devices with the same serial number", async () => {
    const { agent } = await authenticatedAgent();

    const first = await agent.post("/api/devices").send(GALAXY);
    const second = await agent.post("/api/devices").send(GALAXY);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("creates a device owned by a customer, read back with the owner", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);

    const created = await agent
      .post("/api/devices")
      .send({ manufacturer: "Apple", model: "iPhone 12", ownerId: marko.id });

    expect(created.status).toBe(201);
    const owner = { id: marko.id, name: marko.name, phone: marko.phone };
    expect(created.body).toMatchObject({ model: "iPhone 12", owner });

    const read = await agent.get(`/api/devices/${created.body.id}`);

    expect(read.body).toMatchObject({ model: "iPhone 12", owner });
  });

  it("rejects a device without a model with 400", async () => {
    const { agent } = await authenticatedAgent();

    const missing = await agent.post("/api/devices").send({ manufacturer: "Samsung" });
    const blank = await agent.post("/api/devices").send({ manufacturer: "Samsung", model: "  " });

    expect(missing.status).toBe(400);
    expect(missing.body.details.fieldErrors).toHaveProperty("model");
    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors).toHaveProperty("model");
  });

  it("rejects an owner that is not a customer with 400", async () => {
    const { agent } = await authenticatedAgent();

    const malformed = await agent.post("/api/devices").send({ model: "iPhone", ownerId: "nope" });
    const unknown = await agent.post("/api/devices").send({ model: "iPhone", ownerId: UNKNOWN_ID });

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
  it("replaces a device's details, giving it an owner and then making it generic again", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    const device = await createDevice(agent, GALAXY);

    const owned = await agent
      .put(`/api/devices/${device.id}`)
      .send({ manufacturer: "Lenovo", model: "ThinkPad T480", ownerId: marko.id });

    expect(owned.status).toBe(200);
    expect(owned.body).toMatchObject({
      id: device.id,
      manufacturer: "Lenovo",
      model: "ThinkPad T480",
      serialNumber: null,
      description: null,
      owner: { id: marko.id, name: marko.name },
    });

    const generic = await agent
      .put(`/api/devices/${device.id}`)
      .send({ manufacturer: "Lenovo", model: "ThinkPad T480", ownerId: null });

    expect(generic.status).toBe(200);
    expect(generic.body).toMatchObject({ owner: null });
    expect((await agent.get(`/api/devices/${device.id}`)).body).toMatchObject({ owner: null });
  });

  it("moves a device to another owner", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const device = await createDevice(agent, { model: "iPhone 12", ownerId: marko.id });

    const moved = await agent
      .put(`/api/devices/${device.id}`)
      .send({ model: "iPhone 12", ownerId: ana.id });

    expect(moved.status).toBe(200);
    expect(moved.body.owner).toMatchObject({ id: ana.id, name: "Ana" });
  });

  it("rejects an update without a model or with an unknown owner with 400", async () => {
    const { agent } = await authenticatedAgent();
    const device = await createDevice(agent, { model: "iPhone 12" });

    const blank = await agent.put(`/api/devices/${device.id}`).send({ model: "" });
    const unknownOwner = await agent
      .put(`/api/devices/${device.id}`)
      .send({ model: "iPhone 12", ownerId: UNKNOWN_ID });

    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors).toHaveProperty("model");
    expect(unknownOwner.status).toBe(400);
    expect(unknownOwner.body.details.fieldErrors).toHaveProperty("ownerId");
  });

  it("returns 404 when updating an unknown device", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.put(`/api/devices/${UNKNOWN_ID}`).send({ model: "iPhone 12" });

    expect(response.status).toBe(404);
  });

  it("deletes a generic device and an owned device", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    const generic = await createDevice(agent, { model: "Generic" });
    const owned = await createDevice(agent, { model: "Owned", ownerId: marko.id });

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

describe("devices: bulk delete", () => {
  it("deletes the named devices and keeps the rest", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    const [first, second, kept] = await createNumberedDevices(agent, 3, marko.id);

    const response = await agent.post("/api/devices/bulk-delete").send({ ids: [first, second] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedIds: [first, second], inUseIds: [] });
    expect((await agent.get(`/api/devices/${first}`)).status).toBe(404);
    expect((await agent.get(`/api/devices/${second}`)).status).toBe(404);
    expect((await agent.get(`/api/devices/${kept}`)).status).toBe(200);
    // The owner stays.
    expect((await agent.get(`/api/customers/${marko.id}`)).status).toBe(200);
  });

  it("skips ids that name no device, including repeats", async () => {
    const { agent } = await authenticatedAgent();
    const [device] = await createNumberedDevices(agent, 1);

    const response = await agent
      .post("/api/devices/bulk-delete")
      .send({ ids: [device, UNKNOWN_ID, device] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedIds: [device], inUseIds: [] });
  });

  it("accepts up to 50 ids", async () => {
    const { agent } = await authenticatedAgent();
    const ids = await createNumberedDevices(agent, 50);

    const response = await agent.post("/api/devices/bulk-delete").send({ ids });

    expect(response.status).toBe(200);
    expect(response.body.deletedIds).toHaveLength(50);
    expect((await agent.get("/api/devices")).body.total).toBe(0);
  });

  it("rejects an empty, oversized or malformed list with 400, deleting nothing", async () => {
    const { agent } = await authenticatedAgent();
    const [device] = await createNumberedDevices(agent, 1);
    const tooMany = Array.from({ length: 51 }, () => device);

    const missing = await agent.post("/api/devices/bulk-delete").send({});
    const empty = await agent.post("/api/devices/bulk-delete").send({ ids: [] });
    const oversized = await agent.post("/api/devices/bulk-delete").send({ ids: tooMany });
    const malformed = await agent
      .post("/api/devices/bulk-delete")
      .send({ ids: [device, "not-a-uuid"] });

    for (const response of [missing, empty, oversized, malformed]) {
      expect(response.status).toBe(400);
      expect(response.body.details.fieldErrors).toHaveProperty("ids");
    }
    expect((await agent.get(`/api/devices/${device}`)).status).toBe(200);
  });
});

describe("devices: paged list", () => {
  it("returns the first 10 devices by model with the total count and owners", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    await createNumberedDevices(agent, 11);
    await createDevice(agent, { model: "Device 12", ownerId: marko.id });

    const response = await agent.get("/api/devices");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 12, page: 1, pageSize: 10 });
    expect(labels(response)).toEqual([
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

    expect(labels(lastPage)).toEqual(["Device 11", "Device 12"]);
    expect(lastPage.body.items[0].owner).toBeNull();
    expect(lastPage.body.items[1].owner).toMatchObject({ id: marko.id, name: marko.name });
  });

  it("supports 25 and 50 rows per page and rejects other sizes", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedDevices(agent, 26);

    const page25 = await agent.get("/api/devices?pageSize=25&page=2");
    const page50 = await agent.get("/api/devices?pageSize=50");

    expect(page25.body).toMatchObject({ total: 26, page: 2, pageSize: 25 });
    expect(labels(page25)).toEqual(["Device 26"]);
    expect(page50.body.items).toHaveLength(26);
    expect((await agent.get("/api/devices?pageSize=20")).status).toBe(400);
    expect((await agent.get("/api/devices?page=0")).status).toBe(400);
  });

  it("sorts by manufacturer, then model, in either direction", async () => {
    const { agent } = await authenticatedAgent();
    await createDevice(agent, { manufacturer: "Samsung", model: "Galaxy S21" });
    await createDevice(agent, { manufacturer: "Apple", model: "iPhone 12" });
    await createDevice(agent, { manufacturer: "Apple", model: "iPad Air" });

    const ascending = await agent.get("/api/devices");
    const descending = await agent.get("/api/devices?sortDir=desc");

    expect(labels(ascending)).toEqual(["Apple iPad Air", "Apple iPhone 12", "Samsung Galaxy S21"]);
    expect(labels(descending)).toEqual(["Samsung Galaxy S21", "Apple iPhone 12", "Apple iPad Air"]);
  });

  it("searches manufacturer, model and serial number, ignoring case", async () => {
    const { agent } = await authenticatedAgent();
    await createDevice(agent, GALAXY);
    await createDevice(agent, { manufacturer: "Apple", model: "iPhone 12", serialNumber: "F2LX9" });
    await createDevice(agent, { model: "USB-C cable" });

    const byManufacturer = await agent.get("/api/devices?search=SAMSUNG");
    const byModel = await agent.get("/api/devices?search=cable");
    const bySerial = await agent.get("/api/devices?search=f2lx");
    const noMatch = await agent.get("/api/devices?search=nokia");

    expect(labels(byManufacturer)).toEqual(["Samsung Galaxy S21"]);
    expect(labels(byModel)).toEqual(["USB-C cable"]);
    expect(labels(bySerial)).toEqual(["Apple iPhone 12"]);
    expect(noMatch.body).toMatchObject({ items: [], total: 0 });
  });

  it("matches a search of several words only when every word matches some field", async () => {
    const { agent } = await authenticatedAgent();
    await createDevice(agent, GALAXY);
    await createDevice(agent, { manufacturer: "Samsung", model: "Galaxy Tab A" });
    await createDevice(agent, { manufacturer: "Xiaomi", model: "Redmi S21" });

    const both = await agent.get(`/api/devices?search=${encodeURIComponent("samsung  s21")}`);
    const neither = await agent.get(`/api/devices?search=${encodeURIComponent("apple s21")}`);

    expect(labels(both)).toEqual(["Samsung Galaxy S21"]);
    expect(neither.body.total).toBe(0);
  });

  it("filters by owner and by generic, combined with search and paging", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    await createNumberedDevices(agent, 12, marko.id);
    await createDevice(agent, { model: "Ana's phone", ownerId: ana.id });
    await createDevice(agent, { model: "Generic phone" });
    await createDevice(agent, { model: "Generic laptop" });

    const markos = await agent.get(`/api/devices?ownerId=${marko.id}&page=2`);
    const anas = await agent.get(`/api/devices?ownerId=${ana.id}`);
    const generic = await agent.get("/api/devices?generic=true");
    const genericPhones = await agent.get("/api/devices?generic=true&search=phone");
    const all = await agent.get("/api/devices?generic=false");

    expect(markos.body).toMatchObject({ total: 12, page: 2 });
    expect(labels(markos)).toEqual(["Device 11", "Device 12"]);
    expect(labels(anas)).toEqual(["Ana's phone"]);
    expect(labels(generic)).toEqual(["Generic laptop", "Generic phone"]);
    expect(labels(genericPhones)).toEqual(["Generic phone"]);
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
