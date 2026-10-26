import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  PHOTO_FIELD,
  PHOTO_MAX_BYTES,
  PHOTOS_PER_NOTE_MAX,
  THUMBNAIL_FIELD,
  THUMBNAIL_MAX_BYTES,
  type PhotoType,
} from "@servicebook/schemas";
import { deletePhotoObjects, type PhotoStorage } from "./photoStorage.js";
import { sendFieldError } from "./routeHelpers.js";

/** Room for a note's text beside its photos. */
const TEXT_ROOM_BYTES = 64 * 1024;

/** The largest body a note with photos may have: every photo and thumbnail at its limit. */
const PHOTO_BODY_LIMIT =
  PHOTOS_PER_NOTE_MAX * (PHOTO_MAX_BYTES + THUMBNAIL_MAX_BYTES) + TEXT_ROOM_BYTES;

const EXTENSIONS: Record<PhotoType, string> = { "image/jpeg": "jpg", "image/webp": "webp" };

type ImageInfo = { type: PhotoType; width: number; height: number };

/** A JPEG's size, from its first start-of-frame segment. */
function jpegInfo(bytes: Buffer): ImageInfo | null {
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // A marker may be preceded by fill bytes (0xFF), and RST/TEM markers have no length.
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC), which share the range.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        type: "image/jpeg",
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return null;
}

/** A WebP's size, from its first chunk: lossy (VP8), lossless (VP8L) or extended (VP8X). */
function webpInfo(bytes: Buffer): ImageInfo | null {
  if (bytes.length < 30) return null;
  switch (bytes.toString("latin1", 12, 16)) {
    case "VP8 ":
      return {
        type: "image/webp",
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    case "VP8L": {
      const bits = bytes.readUInt32LE(21);
      return {
        type: "image/webp",
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    case "VP8X":
      return {
        type: "image/webp",
        width: bytes.readUIntLE(24, 3) + 1,
        height: bytes.readUIntLE(27, 3) + 1,
      };
    default:
      return null;
  }
}

/**
 * The image's type and size if it is a JPEG or WebP by its content (its magic
 * bytes), whatever the client called it; otherwise null.
 */
export function imageInfo(bytes: Buffer): ImageInfo | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return jpegInfo(bytes);
  }
  if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return webpInfo(bytes);
  }
  return null;
}

const parseMultipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: PHOTOS_PER_NOTE_MAX * 2, fieldSize: TEXT_ROOM_BYTES },
}).fields([
  { name: PHOTO_FIELD, maxCount: PHOTOS_PER_NOTE_MAX },
  { name: THUMBNAIL_FIELD, maxCount: PHOTOS_PER_NOTE_MAX },
]);

/** A size limit as a validation message, e.g. "Must be at most 4 MB". */
function atMost(bytes: number) {
  return bytes >= 1024 * 1024
    ? `Must be at most ${bytes / (1024 * 1024)} MB`
    : `Must be at most ${bytes / 1024} KB`;
}

const MULTER_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: atMost(PHOTO_MAX_BYTES),
  LIMIT_FILE_COUNT: `At most ${PHOTOS_PER_NOTE_MAX} photos`,
  LIMIT_UNEXPECTED_FILE: `At most ${PHOTOS_PER_NOTE_MAX} photos`,
};

/**
 * Parses a multipart body (`text` and the photo fields) into `req.body` and
 * `req.files`, answering 400 for files over the limits or a malformed body.
 * Any other body passes through to `express.json()`.
 */
export function photoUpload(label: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (Number(req.headers["content-length"]) > PHOTO_BODY_LIMIT) {
      res.status(413).json({ error: "Request body too large" });
      return;
    }
    parseMultipart(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      // Memory storage does no I/O, so anything else is a malformed body, e.g. a truncated one.
      if (!(error instanceof multer.MulterError)) {
        res.status(400).json({ error: "Invalid multipart body" });
        return;
      }
      const field = error.field === THUMBNAIL_FIELD ? THUMBNAIL_FIELD : PHOTO_FIELD;
      sendFieldError(res, label, field, MULTER_MESSAGES[error.code] ?? error.message);
    });
  };
}

/** A validated photo, with its id and storage keys chosen, ready to be stored. */
export type NewPhoto = ImageInfo & {
  id: string;
  key: string;
  thumbnailKey: string;
  bytes: Buffer;
  thumbnail: Buffer;
  thumbnailType: PhotoType;
};

/**
 * The photos uploaded by `photoUpload`, in pick order, or null after sending
 * a 400: every photo needs its thumbnail, and both must be a JPEG or WebP
 * within the size limits.
 */
export function parsePhotos(req: Request, res: Response, label: string): NewPhoto[] | null {
  const files = (req.files ?? {}) as Partial<Record<string, Express.Multer.File[]>>;
  const photos = files[PHOTO_FIELD] ?? [];
  const thumbnails = files[THUMBNAIL_FIELD] ?? [];

  if (photos.length !== thumbnails.length) {
    sendFieldError(res, label, THUMBNAIL_FIELD, "Every photo needs one thumbnail");
    return null;
  }

  const parsed: NewPhoto[] = [];
  for (const [n, photo] of photos.entries()) {
    const info = imageInfo(photo.buffer);
    const thumbnailInfo = imageInfo(thumbnails[n].buffer);
    if (!info) {
      sendFieldError(res, label, PHOTO_FIELD, "Must be a JPEG or WebP image");
      return null;
    }
    if (!thumbnailInfo) {
      sendFieldError(res, label, THUMBNAIL_FIELD, "Must be a JPEG or WebP image");
      return null;
    }
    if (thumbnails[n].size > THUMBNAIL_MAX_BYTES) {
      sendFieldError(res, label, THUMBNAIL_FIELD, atMost(THUMBNAIL_MAX_BYTES));
      return null;
    }

    const id = randomUUID();
    parsed.push({
      ...info,
      id,
      key: `${id}.${EXTENSIONS[info.type]}`,
      thumbnailKey: `${id}-thumb.${EXTENSIONS[thumbnailInfo.type]}`,
      bytes: photo.buffer,
      thumbnail: thumbnails[n].buffer,
      thumbnailType: thumbnailInfo.type,
    });
  }
  return parsed;
}

/** The photo rows to create for a note's photos. */
export function photoRows(photos: NewPhoto[]) {
  return photos.map(({ id, key, thumbnailKey, type, width, height, bytes }, position) => ({
    id,
    position,
    key,
    thumbnailKey,
    type,
    width,
    height,
    size: bytes.length,
  }));
}

/** Storing a photo failed; nothing was written. */
export class PhotoStorageError extends Error {
  constructor(cause: unknown) {
    super("Could not store the photos", { cause });
  }
}

/** Answers 502 for a `PhotoStorageError`, or rethrows anything else. */
export function sendPhotoStorageError(res: Response, error: unknown) {
  if (!(error instanceof PhotoStorageError)) throw error;
  res.status(502).json({ error: error.message });
}

/**
 * Stores every photo and its thumbnail, then runs `write` (the database
 * write that refers to them). If storing or writing fails, every object is
 * deleted again, so a failure leaves nothing behind. A failed store throws
 * `PhotoStorageError`; a failed write rethrows its own error.
 */
export async function storePhotosThen<T>(
  storage: PhotoStorage,
  photos: NewPhoto[],
  write: () => Promise<T>,
): Promise<T> {
  const cleanUp = () => deletePhotoObjects(storage, photos);

  // Settled rather than raced, so no put is still running when the clean-up starts.
  const puts = await Promise.allSettled(
    photos.flatMap((photo) => [
      storage.put(photo.key, photo.bytes, photo.type),
      storage.put(photo.thumbnailKey, photo.thumbnail, photo.thumbnailType),
    ]),
  );
  const failed = puts.find((put) => put.status === "rejected");
  if (failed) {
    await cleanUp();
    throw new PhotoStorageError(failed.reason);
  }

  try {
    return await write();
  } catch (error) {
    await cleanUp();
    throw error;
  }
}
