import { Router, type Request, type Response } from "express";
import { deletePhotoObjects, photoStorageOf } from "../lib/photoStorage.js";
import { prisma } from "../lib/prisma.js";
import { idParam, sendNotFound } from "../lib/routeHelpers.js";

/**
 * A photo's image and thumbnail, and deleting it. The storage is private, so
 * the images redirect a logged-in staff member to a short-lived link to the
 * object (ADR-0006).
 */
export const photosRouter = Router();

const LABEL = "Photo";

async function redirectToObject(req: Request, res: Response, which: "key" | "thumbnailKey") {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { key: true, thumbnailKey: true },
  });
  if (!photo) {
    sendNotFound(res, LABEL);
    return;
  }
  // The link expires, so the redirect itself must not be cached for longer.
  res.set("Cache-Control", "private, no-store");
  res.redirect(302, await photoStorageOf(req).url(photo[which]));
}

photosRouter.get("/:id", (req, res) => redirectToObject(req, res, "key"));
photosRouter.get("/:id/thumb", (req, res) => redirectToObject(req, res, "thumbnailKey"));

// The objects are deleted once the row is. A note left with no text and no
// photos is deleted with it, since a note needs one or the other.
photosRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  const photo = await prisma.$transaction(async (tx) => {
    const photo = await tx.photo.findUnique({
      where: { id },
      select: { logEntryId: true, key: true, thumbnailKey: true },
    });
    if (!photo) return null;
    // Locks the note, so deleting its last two photos at once can't leave it empty.
    await tx.$queryRaw`SELECT 1 FROM "service_log_entry" WHERE "id" = ${photo.logEntryId}::uuid FOR UPDATE`;
    // Deleted meanwhile, by a request that held the lock first.
    const { count } = await tx.photo.deleteMany({ where: { id } });
    if (count === 0) return null;
    await tx.serviceLogEntry.deleteMany({
      where: { id: photo.logEntryId, type: "NOTE", text: null, photos: { none: {} } },
    });
    return photo;
  });
  if (!photo) {
    sendNotFound(res, LABEL);
    return;
  }
  await deletePhotoObjects(photoStorageOf(req), [photo]);
  res.status(204).send();
});
