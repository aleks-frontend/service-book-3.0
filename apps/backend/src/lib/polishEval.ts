/*
 * The manual prompt eval of AI polish (`npm run eval:ai-polish`): sample
 * customer reports and service descriptions sent through the real text polisher and model, printed
 * input next to output so the owner can check each keeps its language,
 * script and facts. Never run in CI, as it calls the paid provider.
 */
import {
  TextPolishError,
  textPolisherFromEnv,
  type TextKind,
  type TextPolisher,
} from "./textPolisher.js";

/** A draft of a kind of text, with a label saying what it tests (its language, its style). */
export type PolishEvalSample = { kind: TextKind; label: string; text: string };

const KIND_TITLES: Record<TextKind, string> = {
  customer_report: "Customer report",
  service_description: "Service description",
};

/**
 * One draft per kind of report and of description staff members write, each with
 * the slips AI polish should fix. Descriptions should come back as worded, only corrected.
 */
export const POLISH_EVAL_SAMPLES: readonly PolishEvalSample[] = [
  {
    kind: "customer_report",
    label: "Serbian (Latin)",
    text: "Urađena dijagnostika, utvrđeno je da baterija nedrži punjenje. zamenjena baterija novom, očišćen konektor i telefon sad radi normalno",
  },
  {
    kind: "customer_report",
    label: "Serbian (Cyrillic)",
    text: "Урађена дијагностика, прегорело је напајање. замењено напајање новим, рачунар ради нормално",
  },
  {
    kind: "customer_report",
    label: "Serbian without diacritics",
    text: "Laptop je ociscen od prasine i zamenjena je termalna pasta, sada se ne pregreva i ventilator je tisi",
  },
  {
    kind: "customer_report",
    label: "Hungarian",
    text: "A laptop billentyüzete ki lett cserélve, az uj billentyűzet jól müködik. megtisztitottuk a ventilátort is",
  },
  {
    kind: "customer_report",
    label: "English",
    text: "replaced the charging port, phone charges normaly now. also cleaned the speaker grill",
  },
  { kind: "customer_report", label: "Terse notes", text: "zamenjen kondenzator, ociscen, radi" },
  {
    kind: "service_description",
    label: "Serbian (Latin)",
    text: "Telefon ne pali se,pao u vodu. ekran je razbijen i nereaguje na dodir",
  },
  {
    kind: "service_description",
    label: "Serbian (Cyrillic)",
    text: "Рачунар се гаси после пар минута,вентилатор много бучан",
  },
  {
    kind: "service_description",
    label: "Serbian without diacritics",
    text: "Laptop se pregreva i gasi, punjac ne puni bateriju, tastatura ne radi",
  },
  {
    kind: "service_description",
    label: "Hungarian",
    text: "A telefon nem kapcsol be,leesett a földre. a kijelzö repedt",
  },
  {
    kind: "service_description",
    label: "Terse notes",
    text: "ekran razbijen, ne puni, kuciste ostceno",
  },
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
  kind: TextKind;
  label: string;
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
  for (const { kind, label, text } of samples) {
    try {
      const { text: output } = await polisher.polish(text, kind);
      const [before, after] = [scriptOf(text), scriptOf(output)];
      const warnings = before === after ? [] : [`script changed: ${before} → ${after}`];
      results.push({ kind, label, input: text, output, warnings });
    } catch (error) {
      if (!(error instanceof TextPolishError)) throw error;
      const status = error.providerStatus ? ` (provider ${error.providerStatus})` : "";
      results.push({
        kind,
        label,
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
    .map(({ kind, label, input, output, warnings }) => {
      const left = wrap(input, columnWidth);
      const right = output === null ? ["—"] : wrap(output, columnWidth);
      const rows = Array.from({ length: Math.max(left.length, right.length) }, (_, i) =>
        row(left[i] ?? "", right[i] ?? ""),
      );
      return [
        `── ${KIND_TITLES[kind]}: ${label} ──`,
        row("Input", "Output"),
        ...rows,
        ...warnings.map((warning) => `! ${warning}`),
        "",
      ].join("\n");
    })
    .join("\n");
}
