import { z } from "zod";
import { customerSummarySchema, sortDirSchema } from "./customer.js";
import { pageQuerySchema } from "./pagination.js";

/** What staff members enter when creating or editing a device; no owner makes it generic. */
export const deviceInputSchema = z.object({
  name: z.string().trim().min(1),
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
  name: z.string(),
  /** Null for a generic device. */
  owner: customerSummarySchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Device = z.infer<typeof deviceSchema>;

/**
 * `GET /api/devices`: search matches the name; `ownerId` keeps one customer's
 * devices and `generic=true` keeps only generic ones. The list is sorted by name.
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
