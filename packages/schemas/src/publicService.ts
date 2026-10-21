import { z } from "zod";
import { plainDateSchema, statusSchema } from "./service.js";

/**
 * `GET /api/public/services/:publicToken`: what the public status page shows
 * of a service to anyone holding its public link. Never the customer, the log
 * (see GLOSSARY.md), the description or any id: the link names a service only
 * by its public token (ADR-0003).
 */
export const publicServiceSchema = z.object({
  /** The service number, `YYYY-NNNN`. */
  number: z.string(),
  date: plainDateSchema,
  status: statusSchema,
  /** In the order they were attached. */
  devices: z.array(
    z.object({
      manufacturer: z.string().nullable(),
      model: z.string(),
      serialNumber: z.string().nullable(),
    }),
  ),
  /** In the service's order. */
  lines: z.array(
    z.object({
      label: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number().int(),
    }),
  ),
  /** Σ quantity × unit price over all its lines, in whole RSD. */
  total: z.number().int(),
  customerReport: z.string().nullable(),
});

export type PublicService = z.infer<typeof publicServiceSchema>;
