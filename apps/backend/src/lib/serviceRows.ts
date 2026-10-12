import {
  formatServiceNumber,
  linesTotal,
  utcToPlainDate,
  type Service,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

const deviceSummarySelect = {
  id: true,
  manufacturer: true,
  model: true,
  serialNumber: true,
  owner: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.DeviceSelect;

/** What a service is read with to be shown as a `Service`. */
export const serviceSelect = {
  id: true,
  year: true,
  sequence: true,
  publicToken: true,
  date: true,
  description: true,
  status: true,
  customer: { select: { id: true, name: true, phone: true } },
  devices: { orderBy: { position: "asc" }, select: { device: { select: deviceSummarySelect } } },
  // Only what the total needs; the list does not show the lines.
  lines: { select: { quantity: true, unitPrice: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServiceSelect;

export type ServiceRow = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

/** What the API shows of a service: its number and total, never the legacy fields. */
export function toService({ year, sequence, date, devices, lines, ...rest }: ServiceRow): Service {
  return {
    ...rest,
    number: formatServiceNumber(year, sequence),
    date: utcToPlainDate(date),
    devices: devices.map(({ device }) => device),
    total: linesTotal(lines),
  };
}

/** Newest first, as the services list sorts by default; ties by service number. */
const newestFirst = [
  { date: "desc" },
  { year: "desc" },
  { sequence: "desc" },
] satisfies Prisma.ServiceOrderByWithRelationInput[];

/** Every service matching `where`, newest first, for a customer's or device's history. */
export async function findServiceHistory(where: Prisma.ServiceWhereInput): Promise<Service[]> {
  const rows = await prisma.service.findMany({
    where,
    orderBy: newestFirst,
    select: serviceSelect,
  });
  return rows.map(toService);
}
