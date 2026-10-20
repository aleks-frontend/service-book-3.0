import { randomUUID } from "node:crypto";
import { plainDateToUtc } from "@servicebook/schemas";
import { prisma } from "../prisma.js";
import { newPublicToken, reserveSequences } from "../serviceNumbers.js";
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

/**
 * Splits planned records into those imported before, with their ids, and new
 * ones, given fresh ids, so the new ones can be created in one query.
 */
function assignIds<T extends { legacyId: string }>(
  records: T[],
  imported: { id: string; legacyId: string | null }[],
) {
  const known = new Map(imported.map(({ id, legacyId }) => [legacyId, id]));
  const ids: Ids = new Map();
  const created: (T & { id: string })[] = [];
  const updated: (T & { id: string })[] = [];
  for (const record of records) {
    const id = known.get(record.legacyId);
    const withId = { ...record, id: id ?? randomUUID() };
    (id ? updated : created).push(withId);
    ids.set(record.legacyId, withId.id);
  }
  return { ids, created, updated };
}

const importedOnly = { where: { legacyId: { not: null } }, select: { id: true, legacyId: true } };

/** What the legacy data decides about a service: everything but its number and token. */
function serviceData(service: PlannedService, ids: { customers: Ids; devices: Ids; actions: Ids }) {
  return {
    date: plainDateToUtc(service.date),
    description: service.description,
    status: service.status,
    customerId: lookup(ids.customers, service.customerLegacyId),
  };
}

/** A service's attached devices, lines and legacy remarks, as rows of their own tables. */
function serviceChildren(
  serviceId: string,
  service: PlannedService,
  ids: { devices: Ids; actions: Ids },
) {
  return {
    devices: service.deviceLegacyIds.map((legacyId, position) => ({
      serviceId,
      deviceId: lookup(ids.devices, legacyId),
      position,
    })),
    lines: service.lines.map(({ type, label, quantity, unitPrice, ...ref }, position) => ({
      serviceId,
      type,
      label,
      quantity,
      unitPrice,
      position,
      actionId: "actionLegacyId" in ref ? lookup(ids.actions, ref.actionLegacyId) : null,
      deviceId: "deviceLegacyId" in ref ? lookup(ids.devices, ref.deviceLegacyId) : null,
    })),
    log: service.remarks.map((text) => ({
      serviceId,
      type: "LEGACY_REMARK" as const,
      text,
      createdAt: new Date(service.loggedAt),
    })),
  };
}

/**
 * Writes the plan in one transaction, upserting every record by legacy ID.
 * New records are created a table at a time, so a first import is a few
 * dozen queries however large the export (production's database is far
 * enough away that one query per record outlasts the timeout). An imported
 * service keeps its number and public token; new ones are numbered in the
 * plan's date order from their year's counter, so the counters end past them.
 * Attached devices, lines and legacy remarks are replaced by the legacy ones;
 * staff notes and status changes stay.
 */
export async function applyImportPlan(plan: ImportPlan) {
  await prisma.$transaction(
    async (tx) => {
      const customers = assignIds(plan.customers, await tx.customer.findMany(importedOnly));
      await tx.customer.createMany({ data: customers.created });
      for (const { id, ...data } of customers.updated) {
        await tx.customer.update({ where: { id }, data });
      }

      const actions = assignIds(plan.actions, await tx.action.findMany(importedOnly));
      await tx.action.createMany({ data: actions.created });
      for (const { id, ...data } of actions.updated) {
        await tx.action.update({ where: { id }, data });
      }

      const devices = assignIds(
        plan.devices.map(({ ownerLegacyId, ...device }) => ({
          ...device,
          ownerId: ownerLegacyId ? lookup(customers.ids, ownerLegacyId) : null,
        })),
        await tx.device.findMany(importedOnly),
      );
      await tx.device.createMany({ data: devices.created });
      for (const { id, ...data } of devices.updated) {
        await tx.device.update({ where: { id }, data });
      }

      const ids = { customers: customers.ids, actions: actions.ids, devices: devices.ids };
      const services = assignIds(plan.services, await tx.service.findMany(importedOnly));

      const updatedIds = services.updated.map(({ id }) => id);
      for (const service of services.updated) {
        await tx.service.update({ where: { id: service.id }, data: serviceData(service, ids) });
      }
      await tx.serviceDevice.deleteMany({ where: { serviceId: { in: updatedIds } } });
      await tx.serviceLine.deleteMany({ where: { serviceId: { in: updatedIds } } });
      await tx.serviceLogEntry.deleteMany({
        where: { serviceId: { in: updatedIds }, type: "LEGACY_REMARK" },
      });

      const created = services.created.map((service) => ({
        id: service.id,
        legacyId: service.legacyId,
        ...serviceData(service, ids),
      }));
      const nextSequence = new Map<number, number>();
      for (const { date } of created) {
        const year = date.getUTCFullYear();
        nextSequence.set(year, (nextSequence.get(year) ?? 0) + 1);
      }
      for (const [year, count] of nextSequence) {
        nextSequence.set(year, await reserveSequences(tx, year, count));
      }
      await tx.service.createMany({
        data: created.map((service) => {
          const year = service.date.getUTCFullYear();
          const sequence = nextSequence.get(year)!;
          nextSequence.set(year, sequence + 1);
          return { ...service, year, sequence, publicToken: newPublicToken() };
        }),
      });

      const children = [...services.updated, ...services.created].map((service) =>
        serviceChildren(service.id, service, ids),
      );
      await tx.serviceDevice.createMany({ data: children.flatMap(({ devices }) => devices) });
      await tx.serviceLine.createMany({ data: children.flatMap(({ lines }) => lines) });
      await tx.serviceLogEntry.createMany({ data: children.flatMap(({ log }) => log) });
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_TIMEOUT_MS },
  );
}
