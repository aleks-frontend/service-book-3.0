import { z } from "zod";
import { sortDirSchema } from "./fields.js";
import { rsdAmountSchema } from "./money.js";
import { pageQuerySchema } from "./pagination.js";

/** What staff members enter when creating or editing an action. */
export const actionInputSchema = z.object({
  name: z.string().trim().min(1),
  /** The default price. */
  price: rsdAmountSchema,
});

export type ActionInput = z.infer<typeof actionInputSchema>;

export const actionSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Action = z.infer<typeof actionSchema>;

/** `GET /api/actions`: search matches part of the name; the list is sorted by name. */
export const actionListQuerySchema = pageQuerySchema.extend({
  search: z.string().trim().optional(),
  sortDir: sortDirSchema.default("asc"),
});

export type ActionListQuery = z.input<typeof actionListQuerySchema>;
