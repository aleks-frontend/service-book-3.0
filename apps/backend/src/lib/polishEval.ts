/*
 * The manual prompt eval of AI polish (`npm run eval:ai-polish`): sample
 * customer reports sent through the real text polisher and model, printed
 * input next to output so the owner can check each keeps its language,
 * script and facts. Never run in CI, as it calls the paid provider.
 */
import { TextPolishError, textPolisherFromEnv, type TextPolisher } from "./textPolisher.js";

export type PolishEvalSample = { kind: string; text: string };

/** One draft per kind of report staff members write, each with the slips AI polish should fix. */
export const POLISH_EVAL_SAMPLES: readonly PolishEvalSample[] = [
  {
    kind: "Serbian (Latin)",
    text: "Urađena dijagnostika, utvrđeno je da baterija nedrži punjenje. zamenjena baterija novom, očišćen konektor i telefon sad radi normalno",
  },
  {
    kind: "Serbian (Cyrillic)",
    text: "Урађена дијагностика, прегорело је напајање. замењено напајање новим, рачунар ради нормално",
  },
  {
    kind: "Serbian without diacritics",
    text: "Laptop je ociscen od prasine i zamenjena je termalna pasta, sada se ne pregreva i ventilator je tisi",
  },
  {
    kind: "Hungarian",
    text: "A laptop billentyüzete ki lett cserélve, az uj billentyűzet jól müködik. megtisztitottuk a ventilátort is",
  },
  {
    kind: "English",
    text: "replaced the charging port, phone charges normaly now. also cleaned the speaker grill",
  },
  { kind: "Terse notes", text: "zamenjen kondenzator, ociscen, radi" },
];

/**
 * The polisher the environment configures, never the e2e fake. Throws, saying
 * what to set, when AI polish is off.
 */
export function polishEvalPolisher(env: NodeJS.ProcessEnv): TextPolisher {
  const polisher = textPolisherFromEnv({ ...env, AI_POLISH_FAKE: undefined });
  if (!polisher) {
    throw new Error(
      "The AI polish eval needs AI_POLISH_MODEL and OPENAI_API_KEY set in apps/backend/.env (see .env.example).",
    );
  }
  return polisher;
}

export type Script = "Latin" | "Cyrillic" | "none";

/** The script most of a text's letters are in. */
export function scriptOf(text: string): Script {
  const cyrillic = text.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (cyrillic === 0 && latin === 0) return "none";
  return cyrillic > latin ? "Cyrillic" : "Latin";
}

export type PolishEvalResult = {
  kind: string;
  input: string;
  /** The polished text, or null when the polish failed. */
  output: string | null;
  /** What the owner should look at first: a failure, or a changed script. */
  warnings: string[];
};

/** Polishes each sample in turn. A failure is recorded, not thrown, so one doesn't stop the rest. */
export async function runPolishEval(
  polisher: TextPolisher,
  samples: readonly PolishEvalSample[] = POLISH_EVAL_SAMPLES,
): Promise<PolishEvalResult[]> {
  const results: PolishEvalResult[] = [];
  for (const { kind, text } of samples) {
    try {
      const { text: output } = await polisher.polish(text);
      const [before, after] = [scriptOf(text), scriptOf(output)];
      const warnings = before === after ? [] : [`script changed: ${before} → ${after}`];
      results.push({ kind, input: text, output, warnings });
    } catch (error) {
      if (!(error instanceof TextPolishError)) throw error;
      const status = error.providerStatus ? ` (provider ${error.providerStatus})` : "";
      results.push({
        kind,
        input: text,
        output: null,
        warnings: [`failed: ${error.code}${status}`],
      });
    }
  }
  return results;
}

/** A text as lines of at most `width` characters, broken between words where it can be. */
function wrap(text: string, width: number): string[] {
  return text.split("\n").flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      for (let rest = word; rest;) {
        const candidate = line ? `${line} ${rest}` : rest;
        if (candidate.length <= width) {
          line = candidate;
          rest = "";
        } else if (line) {
          lines.push(line);
          line = "";
        } else {
          lines.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
      }
    }
    lines.push(line);
    return lines;
  });
}

/** The eval's results as two columns per sample, input on the left and output on the right. */
export function formatPolishEval(
  results: readonly PolishEvalResult[],
  { columnWidth = 56 }: { columnWidth?: number } = {},
): string {
  const row = (left: string, right: string) => `${left.padEnd(columnWidth)} │ ${right}`.trimEnd();
  return results
    .map(({ kind, input, output, warnings }) => {
      const left = wrap(input, columnWidth);
      const right = output === null ? ["—"] : wrap(output, columnWidth);
      const rows = Array.from({ length: Math.max(left.length, right.length) }, (_, i) =>
        row(left[i] ?? "", right[i] ?? ""),
      );
      return [
        `── ${kind} ──`,
        row("Input", "Output"),
        ...rows,
        ...warnings.map((warning) => `! ${warning}`),
        "",
      ].join("\n");
    })
    .join("\n");
}
