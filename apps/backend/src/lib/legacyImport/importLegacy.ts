import { applyImportPlan } from "./apply.js";
import { planLegacyImport, type ImportReport } from "./plan.js";

/**
 * Imports a Firebase export of the old app. A dry run only reports what
 * would be imported; otherwise the plan is applied in one transaction,
 * upserting by legacy ID, so running it again changes nothing.
 */
export async function importLegacy(
  raw: unknown,
  { dryRun }: { dryRun: boolean },
): Promise<ImportReport> {
  const { plan, report } = planLegacyImport(raw);
  if (!dryRun) await applyImportPlan(plan);
  return report;
}

/** The report as the CLI prints it: counts, then every anomaly and skipped record. */
export function formatReport({ counts, anomalies, skipped }: ImportReport) {
  return [
    "Records:",
    `  customers       ${counts.customers}`,
    `  devices         ${counts.devices.owned + counts.devices.generic} (${counts.devices.owned} owned, ${counts.devices.generic} generic)`,
    `  actions         ${counts.actions}`,
    `  services        ${counts.services}`,
    `  work lines      ${counts.workLines}`,
    `  sale lines      ${counts.saleLines}`,
    `  legacy remarks  ${counts.legacyRemarks}`,
    "",
    `Anomalies (${anomalies.length}):`,
    ...anomalies.map(({ record, message }) => `  ${record}: ${message}`),
    "",
    `Skipped (${skipped.length}):`,
    ...skipped.map(({ record, reason }) => `  ${record}: ${reason}`),
  ].join("\n");
}
