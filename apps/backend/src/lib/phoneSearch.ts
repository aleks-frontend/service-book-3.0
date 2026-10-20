import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

/** A search term that could be part of a phone number: digits and the usual separators. */
const PHONE_TERM = /^[\d\s+()./-]*\d[\d\s+()./-]*$/;

/** A term written with Serbia's country code, +381 or 00381, in place of the national 0. */
const INTERNATIONAL_TERM = /^\s*(?:\+|00)\s*381/;

export function isPhoneTerm(term: string) {
  return PHONE_TERM.test(term);
}

/**
 * Whether the phone in the `phone` column contains a phone-like term once
 * both are reduced to digits, so `064 123`, `064/123` and `+38164123` all
 * find `+381 64 123 4567`. A term with the country code is the start of a
 * number, so it matches only from the start of the national form.
 */
export function matchesPhoneDigits(phone: Prisma.Sql, term: string) {
  const digits = Prisma.sql`regexp_replace(${phone}, '[^0-9]', '', 'g')`;
  const national = Prisma.sql`regexp_replace(${digits}, '^(00)?381', '0')`;
  const termDigits = term.replace(/\D/g, "");

  if (INTERNATIONAL_TERM.test(term)) {
    return Prisma.sql`${national} LIKE ${`0${termDigits.replace(/^(00)?381/, "")}%`}`;
  }
  return Prisma.sql`(${digits} LIKE ${`%${termDigits}%`} OR ${national} LIKE ${`%${termDigits}%`})`;
}

/** Ids of the customers whose phone matches a phone-like term; see `matchesPhoneDigits`. */
export async function findCustomerIdsByPhone(term: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "customer" WHERE ${matchesPhoneDigits(Prisma.sql`"phone"`, term)}`;
  return rows.map(({ id }) => id);
}
