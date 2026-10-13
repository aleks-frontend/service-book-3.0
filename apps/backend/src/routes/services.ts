import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
import {
  customerReportInputSchema,
  plainDateToUtc,
  serviceInputSchema,
  serviceListQuerySchema,
  statusChangeInputSchema,
  type CursorPage,
  type Service,
  type ServiceDetail,
  type ServiceInput,
  type Status,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { listServiceIds } from "../lib/serviceList.js";
import { serviceSelect, toService } from "../lib/serviceRows.js";
import {
  idParam,
  isNotFound,
  parseBody,
  sendFieldError,
  sendNotFound,
} from "../lib/routeHelpers.js";
import { lineOrder, lineSelect, serviceLinesRouter } from "./serviceLines.js";
import { serviceLogRouter } from "./serviceLog.js";

export const servicesRouter = Router();

servicesRouter.use("/:id/lines", serviceLinesRouter);
servicesRouter.use("/:id/log", serviceLogRouter);

const LABEL = "Service";

const serviceDetailSelect = {
  ...serviceSelect,
  customerReport: true,
  lines: { orderBy: lineOrder, select: lineSelect },
} satisfies Prisma.ServiceSelect;

type ServiceDetailRow = Prisma.ServiceGetPayload<{ select: typeof serviceDetailSelect }>;

/** One service with its lines, as the drawer shows it. */
function toServiceDetail(row: ServiceDetailRow): ServiceDetail {
  return { ...toService(row), lines: row.lines, customerReport: row.customerReport };
}

/** 12 URL-safe characters from 72 random bits: hard to guess, never sequential (ADR-0003). */
function newPublicToken() {
  return randomBytes(9).toString("base64url");
}

/**
 * The next sequence number of `year`. The upsert locks the year's counter row
 * until the surrounding transaction ends, so concurrent creates queue up and
 * never get the same number.
 */
async function nextSequence(tx: Prisma.TransactionClient, year: number) {
  const [{ last }] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "service_number_counter" ("year", "last") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last" = "service_number_counter"."last" + 1
    RETURNING "last"
  `;
  return last;
}

/**
 * Sends a 400 and returns false unless the customer exists and every device
 * exists and is generic or theirs.
 */
async function checkCustomerAndDevices(res: Response, { customerId, deviceIds }: ServiceInput) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    sendFieldError(res, LABEL, "customerId", "Customer not found");
    return false;
  }

  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds } },
    select: { ownerId: true },
  });
  if (devices.length !== deviceIds.length) {
    sendFieldError(res, LABEL, "deviceIds", "Device not found");
    return false;
  }
  if (devices.some(({ ownerId }) => ownerId !== null && ownerId !== customerId)) {
    sendFieldError(res, LABEL, "deviceIds", "Device belongs to another customer");
    return false;
  }
  return true;
}

function deviceRows(deviceIds: string[]) {
  return deviceIds.map((deviceId, position) => ({ deviceId, position }));
}

servicesRouter.get("/", async (req, res) => {
  const parsed = serviceListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return;
  }
  const page = await listServiceIds(parsed.data);
  if (!page) {
    res.status(400).json({
      error: "Invalid query",
      details: { formErrors: [], fieldErrors: { cursor: ["Invalid cursor"] } },
    });
    return;
  }

  const rows = await prisma.service.findMany({
    where: { id: { in: page.ids } },
    select: serviceSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const result: CursorPage<Service> = {
    // A service deleted since the ids were listed is left out.
    items: page.ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toService(row)] : [];
    }),
    nextCursor: page.nextCursor,
  };
  res.json(result);
});

servicesRouter.post("/", async (req, res) => {
  const input = parseBody(serviceInputSchema, req, res, LABEL);
  if (!input) return;
  if (!(await checkCustomerAndDevices(res, input))) return;

  const date = plainDateToUtc(input.date);
  const row = await prisma.$transaction(async (tx) => {
    const year = date.getUTCFullYear();
    return tx.service.create({
      data: {
        year,
        sequence: await nextSequence(tx, year),
        publicToken: newPublicToken(),
        date,
        description: input.description,
        customerId: input.customerId,
        devices: { create: deviceRows(input.deviceIds) },
      },
      select: serviceDetailSelect,
    });
  });
  res.status(201).json(toServiceDetail(row));
});

servicesRouter.get("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  const row = await prisma.service.findUnique({ where: { id }, select: serviceDetailSelect });
  if (!row) {
    sendNotFound(res, LABEL);
    return;
  }
  res.json(toServiceDetail(row));
});

// The Details tab always sends every field, so an update replaces them all,
// including the attached devices. The number, token and status stay.
servicesRouter.put("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;
  const input = parseBody(serviceInputSchema, req, res, LABEL);
  if (!input) return;
  if (!(await checkCustomerAndDevices(res, input))) return;

  try {
    const row = await prisma.service.update({
      where: { id },
      data: {
        date: plainDateToUtc(input.date),
        description: input.description,
        customerId: input.customerId,
        devices: { deleteMany: {}, create: deviceRows(input.deviceIds) },
      },
      select: serviceDetailSelect,
    });
    res.json(toServiceDetail(row));
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});

// Written in the drawer's Customer report tab; the service's details stay.
servicesRouter.put("/:id/customer-report", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;
  const input = parseBody(customerReportInputSchema, req, res, LABEL);
  if (!input) return;

  try {
    const row = await prisma.service.update({
      where: { id },
      data: { customerReport: input.customerReport },
      select: serviceDetailSelect,
    });
    res.json(toServiceDetail(row));
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});

// A change of status is logged with its author in the same transaction; setting
// the status the service already has changes and logs nothing.
servicesRouter.put("/:id/status", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;
  const input = parseBody(statusChangeInputSchema, req, res, LABEL);
  if (!input) return;

  const row = await prisma.$transaction(async (tx) => {
    // Locks the service, so concurrent changes each log the status they really changed from.
    const [current] = await tx.$queryRaw<{ status: Status }[]>`
      SELECT "status" FROM "service" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
    if (!current) return null;
    if (current.status !== input.status) {
      await tx.service.update({ where: { id }, data: { status: input.status } });
      await tx.serviceLogEntry.create({
        data: {
          serviceId: id,
          type: "STATUS_CHANGE",
          fromStatus: current.status,
          toStatus: input.status,
          authorId: req.user!.id,
        },
      });
    }
    return tx.service.findUniqueOrThrow({ where: { id }, select: serviceDetailSelect });
  });
  if (!row) {
    sendNotFound(res, LABEL);
    return;
  }
  res.json(toServiceDetail(row));
});

// The service's attached devices, lines and log go with it; the devices and customer stay.
servicesRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  try {
    await prisma.service.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});
