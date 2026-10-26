import type { PhotoStorage } from "../src/lib/photoStorage.js";

/**
 * Photo storage held in memory, which a test can tell to fail its next puts,
 * or to do something else while a put runs.
 */
export class MemoryPhotoStorage implements PhotoStorage {
  readonly objects = new Map<string, { bytes: Buffer; type: string }>();
  /** Puts made after this many more succeed fail, until reset to Infinity. */
  failPutsAfter = Infinity;
  /** Runs during every put, e.g. to change the database before the write that follows. */
  duringPut: () => Promise<void> = async () => {};

  async put(key: string, bytes: Buffer, type: string) {
    await this.duringPut();
    if (this.failPutsAfter <= 0) throw new Error("Storage unavailable");
    this.failPutsAfter--;
    this.objects.set(key, { bytes, type });
  }

  async delete(keys: string[]) {
    for (const key of keys) this.objects.delete(key);
  }

  async url(key: string) {
    return `https://photos.test/${key}`;
  }
}
