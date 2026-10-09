import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../src/app.js";
import { authenticatedAgent, STAFF } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function create(agent: TestAgent, path: string, body: Record<string, unknown>) {
  const response = await agent.post(path).send(body);
  if (response.status !== 201) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }
  return response.body as { id: string };
}

/** A freshly received service for a customer's phone. */
async function receivedService(agent: TestAgent) {
  const customer = await create(agent, "/api/customers", { name: "Marko", phone: "0641234567" });
  const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: customer.id });
  return create(agent, "/api/services", {
    customerId: customer.id,
    deviceIds: [phone.id],
    date: "2026-03-14",
  });
}

async function readLog(agent: TestAgent, serviceId: string) {
  const response = await agent.get(`/api/services/${serviceId}/log`);
  expect(response.status).toBe(200);
  return response.body as Record<string, unknown>[];
}

describe("service status", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp())
      .put(`/api/services/${UNKNOWN_ID}/status`)
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(401);
  });

  it("changes the status and logs exactly one status change with its author", async () => {
    const { agent, staffMember } = await authenticatedAgent();
    const service = await receivedService(agent);

    const changed = await agent
      .put(`/api/services/${service.id}/status`)
      .send({ status: "IN_PROGRESS" });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ id: service.id, status: "IN_PROGRESS" });
    expect((await agent.get(`/api/services/${service.id}`)).body.status).toBe("IN_PROGRESS");
    expect(await readLog(agent, service.id)).toEqual([
      {
        id: expect.any(String),
        type: "STATUS_CHANGE",
        text: null,
        fromStatus: "RECEIVED",
        toStatus: "IN_PROGRESS",
        author: { id: staffMember.id, name: STAFF.name },
        createdAt: expect.any(String),
      },
    ]);
  });

  it("logs nothing when the status stays the same", async () => {
    const { agent } = await authenticatedAgent();
    const service = await receivedService(agent);

    const unchanged = await agent
      .put(`/api/services/${service.id}/status`)
      .send({ status: "RECEIVED" });

    expect(unchanged.status).toBe(200);
    expect(unchanged.body.status).toBe("RECEIVED");
    expect(await readLog(agent, service.id)).toEqual([]);
  });

  it("refuses an unknown status with a 400 and changes nothing", async () => {
    const { agent } = await authenticatedAgent();
    const service = await receivedService(agent);

    const invalid = await agent.put(`/api/services/${service.id}/status`).send({ status: "LOST" });
    const missing = await agent.put(`/api/services/${service.id}/status`).send({});

    expect(invalid.status).toBe(400);
    expect(invalid.body.details.fieldErrors.status).toBeDefined();
    expect(missing.status).toBe(400);
    expect((await agent.get(`/api/services/${service.id}`)).body.status).toBe("RECEIVED");
    expect(await readLog(agent, service.id)).toEqual([]);
  });

  it("answers 404 for an unknown service", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent
      .put(`/api/services/${UNKNOWN_ID}/status`)
      .send({ status: "COMPLETED" });
    const malformed = await agent
      .put("/api/services/not-a-uuid/status")
      .send({ status: "COMPLETED" });

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("service log", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const list = await request(createApp()).get(`/api/services/${UNKNOWN_ID}/log`);
    const add = await request(createApp())
      .post(`/api/services/${UNKNOWN_ID}/log`)
      .send({ text: "Hi" });

    expect(list.status).toBe(401);
    expect(add.status).toBe(401);
  });

  it("adds a trimmed note with its author", async () => {
    const { agent, staffMember } = await authenticatedAgent();
    const service = await receivedService(agent);

    const added = await agent
      .post(`/api/services/${service.id}/log`)
      .send({ text: "  Screen cracked in the top corner  " });

    expect(added.status).toBe(201);
    expect(added.body).toEqual({
      id: expect.any(String),
      type: "NOTE",
      text: "Screen cracked in the top corner",
      fromStatus: null,
      toStatus: null,
      author: { id: staffMember.id, name: STAFF.name },
      createdAt: expect.any(String),
    });
    expect(await readLog(agent, service.id)).toEqual([added.body]);
  });

  it("lists notes and status changes oldest first", async () => {
    const { agent } = await authenticatedAgent();
    const service = await receivedService(agent);

    await create(agent, `/api/services/${service.id}/log`, { text: "Customer will call back" });
    await agent.put(`/api/services/${service.id}/status`).send({ status: "IN_PROGRESS" });
    await create(agent, `/api/services/${service.id}/log`, { text: "Ordered a new screen" });
    await agent.put(`/api/services/${service.id}/status`).send({ status: "COMPLETED" });

    expect(await readLog(agent, service.id)).toMatchObject([
      { type: "NOTE", text: "Customer will call back" },
      { type: "STATUS_CHANGE", fromStatus: "RECEIVED", toStatus: "IN_PROGRESS" },
      { type: "NOTE", text: "Ordered a new screen" },
      { type: "STATUS_CHANGE", fromStatus: "IN_PROGRESS", toStatus: "COMPLETED" },
    ]);
  });

  it("keeps each service's log to itself", async () => {
    const { agent } = await authenticatedAgent();
    const first = await receivedService(agent);
    const second = await receivedService(agent);

    await create(agent, `/api/services/${first.id}/log`, { text: "Only on the first" });

    expect(await readLog(agent, second.id)).toEqual([]);
  });

  it("refuses a blank or overlong note with a 400", async () => {
    const { agent } = await authenticatedAgent();
    const service = await receivedService(agent);

    const blank = await agent.post(`/api/services/${service.id}/log`).send({ text: "   " });
    const long = await agent
      .post(`/api/services/${service.id}/log`)
      .send({ text: "x".repeat(5001) });

    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors.text).toBeDefined();
    expect(long.status).toBe(400);
    expect(await readLog(agent, service.id)).toEqual([]);
  });

  it("answers 404 for an unknown service", async () => {
    const { agent } = await authenticatedAgent();

    const list = await agent.get(`/api/services/${UNKNOWN_ID}/log`);
    const add = await agent.post(`/api/services/${UNKNOWN_ID}/log`).send({ text: "Hi" });

    expect(list.status).toBe(404);
    expect(add.status).toBe(404);
  });

  it("goes with its service when the service is deleted", async () => {
    const { agent } = await authenticatedAgent();
    const service = await receivedService(agent);
    await create(agent, `/api/services/${service.id}/log`, { text: "Note" });

    expect((await agent.delete(`/api/services/${service.id}`)).status).toBe(204);
    expect((await agent.get(`/api/services/${service.id}/log`)).status).toBe(404);
  });
});
