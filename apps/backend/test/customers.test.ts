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

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

/** Creates customers "Customer 01" … "Customer NN" through the API, returning their ids. */
async function createNumberedCustomers(agent: TestAgent, count: number) {
  const ids: string[] = [];
  for (let n = 1; n <= count; n++) {
    const label = String(n).padStart(2, "0");
    const { body } = await agent
      .post("/api/customers")
      .send({ name: `Customer ${label}`, phone: `06000000${label}` });
    ids.push(body.id);
  }
  return ids;
}

function searchCustomers(agent: TestAgent, term: string) {
  return agent.get(`/api/customers?search=${encodeURIComponent(term)}`);
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

describe("customers: bulk delete", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp())
      .post("/api/customers/bulk-delete")
      .send({ ids: [UNKNOWN_ID] });

    expect(response.status).toBe(401);
  });

  it("deletes the named customers and keeps the rest", async () => {
    const { agent } = await authenticatedAgent();
    const [first, second, kept] = await createNumberedCustomers(agent, 3);

    const response = await agent.post("/api/customers/bulk-delete").send({ ids: [first, second] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedIds: [first, second], inUseIds: [] });
    expect((await agent.get(`/api/customers/${first}`)).status).toBe(404);
    expect((await agent.get(`/api/customers/${second}`)).status).toBe(404);
    expect((await agent.get(`/api/customers/${kept}`)).status).toBe(200);
  });

  it("keeps a customer who owns a device, reporting them as in use, and deletes the others", async () => {
    const { agent } = await authenticatedAgent();
    const [owner, other] = await createNumberedCustomers(agent, 2);
    await agent.post("/api/devices").send({ model: "iPhone 12", ownerId: owner });

    const response = await agent.post("/api/customers/bulk-delete").send({ ids: [owner, other] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedIds: [other], inUseIds: [owner] });
    expect((await agent.get(`/api/customers/${owner}`)).status).toBe(200);
    expect((await agent.get(`/api/customers/${other}`)).status).toBe(404);
  });

  it("skips ids that name no customer", async () => {
    const { agent } = await authenticatedAgent();
    const [customer] = await createNumberedCustomers(agent, 1);

    const response = await agent
      .post("/api/customers/bulk-delete")
      .send({ ids: [customer, UNKNOWN_ID] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedIds: [customer], inUseIds: [] });
  });

  it("rejects an empty, oversized or malformed list with 400, deleting nothing", async () => {
    const { agent } = await authenticatedAgent();
    const [customer] = await createNumberedCustomers(agent, 1);
    const tooMany = Array.from({ length: 51 }, () => customer);

    const empty = await agent.post("/api/customers/bulk-delete").send({ ids: [] });
    const oversized = await agent.post("/api/customers/bulk-delete").send({ ids: tooMany });
    const malformed = await agent
      .post("/api/customers/bulk-delete")
      .send({ ids: [customer, "not-a-uuid"] });

    for (const response of [empty, oversized, malformed]) {
      expect(response.status).toBe(400);
      expect(response.body.details.fieldErrors).toHaveProperty("ids");
    }
    expect((await agent.get(`/api/customers/${customer}`)).status).toBe(200);
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

  it("finds a +381 phone by its digits, with or without the country code", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send(MARKO);
    await agent.post("/api/customers").send({ name: "Servis Plus d.o.o.", phone: "024555666" });

    for (const term of ["0641234567", "064 123", "64123", "+38164123"]) {
      expect(names(await searchCustomers(agent, term)), term).toEqual(["Marko Marković"]);
    }
    expect(names(await searchCustomers(agent, "065 123"))).toEqual([]);
  });

  it("finds a national phone by its digits, ignoring separators and matching +381", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send({ name: "Ana Kovač", phone: "064/123-456" });
    await agent.post("/api/customers").send({ name: "Servis Plus d.o.o.", phone: "024555666" });

    for (const term of ["064123456", "+38164123456"]) {
      expect(names(await searchCustomers(agent, term)), term).toEqual(["Ana Kovač"]);
    }
  });

  it("reads a +381 term as the start of a number, not anywhere in it", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send({ name: "Ana Kovač", phone: "064 1206 333" });
    await agent.post("/api/customers").send({ name: "Bojan Ilić", phone: "011 333 0644" });

    expect(names(await searchCustomers(agent, "+3816"))).toEqual(["Ana Kovač"]);
    expect(names(await searchCustomers(agent, "+381 64 1206"))).toEqual(["Ana Kovač"]);
  });

  it("leaves stored phones as entered when searching by digits", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send(MARKO);

    const response = await searchCustomers(agent, "0641234567");

    expect(response.body.items[0].phone).toBe("+381 64 123 4567");
  });

  it("does not match phones by the digits of a name search", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send({ name: "Customer 01", phone: "0600000099" });
    await agent.post("/api/customers").send({ name: "Ana Kovač", phone: "0601000000" });

    const response = await searchCustomers(agent, "customer 01");

    expect(names(response)).toEqual(["Customer 01"]);
  });

  it("lists only the customers that match every word, each in any field", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send(MARKO);
    await agent.post("/api/customers").send({ name: "Marko Petrović", phone: "0651112233" });
    await agent.post("/api/customers").send({ name: "Ana Kovač", phone: "0649998877" });

    expect(names(await searchCustomers(agent, "Marko 064"))).toEqual(["Marko Marković"]);
    expect(names(await searchCustomers(agent, "marko example.com"))).toEqual(["Marko Marković"]);
  });

  it("keeps adjacent phone-like words together as one piece of a number", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send(MARKO);
    await agent.post("/api/customers").send({ name: "Marko Petrović", phone: "064 999 1230" });

    expect(names(await searchCustomers(agent, "Marko 064 123"))).toEqual(["Marko Marković"]);
  });

  it("keeps a +381 run the start of a number", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/customers").send({ name: "Ana Kovač", phone: "064 1206 333" });
    await agent.post("/api/customers").send({ name: "Bojan Ilić", phone: "011 333 0644" });

    expect(names(await searchCustomers(agent, "+381 64"))).toEqual(["Ana Kovač"]);
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
