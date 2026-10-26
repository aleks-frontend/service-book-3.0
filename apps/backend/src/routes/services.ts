import { Router, type Response } from "express";
import {
  customerReportInputSchema,
  plainDateToUtc,
  serviceCreateInputSchema,
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
import { deletePhotoObjects, photoStorageOf } from "../lib/photoStorage.js";
import {
  parsePhotos,
  photoRows,
  photoUpload,
  sendPhotoStorageError,
  storePhotosThen,
} from "../lib/photoUploads.js";
import { prisma } from "../lib/prisma.js";
import { listServiceIds } from "../lib/serviceList.js";
import { newPublicToken, nextSequence } from "../lib/serviceNumbers.js";
import { serviceSelect, toService } from "../lib/serviceRows.js";
import {
  idParam,
  isForeignKeyViolation,
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

// JSON, or multipart when the intake note has photos (see serviceCreateInputSchema).
// The photos are stored first, then the service, its intake note and the note's
// photos are written in one transaction; if that fails, the photos are deleted again.
servicesRouter.post("/", photoUpload(LABEL), async (req, res) => {
  const input = parseBody(serviceCreateInputSchema, req, res, LABEL);
  if (!input) return;
  if (!(await checkCustomerAndDevices(res, input))) return;
  const photos = parsePhotos(req, res, LABEL);
  if (!photos) return;

  const date = plainDateToUtc(input.date);
  const intakeNote =
    input.intakeNote || photos.length > 0
      ? {
          type: "NOTE" as const,
          text: input.intakeNote,
          authorId: req.user!.id,
          photos: { create: photoRows(photos) },
        }
      : undefined;
  try {
    const row = await storePhotosThen(photoStorageOf(req), photos, () =>
      prisma.$transaction(async (tx) => {
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
            log: intakeNote && { create: intakeNote },
          },
          select: serviceDetailSelect,
        });
      }),
    );
    res.status(201).json(toServiceDetail(row));
  } catch (error) {
    // The customer or a device was deleted while the photos uploaded.
    if (isForeignKeyViolation(error) && !(await checkCustomerAndDevices(res, input))) return;
    sendPhotoStorageError(res, error);
  }
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
  // Photos belong to notes only; to photograph a finished repair, staff add a note.
  if (req.is("multipart/form-data")) {
    sendFieldError(res, LABEL, "photos", "A status change can't carry photos");
    return;
  }
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

// The service's attached devices, lines and log go with it, and its photos'
// objects are deleted once it is; the devices and customer stay.
servicesRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  const photos = await prisma.$transaction(async (tx) => {
    // Locks the service, so no note can add photos between listing them and the delete.
    const [service] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "service" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
    if (!service) return null;
    const photos = await tx.photo.findMany({
      where: { logEntry: { serviceId: id } },
      select: { key: true, thumbnailKey: true },
    });
    await tx.service.delete({ where: { id } });
    return photos;
  });
  if (!photos) {
    sendNotFound(res, LABEL);
    return;
  }
  await deletePhotoObjects(photoStorageOf(req), photos);
  res.status(204).send();
});
