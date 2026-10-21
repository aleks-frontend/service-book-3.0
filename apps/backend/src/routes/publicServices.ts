import { Router } from "express";
import {
  formatServiceNumber,
  linesTotal,
  utcToPlainDate,
  type PublicService,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { sendNotFound } from "../lib/routeHelpers.js";
import { lineOrder } from "./serviceLines.js";

/** Reachable without a session: anyone holding a service's public link may read it. */
export const publicServicesRouter = Router();

const LABEL = "Service";

/** Only what the public status page shows; nothing else is read, so nothing else can leak. */
const publicServiceSelect = {
  year: true,
  sequence: true,
  date: true,
  status: true,
  customerReport: true,
  devices: {
    orderBy: { position: "asc" },
    select: { device: { select: { manufacturer: true, model: true, serialNumber: true } } },
  },
  lines: { orderBy: lineOrder, select: { label: true, quantity: true, unitPrice: true } },
} satisfies Prisma.ServiceSelect;

type PublicServiceRow = Prisma.ServiceGetPayload<{ select: typeof publicServiceSelect }>;

function toPublicService({
  year,
  sequence,
  date,
  devices,
  lines,
  ...rest
}: PublicServiceRow): PublicService {
  return {
    ...rest,
    number: formatServiceNumber(year, sequence),
    date: utcToPlainDate(date),
    devices: devices.map(({ device }) => device),
    lines,
    total: linesTotal(lines),
  };
}

// An unknown token gets the same 404 whether the service never existed or was deleted.
publicServicesRouter.get("/services/:publicToken", async (req, res) => {
  const row = await prisma.service.findUnique({
    where: { publicToken: req.params.publicToken },
    select: publicServiceSelect,
  });
  if (!row) {
    sendNotFound(res, LABEL);
    return;
  }
  res.json(toPublicService(row));
});
