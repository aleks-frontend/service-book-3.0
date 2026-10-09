import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function createCustomer(agent: TestAgent, name = "Marko Marković") {
  const { body } = await agent.post("/api/customers").send({ name, phone: "0641234567" });
  return body as { id: string; name: string; phone: string };
}

async function createDevice(agent: TestAgent, device: Record<string, unknown>) {
  const { body } = await agent.post("/api/devices").send(device);
  return body as { id: string };
}

/** A customer with one device of their own, ready to bring in for service. */
async function customerWithDevice(agent: TestAgent, name?: string) {
  const customer = await createCustomer(agent, name);
  const device = await createDevice(agent, {
    manufacturer: "Samsung",
    model: "Galaxy S21",
    ownerId: customer.id,
  });
  return { customer, device };
}

async function createService(agent: TestAgent, service: Record<string, unknown>) {
  const response = await agent.post("/api/services").send(service);
  if (response.status !== 201) {
    throw new Error(`Creating a service failed with ${response.status}`);
  }
  return response.body as { id: string; number: string; publicToken: string };
}

describe("services: create", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const list = await request(createApp()).get("/api/services");
    const create = await request(createApp()).post("/api/services").send({});

    expect(list.status).toBe(401);
    expect(create.status).toBe(401);
  });

  it("creates a Received service for a customer's device, read back with its details", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);
    const generic = await createDevice(agent, { model: "USB-C cable" });

    const created = await agent.post("/api/services").send({
      customerId: customer.id,
      deviceIds: [device.id, generic.id],
      description: " Screen cracked ",
      date: "2026-03-14",
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      number: "2026-0001",
      date: "2026-03-14",
      description: "Screen cracked",
      status: "RECEIVED",
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      devices: [
        {
          id: device.id,
          manufacturer: "Samsung",
          model: "Galaxy S21",
          owner: { id: customer.id },
        },
        { id: generic.id, manufacturer: null, model: "USB-C cable", owner: null },
      ],
    });
    expect(created.body.publicToken).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(created.body).not.toHaveProperty("legacyId");

    const read = await agent.get(`/api/services/${created.body.id}`);

    expect(read.status).toBe(200);
    expect(read.body).toEqual(created.body);
  });
});

describe("services: service number and public token", () => {
  it("numbers services sequentially within the year of their date, restarting each year", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);
    const on = (date: string) => ({ customerId: customer.id, deviceIds: [device.id], date });

    const numbers = [];
    for (const date of ["2025-12-30", "2025-12-31", "2026-01-01", "2025-06-01", "2026-01-02"]) {
      numbers.push((await createService(agent, on(date))).number);
    }

    expect(numbers).toEqual(["2025-0001", "2025-0002", "2026-0001", "2025-0003", "2026-0002"]);
  });

  it("never hands out the same number twice under concurrent creates", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        agent
          .post("/api/services")
          .send({ customerId: customer.id, deviceIds: [device.id], date: "2026-05-05" }),
      ),
    );

    expect(responses.map(({ status }) => status)).toEqual(Array(10).fill(201));
    const numbers = responses.map(({ body }) => body.number).sort();
    expect(numbers).toEqual([
      "2026-0001",
      "2026-0002",
      "2026-0003",
      "2026-0004",
      "2026-0005",
      "2026-0006",
      "2026-0007",
      "2026-0008",
      "2026-0009",
      "2026-0010",
    ]);
  });

  it("gives every service a different public token", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);

    const tokens = new Set();
    for (let n = 0; n < 5; n++) {
      const service = await createService(agent, {
        customerId: customer.id,
        deviceIds: [device.id],
        date: "2026-05-05",
      });
      expect(service.publicToken).toMatch(/^[A-Za-z0-9_-]{12}$/);
      tokens.add(service.publicToken);
    }

    expect(tokens.size).toBe(5);
  });

  it("keeps the number when the date later moves to another year", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);
    const service = await createService(agent, {
      customerId: customer.id,
      deviceIds: [device.id],
      date: "2026-01-01",
    });

    const moved = await agent
      .put(`/api/services/${service.id}`)
      .send({ customerId: customer.id, deviceIds: [device.id], date: "2025-12-31" });
    const next = await createService(agent, {
      customerId: customer.id,
      deviceIds: [device.id],
      date: "2025-12-31",
    });

    expect(moved.body).toMatchObject({ number: "2026-0001", date: "2025-12-31" });
    expect(next.number).toBe("2025-0001");
  });
});

describe("services: update", () => {
  it("replaces the customer, devices, description and date, keeping number, token and status", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await customerWithDevice(agent, "Marko");
    const ana = await customerWithDevice(agent, "Ana");
    const cable = await createDevice(agent, { model: "USB-C cable" });
    const service = await createService(agent, {
      customerId: marko.customer.id,
      deviceIds: [marko.device.id],
      description: "Screen cracked",
      date: "2026-03-14",
    });

    const updated = await agent.put(`/api/services/${service.id}`).send({
      customerId: ana.customer.id,
      deviceIds: [cable.id, ana.device.id],
      date: "2026-03-15",
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: service.id,
      number: service.number,
      publicToken: service.publicToken,
      status: "RECEIVED",
      customer: { id: ana.customer.id, name: "Ana" },
      devices: [{ id: cable.id }, { id: ana.device.id }],
      description: null,
      date: "2026-03-15",
    });
    expect((await agent.get(`/api/services/${service.id}`)).body).toEqual(updated.body);
  });

  it("returns 404 when updating an unknown service", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);

    const response = await agent
      .put(`/api/services/${UNKNOWN_ID}`)
      .send({ customerId: customer.id, deviceIds: [device.id], date: "2026-03-14" });

    expect(response.status).toBe(404);
  });
});

describe("services: validation", () => {
  it("rejects a service without a valid customer, devices or date with 400", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);
    const valid = { customerId: customer.id, deviceIds: [device.id], date: "2026-03-14" };

    const cases = {
      customerId: [
        { ...valid, customerId: undefined },
        { ...valid, customerId: UNKNOWN_ID },
      ],
      deviceIds: [
        { ...valid, deviceIds: [] },
        { ...valid, deviceIds: ["not-a-uuid"] },
        { ...valid, deviceIds: [device.id, UNKNOWN_ID] },
      ],
      date: [
        { ...valid, date: undefined },
        { ...valid, date: "14.03.2026" },
        { ...valid, date: "2026-02-30" },
      ],
    };

    for (const [field, bodies] of Object.entries(cases)) {
      for (const body of bodies) {
        const response = await agent.post("/api/services").send(body);
        expect(response.status, JSON.stringify(body)).toBe(400);
        expect(response.body.details.fieldErrors).toHaveProperty(field);
      }
    }
    expect((await agent.get("/api/services")).body.items).toEqual([]);
  });

  it("rejects a device owned by another customer, on create and on update", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await customerWithDevice(agent, "Marko");
    const ana = await customerWithDevice(agent, "Ana");
    const service = await createService(agent, {
      customerId: marko.customer.id,
      deviceIds: [marko.device.id],
      date: "2026-03-14",
    });

    const created = await agent
      .post("/api/services")
      .send({ customerId: marko.customer.id, deviceIds: [ana.device.id], date: "2026-03-14" });
    // Moving the service to Ana without swapping Marko's device.
    const updated = await agent
      .put(`/api/services/${service.id}`)
      .send({ customerId: ana.customer.id, deviceIds: [marko.device.id], date: "2026-03-14" });

    for (const response of [created, updated]) {
      expect(response.status).toBe(400);
      expect(response.body.details.fieldErrors).toHaveProperty("deviceIds");
    }
    expect((await agent.get(`/api/services/${service.id}`)).body).toMatchObject({
      customer: { id: marko.customer.id },
      devices: [{ id: marko.device.id }],
    });
  });

  it("attaches a device named twice only once", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);

    const created = await agent
      .post("/api/services")
      .send({ customerId: customer.id, deviceIds: [device.id, device.id], date: "2026-03-14" });

    expect(created.status).toBe(201);
    expect(created.body.devices).toHaveLength(1);
  });
});

describe("services: list", () => {
  /** Creates services on the given dates, in that order, for one customer's device. */
  async function servicesOn(agent: TestAgent, dates: string[]) {
    const { customer, device } = await customerWithDevice(agent);
    for (const date of dates) {
      await createService(agent, { customerId: customer.id, deviceIds: [device.id], date });
    }
  }

  const numbers = (response: { body: { items: { number: string }[] } }) =>
    response.body.items.map(({ number }) => number);

  it("lists services newest first by date, then by number, with customer and devices", async () => {
    const { agent } = await authenticatedAgent();
    await servicesOn(agent, ["2026-03-01", "2026-03-03", "2026-03-02", "2026-03-03"]);

    const response = await agent.get("/api/services");

    expect(response.status).toBe(200);
    expect(numbers(response)).toEqual(["2026-0004", "2026-0002", "2026-0003", "2026-0001"]);
    expect(response.body.nextCursor).toBeNull();
    expect(response.body.items[0]).toMatchObject({
      date: "2026-03-03",
      status: "RECEIVED",
      customer: { name: "Marko Marković" },
      devices: [{ manufacturer: "Samsung", model: "Galaxy S21" }],
    });
  });

  it("pages through every service with a cursor, 20 at a time by default", async () => {
    const { agent } = await authenticatedAgent();
    const dates = Array.from(
      { length: 45 },
      (_, n) => `2026-04-${String((n % 30) + 1).padStart(2, "0")}`,
    );
    await servicesOn(agent, dates);

    const seen: string[] = [];
    let cursor: string | null = null;
    const pageSizes: number[] = [];
    do {
      const response = await agent.get(
        `/api/services${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      expect(response.status).toBe(200);
      pageSizes.push(response.body.items.length);
      seen.push(...numbers(response));
      cursor = response.body.nextCursor;
    } while (cursor);

    expect(pageSizes).toEqual([20, 20, 5]);
    expect(new Set(seen).size).toBe(45);
    // 30 April down to 16 April have one service each; 15 April has two, the later number first.
    expect(seen[0]).toBe("2026-0030");
    expect(seen.slice(14, 17)).toEqual(["2026-0016", "2026-0045", "2026-0015"]);
  });

  it("honours a smaller page size and keeps paging stable when a service is deleted", async () => {
    const { agent } = await authenticatedAgent();
    await servicesOn(agent, ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04"]);

    const first = await agent.get("/api/services?limit=2");
    const [, last] = first.body.items as { id: string }[];
    await agent.delete(`/api/services/${last.id}`);
    const second = await agent.get(
      `/api/services?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
    );

    expect(numbers(first)).toEqual(["2026-0004", "2026-0003"]);
    expect(numbers(second)).toEqual(["2026-0002", "2026-0001"]);
  });

  it("rejects an invalid page size or cursor with 400", async () => {
    const { agent } = await authenticatedAgent();

    expect((await agent.get("/api/services?limit=0")).status).toBe(400);
    expect((await agent.get("/api/services?limit=51")).status).toBe(400);
    expect((await agent.get("/api/services?cursor=garbage")).status).toBe(400);
  });
});

describe("services: delete", () => {
  it("deletes a service, keeping its customer and devices", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);
    const service = await createService(agent, {
      customerId: customer.id,
      deviceIds: [device.id],
      date: "2026-03-14",
    });

    const deleted = await agent.delete(`/api/services/${service.id}`);

    expect(deleted.status).toBe(204);
    expect((await agent.get(`/api/services/${service.id}`)).status).toBe(404);
    expect((await agent.get("/api/services")).body.items).toEqual([]);
    expect((await agent.get(`/api/customers/${customer.id}`)).status).toBe(200);
    expect((await agent.get(`/api/devices/${device.id}`)).status).toBe(200);
  });

  it("returns 404 for an unknown service", async () => {
    const { agent } = await authenticatedAgent();

    expect((await agent.get(`/api/services/${UNKNOWN_ID}`)).status).toBe(404);
    expect((await agent.get("/api/services/not-a-uuid")).status).toBe(404);
    expect((await agent.delete(`/api/services/${UNKNOWN_ID}`)).status).toBe(404);
    expect((await agent.delete("/api/services/not-a-uuid")).status).toBe(404);
  });

  it("refuses to delete a device attached to a service, or a customer with services, with 409", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent);
    const cable = await createDevice(agent, { model: "USB-C cable" });
    const service = await createService(agent, {
      customerId: marko.id,
      deviceIds: [cable.id],
      date: "2026-03-14",
    });

    const device = await agent.delete(`/api/devices/${cable.id}`);
    const bulk = await agent.post("/api/devices/bulk-delete").send({ ids: [cable.id] });
    const customer = await agent.delete(`/api/customers/${marko.id}`);

    expect(device.status).toBe(409);
    expect(device.body.code).toBe("DEVICE_IN_USE");
    expect(bulk.body).toEqual({ deletedIds: [], inUseIds: [cable.id] });
    expect(customer.status).toBe(409);
    expect(customer.body.code).toBe("CUSTOMER_IN_USE");

    // Once the service is gone, both can go.
    await agent.delete(`/api/services/${service.id}`);
    expect((await agent.delete(`/api/devices/${cable.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/customers/${marko.id}`)).status).toBe(204);
  });
});
