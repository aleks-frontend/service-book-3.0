import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { authenticatedAgent } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function create(agent: TestAgent, path: string, body: Record<string, unknown>) {
  const response = await agent.post(path).send(body);
  if (response.status !== 201) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }
  return response.body as { id: string; number: string };
}

function createCustomer(agent: TestAgent, name: string) {
  return create(agent, "/api/customers", { name, phone: "0641234567" });
}

function createService(agent: TestAgent, customerId: string, deviceIds: string[], date: string) {
  return create(agent, "/api/services", { customerId, deviceIds, date });
}

function ids(body: { id: string }[]) {
  return body.map(({ id }) => id);
}

describe("history: a customer's services", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get(`/api/customers/${UNKNOWN_ID}/services`);

    expect(response.status).toBe(401);
  });

  it("lists only the customer's services, newest first, as the services list shows them", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: marko.id });
    const cable = await create(agent, "/api/devices", { model: "USB-C cable" });
    const older = await createService(agent, marko.id, [phone.id], "2025-11-02");
    const newer = await createService(agent, marko.id, [phone.id, cable.id], "2026-03-14");
    const sameDay = await createService(agent, marko.id, [cable.id], "2026-03-14");
    await createService(agent, ana.id, [cable.id], "2026-04-01");

    const response = await agent.get(`/api/customers/${marko.id}/services`);

    expect(response.status).toBe(200);
    expect(ids(response.body)).toEqual([sameDay.id, newer.id, older.id]);
    expect(response.body[1]).toMatchObject({
      number: newer.number,
      date: "2026-03-14",
      status: "RECEIVED",
      customer: { id: marko.id, name: "Marko" },
      devices: [{ id: phone.id }, { id: cable.id }],
      total: 0,
    });
    expect(response.body[1]).not.toHaveProperty("lines");
  });

  it("is empty for a customer without services, and 404 for an unknown customer", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");

    expect((await agent.get(`/api/customers/${marko.id}/services`)).body).toEqual([]);
    expect((await agent.get(`/api/customers/${UNKNOWN_ID}/services`)).status).toBe(404);
    expect((await agent.get("/api/customers/not-a-uuid/services")).status).toBe(404);
  });
});

describe("history: a device's services", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get(`/api/devices/${UNKNOWN_ID}/services`);

    expect(response.status).toBe(401);
  });

  it("lists every service the device is attached to or sold on, newest first, saying which", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: marko.id });
    const cable = await create(agent, "/api/devices", { model: "USB-C cable" });
    const repaired = await createService(agent, marko.id, [cable.id], "2025-11-02");
    const sold = await createService(agent, ana.id, [cable.id], "2026-01-10");
    const both = await createService(agent, marko.id, [phone.id, cable.id], "2026-03-14");
    await createService(agent, marko.id, [phone.id], "2026-04-01");
    await create(agent, `/api/services/${sold.id}/lines`, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 2,
      unitPrice: 800,
    });
    await create(agent, `/api/services/${both.id}/lines`, {
      type: "SALE",
      deviceId: cable.id,
      quantity: 1,
      unitPrice: 800,
    });

    const response = await agent.get(`/api/devices/${cable.id}/services`);

    expect(response.status).toBe(200);
    expect(ids(response.body)).toEqual([both.id, sold.id, repaired.id]);
    expect(
      response.body.map(({ attached, sold }: { attached: boolean; sold: boolean }) => ({
        attached,
        sold,
      })),
    ).toEqual([
      { attached: true, sold: true },
      { attached: true, sold: true },
      { attached: true, sold: false },
    ]);
    expect(response.body[1]).toMatchObject({ customer: { id: ana.id }, total: 1600 });
  });

  it("lists a device that was only sold, never attached", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: marko.id });
    const charger = await create(agent, "/api/devices", { model: "Charger" });
    const service = await createService(agent, marko.id, [phone.id], "2026-03-14");
    await create(agent, `/api/services/${service.id}/lines`, {
      type: "SALE",
      deviceId: charger.id,
      quantity: 1,
      unitPrice: 1200,
    });

    const response = await agent.get(`/api/devices/${charger.id}/services`);

    expect(response.body).toMatchObject([{ id: service.id, attached: false, sold: true }]);
  });

  it("is empty for an unused device, and 404 for an unknown device", async () => {
    const { agent } = await authenticatedAgent();
    const cable = await create(agent, "/api/devices", { model: "USB-C cable" });

    expect((await agent.get(`/api/devices/${cable.id}/services`)).body).toEqual([]);
    expect((await agent.get(`/api/devices/${UNKNOWN_ID}/services`)).status).toBe(404);
    expect((await agent.get("/api/devices/not-a-uuid/services")).status).toBe(404);
  });
});

describe("devices: owner change", () => {
  it("refuses with 409 to give a device attached to someone else's service a new owner", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: marko.id });
    await createService(agent, marko.id, [phone.id], "2026-03-14");

    const response = await agent
      .put(`/api/devices/${phone.id}`)
      .send({ model: "Galaxy S21", ownerId: ana.id });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DEVICE_ATTACHED_TO_OTHER_CUSTOMER");
    expect((await agent.get(`/api/devices/${phone.id}`)).body.owner.id).toBe(marko.id);
  });

  it("refuses to give a generic device used by several customers one of them as owner", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const cable = await create(agent, "/api/devices", { model: "USB-C cable" });
    await createService(agent, marko.id, [cable.id], "2026-03-14");
    await createService(agent, ana.id, [cable.id], "2026-03-15");

    const response = await agent
      .put(`/api/devices/${cable.id}`)
      .send({ model: "USB-C cable", ownerId: marko.id });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DEVICE_ATTACHED_TO_OTHER_CUSTOMER");
  });

  it("allows edits that keep the owner, making the device generic, and owners whose services they are", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: marko.id });
    const cable = await create(agent, "/api/devices", { model: "USB-C cable" });
    await createService(agent, marko.id, [phone.id, cable.id], "2026-03-14");

    const renamed = await agent
      .put(`/api/devices/${phone.id}`)
      .send({ model: "Galaxy S21 Ultra", ownerId: marko.id });
    const generic = await agent.put(`/api/devices/${phone.id}`).send({ model: "Galaxy S21" });
    const owned = await agent
      .put(`/api/devices/${cable.id}`)
      .send({ model: "USB-C cable", ownerId: marko.id });

    expect(renamed.status).toBe(200);
    expect(generic.status).toBe(200);
    expect(generic.body.owner).toBeNull();
    expect(owned.status).toBe(200);
    expect(owned.body.owner.id).toBe(marko.id);
  });

  it("lets a device keep its owner even when imported data has it on another customer's service", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const phone = await create(agent, "/api/devices", { model: "Galaxy S21" });
    await createService(agent, ana.id, [phone.id], "2026-03-14");
    // The API never allows this state; legacy data might.
    await prisma.device.update({ where: { id: phone.id }, data: { ownerId: marko.id } });

    const response = await agent
      .put(`/api/devices/${phone.id}`)
      .send({ model: "Galaxy S21 Ultra", ownerId: marko.id });

    expect(response.status).toBe(200);
  });

  it("allows any new owner once the device is attached to no service", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const ana = await createCustomer(agent, "Ana");
    const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: marko.id });
    const service = await createService(agent, marko.id, [phone.id], "2026-03-14");
    await agent.delete(`/api/services/${service.id}`);

    const response = await agent
      .put(`/api/devices/${phone.id}`)
      .send({ model: "Galaxy S21", ownerId: ana.id });

    expect(response.status).toBe(200);
    expect(response.body.owner.id).toBe(ana.id);
  });
});

describe("in-use protection", () => {
  it("refuses with 409 to delete a customer who has services but owns no devices", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const cable = await create(agent, "/api/devices", { model: "USB-C cable" });
    await createService(agent, marko.id, [cable.id], "2026-03-14");

    const response = await agent.delete(`/api/customers/${marko.id}`);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Customer is in use", code: "CUSTOMER_IN_USE" });
  });

  it("deletes an unreferenced customer, device and action", async () => {
    const { agent } = await authenticatedAgent();
    const marko = await createCustomer(agent, "Marko");
    const cable = await create(agent, "/api/devices", { model: "USB-C cable" });
    const action = await create(agent, "/api/actions", { name: "Cleaning", price: 1000 });

    expect((await agent.delete(`/api/customers/${marko.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/devices/${cable.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/actions/${action.id}`)).status).toBe(204);
  });
});
