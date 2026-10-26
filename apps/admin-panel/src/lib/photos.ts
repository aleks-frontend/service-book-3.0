import { PHOTO_MAX_EDGE, THUMBNAIL_MAX_EDGE } from "@servicebook/schemas";

/** A picked photo, already shrunk and re-encoded for upload. */
export type PickedPhoto = {
  /** The picked file's name, e.g. for a remove button's label. */
  name: string;
  /** At most 2048 px on its long edge. */
  photo: Blob;
  /** At most 400 px on its long edge. */
  thumbnail: Blob;
  /** An object URL of the thumbnail, for the preview; revoke it once the photo is dropped. */
  previewUrl: string;
};

const TYPE = "image/jpeg";
const QUALITY = 0.8;

/** The bitmap redrawn to fit `maxEdge` on its long edge (never enlarged), as a JPEG. */
function encode(bitmap: ImageBitmap, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo"))),
      TYPE,
      QUALITY,
    ),
  );
}

/**
 * Decodes a picked image once and re-encodes it as a full-size photo and a
 * thumbnail. The EXIF orientation is applied, and re-encoding drops the rest
 * of the EXIF data, GPS included. Rejects if the browser can't decode the
 * file (e.g. HEIC on desktop Chrome).
 */
export async function processPhoto(file: File): Promise<PickedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const [photo, thumbnail] = await Promise.all([
      encode(bitmap, PHOTO_MAX_EDGE),
      encode(bitmap, THUMBNAIL_MAX_EDGE),
    ]);
    return { name: file.name, photo, thumbnail, previewUrl: URL.createObjectURL(thumbnail) };
  } finally {
    bitmap.close();
  }
}

/** Where a photo's full-size image is shown; the API redirects to the storage. */
export function photoUrl(id: string) {
  return `/api/photos/${id}`;
}

/** Where a photo's thumbnail is shown. */
export function thumbnailUrl(id: string) {
  return `/api/photos/${id}/thumb`;
}
