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

/** How a device is named everywhere, e.g. "Samsung Galaxy S21", or just "USB cable". */
export function deviceLabel({ manufacturer, model }: Pick<Device, "manufacturer" | "model">) {
  return manufacturer ? `${manufacturer} ${model}` : model;
}

/**
 * `GET /api/devices`: every word of the search must match the manufacturer,
 * model or serial number; `ownerId` keeps one customer's devices and
 * `generic=true` keeps only generic ones. The list is sorted by manufacturer,
 * then model.
 */
export const deviceListQuerySchema = pageQuerySchema
  .extend({
    search: z.string().trim().optional(),
    sortDir: sortDirSchema.default("asc"),
    ownerId: z.string().uuid().optional(),
    generic: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .refine((query) => !(query.ownerId && query.generic), {
    message: "A device cannot both have an owner and be generic",
    path: ["generic"],
  });

export type DeviceListQuery = z.input<typeof deviceListQuerySchema>;
