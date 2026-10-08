import { z } from "zod";
import { rsdAmountSchema } from "./money.js";

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
