import { readFile } from "node:fs/promises";
import type { Download } from "@playwright/test";
import { readPdf } from "./pdf.js";

/** The logo and signature images the backend tests upload too. */
export const IMAGES = "apps/backend/test/fixtures/images";

/** A fixture image as the `data:` URL the Settings API takes. */
export async function dataUrl(path: string, type: string) {
  return `data:${type};base64,${(await readFile(path)).toString("base64")}`;
}

/** A downloaded document, read with `readPdf`. */
export async function readDownload(download: Download) {
  return readPdf(new Uint8Array(await readFile((await download.path())!)));
}
