import { z } from "zod";
import { rsdAmountSchema } from "./money.js";

/** A work line refers to an action, a sale line to a device (see GLOSSARY.md, ADR-0004). */
export const LINE_TYPES = ["WORK", "SALE"] as const;
export const lineTypeSchema = z.enum(LINE_TYPES);
export type LineType = z.infer<typeof lineTypeSchema>;

/** The largest quantity on one line; it keeps every total well inside a safe integer. */
export const LINE_QUANTITY_MAX = 10_000;

/** How many of the action or device a line counts: a whole number from 1. */
export const lineQuantitySchema = z.number().int().min(1).max(LINE_QUANTITY_MAX);

/**
 * What staff members enter when adding a service line. A work line's unit
 * price defaults to the action's price; a sale line always names its price.
 * Sold devices must be generic or the service customer's own.
 */
export const serviceLineInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("WORK"),
    actionId: z.string().uuid(),
    quantity: lineQuantitySchema,
    unitPrice: rsdAmountSchema.optional(),
  }),
  z.object({
    type: z.literal("SALE"),
    deviceId: z.string().uuid(),
    quantity: lineQuantitySchema,
    unitPrice: rsdAmountSchema,
  }),
]);

export type ServiceLineInput = z.infer<typeof serviceLineInputSchema>;

/** Editing a line changes its quantity or unit price; its action or device and label stay. */
export const serviceLineUpdateSchema = z
  .object({ quantity: lineQuantitySchema, unitPrice: rsdAmountSchema })
  .partial()
  .refine(({ quantity, unitPrice }) => quantity !== undefined || unitPrice !== undefined, {
    message: "Change the quantity or the unit price",
  });

export type ServiceLineUpdate = z.infer<typeof serviceLineUpdateSchema>;

/** The new order of a service's lines: every one of its line ids, each once. */
export const serviceLineOrderSchema = z.object({
  lineIds: z.array(z.string().uuid()),
});

export type ServiceLineOrder = z.infer<typeof serviceLineOrderSchema>;

export const serviceLineSchema = z.object({
  id: z.string(),
  type: lineTypeSchema,
  /** Set on work lines; null once the legacy action is gone. */
  actionId: z.string().nullable(),
  /** Set on sale lines. */
  deviceId: z.string().nullable(),
  /** The action's or device's name when the line was added. */
  label: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number().int(),
});

export type ServiceLine = z.infer<typeof serviceLineSchema>;

/** Σ quantity × unit price over every line, work and sale alike, in whole RSD. */
export function linesTotal(lines: Pick<ServiceLine, "quantity" | "unitPrice">[]) {
  return lines.reduce((total, { quantity, unitPrice }) => total + quantity * unitPrice, 0);
}
