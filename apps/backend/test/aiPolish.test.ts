import request from "supertest";
import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type TestAgent from "supertest/lib/agent.js";
import { CUSTOMER_REPORT_MAX } from "@servicebook/schemas";
import { createApp } from "../src/app.js";
import {
  createTextPolisher,
  textPolisherFromEnv,
  type TextPolisher,
} from "../src/lib/textPolisher.js";
import { authenticatedAgent } from "./helpers.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

/** A model that answers every call with `reply`, keeping the calls it received. */
function mockModel(reply: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: reply }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

async function create(agent: TestAgent, path: string, body: Record<string, unknown>) {
  const response = await agent.post(path).send(body);
  if (response.status !== 201) throw new Error(`POST ${path} failed with ${response.status}`);
  return response.body as { id: string };
}

/** A service to polish the report of, through an app with `textPolisher` (by default, the mock's). */
async function setUp(
  model = mockModel("Zamenjen je kondenzator, uređaj je očišćen i radi ispravno."),
  textPolisher: TextPolisher | null = createTextPolisher({ model }),
) {
  const { agent } = await authenticatedAgent({ textPolisher });
  const customer = await create(agent, "/api/customers", {
    name: "Marko Marković",
    phone: "0641234567",
  });
  const device = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: customer.id });
  const service = await create(agent, "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: "2026-03-14",
    description: "Ne pali se",
  });
  return { agent, model, service };
}

const polishPath = (id: string) => `/api/services/${id}/customer-report/polish`;

describe("AI polish", () => {
  it("returns the polished text, saving nothing", async () => {
    const { agent, service } = await setUp();

    const response = await agent
      .post(polishPath(service.id))
      .send({ text: "zamenjen kondenzator, ociscen, radi" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      text: "Zamenjen je kondenzator, uređaj je očišćen i radi ispravno.",
      changed: true,
    });
    const saved = await agent.get(`/api/services/${service.id}`);
    expect(saved.body.customerReport).toBeNull();
  });

  it("sends the model only the report text", async () => {
    const { agent, model, service } = await setUp();

    await agent.post(polishPath(service.id)).send({ text: "zamenjen kondenzator" });

    expect(model.doGenerateCalls).toHaveLength(1);
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    for (const field of ["Marko", "0641234567", "Galaxy", "Ne pali se", service.id]) {
      expect(prompt).not.toContain(field);
    }
    const user = model.doGenerateCalls[0].prompt.filter((message) => message.role === "user");
    expect(user).toEqual([
      { role: "user", content: [{ type: "text", text: "zamenjen kondenzator" }] },
    ]);
  });

  it("asks OpenAI not to store the request", async () => {
    const { agent, model, service } = await setUp();

    await agent.post(polishPath(service.id)).send({ text: "zamenjen kondenzator" });

    expect(model.doGenerateCalls[0].providerOptions?.openai).toMatchObject({ store: false });
  });

  it("returns 404 for an unknown service", async () => {
    const { agent, model } = await setUp();

    const response = await agent.post(polishPath(UNKNOWN_ID)).send({ text: "radi" });

    expect(response.status).toBe(404);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it.each([
    ["blank", { text: "  \n " }],
    ["over-length", { text: "a".repeat(CUSTOMER_REPORT_MAX + 1) }],
    ["missing", {}],
  ])("rejects %s text with 400", async (_case, body) => {
    const { agent, model, service } = await setUp();

    const response = await agent.post(polishPath(service.id)).send(body);

    expect(response.status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("requires a logged-in staff member", async () => {
    const app = createApp({ textPolisher: createTextPolisher({ model: mockModel("x") }) });

    const response = await request(app).post(polishPath(UNKNOWN_ID)).send({ text: "radi" });

    expect(response.status).toBe(401);
  });

  it("reports the feature on in /api/me", async () => {
    const { agent } = await setUp();

    const response = await agent.get("/api/me");

    expect(response.body.features).toEqual({ aiPolish: true });
  });
});

describe("AI polish without a provider key", () => {
  it("is off in /api/me, and the route answers 503 not_configured", async () => {
    const { agent, service } = await setUp(undefined, null);

    const me = await agent.get("/api/me");
    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(me.body.features).toEqual({ aiPolish: false });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("not_configured");
  });
});

describe("textPolisherFromEnv", () => {
  const MODEL = "openai:gpt-5.4-mini-2026-03-17";

  it("is off without the provider's key", () => {
    expect(textPolisherFromEnv({ AI_POLISH_MODEL: MODEL })).toBeNull();
    expect(textPolisherFromEnv({ AI_POLISH_MODEL: MODEL, OPENAI_API_KEY: "" })).toBeNull();
  });

  it("is off without a model", () => {
    expect(textPolisherFromEnv({ OPENAI_API_KEY: "sk-test" })).toBeNull();
  });

  it("is on with the model and its provider's key", () => {
    expect(
      textPolisherFromEnv({ AI_POLISH_MODEL: MODEL, OPENAI_API_KEY: "sk-test" }),
    ).not.toBeNull();
  });

  it("refuses a model that is not in provider:model form, or an unknown provider", () => {
    expect(() =>
      textPolisherFromEnv({ AI_POLISH_MODEL: "gpt-5.4-mini", OPENAI_API_KEY: "sk-test" }),
    ).toThrow(/AI_POLISH_MODEL/);
    expect(() =>
      textPolisherFromEnv({ AI_POLISH_MODEL: "acme:fast", OPENAI_API_KEY: "sk-test" }),
    ).toThrow(/AI_POLISH_MODEL/);
  });

  it("uses the fake polisher when the test-only flag is set, with no key", () => {
    expect(textPolisherFromEnv({ AI_POLISH_FAKE: "true" })).not.toBeNull();
  });
});
