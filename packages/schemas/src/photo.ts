import { z } from "zod";

/**
 * The types a photo is stored in. The admin panel re-encodes every picked
 * image, so nothing else ever needs to be accepted.
 */
export const PHOTO_TYPES = ["image/jpeg", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

/** The most photos one note may carry. */
export const PHOTOS_PER_NOTE_MAX = 10;

/** The admin panel shrinks a photo to fit this many pixels on its long edge before upload. */
export const PHOTO_MAX_EDGE = 2048;
/** …and makes a thumbnail that fits this many. */
export const THUMBNAIL_MAX_EDGE = 400;

/** The largest full-size photo the API accepts: generous for one already shrunk to 2048 px. */
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
/** The largest thumbnail the API accepts. */
export const THUMBNAIL_MAX_BYTES = 512 * 1024;

/** The multipart fields of a note's photos: the n-th thumbnail belongs to the n-th photo. */
export const PHOTO_FIELD = "photos";
export const THUMBNAIL_FIELD = "thumbnails";

/** A photo on a log entry (see GLOSSARY.md: Photo). Its image is at `/api/photos/:id`. */
export const photoSchema = z.object({
  id: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});

export type Photo = z.infer<typeof photoSchema>;
