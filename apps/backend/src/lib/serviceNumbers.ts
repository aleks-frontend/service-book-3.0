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
  return reserveSequences(tx, year, 1);
}

/** Reserves `count` consecutive sequence numbers of `year` in one query, returning the first. */
export async function reserveSequences(tx: Prisma.TransactionClient, year: number, count: number) {
  const [{ last }] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "service_number_counter" ("year", "last") VALUES (${year}, ${count})
    ON CONFLICT ("year") DO UPDATE SET "last" = "service_number_counter"."last" + ${count}
    RETURNING "last"
  `;
  return last - count + 1;
}
