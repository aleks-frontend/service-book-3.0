import { z } from "zod";

/** An optional field: blank (or whitespace-only) input is stored as null. */
export function blankAsNull<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((value: z.output<T> | null | undefined) => value || null);
}

/** Optional free text, trimmed; blank is stored as null. */
export const optionalText = blankAsNull(z.string().trim());

export const sortDirSchema = z.enum(["asc", "desc"]);
export type SortDir = z.infer<typeof sortDirSchema>;
