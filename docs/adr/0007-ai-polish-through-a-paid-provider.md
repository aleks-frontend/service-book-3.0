# AI polish uses a paid provider through the AI SDK

## Context

Staff members write the customer report quickly, often as terse notes with typos and missing diacritics, and customers read it on the service report and the public status page. AI polish (GLOSSARY.md) rewrites the draft with a language model. A report describes a customer's device and what was wrong with it, so what we send, and what the provider keeps, matters. Volume is tiny (about 82 services a year), so cost is not a factor beyond "cheap".

## Decision

- **A paid OpenAI model, reached through the AI SDK** (`ai` + `@ai-sdk/openai`). We chose it over the free Gemini tier, whose terms allow training on prompts and whose rate limits are tight. A mini-tier model costs well under a dollar a year at our volume. We picked mini over nano for the quality of Serbian diacritics and script, and of Hungarian.
- **Only the report text is sent.** The route is scoped to a service (`POST /api/services/:id/customer-report/polish`) but sends the model none of its fields: no customer, device or service lines.
- **A second kind of text, under the same rules.** The service description is polished too, more lightly (punctuation and a professional tone, no swearing, but kept short) and with its own prompt (`POST /api/services/description/polish`). That route is not scoped to a service, since a new one has no id yet, and it too sends the model only the text.
- **`store: false` on every OpenAI call**, through the provider options, so OpenAI doesn't keep reports and they don't show in the dashboard's Logs.
- **The key stays server-side.** `OPENAI_API_KEY` is read only by the backend; the admin panel learns only whether the feature is on (`features.aiPolish` on `/api/me`).
- **Providers swap through config.** One env value, `AI_POLISH_MODEL`, names the model as `provider:model`. Without it, or without that provider's key, AI polish is off: the button is hidden and the route answers 503 `not_configured`.
- **The text polisher is injected.** `createApp` takes it as an option, the way it takes photo storage (ADR-0006). The API tests pass one backed by the AI SDK's mock model, and the e2e tests switch the backend to a deterministic fake with `AI_POLISH_FAKE`.

## Consequences

- `AI_POLISH_MODEL` names a dated snapshot (e.g. `gpt-5.4-mini-2026-03-17`), never a moving alias, so behaviour only changes when the env does.
- The OpenAI project's model allow-list (Project settings → Limits) must include that exact snapshot. Switching models means allowing the new snapshot there, re-running the prompt eval, then changing the env.
- Adding another provider means adding its AI SDK package and an entry in the polisher's provider table, with the env var holding its key.
- Report and description text is never logged; a failure is logged, and reported to Sentry, as its code (`unavailable`, `timeout`, `invalid_output`) and the provider's HTTP status only. Sentry attaches request bodies by default, so `beforeSend` drops them from events on the customer report routes and the description polish route.
