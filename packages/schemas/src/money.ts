import { z } from "zod";

/** The largest amount a Postgres `INTEGER` column holds. */
const MAX_RSD = 2_147_483_647;

/** An amount in whole RSD, as stored in an `INTEGER` column. */
export const rsdAmountSchema = z.number().int().min(0).max(MAX_RSD);
