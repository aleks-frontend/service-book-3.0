import type { PhotoStorage } from "../src/lib/photoStorage.js";

/**
 * Photo storage held in memory, which a test can tell to fail its next puts
 * or its deletes, or to do something else while a put runs.
 */
export class MemoryPhotoStorage implements PhotoStorage {
  readonly objects = new Map<string, { bytes: Buffer; type: string }>();
  /** Puts made after this many more succeed fail, until reset to Infinity. */
  failPutsAfter = Infinity;
  /** While set, deletes fail and leave the objects in place. */
  failDeletes = false;
  /** Runs during every put, e.g. to change the database before the write that follows. */
  duringPut: () => Promise<void> = async () => {};

  async put(key: string, bytes: Buffer, type: string) {
    await this.duringPut();
    if (this.failPutsAfter <= 0) throw new Error("Storage unavailable");
    this.failPutsAfter--;
    this.objects.set(key, { bytes, type });
  }

  async delete(keys: string[]) {
    if (this.failDeletes) throw new Error("Storage unavailable");
    for (const key of keys) this.objects.delete(key);
  }

  async url(key: string) {
    return `https://photos.test/${key}`;
  }
}
