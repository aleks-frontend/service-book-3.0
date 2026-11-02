import { setTimeout as sleep } from "node:timers/promises";
import type { Request } from "express";
import { APICallError, generateText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  CUSTOMER_REPORT_MAX,
  type AiPolishErrorCode,
  type CustomerReportPolish,
} from "@servicebook/schemas";

/**
 * AI polish (GLOSSARY.md, ADR-0007): rewrites a draft customer report for
 * grammar and a professional tone, keeping its language, script and facts.
 * Only the text is ever sent to the model.
 */
export interface TextPolisher {
  /** The polished text, or a `TextPolishError` saying why there is none. */
  polish(text: string): Promise<CustomerReportPolish>;
}

const SYSTEM_PROMPT = `You polish the customer report of a repair shop: the text a customer reads about the work done on their device.

- Fix grammar, spelling, punctuation and diacritics (e.g. "ociscen" becomes "očišćen").
- Make the tone professional and customer-facing.
- Reply in the same language and the same script as the input. Never translate. Serbian in Latin stays Latin, Serbian in Cyrillic stays Cyrillic. If the input mixes languages, keep the dominant one.
- Do not add facts: no parts, prices, causes, warranties or promises that are not in the input.
- Terse notes may become full sentences, without new content.
- Keep it about as long as the original.
- Return only the polished text, with no quotes, preamble or explanation.`;

/** Why a polish failed (`AiPolishErrorCode`, but for `not_configured`, which never gets this far). */
export type TextPolishFailure = Exclude<AiPolishErrorCode, "not_configured">;

/**
 * A failed polish. It never carries the report text or the provider's message,
 * which may quote it, so it is safe to log.
 */
export class TextPolishError extends Error {
  readonly code: TextPolishFailure;
  /** The provider's HTTP status, when it answered with an error. */
  readonly providerStatus?: number;
  /** Whether the provider refused because its daily limit was reached. */
  readonly dailyLimit: boolean;

  constructor(
    code: TextPolishFailure,
    { providerStatus, dailyLimit = false }: { providerStatus?: number; dailyLimit?: boolean } = {},
  ) {
    super(`AI polish failed: ${code}`);
    this.name = "TextPolishError";
    this.code = code;
    this.providerStatus = providerStatus;
    this.dailyLimit = dailyLimit;
  }
}

/** Whitespace-insensitive, so a polish that only reflows the text counts as no change. */
function normalized(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

/** Quote pairs a model may wrap its whole answer in: straight, curly, Serbian, Hungarian, guillemets. */
const WRAPPING_QUOTES =
  /^(?:"([^"]*)"|'([^']*)'|“([^“”]*)”|‘([^‘’]*)’|„([^„“”]*)[“”]|«([^«»]*)»|»([^«»]*)«)$/s;

/**
 * A leading "Here is the polished text:" (or sr "Evo …:" / "Ево …:", hu "Íme …:"), which the
 * prompt asks the model to leave out. Only when the text follows on a new line or
 * in quotes, so a report that itself starts "Here is what we did: …" is kept.
 */
const PREAMBLE =
  /^(?:here(?:['’]s| is)|evo|ево|íme)(?=\s)[^\n:]*:(?:[ \t]*\n|[ \t]*(?=["'“‘„«»]))\s*/iu;

/**
 * The model's answer as a customer report: trimmed, without a preamble or
 * wrapping quotes. Empty or over-long answers are `invalid_output`.
 */
function cleanOutput(output: string) {
  let text = output.trim().replace(PREAMBLE, "").trim();
  const quoted = WRAPPING_QUOTES.exec(text);
  if (quoted)
    text = quoted
      .slice(1)
      .find((inner) => inner !== undefined)!
      .trim();
  if (text === "" || text.length > CUSTOMER_REPORT_MAX) {
    throw new TextPolishError("invalid_output");
  }
  return text;
}

function toPolishResult(input: string, output: string): CustomerReportPolish {
  const text = cleanOutput(output);
  return { text, changed: normalized(text) !== normalized(input) };
}

/** Rate limits (429), provider outages (5xx) and lost connections are worth one more try. */
function isRetryable(error: unknown) {
  if (!APICallError.isInstance(error)) return false;
  const status = error.statusCode;
  return status === undefined ? error.isRetryable : status === 429 || status >= 500;
}

/** Whether a 429 is OpenAI's "Rate limit reached … on requests per day (RPD)", or tokens per day. */
function isDailyLimit(error: APICallError) {
  return (
    error.statusCode === 429 && /per day/i.test(`${error.message} ${error.responseBody ?? ""}`)
  );
}

/** The failure a provider error or a timeout means, dropping the error's message. */
function toPolishError(error: unknown, signal: AbortSignal): TextPolishError {
  if (error instanceof TextPolishError) return error;
  if (signal.aborted) return new TextPolishError("timeout");
  if (!APICallError.isInstance(error)) return new TextPolishError("unavailable");
  return new TextPolishError("unavailable", {
    providerStatus: error.statusCode,
    dailyLimit: isDailyLimit(error),
  });
}

type TextPolisherOptions = {
  model: LanguageModel;
  /** How long a polish waits for the model, retry included. */
  timeoutMs?: number;
  /** The pause before the one retry. */
  retryDelayMs?: number;
};

/**
 * A polisher backed by an AI SDK language model. It retries a rate limit or an
 * outage once, gives up after `timeoutMs`, and throws a `TextPolishError` on failure.
 */
export function createTextPolisher({
  model,
  timeoutMs = 20_000,
  retryDelayMs = 1_000,
}: TextPolisherOptions): TextPolisher {
  async function generate(text: string, abortSignal: AbortSignal) {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: text,
      temperature: 0.2,
      // The one retry is ours, so it shares the timeout and skips the SDK's longer backoff.
      maxRetries: 0,
      abortSignal,
      // Reports stay out of OpenAI's storage and the dashboard's Logs (ADR-0007).
      // Other providers ignore options keyed to OpenAI.
      providerOptions: { openai: { store: false } },
    });
    return result.text;
  }

  return {
    async polish(text) {
      const signal = AbortSignal.timeout(timeoutMs);
      let output: string;
      try {
        try {
          output = await generate(text, signal);
        } catch (error) {
          if (signal.aborted || !isRetryable(error)) throw error;
          await sleep(retryDelayMs, undefined, { signal });
          output = await generate(text, signal);
        }
      } catch (error) {
        throw toPolishError(error, signal);
      }
      return toPolishResult(text, output);
    },
  };
}

/**
 * A deterministic stand-in for the e2e tests (`AI_POLISH_FAKE`), which never
 * calls a provider. It marks the text as polished, so polishing twice differs
 * too, unless the text holds a marker picking another outcome:
 * `[unchanged]`, `[unavailable]`, `[daily limit]` or `[slow]` (polished after 2s).
 */
export function createFakeTextPolisher(): TextPolisher {
  return {
    async polish(text) {
      if (text.includes("[unchanged]")) return toPolishResult(text, text);
      if (text.includes("[unavailable]")) throw new TextPolishError("unavailable");
      if (text.includes("[daily limit]")) {
        throw new TextPolishError("unavailable", { providerStatus: 429, dailyLimit: true });
      }
      if (text.includes("[slow]")) await sleep(2_000);
      return toPolishResult(text, `${text.trim()} (polished)`);
    },
  };
}

/** The providers `AI_POLISH_MODEL` may name, each with the env var holding its key. */
const PROVIDERS = {
  openai: {
    keyVar: "OPENAI_API_KEY",
    model: (apiKey: string, modelId: string) => createOpenAI({ apiKey })(modelId),
  },
} as const;

/**
 * The polisher the environment configures, or null when AI polish is off:
 * `AI_POLISH_MODEL` (`provider:model`) and that provider's key must both be
 * set. `AI_POLISH_FAKE` (test-only) switches to the fake polisher.
 */
export function textPolisherFromEnv(env: NodeJS.ProcessEnv = process.env): TextPolisher | null {
  if (env.AI_POLISH_FAKE === "true") return createFakeTextPolisher();
  if (!env.AI_POLISH_MODEL) return null;

  const [providerName, modelId] = env.AI_POLISH_MODEL.split(/:(.*)/s);
  const provider = PROVIDERS[providerName as keyof typeof PROVIDERS];
  if (!provider || !modelId) {
    throw new Error(
      `AI_POLISH_MODEL must be provider:model, with provider one of ${Object.keys(PROVIDERS).join(", ")} (see .env.example).`,
    );
  }
  const apiKey = env[provider.keyVar];
  if (!apiKey) return null;
  return createTextPolisher({ model: provider.model(apiKey, modelId) });
}

/** The text polisher of the app handling the request, or null when AI polish is off. */
export function textPolisherOf(req: Request): TextPolisher | null {
  return req.app.locals.textPolisher as TextPolisher | null;
}
