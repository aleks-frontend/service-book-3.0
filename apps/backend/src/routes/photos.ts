import { Router, type Request, type Response } from "express";
import { photoStorageOf } from "../lib/photoStorage.js";
import { prisma } from "../lib/prisma.js";
import { idParam, sendNotFound } from "../lib/routeHelpers.js";

/**
 * A photo's image and thumbnail. The storage is private, so these redirect a
 * logged-in staff member to a short-lived link to the object (ADR-0006).
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
