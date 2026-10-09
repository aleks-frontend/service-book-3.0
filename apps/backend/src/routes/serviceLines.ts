import { Router, type Request, type Response } from "express";
import {
  deviceLabel,
  serviceLineInputSchema,
  serviceLineOrderSchema,
  serviceLineUpdateSchema,
  type ServiceLine,
  type ServiceLineInput,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  idParam,
  isNotFound,
  parseBody,
  sendFieldError,
  sendNotFound,
} from "../lib/routeHelpers.js";

/** Mounted at `/api/services/:id/lines`; `:id` is the service's. */
export const serviceLinesRouter = Router({ mergeParams: true });

const LABEL = "Service line";

/** What the API shows of a line; its position is its place in the list. */
export const lineSelect = {
  id: true,
  type: true,
  actionId: true,
  deviceId: true,
  label: true,
  quantity: true,
  unitPrice: true,
} satisfies Prisma.ServiceLineSelect;

/** The lines of a service in the order staff members put them. */
export const lineOrder = [
  { position: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.ServiceLineOrderByWithRelationInput[];

/** The service named by the path, or null after sending a 404. */
async function serviceParam(req: Request, res: Response) {
  const id = idParam(req, res, "Service");
  if (!id) return null;

  const service = await prisma.service.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  });
  if (!service) sendNotFound(res, "Service");
  return service;
}

/** The service and line ids from the path, or null after sending a 404. */
function lineParams(req: Request, res: Response) {
  const serviceId = idParam(req, res, "Service");
  const lineId = serviceId && idParam(req, res, LABEL, "lineId");
  return serviceId && lineId ? { serviceId, lineId } : null;
}

/**
 * What the new line refers to, with its label snapshot and unit price, or
 * null after sending a 400. A work line's price defaults to the action's; a
 * sold device must be generic or the service customer's.
 */
async function lineReference(res: Response, input: ServiceLineInput, customerId: string) {
  if (input.type === "WORK") {
    const action = await prisma.action.findUnique({ where: { id: input.actionId } });
    if (!action) {
      sendFieldError(res, LABEL, "actionId", "Action not found");
      return null;
    }
    return {
      type: input.type,
      actionId: action.id,
      label: action.name,
      unitPrice: input.unitPrice ?? action.price,
    };
  }

  const device = await prisma.device.findUnique({ where: { id: input.deviceId } });
  if (!device) {
    sendFieldError(res, LABEL, "deviceId", "Device not found");
    return null;
  }
  if (device.ownerId !== null && device.ownerId !== customerId) {
    sendFieldError(res, LABEL, "deviceId", "Device belongs to another customer");
    return null;
  }
  return {
    type: input.type,
    deviceId: device.id,
    label: deviceLabel(device),
    unitPrice: input.unitPrice,
  };
}

// A new line goes last.
serviceLinesRouter.post("/", async (req, res) => {
  const service = await serviceParam(req, res);
  if (!service) return;
  const input = parseBody(serviceLineInputSchema, req, res, LABEL);
  if (!input) return;
  const reference = await lineReference(res, input, service.customerId);
  if (!reference) return;

  const line: ServiceLine = await prisma.$transaction(async (tx) => {
    // Locks the service until the line is in, so concurrent adds get distinct positions.
    await tx.$queryRaw`SELECT 1 FROM "service" WHERE "id" = ${service.id}::uuid FOR UPDATE`;
    const { _max } = await tx.serviceLine.aggregate({
      where: { serviceId: service.id },
      _max: { position: true },
    });
    return tx.serviceLine.create({
      data: {
        ...reference,
        serviceId: service.id,
        quantity: input.quantity,
        position: (_max.position ?? -1) + 1,
      },
      select: lineSelect,
    });
  });
  res.status(201).json(line);
});

// Every line in the new order; positions are renumbered from 0.
serviceLinesRouter.put("/order", async (req, res) => {
  const service = await serviceParam(req, res);
  if (!service) return;
  const input = parseBody(serviceLineOrderSchema, req, res, LABEL);
  if (!input) return;

  const lines = await prisma.serviceLine.findMany({
    where: { serviceId: service.id },
    select: { id: true },
  });
  const named = new Set(input.lineIds);
  if (
    named.size !== input.lineIds.length ||
    named.size !== lines.length ||
    lines.some(({ id }) => !named.has(id))
  ) {
    sendFieldError(res, LABEL, "lineIds", "Name each of the service's lines once");
    return;
  }

  const ordered: ServiceLine[] = await prisma.$transaction(async (tx) => {
    for (const [position, id] of input.lineIds.entries()) {
      await tx.serviceLine.update({ where: { id }, data: { position } });
    }
    return tx.serviceLine.findMany({
      where: { serviceId: service.id },
      orderBy: lineOrder,
      select: lineSelect,
    });
  });
  res.json(ordered);
});

serviceLinesRouter.patch("/:lineId", async (req, res) => {
  const ids = lineParams(req, res);
  if (!ids) return;
  const input = parseBody(serviceLineUpdateSchema, req, res, LABEL);
  if (!input) return;

  try {
    const line: ServiceLine = await prisma.serviceLine.update({
      where: { id: ids.lineId, serviceId: ids.serviceId },
      data: input,
      select: lineSelect,
    });
    res.json(line);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});

serviceLinesRouter.delete("/:lineId", async (req, res) => {
  const ids = lineParams(req, res);
  if (!ids) return;

  try {
    await prisma.serviceLine.delete({ where: { id: ids.lineId, serviceId: ids.serviceId } });
    res.status(204).send();
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});
