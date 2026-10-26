import { Router, type Request, type Response } from "express";
import { logNoteInputSchema, type LogEntry } from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { photoStorageOf } from "../lib/photoStorage.js";
import {
  parsePhotos,
  photoRows,
  photoUpload,
  sendPhotoStorageError,
  storePhotosThen,
} from "../lib/photoUploads.js";
import { prisma } from "../lib/prisma.js";
import { idParam, parseBody, sendFieldError, sendNotFound } from "../lib/routeHelpers.js";

/** Mounted at `/api/services/:id/log`; `:id` is the service's. */
export const serviceLogRouter = Router({ mergeParams: true });

const LABEL = "Log entry";

/** What the API shows of a log entry. */
export const logEntrySelect = {
  id: true,
  type: true,
  text: true,
  fromStatus: true,
  toStatus: true,
  author: { select: { id: true, name: true } },
  photos: { orderBy: { position: "asc" }, select: { id: true, width: true, height: true } },
  createdAt: true,
} satisfies Prisma.ServiceLogEntrySelect;

/** The service's id from the path if it exists, or null after sending a 404. */
async function serviceIdParam(req: Request, res: Response) {
  const id = idParam(req, res, "Service");
  if (!id) return null;

  const service = await prisma.service.findUnique({ where: { id }, select: { id: true } });
  if (!service) sendNotFound(res, "Service");
  return service?.id ?? null;
}

// Oldest first, as a thread reads.
serviceLogRouter.get("/", async (req, res) => {
  const serviceId = await serviceIdParam(req, res);
  if (!serviceId) return;

  const entries: LogEntry[] = await prisma.serviceLogEntry.findMany({
    where: { serviceId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: logEntrySelect,
  });
  res.json(entries);
});

// JSON for a note with text only, or multipart for one with photos (and maybe text).
// The photos are stored before the note is written, and deleted again if it can't be.
serviceLogRouter.post("/", photoUpload(LABEL), async (req, res) => {
  const serviceId = await serviceIdParam(req, res);
  if (!serviceId) return;
  const input = parseBody(logNoteInputSchema, req, res, LABEL);
  if (!input) return;
  const photos = parsePhotos(req, res, LABEL);
  if (!photos) return;
  if (!input.text && photos.length === 0) {
    sendFieldError(res, LABEL, "text", "A note needs text or photos");
    return;
  }

  try {
    const entry: LogEntry = await storePhotosThen(photoStorageOf(req), photos, () =>
      prisma.serviceLogEntry.create({
        data: {
          serviceId,
          type: "NOTE",
          text: input.text,
          authorId: req.user!.id,
          photos: { create: photoRows(photos) },
        },
        select: logEntrySelect,
      }),
    );
    res.status(201).json(entry);
  } catch (error) {
    sendPhotoStorageError(res, error);
  }
});
