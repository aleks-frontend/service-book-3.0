import { plainDateToUtc } from "@servicebook/schemas";
import { prisma } from "../prisma.js";
import { newPublicToken, nextSequence } from "../serviceNumbers.js";
import type { ImportPlan, PlannedService } from "./plan.js";

/** Ample for the whole export; the default five seconds is not. */
const TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000;

/** The new ids of the records upserted so far, by legacy id. */
type Ids = Map<string, string>;

function lookup(ids: Ids, legacyId: string) {
  const id = ids.get(legacyId);
  if (!id) throw new Error(`Legacy record ${legacyId} was not imported`);
  return id;
}

/** What the legacy data decides about a service: everything but its number and token. */
function serviceData(service: PlannedService, ids: { customers: Ids; devices: Ids; actions: Ids }) {
  return {
    date: plainDateToUtc(service.date),
    description: service.description,
    status: service.status,
    customerId: lookup(ids.customers, service.customerLegacyId),
    devices: service.deviceLegacyIds.map((legacyId, position) => ({
      deviceId: lookup(ids.devices, legacyId),
      position,
    })),
    lines: service.lines.map(({ type, label, quantity, unitPrice, ...ref }, position) => ({
      type,
      label,
      quantity,
      unitPrice,
      position,
      actionId: "actionLegacyId" in ref ? lookup(ids.actions, ref.actionLegacyId) : null,
      deviceId: "deviceLegacyId" in ref ? lookup(ids.devices, ref.deviceLegacyId) : null,
    })),
    log: service.remarks.map((text) => ({
      type: "LEGACY_REMARK" as const,
      text,
      createdAt: new Date(service.loggedAt),
    })),
  };
}

/**
 * Writes the plan in one transaction, upserting every record by legacy ID.
 * An imported service keeps its number and public token; a new one gets the
 * next number of its year, so numbers follow the plan's date order and the
 * counters end past them. Its attached devices, lines and legacy remarks are
 * replaced by the legacy ones; staff notes and status changes stay.
 */
export async function applyImportPlan(plan: ImportPlan) {
  await prisma.$transaction(
    async (tx) => {
      const ids = { customers: new Map(), actions: new Map(), devices: new Map() } satisfies Record<
        string,
        Ids
      >;

      for (const { legacyId, ...data } of plan.customers) {
        const { id } = await tx.customer.upsert({
          where: { legacyId },
          create: { legacyId, ...data },
          update: data,
          select: { id: true },
        });
        ids.customers.set(legacyId, id);
      }

      for (const { legacyId, ...data } of plan.actions) {
        const { id } = await tx.action.upsert({
          where: { legacyId },
          create: { legacyId, ...data },
          update: data,
          select: { id: true },
        });
        ids.actions.set(legacyId, id);
      }

      for (const { legacyId, ownerLegacyId, ...rest } of plan.devices) {
        const data = {
          ...rest,
          ownerId: ownerLegacyId ? lookup(ids.customers, ownerLegacyId) : null,
        };
        const { id } = await tx.device.upsert({
          where: { legacyId },
          create: { legacyId, ...data },
          update: data,
          select: { id: true },
        });
        ids.devices.set(legacyId, id);
      }

      for (const service of plan.services) {
        const { devices, lines, log, ...data } = serviceData(service, ids);
        const existing = await tx.service.findUnique({
          where: { legacyId: service.legacyId },
          select: { id: true },
        });

        if (existing) {
          await tx.service.update({
            where: { id: existing.id },
            data: {
              ...data,
              devices: { deleteMany: {}, create: devices },
              lines: { deleteMany: {}, create: lines },
              log: { deleteMany: { type: "LEGACY_REMARK" }, create: log },
            },
          });
        } else {
          const year = data.date.getUTCFullYear();
          await tx.service.create({
            data: {
              ...data,
              legacyId: service.legacyId,
              year,
              sequence: await nextSequence(tx, year),
              publicToken: newPublicToken(),
              devices: { create: devices },
              lines: { create: lines },
              log: { create: log },
            },
          });
        }
      }
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_TIMEOUT_MS },
  );
}
