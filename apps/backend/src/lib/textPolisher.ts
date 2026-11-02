import type { Request } from "express";
import { generateText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { CustomerReportPolish } from "@servicebook/schemas";

/**
 * AI polish (GLOSSARY.md, ADR-0007): rewrites a draft customer report for
 * grammar and a professional tone, keeping its language, script and facts.
 * Only the text is ever sent to the model.
 */
export interface TextPolisher {
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

/** Whitespace-insensitive, so a polish that only reflows the text counts as no change. */
function normalized(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function toPolishResult(input: string, output: string): CustomerReportPolish {
  const text = output.trim();
  return { text, changed: normalized(text) !== normalized(input) };
}

/** A polisher backed by an AI SDK language model. */
export function createTextPolisher({ model }: { model: LanguageModel }): TextPolisher {
  return {
    async polish(text) {
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: text,
        temperature: 0.2,
        // Reports stay out of OpenAI's storage and the dashboard's Logs (ADR-0007).
        // Other providers ignore options keyed to OpenAI.
        providerOptions: { openai: { store: false } },
      });
      return toPolishResult(text, result.text);
    },
  };
}

/**
 * A deterministic stand-in for the e2e tests (`AI_POLISH_FAKE`), which never
 * calls a provider: it marks the text as polished, so polishing twice differs too.
 */
export function createFakeTextPolisher(): TextPolisher {
  return {
    async polish(text) {
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
