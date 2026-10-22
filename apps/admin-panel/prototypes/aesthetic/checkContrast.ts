// PROTOTYPE (#24): `npx tsx prototypes/aesthetic/checkContrast.ts` fails on any pair under WCAG AA.
import { checks, TOKENS, type Mode } from "./tokens";

let failed = false;
for (const [key, tokens] of Object.entries(TOKENS)) {
  for (const mode of ["light", "dark"] as Mode[]) {
    for (const check of checks(tokens, mode)) {
      const ok = check.ratio >= check.min;
      if (!ok) failed = true;
      console.log(
        `${ok ? "  " : "✗ "}${key} ${mode.padEnd(5)} ${check.label.padEnd(24)} ${check.ratio.toFixed(2)}`,
      );
    }
  }
}
process.exit(failed ? 1 : 0);
