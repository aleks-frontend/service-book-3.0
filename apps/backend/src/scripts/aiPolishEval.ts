import "dotenv/config";
import { formatPolishEval, polishEvalPolisher, runPolishEval } from "../lib/polishEval.js";

// Usage: npm run eval:ai-polish -w @servicebook/backend
// The manual prompt eval of AI polish: sends the sample reports in
// lib/polishEval.ts to the model AI_POLISH_MODEL names (paid, a fraction of a
// cent a run) and prints each input next to its output. Not part of CI.
try {
  const polisher = polishEvalPolisher(process.env);
  console.log(`AI polish eval against ${process.env.AI_POLISH_MODEL}\n`);
  const results = await runPolishEval(polisher);
  console.log(
    formatPolishEval(results, {
      columnWidth: Math.max(30, Math.floor(((process.stdout.columns || 120) - 3) / 2)),
    }),
  );
  const flagged = results.filter(({ warnings }) => warnings.length > 0).length;
  console.log(
    `${results.length} samples, ${flagged} flagged. Check each keeps its language and script and adds no facts.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
