import { randomBytes } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";

/** 12 URL-safe characters from 72 random bits: hard to guess, never sequential (ADR-0003). */
export function newPublicToken() {
  return randomBytes(9).toString("base64url");
}

/**
 * The next sequence number of `year`. The upsert locks the year's counter row
 * until the surrounding transaction ends, so concurrent creates queue up and
 * never get the same number.
 */
export async function nextSequence(tx: Prisma.TransactionClient, year: number) {
  const [{ last }] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "service_number_counter" ("year", "last") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last" = "service_number_counter"."last" + 1
    RETURNING "last"
  `;
  return last;
}
