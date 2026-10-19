import "dotenv/config";
import { readFileSync } from "node:fs";
import { formatReport, importLegacy } from "../lib/legacyImport/importLegacy.js";
import { prisma } from "../lib/prisma.js";

// Usage: npm run import:legacy -w @servicebook/backend -- <export.json> [--dry-run]
// Imports a Firebase export of the old app. Run it with --dry-run first and
// review the report; running it for real again later is safe (#17).
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const [file] = args.filter((arg) => arg !== "--dry-run");

if (!file) {
  console.error(
    "Usage: npm run import:legacy -w @servicebook/backend -- <export.json> [--dry-run]",
  );
  process.exit(1);
}

try {
  const report = await importLegacy(JSON.parse(readFileSync(file, "utf8")), { dryRun });
  console.log(formatReport(report));
  console.log(dryRun ? "\nDry run: nothing was written." : "\nImported.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
