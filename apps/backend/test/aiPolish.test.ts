import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/node";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type TestAgent from "supertest/lib/agent.js";
import { AI_POLISH_MAX, CUSTOMER_REPORT_MAX } from "@servicebook/schemas";
import { createApp } from "../src/app.js";
import {
  createTextPolisher,
  textPolisherFromEnv,
  type TextPolisher,
} from "../src/lib/textPolisher.js";
import { authenticatedAgent } from "./helpers.js";

// Sentry's exports can't be spied on in ESM, so its reporting is mocked for every test here.
vi.mock("@sentry/node", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/node")>()),
  captureMessage: vi.fn(),
}));

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

  it("instructs the model to polish a customer report", async () => {
    const { agent, model, service } = await setUp();

    await agent.post(polishPath(service.id)).send({ text: "zamenjen kondenzator" });

    const system = model.doGenerateCalls[0].prompt.filter((message) => message.role === "system");
    expect(system).toHaveLength(1);
    expect(system[0].content).toMatch(/customer report/);
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

/** A provider error, as the AI SDK reports a failed call. */
function providerError(statusCode: number, message = "Provider error") {
  return new APICallError({
    message,
    url: "https://api.openai.com/v1/responses",
    requestBodyValues: {},
    statusCode,
    responseBody: JSON.stringify({ error: { message } }),
    data: { error: { message } },
    isRetryable: statusCode === 429 || statusCode >= 500,
  });
}

/** A model that fails with each of `errors` in turn, then answers `reply`. */
function failingModel(errors: unknown[], reply = "Uređaj radi.") {
  const replies = mockModel(reply);
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      const error = errors[call++];
      if (error) throw error;
      return replies.doGenerate(options);
    },
  });
}

/** A model that never answers, until the call is aborted. */
function hangingModel() {
  return new MockLanguageModelV4({
    doGenerate: (options) =>
      new Promise((_resolve, reject) => {
        options.abortSignal?.addEventListener("abort", () => reject(options.abortSignal?.reason));
      }),
  });
}

/** Quick to give up, so a test doesn't wait the real 20s. */
const quickly = { timeoutMs: 100, retryDelayMs: 1 };

describe("AI polish of the model's output", () => {
  it("leaves the draft alone when the output reads the same, but for whitespace", async () => {
    const { agent, service } = await setUp(mockModel("  Uređaj  radi.\n"));

    const response = await agent.post(polishPath(service.id)).send({ text: "Uređaj radi." });

    expect(response.status).toBe(200);
    expect(response.body.changed).toBe(false);
  });

  it.each([
    ['"Uređaj radi ispravno."'],
    ["„Uređaj radi ispravno.“"],
    ["“Uređaj radi ispravno.”"],
    ["«Uređaj radi ispravno.»"],
    ["‘Uređaj radi ispravno.’"],
    ["Here’s the polished text:\nUređaj radi ispravno."],
    ["Ево дотераног текста:\nUređaj radi ispravno."],
    ["Here is the polished text:\n\nUređaj radi ispravno."],
    ['Here\'s the polished report: "Uređaj radi ispravno."'],
    ['  Here is the polished text:\n"Uređaj radi ispravno."  '],
  ])("strips wrapping quotes and a preamble from %j", async (reply) => {
    const { agent, service } = await setUp(mockModel(reply));

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.status).toBe(200);
    expect(response.body.text).toBe("Uređaj radi ispravno.");
  });

  it("keeps a report that itself starts like a preamble", async () => {
    const reply = "Here is what we did: replaced the screen.";
    const { agent, service } = await setUp(mockModel(reply));

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.body.text).toBe(reply);
  });

  it("keeps quotes that don't wrap the whole text", async () => {
    const reply = '"Ekran" je zamenjen, a uređaj je "očišćen".';
    const { agent, service } = await setUp(mockModel(reply));

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.body.text).toBe(reply);
  });

  it.each([
    ["empty", ""],
    ["blank", "  \n "],
    ["only quotes", '""'],
    ["over-length", "a".repeat(CUSTOMER_REPORT_MAX + 1)],
  ])("rejects %s output with 502 invalid_output", async (_case, reply) => {
    const { agent, service } = await setUp(mockModel(reply));

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe("invalid_output");
  });
});

describe("AI polish when the provider fails", () => {
  /** A service whose polish goes through `model`, giving up quickly. */
  const setUpWith = (model: MockLanguageModelV4) =>
    setUp(model, createTextPolisher({ model, ...quickly }));

  it.each([429, 500, 503])(
    "retries a %i once, and succeeds when the retry does",
    async (status) => {
      const model = failingModel([providerError(status)]);
      const { agent, service } = await setUpWith(model);

      const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ text: "Uređaj radi.", changed: true });
      expect(model.doGenerateCalls).toHaveLength(2);
    },
  );

  it.each([429, 500, 503])("answers 503 unavailable when a %i persists", async (status) => {
    const model = failingModel([providerError(status), providerError(status)]);
    const { agent, service } = await setUpWith(model);

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("unavailable");
    expect(response.body.dailyLimit).toBeUndefined();
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("says when the provider's daily limit was reached", async () => {
    const daily = () =>
      providerError(
        429,
        "Rate limit reached for gpt-5.4-mini in organization org-x on requests per day (RPD): Limit 200, Used 200.",
      );
    const { agent, service } = await setUpWith(failingModel([daily(), daily()]));

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: "unavailable", dailyLimit: true });
  });

  it("doesn't retry an error a retry can't fix", async () => {
    const model = failingModel([providerError(401)]);
    const { agent, service } = await setUpWith(model);

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("unavailable");
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("answers 504 timeout when the model hangs", async () => {
    const { agent, service } = await setUpWith(hangingModel());

    const response = await agent.post(polishPath(service.id)).send({ text: "radi" });

    expect(response.status).toBe(504);
    expect(response.body.code).toBe("timeout");
  });

  it("logs and reports only the failure code and status, never the text", async () => {
    const text = "zamenjen kondenzator kod Marka";
    const error = providerError(500, `Upstream failed on: ${text}`);
    const { agent, service } = await setUpWith(failingModel([error, error]));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const reported = vi.mocked(Sentry.captureMessage);
    reported.mockClear();

    try {
      await agent.post(polishPath(service.id)).send({ text });

      const everything = JSON.stringify([logged.mock.calls, reported.mock.calls]);
      expect(everything).not.toContain("kondenzator");
      expect(everything).toContain("unavailable");
      expect(reported).toHaveBeenCalledTimes(1);
      expect(reported.mock.calls[0][1]).toEqual({
        level: "warning",
        tags: { aiPolishFailure: "unavailable", providerStatus: "500" },
      });
    } finally {
      logged.mockRestore();
    }
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

const DESCRIPTION_POLISH = "/api/services/description/polish";

describe("AI polish of a service description", () => {
  it("polishes a description with no service to scope it, saving nothing", async () => {
    const model = mockModel("Ne pali se, pao u vodu, ekran razbijen.");
    const { agent } = await authenticatedAgent({ textPolisher: createTextPolisher({ model }) });

    const response = await agent
      .post(DESCRIPTION_POLISH)
      .send({ text: "ne pali se,pao u vodu ekran razbijen" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      text: "Ne pali se, pao u vodu, ekran razbijen.",
      changed: true,
    });
  });

  it("sends the model only the text, with the light-polish instructions", async () => {
    const model = mockModel("Ekran razbijen.");
    const { agent } = await authenticatedAgent({ textPolisher: createTextPolisher({ model }) });

    await agent.post(DESCRIPTION_POLISH).send({ text: "ekran razbijen" });

    expect(model.doGenerateCalls).toHaveLength(1);
    const [call] = model.doGenerateCalls;
    expect(call.prompt.filter((message) => message.role === "user")).toEqual([
      { role: "user", content: [{ type: "text", text: "ekran razbijen" }] },
    ]);
    const system = call.prompt.filter((message) => message.role === "system");
    expect(system).toHaveLength(1);
    expect(system[0].content).toMatch(/service description/);
    expect(system[0].content).not.toMatch(/customer report/);
    expect(call.providerOptions?.openai).toMatchObject({ store: false });
  });

  it.each([
    ["blank", { text: "  \n " }],
    ["over-length", { text: "a".repeat(AI_POLISH_MAX + 1) }],
    ["missing", {}],
  ])("rejects %s text with 400", async (_case, body) => {
    const model = mockModel("x");
    const { agent } = await authenticatedAgent({ textPolisher: createTextPolisher({ model }) });

    const response = await agent.post(DESCRIPTION_POLISH).send(body);

    expect(response.status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("requires a logged-in staff member", async () => {
    const app = createApp({ textPolisher: createTextPolisher({ model: mockModel("x") }) });

    const response = await request(app).post(DESCRIPTION_POLISH).send({ text: "radi" });

    expect(response.status).toBe(401);
  });

  it("answers 503 not_configured when AI polish is off", async () => {
    const { agent } = await authenticatedAgent({ textPolisher: null });

    const response = await agent.post(DESCRIPTION_POLISH).send({ text: "radi" });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("not_configured");
  });

  it.each([
    [
      "a persisting outage",
      failingModel([providerError(503), providerError(503)]),
      503,
      "unavailable",
    ],
    ["a hanging model", hangingModel(), 504, "timeout"],
    ["an over-long output", mockModel("a".repeat(AI_POLISH_MAX + 1)), 502, "invalid_output"],
  ])("answers a failure as the customer report does: %s", async (_case, model, status, code) => {
    const { agent } = await authenticatedAgent({
      textPolisher: createTextPolisher({ model, ...quickly }),
    });

    const response = await agent.post(DESCRIPTION_POLISH).send({ text: "radi" });

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
  });

  it("says when the provider's daily limit was reached", async () => {
    const daily = () => providerError(429, "Rate limit reached on requests per day (RPD).");
    const { agent } = await authenticatedAgent({
      textPolisher: createTextPolisher({ model: failingModel([daily(), daily()]), ...quickly }),
    });

    const response = await agent.post(DESCRIPTION_POLISH).send({ text: "radi" });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: "unavailable", dailyLimit: true });
  });
});
