import { z } from "zod";
import { customerSummarySchema } from "./customer.js";
import { optionalText, sortDirSchema } from "./fields.js";
import { pageQuerySchema } from "./pagination.js";

/**
 * What staff members enter when creating or editing a device. Only the model
 * is required: accessories such as cables often have no manufacturer. No owner
 * makes the device generic.
 */
export const deviceInputSchema = z.object({
  manufacturer: optionalText,
  model: z.string().trim().min(1),
  serialNumber: optionalText,
  description: optionalText,
  ownerId: z
    .string()
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
});

export type DeviceInputValues = z.input<typeof deviceInputSchema>;
export type DeviceInput = z.output<typeof deviceInputSchema>;

export const deviceSchema = z.object({
  id: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string(),
  serialNumber: z.string().nullable(),
  description: z.string().nullable(),
  /** Null for a generic device. */
  owner: customerSummarySchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Device = z.infer<typeof deviceSchema>;

/** Enough of a device to name it and tell whose it is, e.g. as attached to a service. */
export const deviceSummarySchema = deviceSchema.pick({
  id: true,
  manufacturer: true,
  model: true,
  serialNumber: true,
  owner: true,
});

export type DeviceSummary = z.infer<typeof deviceSummarySchema>;

/** How a device is named everywhere, e.g. "Samsung Galaxy S21", or just "USB cable". */
export function deviceLabel({ manufacturer, model }: Pick<Device, "manufacturer" | "model">) {
  return manufacturer ? `${manufacturer} ${model}` : model;
}

/**
 * `GET /api/devices`: every word of the search must match the manufacturer,
 * model or serial number; `ownerId` keeps one customer's devices,
 * `generic=true` keeps only generic ones, and `availableTo` keeps the devices
 * a customer can bring in for service (theirs and generic ones). At most one
 * of the three applies. The list is sorted by manufacturer, then model.
 */
export const deviceListQuerySchema = pageQuerySchema
  .extend({
    search: z.string().trim().optional(),
    sortDir: sortDirSchema.default("asc"),
    ownerId: z.string().uuid().optional(),
    availableTo: z.string().uuid().optional(),
    generic: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .refine(
    (query) => [query.ownerId, query.generic, query.availableTo].filter(Boolean).length <= 1,
    {
      message: "Filter by owner, generic or available to a customer, not several",
      path: ["generic"],
    },
  );

export type DeviceListQuery = z.input<typeof deviceListQuerySchema>;
