import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import type { Status } from "@servicebook/schemas";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

async function create(agent: TestAgent, path: string, body: Record<string, unknown>) {
  const response = await agent.post(path).send(body);
  if (response.status !== 201) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }
  return response.body as { id: string };
}

/** A customer with a phone, plus an action and a generic device to put on their services. */
async function serviceParts(agent: TestAgent) {
  const customer = await create(agent, "/api/customers", { name: "Marko", phone: "0641234567" });
  const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: customer.id });
  const screen = await create(agent, "/api/actions", { name: "Screen replacement", price: 4500 });
  const cable = await create(agent, "/api/devices", { model: "USB-C cable" });
  return { customer, phone, screen, cable };
}

type Line = { type: "WORK" | "SALE"; quantity: number; unitPrice: number };

/**
 * A service on `date` with `lines`, each work line on the screen action and
 * each sale line selling the cable, then moved to `status`.
 */
async function serviceOn(
  agent: TestAgent,
  parts: Awaited<ReturnType<typeof serviceParts>>,
  date: string,
  lines: Line[],
  status: Status = "RECEIVED",
) {
  const service = await create(agent, "/api/services", {
    customerId: parts.customer.id,
    deviceIds: [parts.phone.id],
    date,
  });
  for (const { type, ...line } of lines) {
    const reference =
      type === "WORK" ? { actionId: parts.screen.id } : { deviceId: parts.cable.id };
    await create(agent, `/api/services/${service.id}/lines`, { type, ...reference, ...line });
  }
  if (status !== "RECEIVED") {
    const response = await agent.put(`/api/services/${service.id}/status`).send({ status });
    if (!response.ok) throw new Error(`Status change failed with ${response.status}`);
  }
  return service;
}

const work = (unitPrice: number, quantity = 1): Line => ({ type: "WORK", quantity, unitPrice });
const sale = (unitPrice: number, quantity = 1): Line => ({ type: "SALE", quantity, unitPrice });

async function earnings(agent: TestAgent, query: Record<string, string>) {
  const response = await agent.get("/api/statistics/earnings").query(query);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body as { earnings: number; buckets: { period: string; earnings: number }[] };
}

describe("statistics: earnings", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp())
      .get("/api/statistics/earnings")
      .query({ from: "2026-01-01", to: "2026-12-31" });

    expect(response.status).toBe(401);
  });

  it("sums quantity × unit price over work and sale lines, leaving out cancelled services", async () => {
    const { agent } = await authenticatedAgent();
    const parts = await serviceParts(agent);
    await serviceOn(agent, parts, "2026-03-14", [work(4500, 2), sale(800, 3)]);
    await serviceOn(agent, parts, "2026-03-20", [sale(1500)], "DELIVERED");
    await serviceOn(agent, parts, "2026-03-21", [work(10_000)], "CANCELLED");

    const result = await earnings(agent, { from: "2026-03-01", to: "2026-03-31", bucket: "month" });

    // 2 × 4500 + 3 × 800 + 1 × 1500
    expect(result).toEqual({
      earnings: 12_900,
      buckets: [{ period: "2026-03", earnings: 12_900 }],
    });
  });

  it("counts services dated on both ends of the range and none outside it", async () => {
    const { agent } = await authenticatedAgent();
    const parts = await serviceParts(agent);
    await serviceOn(agent, parts, "2026-02-28", [work(1)]);
    await serviceOn(agent, parts, "2026-03-01", [work(10)]);
    await serviceOn(agent, parts, "2026-03-31", [work(100)]);
    await serviceOn(agent, parts, "2026-04-01", [work(1000)]);

    const result = await earnings(agent, { from: "2026-03-01", to: "2026-03-31", bucket: "month" });

    expect(result.earnings).toBe(110);
  });

  it("buckets by day, with every day of the range in order", async () => {
    const { agent } = await authenticatedAgent();
    const parts = await serviceParts(agent);
    await serviceOn(agent, parts, "2026-12-31", [work(100)]);
    await serviceOn(agent, parts, "2027-01-02", [work(200), sale(50, 2)]);
    await serviceOn(agent, parts, "2027-01-02", [work(300)]);

    const result = await earnings(agent, { from: "2026-12-30", to: "2027-01-02", bucket: "day" });

    expect(result).toEqual({
      earnings: 700,
      buckets: [
        { period: "2026-12-30", earnings: 0 },
        { period: "2026-12-31", earnings: 100 },
        { period: "2027-01-01", earnings: 0 },
        { period: "2027-01-02", earnings: 600 },
      ],
    });
  });

  it("buckets by month across a year boundary", async () => {
    const { agent } = await authenticatedAgent();
    const parts = await serviceParts(agent);
    await serviceOn(agent, parts, "2026-11-30", [work(100)]);
    await serviceOn(agent, parts, "2026-12-01", [work(200)]);
    await serviceOn(agent, parts, "2026-12-31", [work(300)]);
    await serviceOn(agent, parts, "2027-02-01", [work(400)]);

    const result = await earnings(agent, { from: "2026-11-15", to: "2027-02-10", bucket: "month" });

    expect(result).toEqual({
      earnings: 1000,
      buckets: [
        { period: "2026-11", earnings: 100 },
        { period: "2026-12", earnings: 500 },
        { period: "2027-01", earnings: 0 },
        { period: "2027-02", earnings: 400 },
      ],
    });
  });

  it("buckets by year", async () => {
    const { agent } = await authenticatedAgent();
    const parts = await serviceParts(agent);
    await serviceOn(agent, parts, "2025-12-31", [work(100)]);
    await serviceOn(agent, parts, "2026-01-01", [work(200)]);
    await serviceOn(agent, parts, "2027-06-15", [sale(300, 2)]);

    const result = await earnings(agent, { from: "2025-01-01", to: "2027-12-31", bucket: "year" });

    expect(result).toEqual({
      earnings: 900,
      buckets: [
        { period: "2025", earnings: 100 },
        { period: "2026", earnings: 200 },
        { period: "2027", earnings: 600 },
      ],
    });
  });

  it("groups by month unless told otherwise", async () => {
    const { agent } = await authenticatedAgent();

    const result = await earnings(agent, { from: "2026-01-10", to: "2026-02-10" });

    expect(result).toEqual({
      earnings: 0,
      buckets: [
        { period: "2026-01", earnings: 0 },
        { period: "2026-02", earnings: 0 },
      ],
    });
  });

  it("sums past what a 32-bit integer holds", async () => {
    const { agent } = await authenticatedAgent();
    const parts = await serviceParts(agent);
    await serviceOn(agent, parts, "2026-05-01", [work(2_000_000_000, 2)]);

    const result = await earnings(agent, { from: "2026-05-01", to: "2026-05-01", bucket: "year" });

    expect(result.earnings).toBe(4_000_000_000);
  });

  it("rejects an invalid range with 400", async () => {
    const { agent } = await authenticatedAgent();

    const cases = [
      {},
      { from: "2026-01-01" },
      { from: "2026-02-30", to: "2026-03-01" },
      { from: "2026-03-01", to: "2026-02-01" },
      { from: "2026-01-01", to: "2026-12-31", bucket: "week" },
      { from: "2025-01-01", to: "2026-01-02", bucket: "day" },
    ];

    for (const query of cases) {
      const response = await agent.get("/api/statistics/earnings").query(query);
      expect(response.status, JSON.stringify(query)).toBe(400);
    }
  });
});

describe("statistics: status counts", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get("/api/statistics/status-counts");

    expect(response.status).toBe(401);
  });

  it("counts the services in each status, with 0 for a status no service has", async () => {
    const { agent } = await authenticatedAgent();
    const parts = await serviceParts(agent);
    await serviceOn(agent, parts, "2026-03-01", []);
    await serviceOn(agent, parts, "2025-03-02", [], "IN_PROGRESS");
    await serviceOn(agent, parts, "2026-03-03", [], "IN_PROGRESS");
    await serviceOn(agent, parts, "2026-03-04", [], "DELIVERED");
    await serviceOn(agent, parts, "2026-03-05", [], "CANCELLED");

    const response = await agent.get("/api/statistics/status-counts");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      RECEIVED: 1,
      IN_PROGRESS: 2,
      COMPLETED: 0,
      DELIVERED: 1,
      CANCELLED: 1,
    });
  });
});
