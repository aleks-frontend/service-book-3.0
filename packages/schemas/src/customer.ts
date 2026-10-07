import { z } from "zod";
import { pageQuerySchema } from "./pagination.js";

/** An optional field: blank (or whitespace-only) input is stored as null. */
function blankAsNull<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((value: z.output<T> | null | undefined) => value || null);
}

const optionalText = blankAsNull(z.string().trim());

/** What staff members enter when creating or editing a customer. */
export const customerInputSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: blankAsNull(
    z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), z.string().email()])),
  ),
  address: optionalText,
  facebook: optionalText,
});

export type CustomerInputValues = z.input<typeof customerInputSchema>;
export type CustomerInput = z.output<typeof customerInputSchema>;

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  facebook: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Customer = z.infer<typeof customerSchema>;

export const sortDirSchema = z.enum(["asc", "desc"]);
export type SortDir = z.infer<typeof sortDirSchema>;

/** `GET /api/customers`: search matches name, phone or email; the list is sorted by name. */
export const customerListQuerySchema = pageQuerySchema.extend({
  search: z.string().trim().optional(),
  sortDir: sortDirSchema.default("asc"),
});

export type CustomerListQuery = z.input<typeof customerListQuerySchema>;
