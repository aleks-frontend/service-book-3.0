import { Router, type Response } from "express";
import {
  deviceInputSchema,
  deviceListQuerySchema,
  type Device,
  type Page,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { bulkDeleteHandler } from "../lib/bulkDelete.js";
import { prisma } from "../lib/prisma.js";
import {
  idParam,
  isForeignKeyViolation,
  isNotFound,
  parseBody,
  sendFieldError,
  sendNotFound,
} from "../lib/routeHelpers.js";

export const devicesRouter = Router();

const LABEL = "Device";

// What the API shows of a device: the owner's name and phone, never the legacy fields.
const deviceSelect = {
  id: true,
  manufacturer: true,
  model: true,
  serialNumber: true,
  description: true,
  owner: { select: { id: true, name: true, phone: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeviceSelect;

/** Every word must appear in the manufacturer, model or serial number. */
function searchWhere(search: string): Prisma.DeviceWhereInput[] {
  return search
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      OR: (["manufacturer", "model", "serialNumber"] as const).map((field) => ({
        [field]: { contains: word, mode: "insensitive" },
      })),
    }));
}

/** The owner id named no customer; reported like any other field error. */
function sendUnknownOwner(res: Response) {
  sendFieldError(res, LABEL, "ownerId", "Customer not found");
}

devicesRouter.get("/", async (req, res) => {
  const parsed = deviceListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return;
  }

  const { page, pageSize, search, sortDir, ownerId, generic } = parsed.data;
  const where: Prisma.DeviceWhereInput = {
    ...(search && { AND: searchWhere(search) }),
    ...(ownerId && { ownerId }),
    ...(generic && { ownerId: null }),
  };

  const [items, total] = await Promise.all([
    prisma.device.findMany({
      where,
      // Sorted as the label reads; the id tie-break keeps pages stable when labels repeat.
      orderBy: [{ manufacturer: sortDir }, { model: sortDir }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: deviceSelect,
    }),
    prisma.device.count({ where }),
  ]);

  const result: Page<Device> = { items, total, page, pageSize };
  res.json(result);
});

devicesRouter.post("/", async (req, res) => {
  const input = parseBody(deviceInputSchema, req, res, LABEL);
  if (!input) return;

  try {
    const device: Device = await prisma.device.create({ data: input, select: deviceSelect });
    res.status(201).json(device);
  } catch (error) {
    if (!isForeignKeyViolation(error)) throw error;
    sendUnknownOwner(res);
  }
});

devicesRouter.post(
  "/bulk-delete",
  bulkDeleteHandler(LABEL, (id) => prisma.device.delete({ where: { id } })),
);

devicesRouter.get("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  const device: Device | null = await prisma.device.findUnique({
    where: { id },
    select: deviceSelect,
  });
  if (!device) {
    sendNotFound(res, LABEL);
    return;
  }
  res.json(device);
});

// The edit dialog always sends every field, so an update replaces them all;
// a missing or null owner makes the device generic.
devicesRouter.put("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;
  const input = parseBody(deviceInputSchema, req, res, LABEL);
  if (!input) return;

  try {
    const device: Device = await prisma.device.update({
      where: { id },
      data: input,
      select: deviceSelect,
    });
    res.json(device);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      sendUnknownOwner(res);
      return;
    }
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});

devicesRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  try {
    await prisma.device.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});
