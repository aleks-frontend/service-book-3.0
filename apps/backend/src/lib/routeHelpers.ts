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
 * The record id from the path (the `:id` param unless `param` names another),
 * or null after sending a 404. A malformed id names no record, so it is a 404
 * like any unknown id, not a 400.
 */
export function idParam(req: Request, res: Response, label: string, param = "id"): string | null {
  const id = z.string().uuid().safeParse(req.params[param]);
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
 * others still refer to, or referring to one that does not exist. Prisma
 * reports it as P2003, but a raw `DriverAdapterError` from the pg adapter can
 * also surface it with Postgres's own code.
 */
export function isForeignKeyViolation(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2003";
  if (!(error instanceof Error) || error.name !== "DriverAdapterError") return false;
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code === "23503" || cause?.code === "23001";
}

/** 409 with a code the admin panel translates, e.g. "CUSTOMER_IN_USE". */
export function sendConflict(res: Response, error: string, code: string) {
  res.status(409).json({ error, code });
}

/**
 * Deletes one record and answers 204, or 409 with `inUseCode` while others
 * still refer to it, or 404 when there is no such record. Every record that a
 * service's history refers to is deleted through here.
 */
export async function sendDelete(
  res: Response,
  label: string,
  inUseCode: string,
  deleteOne: () => Promise<unknown>,
) {
  try {
    await deleteOne();
    res.status(204).send();
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      sendConflict(res, `${label} is in use`, inUseCode);
      return;
    }
    if (!isNotFound(error)) throw error;
    sendNotFound(res, label);
  }
}
