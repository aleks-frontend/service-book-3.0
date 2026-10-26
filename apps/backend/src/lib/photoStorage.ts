import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import express, { type Request, type RequestHandler } from "express";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Where photos' bytes live (ADR-0006). The database holds only their keys, and
 * staff members' browsers are sent to `url(key)` to show one.
 */
export interface PhotoStorage {
  put(key: string, bytes: Buffer, type: string): Promise<void>;
  /** Deletes the objects; a key with no object is skipped. */
  delete(keys: string[]): Promise<void>;
  /** A short-lived link that shows the object. */
  url(key: string): Promise<string>;
  /**
   * Serves the objects at `PHOTO_FILES_PATH`, for a storage whose links point
   * back at this app. Mounted behind the session check.
   */
  files?: RequestHandler;
}

/** Where the filesystem storage's links point. */
export const PHOTO_FILES_PATH = "/api/photo-files";

/** How long an R2 link works: enough to load the image, too short to pass around. */
const PRESIGNED_URL_SECONDS = 5 * 60;

/** An R2 API token's credentials, and the account its bucket is in. */
export type R2Credentials = { accountId: string; accessKeyId: string; secretAccessKey: string };

/**
 * Photos in a private Cloudflare R2 bucket, shown through presigned links. Each
 * deployment has its own bucket (ADR-0002).
 */
export class R2PhotoStorage implements PhotoStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    { accountId, accessKeyId, secretAccessKey }: R2Credentials,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, bytes: Buffer, type: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: type }),
    );
  }

  async delete(keys: string[]) {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  url(key: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: PRESIGNED_URL_SECONDS,
    });
  }
}

/**
 * Photos in a local directory, for development and the e2e tests. Its links
 * point back at this app, which serves the files only to a logged-in staff member.
 */
export class FilesystemPhotoStorage implements PhotoStorage {
  readonly files: RequestHandler;

  constructor(private readonly dir: string) {
    this.files = express.static(dir, { fallthrough: false, index: false });
  }

  async put(key: string, bytes: Buffer) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(key), bytes);
  }

  async delete(keys: string[]) {
    await Promise.all(keys.map((key) => rm(this.file(key), { force: true })));
  }

  async url(key: string) {
    return `${PHOTO_FILES_PATH}/${encodeURIComponent(key)}`;
  }

  private file(key: string) {
    // Keys are made by the app, never by a client, but a key must not leave the directory anyway.
    if (path.basename(key) !== key) throw new Error(`Invalid photo key: ${key}`);
    return path.join(this.dir, key);
  }
}

/**
 * The storage the environment configures: R2 when `R2_BUCKET` is set,
 * otherwise a local directory (`PHOTO_STORAGE_DIR`). Production must set one of
 * them; development falls back to a directory in the backend's folder.
 */
export function photoStorageFromEnv(env = process.env): PhotoStorage {
  if (env.R2_BUCKET) {
    const { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId } = env;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2_BUCKET is set, so R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be too.",
      );
    }
    return new R2PhotoStorage(env.R2_BUCKET, { accountId, accessKeyId, secretAccessKey });
  }
  if (env.PHOTO_STORAGE_DIR) return new FilesystemPhotoStorage(path.resolve(env.PHOTO_STORAGE_DIR));
  if (env.NODE_ENV === "production") {
    throw new Error("Set R2_BUCKET (or PHOTO_STORAGE_DIR) to store photos (see .env.example).");
  }
  return new FilesystemPhotoStorage(path.resolve("storage/photos"));
}

/** The photo storage of the app handling the request (see `createApp`). */
export function photoStorageOf(req: Request): PhotoStorage {
  return req.app.locals.photoStorage as PhotoStorage;
}
