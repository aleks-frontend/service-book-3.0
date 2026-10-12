import { z } from "zod";
import {
  plainDateSchema,
  utcToPlainDate,
  type serviceListQuerySchema,
  type ServiceSort,
  type SortDir,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

/** What one page of the services list is drawn from, already validated. */
export type ServiceListParams = z.output<typeof serviceListQuerySchema>;

/** The listed services' ids in order, and the cursor of the next page, if any. */
export type ServiceIdPage = { ids: string[]; nextCursor: string | null };

type ListedRow = { id: string; customerName: string; date: Date; year: number; sequence: number };
type CursorValue = string | number;

/** A column the list sorts by: how it reads in SQL, in a row, and in a cursor. */
type Column = {
  sql: Prisma.Sql;
  read: (row: ListedRow) => CursorValue;
  param: (value: CursorValue) => Prisma.Sql;
  schema: z.ZodType<CursorValue>;
};

const intColumn = (sql: Prisma.Sql, read: (row: ListedRow) => number): Column => ({
  sql,
  read,
  param: (value) => Prisma.sql`${value}::int`,
  schema: z.number().int(),
});

const COLUMNS = {
  customerName: {
    sql: Prisma.sql`c."name"`,
    read: (row) => row.customerName,
    param: (value) => Prisma.sql`${value}::text`,
    schema: z.string(),
  },
  date: {
    sql: Prisma.sql`s."date"`,
    read: (row) => utcToPlainDate(row.date),
    param: (value) => Prisma.sql`${value}::date`,
    schema: plainDateSchema,
  },
  year: intColumn(Prisma.sql`s."year"`, (row) => row.year),
  sequence: intColumn(Prisma.sql`s."sequence"`, (row) => row.sequence),
} satisfies Record<string, Column>;

type SortColumn = { column: Column; dir: SortDir };

/** How each direction compares past a cursor and orders. */
const DIRECTION_SQL = {
  asc: { past: Prisma.raw(">"), order: Prisma.raw("ASC") },
  desc: { past: Prisma.raw("<"), order: Prisma.raw("DESC") },
} satisfies Record<SortDir, { past: Prisma.Sql; order: Prisma.Sql }>;

/**
 * The full sort order. (year, sequence) is unique, so it is total and pages
 * never overlap; a customer's services come newest first either way.
 */
function sortColumns(sort: ServiceSort, dir: SortDir): SortColumn[] {
  const byDate = (dateDir: SortDir) =>
    [COLUMNS.date, COLUMNS.year, COLUMNS.sequence].map((column) => ({ column, dir: dateDir }));
  return sort === "date" ? byDate(dir) : [{ column: COLUMNS.customerName, dir }, ...byDate("desc")];
}

/** The last listed row's sort key and the sort it belongs to, so the next page starts after it even if it is deleted. */
function encodeCursor(sort: ServiceSort, columns: SortColumn[], row: ListedRow) {
  const values = columns.map(({ column }) => column.read(row));
  return Buffer.from(JSON.stringify([sort, ...values])).toString("base64url");
}

function decodeCursor(cursor: string, sort: ServiceSort, columns: SortColumn[]) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
  } catch {
    return null;
  }
  if (!Array.isArray(decoded) || decoded.length !== columns.length + 1) return null;
  const [cursorSort, ...values] = decoded;
  if (cursorSort !== sort) return null;
  const valid = columns.every(
    ({ column }, index) => column.schema.safeParse(values[index]).success,
  );
  return valid ? (values as CursorValue[]) : null;
}

/** Rows sorting after the cursor: equal on the first columns, then past it on the next. */
function afterCursor(columns: SortColumn[], values: CursorValue[]) {
  const branches = columns.map(({ column, dir }, index) => {
    const equal = columns
      .slice(0, index)
      .map(({ column: earlier }, j) => Prisma.sql`${earlier.sql} = ${earlier.param(values[j])}`);
    const past = Prisma.sql`${column.sql} ${DIRECTION_SQL[dir].past} ${column.param(values[index])}`;
    return Prisma.sql`(${Prisma.join([...equal, past], " AND ")})`;
  });
  return Prisma.sql`(${Prisma.join(branches, " OR ")})`;
}

/** The service number as shown, `YYYY-NNNN`; see `formatServiceNumber`. */
const serviceNumber = Prisma.sql`(s."year"::text || '-' || lpad(s."sequence"::text, greatest(4, length(s."sequence"::text)), '0'))`;

/** A search word that could be part of a phone number: digits and the usual separators. */
const PHONE_WORD = /^[\d+()./-]*\d[\d+()./-]*$/;

/**
 * One search word in any searched field; `%` and `_` in it are taken
 * literally. A phone matches on its digits alone, however either was typed.
 */
function matchesWord(word: string) {
  const pattern = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
  const phoneDigits = PHONE_WORD.test(word)
    ? Prisma.sql`OR regexp_replace(c."phone", '[^0-9]', '', 'g') LIKE ${`%${word.replace(/\D/g, "")}%`}`
    : Prisma.empty;
  return Prisma.sql`(
    ${serviceNumber} ILIKE ${pattern}
    OR c."name" ILIKE ${pattern}
    OR c."phone" ILIKE ${pattern}
    ${phoneDigits}
    OR s."description" ILIKE ${pattern}
    OR EXISTS (
      SELECT 1 FROM "service_device" sd JOIN "device" d ON d."id" = sd."deviceId"
      WHERE sd."serviceId" = s."id" AND (d."manufacturer" ILIKE ${pattern} OR d."model" ILIKE ${pattern})
    )
  )`;
}

/**
 * One page of the services list, as ids in order. Returns null when the
 * cursor is malformed or belongs to another sort.
 */
export async function listServiceIds({
  search,
  status,
  sort,
  sortDir,
  cursor,
  limit,
}: ServiceListParams): Promise<ServiceIdPage | null> {
  const columns = sortColumns(sort, sortDir);
  let after: CursorValue[] | null = null;
  if (cursor) {
    after = decodeCursor(cursor, sort, columns);
    if (!after) return null;
  }

  const conditions = [
    Prisma.sql`TRUE`,
    ...(search ?? "").split(/\s+/).filter(Boolean).map(matchesWord),
    ...(status ? [Prisma.sql`s."status" = ${status}::"Status"`] : []),
    ...(after ? [afterCursor(columns, after)] : []),
  ];
  const orderBy = columns.map(
    ({ column, dir }) => Prisma.sql`${column.sql} ${DIRECTION_SQL[dir].order}`,
  );

  // One extra row tells whether another page follows.
  const rows = await prisma.$queryRaw<ListedRow[]>`
    SELECT s."id", c."name" AS "customerName", s."date", s."year", s."sequence"
    FROM "service" s JOIN "customer" c ON c."id" = s."customerId"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ${Prisma.join(orderBy)}
    LIMIT ${limit + 1}
  `;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    ids: page.map(({ id }) => id),
    nextCursor: rows.length > limit && last ? encodeCursor(sort, columns, last) : null,
  };
}
