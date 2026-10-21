import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

/** A service with a device, a work line, a sale line, a log note and a customer report. */
async function serviceWithEverything() {
  const { agent } = await authenticatedAgent();
  const send = async (method: "post" | "put", path: string, body: object) => {
    const response = await agent[method](path).send(body);
    if (response.status >= 300) throw new Error(`${path} failed with ${response.status}`);
    return response.body;
  };

  const customer = await send("post", "/api/customers", {
    name: "Marko Marković",
    phone: "0641234567",
  });
  const device = await send("post", "/api/devices", {
    manufacturer: "Samsung",
    model: "Galaxy S21",
    serialNumber: "R58N12345",
    ownerId: customer.id,
  });
  const cable = await send("post", "/api/devices", { model: "USB-C cable" });
  const action = await send("post", "/api/actions", { name: "Screen replacement", price: 9000 });
  const service = await send("post", "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    description: "Screen cracked",
    date: "2026-03-14",
  });
  const lines = `/api/services/${service.id}/lines`;
  await send("post", lines, { type: "WORK", actionId: action.id, quantity: 1 });
  await send("post", lines, { type: "SALE", deviceId: cable.id, quantity: 2, unitPrice: 800 });
  await send("post", `/api/services/${service.id}/log`, { text: "Internal: cracked frame too" });
  await send("put", `/api/services/${service.id}/status`, { status: "COMPLETED" });
  await send("put", `/api/services/${service.id}/customer-report`, {
    customerReport: "Replaced the screen.",
  });

  return { agent, service: service as { id: string; number: string; publicToken: string } };
}

describe("public services: the status page's view of a service", () => {
  it("shows a service by its public token without a session", async () => {
    const { service } = await serviceWithEverything();

    const response = await request(createApp()).get(`/api/public/services/${service.publicToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      number: service.number,
      date: "2026-03-14",
      status: "COMPLETED",
      devices: [{ manufacturer: "Samsung", model: "Galaxy S21", serialNumber: "R58N12345" }],
      lines: [
        { label: "Screen replacement", quantity: 1, unitPrice: 9000 },
        { label: "USB-C cable", quantity: 2, unitPrice: 800 },
      ],
      total: 10_600,
      customerReport: "Replaced the screen.",
    });
  });

  it("answers an unknown token and a deleted service's token with the same 404", async () => {
    const { agent, service } = await serviceWithEverything();
    await agent.delete(`/api/services/${service.id}`).expect(204);
    const app = createApp();

    const deleted = await request(app).get(`/api/public/services/${service.publicToken}`);
    const unknown = await request(app).get("/api/public/services/AAAAAAAAAAAA");
    const byId = await request(app).get(`/api/public/services/${service.id}`);

    for (const response of [deleted, unknown, byId]) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Service not found" });
    }
  });
});
