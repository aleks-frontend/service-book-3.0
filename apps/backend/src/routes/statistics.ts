import { Router } from "express";
import {
  STATUSES,
  earningsQuerySchema,
  plainDateToUtc,
  utcToPlainDate,
  type Earnings,
  type EarningsBucket,
  type Status,
  type StatusCounts,
} from "@servicebook/schemas";
import { prisma } from "../lib/prisma.js";

export const statisticsRouter = Router();

/**
 * How each bucket names its period: Postgres's `to_char` format, the length
 * of a `YYYY-MM-DD` date's prefix that it keeps, and the step to the next one.
 */
const PERIODS: Record<
  EarningsBucket,
  { format: string; length: number; step: (date: Date) => void }
> = {
  day: { format: "YYYY-MM-DD", length: 10, step: (d) => d.setUTCDate(d.getUTCDate() + 1) },
  month: { format: "YYYY-MM", length: 7, step: (d) => d.setUTCMonth(d.getUTCMonth() + 1, 1) },
  year: { format: "YYYY", length: 4, step: (d) => d.setUTCFullYear(d.getUTCFullYear() + 1, 0, 1) },
};

/** Every period from `from`'s to `to`'s, in order. */
function periodsBetween(from: string, to: string, bucket: EarningsBucket) {
  const { length, step } = PERIODS[bucket];
  const last = to.slice(0, length);
  const periods: string[] = [];
  for (const date = plainDateToUtc(from); ; step(date)) {
    const period = utcToPlainDate(date).slice(0, length);
    periods.push(period);
    if (period === last) return periods;
  }
}

// Earnings (see GLOSSARY.md) bucketed on the service date; cancelled services earn nothing.
statisticsRouter.get("/earnings", async (req, res) => {
  const parsed = earningsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return;
  }
  const { from, to, bucket } = parsed.data;

  // A sum of INTEGER products can pass what an INTEGER holds, so it is summed as BIGINT.
  const rows = await prisma.$queryRaw<{ period: string; earnings: bigint }[]>`
    SELECT to_char(s."date", ${PERIODS[bucket].format}) AS "period",
           SUM(l."quantity"::bigint * l."unitPrice") AS "earnings"
    FROM "service_line" l
    JOIN "service" s ON s."id" = l."serviceId"
    WHERE s."date" BETWEEN ${from}::date AND ${to}::date
      AND s."status" <> 'CANCELLED'
    GROUP BY 1
  `;
  const byPeriod = new Map(rows.map(({ period, earnings }) => [period, Number(earnings)]));

  const buckets = periodsBetween(from, to, bucket).map((period) => ({
    period,
    earnings: byPeriod.get(period) ?? 0,
  }));
  const result: Earnings = {
    earnings: buckets.reduce((sum, { earnings }) => sum + earnings, 0),
    buckets,
  };
  res.json(result);
});

statisticsRouter.get("/status-counts", async (_req, res) => {
  const groups = await prisma.service.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = new Map<Status, number>(groups.map(({ status, _count }) => [status, _count._all]));

  const statusCounts = Object.fromEntries(
    STATUSES.map((status) => [status, counts.get(status) ?? 0]),
  ) as StatusCounts;
  res.json(statusCounts);
});
