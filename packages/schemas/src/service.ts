import { z } from "zod";
import { customerSummarySchema } from "./customer.js";
import { deviceSummarySchema } from "./device.js";
import { optionalText, sortDirSchema } from "./fields.js";
import { serviceLineSchema } from "./serviceLine.js";

/** Where a service is in its lifecycle; a new service is Received (see GLOSSARY.md). */
export const STATUSES = ["RECEIVED", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"] as const;
export const statusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof statusSchema>;

/** A calendar date without a time of day, as `YYYY-MM-DD`. */
export const plainDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = plainDateToUtc(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Invalid date");

/** Midnight UTC of a `YYYY-MM-DD` date, as Postgres stores a `DATE`. */
export function plainDateToUtc(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

/** The `YYYY-MM-DD` date of a `DATE` read from Postgres as midnight UTC. */
export function utcToPlainDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** The most devices one service may have attached. */
export const SERVICE_DEVICES_MAX = 20;

/**
 * What staff members enter when creating or editing a service. Every device
 * must be generic or owned by the service's customer; repeated ids count once.
 */
export const serviceInputSchema = z.object({
  customerId: z.string().uuid(),
  deviceIds: z
    .array(z.string().uuid())
    .min(1)
    .max(SERVICE_DEVICES_MAX)
    .transform((ids) => [...new Set(ids)]),
  description: optionalText,
  date: plainDateSchema,
});

export type ServiceInputValues = z.input<typeof serviceInputSchema>;
export type ServiceInput = z.output<typeof serviceInputSchema>;

export const serviceSchema = z.object({
  id: z.string(),
  /** The service number, `YYYY-NNNN`. */
  number: z.string(),
  publicToken: z.string(),
  date: plainDateSchema,
  description: z.string().nullable(),
  status: statusSchema,
  customer: customerSummarySchema,
  /** In the order they were attached. */
  devices: z.array(deviceSummarySchema),
  /** Σ quantity × unit price over all its lines, in whole RSD. */
  total: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/** A service as listed: its total, but not its lines. */
export type Service = z.infer<typeof serviceSchema>;

/** One service as the drawer shows it, with its lines in order. */
export const serviceDetailSchema = serviceSchema.extend({
  lines: z.array(serviceLineSchema),
});

export type ServiceDetail = z.infer<typeof serviceDetailSchema>;

/** A service in a device's history, saying how the device appears on it. */
export const deviceServiceSchema = serviceSchema.extend({
  /** The device is one of the service's attached devices. */
  attached: z.boolean(),
  /** The device is sold on one of the service's sale lines. */
  sold: z.boolean(),
});

export type DeviceService = z.infer<typeof deviceServiceSchema>;

/** The service number as staff members see it, e.g. `2026-0042`. */
export function formatServiceNumber(year: number, sequence: number) {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}

export const SERVICE_PAGE_SIZE_DEFAULT = 20;
export const SERVICE_PAGE_SIZE_MAX = 50;

/** What the services list can be sorted by; a customer's services come newest first. */
export const SERVICE_SORTS = ["date", "customer"] as const;
export type ServiceSort = (typeof SERVICE_SORTS)[number];

/**
 * `GET /api/services`: every word of the search must match the service
 * number, the customer's name or phone, an attached device's manufacturer or
 * model, or the description. `status` keeps one status. Sorted by date (ties
 * by service number) or by customer name, newest first by default. `cursor`
 * is the previous page's `nextCursor`, an opaque string valid for the same sort.
 */
export const serviceListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SERVICE_PAGE_SIZE_MAX)
    .default(SERVICE_PAGE_SIZE_DEFAULT),
  search: z.string().trim().optional(),
  status: statusSchema.optional(),
  sort: z.enum(SERVICE_SORTS).default("date"),
  sortDir: sortDirSchema.default("desc"),
});

export type ServiceListQuery = z.input<typeof serviceListQuerySchema>;

/** One page of a cursor-paged list; `nextCursor` is null on the last page. */
export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
