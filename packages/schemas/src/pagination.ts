import { z } from "zod";

/** The rows-per-page choices offered on offset-paged tables. */
export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** `?page=&pageSize=` on an offset-paged list endpoint; pages are 1-based. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((size): size is PageSize => PAGE_SIZES.includes(size as PageSize))
    .default(10),
});

/** One page of an offset-paged list, with the total across all pages. */
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: PageSize;
};
