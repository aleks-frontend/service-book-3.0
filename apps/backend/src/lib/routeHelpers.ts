import type { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";

// The legacy ID is for the import only; staff members never see it.
export const hideLegacyId = { legacyId: true } as const;

/** `label` names the record kind in error messages, e.g. "Customer". */
export function sendNotFound(res: Response, label: string) {
  res.status(404).json({ error: `${label} not found` });
}

/**
 * The record id from the path, or null after sending a 404. A malformed id
 * names no record, so it is a 404 like any unknown id, not a 400.
 */
export function idParam(req: Request, res: Response, label: string): string | null {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) sendNotFound(res, label);
  return id.success ? id.data : null;
}

/** A 400 for one field, in the same shape as a failed body parse. */
export function sendFieldError(res: Response, label: string, field: string, message: string) {
  res.status(400).json({
    error: `Invalid ${label.toLowerCase()}`,
    details: { formErrors: [], fieldErrors: { [field]: [message] } },
  });
}

/** The parsed body, or null after sending a 400 with the issue details. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  req: Request,
  res: Response,
  label: string,
): z.output<T> | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: `Invalid ${label.toLowerCase()}`, details: parsed.error.flatten() });
  }
  return parsed.success ? parsed.data : null;
}

/** Whether Prisma failed because the record to update or delete does not exist. */
export function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * Whether Postgres refused a write over a foreign key: deleting a record that
 * others still refer to, or referring to one that does not exist.
 */
export function isForeignKeyViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

/**
 * 409 for a record that cannot be deleted while others refer to it. The admin
 * panel translates the message from `code`, e.g. "CUSTOMER_IN_USE".
 */
export function sendInUse(res: Response, label: string, code: string) {
  res.status(409).json({ error: `${label} is in use`, code });
}
