import jsQRModule from "jsqr";
import { getDocument, ImageKind, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

// jsqr is CommonJS typed as an ES module, so under NodeNext its function is on `default`.
const jsQR = jsQRModule.default;

type DecodedImage = { width: number; height: number; kind: number; data: Uint8ClampedArray };

/** An image's pixels as RGBA, the layout jsQR reads. */
function toRgba({ width, height, kind, data }: DecodedImage) {
  if (kind === ImageKind.RGBA_32BPP) return new Uint8ClampedArray(data);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (kind === ImageKind.RGB_24BPP) {
      rgba.set([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255], i * 4);
    } else {
      // GRAYSCALE_1BPP: one bit per pixel, each row padded to a whole byte.
      const rowBytes = Math.ceil(width / 8);
      const x = i % width;
      const y = Math.floor(i / width);
      const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      rgba.set([bit * 255, bit * 255, bit * 255, 255], i * 4);
    }
  }
  return rgba;
}

/**
 * A PDF's text, the number of images it draws, and what any QR codes among
 * those images decode to.
 */
export async function readPdf(bytes: Uint8Array) {
  const pdf = await getDocument({
    data: bytes,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    verbosity: 0,
  }).promise;
  const texts: string[] = [];
  const qrCodes: string[] = [];
  let imageCount = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    texts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));

    const operators = await page.getOperatorList();
    for (let i = 0; i < operators.fnArray.length; i++) {
      if (operators.fnArray[i] !== OPS.paintImageXObject) continue;
      imageCount++;
      const name = operators.argsArray[i][0] as string;
      const objs = name.startsWith("g_") ? page.commonObjs : page.objs;
      // Images are decoded in the background; the callback runs once this one is ready.
      const image = await new Promise<DecodedImage>((resolve) => objs.get(name, resolve));
      const qr = jsQR(toRgba(image), image.width, image.height);
      if (qr) qrCodes.push(qr.data);
    }
  }

  // Text items are split at arbitrary points; collapse the whitespace between them.
  return { text: texts.join(" ").replace(/\s+/g, " "), imageCount, qrCodes };
}
