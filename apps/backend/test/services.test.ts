import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function createCustomer(agent: TestAgent, name = "Marko Marković", phone = "0641234567") {
  const { body } = await agent.post("/api/customers").send({ name, phone });
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

describe("services: customer report", () => {
  async function newService(agent: TestAgent) {
    const { customer, device } = await customerWithDevice(agent);
    return createService(agent, {
      customerId: customer.id,
      deviceIds: [device.id],
      description: "Screen cracked",
      date: "2026-03-14",
    });
  }

  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp())
      .put(`/api/services/${UNKNOWN_ID}/customer-report`)
      .send({ customerReport: "Replaced the screen." });

    expect(response.status).toBe(401);
  });

  it("starts empty, is saved trimmed and is returned with the service", async () => {
    const { agent } = await authenticatedAgent();
    const service = await newService(agent);
    expect((await agent.get(`/api/services/${service.id}`)).body.customerReport).toBeNull();

    const saved = await agent
      .put(`/api/services/${service.id}/customer-report`)
      .send({ customerReport: " Replaced the screen.\nTested the touch. " });

    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      id: service.id,
      description: "Screen cracked",
      customerReport: "Replaced the screen.\nTested the touch.",
    });
    expect((await agent.get(`/api/services/${service.id}`)).body).toEqual(saved.body);
  });

  it("is cleared by a blank report and kept by an edit of the service's details", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, device } = await customerWithDevice(agent);
    const service = await createService(agent, {
      customerId: customer.id,
      deviceIds: [device.id],
      date: "2026-03-14",
    });
    await agent
      .put(`/api/services/${service.id}/customer-report`)
      .send({ customerReport: "Replaced the screen." });

    const edited = await agent
      .put(`/api/services/${service.id}`)
      .send({ customerId: customer.id, deviceIds: [device.id], date: "2026-03-15" });
    expect(edited.body.customerReport).toBe("Replaced the screen.");

    const cleared = await agent
      .put(`/api/services/${service.id}/customer-report`)
      .send({ customerReport: "   " });
    expect(cleared.status).toBe(200);
    expect(cleared.body.customerReport).toBeNull();
  });

  it("refuses an overlong report with a 400, and an unknown service with a 404", async () => {
    const { agent } = await authenticatedAgent();
    const service = await newService(agent);

    const overlong = await agent
      .put(`/api/services/${service.id}/customer-report`)
      .send({ customerReport: "x".repeat(10_001) });
    const unknown = await agent
      .put(`/api/services/${UNKNOWN_ID}/customer-report`)
      .send({ customerReport: "Replaced the screen." });

    expect(overlong.status).toBe(400);
    expect((await agent.get(`/api/services/${service.id}`)).body.customerReport).toBeNull();
    expect(unknown.status).toBe(404);
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

describe("services: search, status filter and sort", () => {
  /**
   * Five services, numbered in creation order:
   * 2026-0001 Ana Anić (061 111 2233), Apple iPhone 13, "Pukao ekran", 10 Jan, In progress
   * 2026-0002 Bojan Bojić (062 222), Lenovo ThinkPad + USB-C cable, "Ne pali se", 12 Jan
   * 2025-0001 Ana Anić, Apple iPhone 13, no description, 1 Dec 2025
   * 2026-0003 Marko Marković, Samsung Galaxy S21, "100% mrtav", 12 Jan, In progress
   * 2026-0004 another Marko Marković, Samsung Galaxy S21, 11 Jan
   */
  async function seedServices(agent: TestAgent) {
    const ana = await createCustomer(agent, "Ana Anić", "061 111 2233");
    const iphone = await createDevice(agent, {
      manufacturer: "Apple",
      model: "iPhone 13",
      ownerId: ana.id,
    });
    const bojan = await createCustomer(agent, "Bojan Bojić", "062 222");
    const thinkpad = await createDevice(agent, {
      manufacturer: "Lenovo",
      model: "ThinkPad",
      ownerId: bojan.id,
    });
    const cable = await createDevice(agent, { model: "USB-C cable" });
    const marko = await customerWithDevice(agent);
    const otherMarko = await customerWithDevice(agent);

    const services = [
      { customer: ana, devices: [iphone], description: "Pukao ekran", date: "2026-01-10" },
      {
        customer: bojan,
        devices: [thinkpad, cable],
        description: "Ne pali se",
        date: "2026-01-12",
      },
      { customer: ana, devices: [iphone], date: "2025-12-01" },
      { ...marko, devices: [marko.device], description: "100% mrtav", date: "2026-01-12" },
      { ...otherMarko, devices: [otherMarko.device], date: "2026-01-11" },
    ];
    const created = [];
    for (const { customer, devices, description, date } of services) {
      created.push(
        await createService(agent, {
          customerId: customer.id,
          deviceIds: devices.map(({ id }) => id),
          description,
          date,
        }),
      );
    }
    for (const service of [created[0], created[3]]) {
      await agent.put(`/api/services/${service.id}/status`).send({ status: "IN_PROGRESS" });
    }
  }

  /** The numbers of every service the query lists, fetched in one page. */
  async function listed(agent: TestAgent, query: Record<string, string | undefined>) {
    const response = await agent.get("/api/services").query({ ...query, limit: 50 });
    expect(response.status).toBe(200);
    expect(response.body.nextCursor).toBeNull();
    return (response.body.items as { number: string }[]).map(({ number }) => number);
  }

  /** The numbers of every service the query lists, fetched `limit` at a time. */
  async function paged(agent: TestAgent, query: Record<string, string | undefined>, limit: number) {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await agent
        .get("/api/services")
        .query({ ...query, limit, ...(cursor && { cursor }) });
      expect(response.status).toBe(200);
      seen.push(...(response.body.items as { number: string }[]).map(({ number }) => number));
      cursor = response.body.nextCursor;
    } while (cursor);
    return seen;
  }

  it("searches the service number", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { search: "2026-0002" })).toEqual(["2026-0002"]);
    expect(await listed(agent, { search: "0001" })).toEqual(["2026-0001", "2025-0001"]);
    expect(await listed(agent, { search: "2025-" })).toEqual(["2025-0001"]);
  });

  it("searches the customer's name and phone, ignoring case", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { search: "bojan" })).toEqual(["2026-0002"]);
    expect(await listed(agent, { search: "ANA" })).toEqual(["2026-0001", "2025-0001"]);
    expect(await listed(agent, { search: "062 222" })).toEqual(["2026-0002"]);
    expect(await listed(agent, { search: "2233" })).toEqual(["2026-0001", "2025-0001"]);
  });

  it("finds a phone typed with other separators than it was saved with", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { search: "0611112233" })).toEqual(["2026-0001", "2025-0001"]);
    expect(await listed(agent, { search: "061-111-2233" })).toEqual(["2026-0001", "2025-0001"]);
    expect(await listed(agent, { search: "062222" })).toEqual(["2026-0002"]);
  });

  it("searches the names of attached devices, manufacturer and model alike", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { search: "lenovo" })).toEqual(["2026-0002"]);
    expect(await listed(agent, { search: "usb-c" })).toEqual(["2026-0002"]);
    expect(await listed(agent, { search: "Apple iPhone" })).toEqual(["2026-0001", "2025-0001"]);
  });

  it("searches the description", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { search: "EKRAN" })).toEqual(["2026-0001"]);
  });

  it("lists only services matching every word, each in any field", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { search: "  ana   ekran " })).toEqual(["2026-0001"]);
    expect(await listed(agent, { search: "ana lenovo" })).toEqual([]);
    expect(await listed(agent, { search: "   " })).toHaveLength(5);
  });

  it("takes % and _ in the search literally", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { search: "100%" })).toEqual(["2026-0003"]);
    expect(await listed(agent, { search: "%" })).toEqual(["2026-0003"]);
    expect(await listed(agent, { search: "_" })).toEqual([]);
  });

  it("filters by status, alone and with a search", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { status: "IN_PROGRESS" })).toEqual(["2026-0003", "2026-0001"]);
    expect(await listed(agent, { status: "RECEIVED" })).toEqual([
      "2026-0002",
      "2026-0004",
      "2025-0001",
    ]);
    expect(await listed(agent, { status: "IN_PROGRESS", search: "ana" })).toEqual(["2026-0001"]);
    expect(await listed(agent, { status: "DELIVERED" })).toEqual([]);
  });

  it("sorts by date, newest or oldest first, then by number", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { sort: "date", sortDir: "desc" })).toEqual([
      "2026-0003",
      "2026-0002",
      "2026-0004",
      "2026-0001",
      "2025-0001",
    ]);
    expect(await listed(agent, { sort: "date", sortDir: "asc" })).toEqual([
      "2025-0001",
      "2026-0001",
      "2026-0004",
      "2026-0002",
      "2026-0003",
    ]);
  });

  it("sorts by customer name either way, a customer's services newest first", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect(await listed(agent, { sort: "customer", sortDir: "asc" })).toEqual([
      "2026-0001",
      "2025-0001",
      "2026-0002",
      "2026-0003",
      "2026-0004",
    ]);
    expect(await listed(agent, { sort: "customer", sortDir: "desc" })).toEqual([
      "2026-0003",
      "2026-0004",
      "2026-0002",
      "2026-0001",
      "2025-0001",
    ]);
  });

  it("pages through the same services in the same order under every combination", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    for (const sort of ["date", "customer"]) {
      for (const sortDir of ["asc", "desc"]) {
        for (const filter of [{}, { status: "RECEIVED" }, { search: "a" }]) {
          const query = { sort, sortDir, ...filter };
          const all = await listed(agent, query);
          expect(all.length, JSON.stringify(query)).toBeGreaterThan(1);
          for (const limit of [1, 2]) {
            expect(await paged(agent, query, limit), JSON.stringify({ ...query, limit })).toEqual(
              all,
            );
          }
        }
      }
    }
  });

  it("rejects an unknown status, sort or direction, or another sort's cursor, with 400", async () => {
    const { agent } = await authenticatedAgent();
    await seedServices(agent);

    expect((await agent.get("/api/services?status=OPEN")).status).toBe(400);
    expect((await agent.get("/api/services?sort=title")).status).toBe(400);
    expect((await agent.get("/api/services?sortDir=up")).status).toBe(400);

    const { body } = await agent.get("/api/services?sort=customer&limit=1");
    const otherSort = await agent
      .get("/api/services")
      .query({ sort: "date", cursor: body.nextCursor });
    expect(otherSort.status).toBe(400);
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
