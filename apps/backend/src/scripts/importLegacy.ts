import "dotenv/config";
import { readFileSync } from "node:fs";
import { formatReport, importLegacy } from "../lib/legacyImport/importLegacy.js";
import { prisma } from "../lib/prisma.js";

// Usage: npm run import:legacy -w @servicebook/backend -- <export.json | https://…> [--dry-run]
// Imports a Firebase export of the old app, from a file or straight from the
// database's REST URL (e.g. https://<db>.firebaseio.com/.json, readable until
// its rules are locked). Run it with --dry-run first and review the report;
// running it for real again later is safe (#17).
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const [file] = args.filter((arg) => arg !== "--dry-run");

if (!file) {
  console.error(
    "Usage: npm run import:legacy -w @servicebook/backend -- <export.json | https://…> [--dry-run]",
  );
  process.exit(1);
}

async function readExport(source: string) {
  if (!source.startsWith("https://")) return readFileSync(source, "utf8");
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Fetching ${source} failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

try {
  const report = await importLegacy(JSON.parse(await readExport(file)), { dryRun });
  console.log(formatReport(report));
  console.log(dryRun ? "\nDry run: nothing was written." : "\nImported.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
