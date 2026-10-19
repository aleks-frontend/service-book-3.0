import { z } from "zod";
import { plainDateSchema, plainDateToUtc, type Status } from "./service.js";

/** How earnings are grouped: by the service date's day, month or year. */
export const EARNINGS_BUCKETS = ["day", "month", "year"] as const;
export type EarningsBucket = (typeof EARNINGS_BUCKETS)[number];

/** The most day buckets one request may ask for, so a chart stays readable. */
export const EARNINGS_DAYS_MAX = 366;

/**
 * `GET /api/statistics/earnings`: earnings for services dated from `from` to
 * `to`, both inclusive, grouped by `bucket`.
 */
export const earningsQuerySchema = z
  .object({
    from: plainDateSchema,
    to: plainDateSchema,
    bucket: z.enum(EARNINGS_BUCKETS).default("month"),
  })
  .refine(({ from, to }) => from <= to, {
    message: "The range must not end before it starts",
    path: ["to"],
  })
  .refine(({ from, to, bucket }) => bucket !== "day" || !tooManyDays(from, to), {
    message: `Group a range longer than ${EARNINGS_DAYS_MAX} days by month`,
    path: ["bucket"],
  });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether a `YYYY-MM-DD` range spans more days than earnings may be grouped by. */
export function tooManyDays(from: string, to: string) {
  const days = (plainDateToUtc(to).getTime() - plainDateToUtc(from).getTime()) / DAY_MS;
  return days >= EARNINGS_DAYS_MAX;
}

export type EarningsQuery = z.input<typeof earningsQuerySchema>;

/** One bucket's earnings in RSD; `period` is `YYYY-MM-DD`, `YYYY-MM` or `YYYY` by bucket. */
export type EarningsPeriod = {
  period: string;
  earnings: number;
};

/** A range's earnings in RSD, and every bucket in it in order, empty ones as 0. */
export type Earnings = {
  earnings: number;
  buckets: EarningsPeriod[];
};

/** The number of services in each status, every status present. */
export type StatusCounts = Record<Status, number>;
