import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type TestAgent from "supertest/lib/agent.js";
import { authenticatedAgent } from "./helpers.js";

const MARKO = {
  name: "Marko Marković",
  phone: "+381 64 123 4567",
  email: "marko@example.com",
  address: "Glavna 1, Subotica",
  facebook: "marko.markovic",
};

/** Creates customers "Customer 01" … "Customer NN" through the API. */
async function createNumberedCustomers(agent: TestAgent, count: number) {
  for (let n = 1; n <= count; n++) {
    const label = String(n).padStart(2, "0");
    await agent
      .post("/api/customers")
      .send({ name: `Customer ${label}`, phone: `06000000${label}` });
  }
}

function names(response: { body: { items: { name: string }[] } }) {
  return response.body.items.map(({ name }) => name);
}

describe("customers: create and read", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get("/api/customers");

    expect(response.status).toBe(401);
  });

  it("creates a customer that can then be read back", async () => {
    const { agent } = await authenticatedAgent();

    const created = await agent.post("/api/customers").send(MARKO);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(MARKO);
    expect(created.body.id).toEqual(expect.any(String));

    const read = await agent.get(`/api/customers/${created.body.id}`);

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ id: created.body.id, ...MARKO });
  });

  it("rejects a customer without a phone with 400", async () => {
    const { agent } = await authenticatedAgent();

    const missing = await agent.post("/api/customers").send({ name: "Marko Marković" });
    const blank = await agent.post("/api/customers").send({ name: "Marko Marković", phone: "  " });

    expect(missing.status).toBe(400);
    expect(missing.body.details.fieldErrors).toHaveProperty("phone");
    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors).toHaveProperty("phone");
  });

  it("stores only a name and phone, with blank optional fields as null", async () => {
    const { agent } = await authenticatedAgent();

    const created = await agent
      .post("/api/customers")
      .send({ name: " Ana ", phone: "0641112233", email: "", address: " ", facebook: "" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: "Ana",
      phone: "0641112233",
      email: null,
      address: null,
      facebook: null,
    });
  });

  it("rejects a malformed email with 400", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.post("/api/customers").send({ ...MARKO, email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.details.fieldErrors).toHaveProperty("email");
  });

  it("returns 404 for an unknown customer", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent.get("/api/customers/00000000-0000-4000-8000-000000000000");
    const malformed = await agent.get("/api/customers/not-a-uuid");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("customers: update and delete", () => {
  it("replaces a customer's details on update", async () => {
    const { agent } = await authenticatedAgent();
    const { body: marko } = await agent.post("/api/customers").send(MARKO);

    const updated = await agent
      .put(`/api/customers/${marko.id}`)
      .send({ name: "Marko M.", phone: "+381 63 000 000", email: "", address: "Nova 2" });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: marko.id,
      name: "Marko M.",
      phone: "+381 63 000 000",
      email: null,
      address: "Nova 2",
      facebook: null,
    });

    const read = await agent.get(`/api/customers/${marko.id}`);
    expect(read.body).toMatchObject({ name: "Marko M.", address: "Nova 2", facebook: null });
  });

  it("rejects an update that removes the phone with 400", async () => {
    const { agent } = await authenticatedAgent();
    const { body: marko } = await agent.post("/api/customers").send(MARKO);

    const response = await agent.put(`/api/customers/${marko.id}`).send({ ...MARKO, phone: "" });

    expect(response.status).toBe(400);
    expect(response.body.details.fieldErrors).toHaveProperty("phone");
  });

  it("returns 404 when updating an unknown customer", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent
      .put("/api/customers/00000000-0000-4000-8000-000000000000")
      .send(MARKO);

    expect(response.status).toBe(404);
  });

  it("deletes a customer", async () => {
    const { agent } = await authenticatedAgent();
    const { body: marko } = await agent.post("/api/customers").send(MARKO);

    const deleted = await agent.delete(`/api/customers/${marko.id}`);

    expect(deleted.status).toBe(204);
    expect((await agent.get(`/api/customers/${marko.id}`)).status).toBe(404);
  });

  it("refuses with 409 to delete a customer who still owns a device", async () => {
    const { agent } = await authenticatedAgent();
    const { body: marko } = await agent.post("/api/customers").send(MARKO);
    const { body: device } = await agent
      .post("/api/devices")
      .send({ manufacturer: "Apple", model: "iPhone 12", ownerId: marko.id });

    const response = await agent.delete(`/api/customers/${marko.id}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CUSTOMER_IN_USE");
    expect((await agent.get(`/api/customers/${marko.id}`)).status).toBe(200);
    expect((await agent.get(`/api/devices/${device.id}`)).body).toMatchObject({
      owner: { id: marko.id },
    });
  });

  it("returns 404 when deleting an unknown customer", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent.delete("/api/customers/00000000-0000-4000-8000-000000000000");
    const malformed = await agent.delete("/api/customers/not-a-uuid");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("customers: paged list", () => {
  it("returns the first 10 customers by name with the total count", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedCustomers(agent, 12);

    const response = await agent.get("/api/customers");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 12, page: 1, pageSize: 10 });
    expect(names(response)).toEqual([
      "Customer 01",
      "Customer 02",
      "Customer 03",
      "Customer 04",
      "Customer 05",
      "Customer 06",
      "Customer 07",
      "Customer 08",
      "Customer 09",
      "Customer 10",
    ]);
  });

  it("returns later pages by offset", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedCustomers(agent, 12);

    const response = await agent.get("/api/customers?page=2&pageSize=10");

    expect(response.body).toMatchObject({ total: 12, page: 2, pageSize: 10 });
    expect(names(response)).toEqual(["Customer 11", "Customer 12"]);
  });

  it("supports 25 and 50 rows per page", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedCustomers(agent, 55);

    const page25 = await agent.get("/api/customers?pageSize=25&page=3");
    const page50 = await agent.get("/api/customers?pageSize=50");

    expect(page25.body).toMatchObject({ total: 55, page: 3, pageSize: 25 });
    expect(names(page25)).toEqual([
      "Customer 51",
      "Customer 52",
      "Customer 53",
      "Customer 54",
      "Customer 55",
    ]);
    expect(page50.body.items).toHaveLength(50);
    expect(names(page50).at(-1)).toBe("Customer 50");
  });

  it("rejects other page sizes and invalid pages with 400", async () => {
    const { agent } = await authenticatedAgent();

    expect((await agent.get("/api/customers?pageSize=20")).status).toBe(400);
    expect((await agent.get("/api/customers?pageSize=1000")).status).toBe(400);
    expect((await agent.get("/api/customers?page=0")).status).toBe(400);
    expect((await agent.get("/api/customers?page=abc")).status).toBe(400);
  });

  it("sorts by name in descending order", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedCustomers(agent, 3);

    const response = await agent.get("/api/customers?sortDir=desc");

    expect(names(response)).toEqual(["Customer 03", "Customer 02", "Customer 01"]);
  });

  it("searches by name, phone and email, ignoring case", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send(MARKO);
    await agent.post("/api/customers").send({ name: "Ana Kovač", phone: "0631234567" });
    await agent
      .post("/api/customers")
      .send({ name: "Servis Plus d.o.o.", phone: "024555666", email: "office@servisplus.rs" });

    const byName = await agent.get("/api/customers?search=marković");
    const byPhone = await agent.get("/api/customers?search=0631234");
    const byEmail = await agent.get("/api/customers?search=SERVISPLUS.rs");
    const noMatch = await agent.get("/api/customers?search=nobody");

    expect(names(byName)).toEqual(["Marko Marković"]);
    expect(names(byPhone)).toEqual(["Ana Kovač"]);
    expect(names(byEmail)).toEqual(["Servis Plus d.o.o."]);
    expect(noMatch.body).toMatchObject({ items: [], total: 0 });
  });

  it("pages through search results with the filtered total", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedCustomers(agent, 12);
    await agent.post("/api/customers").send(MARKO);

    const response = await agent.get("/api/customers?search=customer&page=2");

    expect(response.body).toMatchObject({ total: 12, page: 2 });
    expect(names(response)).toEqual(["Customer 11", "Customer 12"]);
  });
});
