import { Router } from "express";
import { parseImageDataUrl, settingsInputSchema, type Settings } from "@servicebook/schemas";
import type { Settings as SettingsRow } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { parseBody } from "../lib/routeHelpers.js";

export const settingsRouter = Router();

const LABEL = "Settings";

/** The single settings row's id (enforced by a check constraint). */
const SETTINGS_ID = 1;

/** An image's bytes and media type as stored, both null when there is no image. */
function fromDataUrl(dataUrl: string | null) {
  // The schema has already checked that a non-null value parses.
  const image = dataUrl === null ? null : parseImageDataUrl(dataUrl);
  return image
    ? { bytes: Buffer.from(image.base64, "base64"), type: image.type }
    : { bytes: null, type: null };
}

function toDataUrl(bytes: Uint8Array | null, type: string | null) {
  return bytes && type ? `data:${type};base64,${Buffer.from(bytes).toString("base64")}` : null;
}

/** Before the company is set up there is no row, and every field is unset. */
function toSettings(row: SettingsRow | null): Settings {
  return {
    name: row?.name ?? null,
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    email: row?.email ?? null,
    taxId: row?.taxId ?? null,
    logo: toDataUrl(row?.logo ?? null, row?.logoType ?? null),
    signature: toDataUrl(row?.signature ?? null, row?.signatureType ?? null),
  };
}

/**
 * Reachable without a session: the login page shows the company's logo. It is
 * printed on every document anyway; nothing else from the settings is read.
 */
export const publicSettingsRouter = Router();

publicSettingsRouter.get("/logo", async (_req, res) => {
  const row = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: { logo: true, logoType: true },
  });
  res.json({ logo: toDataUrl(row?.logo ?? null, row?.logoType ?? null) });
});

settingsRouter.get("/", async (_req, res) => {
  const row = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  res.json(toSettings(row));
});

settingsRouter.put("/", async (req, res) => {
  const input = parseBody(settingsInputSchema, req, res, LABEL);
  if (!input) return;

  const logo = fromDataUrl(input.logo);
  const signature = fromDataUrl(input.signature);
  const data = {
    ...input,
    logo: logo.bytes,
    logoType: logo.type,
    signature: signature.bytes,
    signatureType: signature.type,
  };
  const row = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
  res.json(toSettings(row));
});
