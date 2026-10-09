import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function create(agent: TestAgent, path: string, body: Record<string, unknown>) {
  const response = await agent.post(path).send(body);
  if (response.status !== 201) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }
  return response.body as { id: string };
}

/** A service for a customer's phone, plus an action and a generic device to put on it. */
async function serviceWithPriceList(agent: TestAgent) {
  const customer = await create(agent, "/api/customers", { name: "Marko", phone: "0641234567" });
  const phone = await create(agent, "/api/devices", {
    manufacturer: "Samsung",
    model: "Galaxy S21",
    ownerId: customer.id,
  });
  const service = await create(agent, "/api/services", {
    customerId: customer.id,
    deviceIds: [phone.id],
    date: "2026-03-14",
  });
  const screen = await create(agent, "/api/actions", { name: "Screen replacement", price: 4500 });
  const cable = await create(agent, "/api/devices", {
    manufacturer: "Anker",
    model: "USB-C cable",
  });
  return { customer, phone, service, screen, cable };
}

async function addLine(agent: TestAgent, serviceId: string, line: Record<string, unknown>) {
  return create(agent, `/api/services/${serviceId}/lines`, line);
}

async function readService(agent: TestAgent, id: string) {
  const { body } = await agent.get(`/api/services/${id}`);
  return body as {
    total: number;
    lines: { id: string; label: string; quantity: number; unitPrice: number }[];
  };
}

describe("service lines: add", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).post(`/api/services/${UNKNOWN_ID}/lines`).send({});

    expect(response.status).toBe(401);
  });

  it("adds a work line at the action's price, labelled with the action's name", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen } = await serviceWithPriceList(agent);

    const added = await agent
      .post(`/api/services/${service.id}/lines`)
      .send({ type: "WORK", actionId: screen.id, quantity: 2 });

    expect(added.status).toBe(201);
    expect(added.body).toEqual({
      id: expect.any(String),
      type: "WORK",
      actionId: screen.id,
      deviceId: null,
      label: "Screen replacement",
      quantity: 2,
      unitPrice: 4500,
    });
    expect(await readService(agent, service.id)).toMatchObject({
      lines: [added.body],
      total: 9000,
    });
  });

  it("keeps a work line's own unit price when one is given", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen } = await serviceWithPriceList(agent);

    await addLine(agent, service.id, {
      type: "WORK",
      actionId: screen.id,
      quantity: 1,
      unitPrice: 4000,
    });

    expect(await readService(agent, service.id)).toMatchObject({
      lines: [{ unitPrice: 4000 }],
      total: 4000,
    });
  });

  it("adds a sale line for a generic or the customer's device, labelled with the device's name", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, service, cable } = await serviceWithPriceList(agent);
    const charger = await create(agent, "/api/devices", { model: "Charger", ownerId: customer.id });

    const added = await agent
      .post(`/api/services/${service.id}/lines`)
      .send({ type: "SALE", deviceId: cable.id, quantity: 3, unitPrice: 800 });
    await addLine(agent, service.id, {
      type: "SALE",
      deviceId: charger.id,
      quantity: 1,
      unitPrice: 1500,
    });

    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({
      type: "SALE",
      actionId: null,
      deviceId: cable.id,
      label: "Anker USB-C cable",
      quantity: 3,
      unitPrice: 800,
    });
    expect((await readService(agent, service.id)).total).toBe(3900);
  });

  it("totals quantity × unit price over work and sale lines alike", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen, cable } = await serviceWithPriceList(agent);
    const cleaning = await create(agent, "/api/actions", { name: "Cleaning", price: 1000 });

    await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 1 });
    await addLine(agent, service.id, { type: "WORK", actionId: cleaning.id, quantity: 2 });
    await addLine(agent, service.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 2,
      unitPrice: 750,
    });

    // 1 × 4500 + 2 × 1000 + 2 × 750
    const read = await readService(agent, service.id);
    expect(read.total).toBe(8000);
    expect(read.lines.map(({ label }) => label)).toEqual([
      "Screen replacement",
      "Cleaning",
      "Anker USB-C cable",
    ]);
  });

  it("keeps a line's label and price when the action or device changes later", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen, cable } = await serviceWithPriceList(agent);
    await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 1 });
    await addLine(agent, service.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 1,
      unitPrice: 800,
    });

    await agent.put(`/api/actions/${screen.id}`).send({ name: "Display swap", price: 6000 });
    await agent.put(`/api/devices/${cable.id}`).send({ model: "Lightning cable" });

    expect(await readService(agent, service.id)).toMatchObject({
      lines: [
        { label: "Screen replacement", unitPrice: 4500 },
        { label: "Anker USB-C cable", unitPrice: 800 },
      ],
      total: 5300,
    });
  });

  it("rejects an invalid line with 400, adding nothing", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen, cable } = await serviceWithPriceList(agent);
    const ana = await create(agent, "/api/customers", { name: "Ana", phone: "0649876543" });
    const anasPhone = await create(agent, "/api/devices", { model: "iPhone 13", ownerId: ana.id });
    const work = { type: "WORK", actionId: screen.id, quantity: 1 };
    const sale = { type: "SALE", deviceId: cable.id, quantity: 1, unitPrice: 800 };

    const cases = {
      type: [{ ...work, type: "OTHER" }, { quantity: 1 }],
      actionId: [
        { ...work, actionId: undefined },
        { ...work, actionId: UNKNOWN_ID },
      ],
      deviceId: [
        { ...sale, deviceId: undefined },
        { ...sale, deviceId: UNKNOWN_ID },
        { ...sale, deviceId: anasPhone.id },
      ],
      quantity: [
        { ...work, quantity: 0 },
        { ...work, quantity: 1.5 },
        { ...work, quantity: "2" },
        { ...sale, quantity: 10_001 },
      ],
      unitPrice: [
        { ...work, unitPrice: -1 },
        { ...work, unitPrice: 99.5 },
        { ...sale, unitPrice: undefined },
      ],
    };

    for (const [field, bodies] of Object.entries(cases)) {
      for (const body of bodies) {
        const response = await agent.post(`/api/services/${service.id}/lines`).send(body);
        expect(response.status, JSON.stringify(body)).toBe(400);
        const { fieldErrors, formErrors } = response.body.details;
        expect(
          field in fieldErrors || formErrors.length > 0,
          `${field}: ${JSON.stringify(response.body.details)}`,
        ).toBe(true);
      }
    }
    expect(await readService(agent, service.id)).toMatchObject({ lines: [], total: 0 });
  });

  it("returns 404 when adding a line to an unknown service", async () => {
    const { agent } = await authenticatedAgent();
    const { screen } = await serviceWithPriceList(agent);

    const response = await agent
      .post(`/api/services/${UNKNOWN_ID}/lines`)
      .send({ type: "WORK", actionId: screen.id, quantity: 1 });

    expect(response.status).toBe(404);
  });
});

describe("service lines: edit and remove", () => {
  it("changes a line's quantity and unit price, updating the total", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen, cable } = await serviceWithPriceList(agent);
    const work = await addLine(agent, service.id, {
      type: "WORK",
      actionId: screen.id,
      quantity: 1,
    });
    const sale = await addLine(agent, service.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 1,
      unitPrice: 800,
    });

    const edited = await agent
      .patch(`/api/services/${service.id}/lines/${work.id}`)
      .send({ quantity: 3, unitPrice: 4000 });
    await agent.patch(`/api/services/${service.id}/lines/${sale.id}`).send({ quantity: 2 });

    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      id: work.id,
      label: "Screen replacement",
      quantity: 3,
      unitPrice: 4000,
    });
    // 3 × 4000 + 2 × 800
    expect((await readService(agent, service.id)).total).toBe(13600);
  });

  it("rejects an invalid edit with 400, leaving the line alone", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen } = await serviceWithPriceList(agent);
    const line = await addLine(agent, service.id, {
      type: "WORK",
      actionId: screen.id,
      quantity: 1,
    });

    for (const body of [{ quantity: 0 }, { unitPrice: -5 }, { quantity: 2.5 }, {}]) {
      const response = await agent.patch(`/api/services/${service.id}/lines/${line.id}`).send(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect((await readService(agent, service.id)).lines).toMatchObject([
      { quantity: 1, unitPrice: 4500 },
    ]);
  });

  it("removes a line, updating the total", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen, cable } = await serviceWithPriceList(agent);
    const work = await addLine(agent, service.id, {
      type: "WORK",
      actionId: screen.id,
      quantity: 1,
    });
    await addLine(agent, service.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 1,
      unitPrice: 800,
    });

    const removed = await agent.delete(`/api/services/${service.id}/lines/${work.id}`);

    expect(removed.status).toBe(204);
    expect(await readService(agent, service.id)).toMatchObject({
      lines: [{ label: "Anker USB-C cable" }],
      total: 800,
    });
  });

  it("returns 404 for an unknown line, or a line of another service", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, phone, service, screen } = await serviceWithPriceList(agent);
    const other = await create(agent, "/api/services", {
      customerId: customer.id,
      deviceIds: [phone.id],
      date: "2026-03-15",
    });
    const line = await addLine(agent, service.id, {
      type: "WORK",
      actionId: screen.id,
      quantity: 1,
    });

    const paths = [
      `/api/services/${service.id}/lines/${UNKNOWN_ID}`,
      `/api/services/${service.id}/lines/not-a-uuid`,
      `/api/services/${other.id}/lines/${line.id}`,
    ];
    for (const path of paths) {
      expect((await agent.patch(path).send({ quantity: 2 })).status, path).toBe(404);
      expect((await agent.delete(path)).status, path).toBe(404);
    }
    expect((await readService(agent, service.id)).lines).toMatchObject([{ quantity: 1 }]);
  });
});

describe("service lines: order", () => {
  it("lists lines in the order they were added, until they are reordered", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen, cable } = await serviceWithPriceList(agent);
    const a = await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 1 });
    const b = await addLine(agent, service.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 1,
      unitPrice: 800,
    });
    const c = await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 2 });

    const reordered = await agent
      .put(`/api/services/${service.id}/lines/order`)
      .send({ lineIds: [c.id, a.id, b.id] });

    expect(reordered.status).toBe(200);
    expect(reordered.body.map(({ id }: { id: string }) => id)).toEqual([c.id, a.id, b.id]);
    const read = await readService(agent, service.id);
    expect(read.lines.map(({ id }) => id)).toEqual([c.id, a.id, b.id]);

    // A line added afterwards goes last.
    const d = await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 1 });
    expect((await readService(agent, service.id)).lines.map(({ id }) => id)).toEqual([
      c.id,
      a.id,
      b.id,
      d.id,
    ]);
  });

  it("adds lines sent at the same time, which can then all be reordered", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen } = await serviceWithPriceList(agent);

    const added = await Promise.all(
      [1, 2, 3, 4, 5].map((quantity) =>
        agent
          .post(`/api/services/${service.id}/lines`)
          .send({ type: "WORK", actionId: screen.id, quantity }),
      ),
    );
    const [first, ...rest] = (await readService(agent, service.id)).lines;
    const moved = await agent
      .put(`/api/services/${service.id}/lines/order`)
      .send({ lineIds: [...rest, first].map(({ id }) => id) });

    expect(added.map(({ status }) => status)).toEqual(Array(5).fill(201));
    expect(moved.body.map(({ id }: { id: string }) => id)).toEqual(
      [...rest, first].map(({ id }) => id),
    );
  });

  it("rejects an order that does not name each of the service's lines exactly once", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen } = await serviceWithPriceList(agent);
    const a = await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 1 });
    const b = await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 2 });

    for (const lineIds of [[a.id], [a.id, a.id], [a.id, b.id, UNKNOWN_ID], ["not-a-uuid"]]) {
      const response = await agent.put(`/api/services/${service.id}/lines/order`).send({ lineIds });
      expect(response.status, JSON.stringify(lineIds)).toBe(400);
    }
    expect((await readService(agent, service.id)).lines.map(({ id }) => id)).toEqual([a.id, b.id]);
    expect(
      (await agent.put(`/api/services/${UNKNOWN_ID}/lines/order`).send({ lineIds: [] })).status,
    ).toBe(404);
  });
});

describe("service lines: totals in the list", () => {
  it("returns each listed service's total, zero for a service without lines", async () => {
    const { agent } = await authenticatedAgent();
    const { customer, phone, service, screen, cable } = await serviceWithPriceList(agent);
    const empty = await create(agent, "/api/services", {
      customerId: customer.id,
      deviceIds: [phone.id],
      date: "2026-03-13",
    });
    const later = await create(agent, "/api/services", {
      customerId: customer.id,
      deviceIds: [phone.id],
      date: "2026-03-15",
    });
    await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 2 });
    await addLine(agent, service.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 3,
      unitPrice: 700,
    });
    await addLine(agent, later.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 1,
      unitPrice: 900,
    });

    const response = await agent.get("/api/services");

    expect(response.status).toBe(200);
    const totals = Object.fromEntries(
      response.body.items.map(({ id, total }: { id: string; total: number }) => [id, total]),
    );
    expect(totals).toEqual({ [later.id]: 900, [service.id]: 11100, [empty.id]: 0 });
    expect(response.body.items[0]).not.toHaveProperty("lines");
  });
});

describe("service lines: what they refer to", () => {
  it("refuses to delete an action or device used on a line with 409, until the service is gone", async () => {
    const { agent } = await authenticatedAgent();
    const { service, screen, cable } = await serviceWithPriceList(agent);
    await addLine(agent, service.id, { type: "WORK", actionId: screen.id, quantity: 1 });
    await addLine(agent, service.id, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 1,
      unitPrice: 800,
    });

    const action = await agent.delete(`/api/actions/${screen.id}`);
    const device = await agent.delete(`/api/devices/${cable.id}`);

    expect(action.status).toBe(409);
    expect(action.body.code).toBe("ACTION_IN_USE");
    expect(device.status).toBe(409);
    expect(device.body.code).toBe("DEVICE_IN_USE");

    // Deleting the service takes its lines with it.
    await agent.delete(`/api/services/${service.id}`);
    expect((await agent.delete(`/api/actions/${screen.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/devices/${cable.id}`)).status).toBe(204);
  });
});
