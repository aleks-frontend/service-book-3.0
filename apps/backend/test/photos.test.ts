import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../src/app.js";
import { FilesystemPhotoStorage } from "../src/lib/photoStorage.js";
import { prisma } from "../src/lib/prisma.js";
import { authenticatedAgent, STAFF } from "./helpers.js";
import { MemoryPhotoStorage } from "./memoryPhotoStorage.js";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

function fixture(file: string) {
  return readFileSync(fileURLToPath(new URL(`./fixtures/images/${file}`, import.meta.url)));
}

/** 640 × 480 */
const JPEG = fixture("photo.jpg");
/** 300 × 200 */
const WEBP = fixture("photo.webp");
const THUMBNAIL = fixture("thumbnail.jpg");
const PNG = fixture("logo.png");

type Upload = { photo: Buffer; thumbnail?: Buffer; name?: string };

async function create(agent: TestAgent, path: string, body: Record<string, unknown>) {
  const response = await agent.post(path).send(body);
  if (response.status !== 201) throw new Error(`POST ${path} failed with ${response.status}`);
  return response.body as { id: string; publicToken: string };
}

async function setUp() {
  const storage = new MemoryPhotoStorage();
  const { agent } = await authenticatedAgent({ photoStorage: storage });
  const customer = await create(agent, "/api/customers", { name: "Marko", phone: "0641234567" });
  const phone = await create(agent, "/api/devices", { model: "Galaxy S21", ownerId: customer.id });
  const service = await create(agent, "/api/services", {
    customerId: customer.id,
    deviceIds: [phone.id],
    date: "2026-03-14",
  });
  return { storage, agent, service, customer, phone };
}

/** Posts a note as multipart: its text, if any, and each photo with its thumbnail. */
function postNote(agent: TestAgent, serviceId: string, text: string | null, uploads: Upload[]) {
  const post = agent.post(`/api/services/${serviceId}/log`);
  if (text !== null) post.field("text", text);
  uploads.forEach(({ photo, thumbnail = THUMBNAIL, name = `photo-${uploads.length}` }, n) => {
    post.attach("photos", photo, `${name}-${n}.jpg`);
    post.attach("thumbnails", thumbnail, `${name}-${n}-thumb.jpg`);
  });
  return post;
}

/**
 * Registers a service as multipart: its fields, the device ids as
 * `deviceIds[]`, and its intake note's text, if any, and photos.
 */
function postService(
  agent: TestAgent,
  fields: { customerId: string; deviceIds: string[]; date: string; description?: string },
  intakeNote: string | null,
  uploads: Upload[],
) {
  const post = agent.post("/api/services");
  post.field("customerId", fields.customerId).field("date", fields.date);
  if (fields.description !== undefined) post.field("description", fields.description);
  for (const deviceId of fields.deviceIds) post.field("deviceIds[]", deviceId);
  if (intakeNote !== null) post.field("intakeNote", intakeNote);
  uploads.forEach(({ photo, thumbnail = THUMBNAIL }, n) => {
    post.attach("photos", photo, `intake-${n}.jpg`);
    post.attach("thumbnails", thumbnail, `intake-${n}-thumb.jpg`);
  });
  return post;
}

async function readLog(agent: TestAgent, serviceId: string) {
  const response = await agent.get(`/api/services/${serviceId}/log`);
  expect(response.status).toBe(200);
  return response.body as { text: string | null; photos: { id: string }[] }[];
}

describe("notes with photos", () => {
  it("adds a note with text and photos, returning the photos in pick order", async () => {
    const { storage, agent, service } = await setUp();

    const added = await postNote(agent, service.id, "Cracked back", [
      { photo: JPEG },
      { photo: WEBP },
    ]);

    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({
      type: "NOTE",
      text: "Cracked back",
      photos: [
        { id: expect.any(String), width: 640, height: 480 },
        { id: expect.any(String), width: 300, height: 200 },
      ],
    });
    expect(await readLog(agent, service.id)).toEqual([added.body]);
    // Each photo is stored full size and as a thumbnail.
    expect(storage.objects.size).toBe(4);
    expect([...storage.objects.values()].map(({ type }) => type).sort()).toEqual([
      "image/jpeg",
      "image/jpeg",
      "image/jpeg",
      "image/webp",
    ]);
  });

  it("adds a note with only photos, and one with only text as multipart", async () => {
    const { agent, service } = await setUp();

    const photosOnly = await postNote(agent, service.id, null, [{ photo: JPEG }]);
    const textOnly = await postNote(agent, service.id, "Just text", []);

    expect(photosOnly.status).toBe(201);
    expect(photosOnly.body).toMatchObject({ text: null, photos: [{ width: 640 }] });
    expect(textOnly.status).toBe(201);
    expect(textOnly.body).toMatchObject({ text: "Just text", photos: [] });
  });

  it("refuses a note with neither text nor photos", async () => {
    const { storage, agent, service } = await setUp();

    const blank = await postNote(agent, service.id, "   ", []);
    const nothing = await postNote(agent, service.id, null, []);

    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors.text).toBeDefined();
    expect(nothing.status).toBe(400);
    expect(await readLog(agent, service.id)).toEqual([]);
    expect(storage.objects.size).toBe(0);
  });

  it("refuses more than 10 photos with a 400 and stores nothing", async () => {
    const { storage, agent, service } = await setUp();

    const tooMany = await postNote(
      agent,
      service.id,
      "Eleven",
      Array.from({ length: 11 }, () => ({ photo: JPEG })),
    );

    expect(tooMany.status).toBe(400);
    expect(tooMany.body.details.fieldErrors.photos).toBeDefined();
    expect(await readLog(agent, service.id)).toEqual([]);
    expect(storage.objects.size).toBe(0);
  });

  it("refuses a file that isn't a JPEG or WebP by its content, whatever it is named", async () => {
    const { storage, agent, service } = await setUp();

    const png = await postNote(agent, service.id, null, [{ photo: JPEG }, { photo: PNG }]);
    const text = await postNote(agent, service.id, null, [{ photo: Buffer.from("not an image") }]);
    const badThumbnail = await postNote(agent, service.id, null, [{ photo: JPEG, thumbnail: PNG }]);

    for (const response of [png, text, badThumbnail]) {
      expect(response.status).toBe(400);
    }
    expect(png.body.details.fieldErrors.photos).toBeDefined();
    expect(badThumbnail.body.details.fieldErrors.thumbnails).toBeDefined();
    expect(await readLog(agent, service.id)).toEqual([]);
    expect(storage.objects.size).toBe(0);
  });

  it("refuses a photo without its thumbnail", async () => {
    const { agent, service } = await setUp();

    const response = await agent
      .post(`/api/services/${service.id}/log`)
      .attach("photos", JPEG, "photo.jpg");

    expect(response.status).toBe(400);
    expect(await readLog(agent, service.id)).toEqual([]);
  });

  it("refuses a malformed multipart body with a 400", async () => {
    const { agent, service } = await setUp();

    const response = await agent
      .post(`/api/services/${service.id}/log`)
      .set("Content-Type", "multipart/form-data; boundary=xyz")
      .send('--xyz\r\nContent-Disposition: form-data; name="photos"; filename="a.jpg"\r\n\r\nabc');

    expect(response.status).toBe(400);
    expect(await readLog(agent, service.id)).toEqual([]);
  });

  it("refuses a photo over the size limit", async () => {
    const { agent, service } = await setUp();
    // Still a JPEG by its first bytes.
    const huge = Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024)]);

    const response = await postNote(agent, service.id, null, [{ photo: huge }]);

    expect(response.status).toBe(400);
    expect(response.body.details.fieldErrors.photos).toBeDefined();
    expect(await readLog(agent, service.id)).toEqual([]);
  });

  it("leaves no note and no objects when storing a photo fails", async () => {
    const { storage, agent, service } = await setUp();
    storage.failPutsAfter = 3;

    const response = await postNote(agent, service.id, "Two photos", [
      { photo: JPEG },
      { photo: WEBP },
    ]);

    expect(response.status).toBe(502);
    expect(await readLog(agent, service.id)).toEqual([]);
    expect(storage.objects.size).toBe(0);
  });

  it("deletes the stored objects when the note can't be written", async () => {
    const { storage, agent, service } = await setUp();
    // The service is deleted while its photos upload, so writing the note fails.
    storage.duringPut = async () => {
      await prisma.service.deleteMany({ where: { id: service.id } });
    };

    const response = await postNote(agent, service.id, "Too late", [{ photo: JPEG }]);

    expect(response.status).toBe(404);
    expect(storage.objects.size).toBe(0);
    expect(await prisma.serviceLogEntry.count()).toBe(0);
  });

  it("stores nothing for an unknown service", async () => {
    const { storage, agent, service } = await setUp();
    const deleted = await agent.delete(`/api/services/${service.id}`);
    expect(deleted.status).toBe(204);

    const response = await postNote(agent, service.id, null, [{ photo: JPEG }]);

    expect(response.status).toBe(404);
    expect(storage.objects.size).toBe(0);
  });

  it("doesn't let a status change carry photos", async () => {
    const { storage, agent, service } = await setUp();

    const response = await agent
      .put(`/api/services/${service.id}/status`)
      .field("status", "IN_PROGRESS")
      .attach("photos", JPEG, "photo.jpg");

    expect(response.status).toBe(400);
    expect(response.body.details.fieldErrors.photos).toBeDefined();
    expect(await readLog(agent, service.id)).toEqual([]);
    expect(storage.objects.size).toBe(0);
  });

  it("isn't exposed on the public status page", async () => {
    const { agent, service } = await setUp();
    const added = await postNote(agent, service.id, "Internal", [{ photo: JPEG }]);

    const response = await request(createApp()).get(`/api/public/services/${service.publicToken}`);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(added.body.photos[0].id);
    expect(response.body).not.toHaveProperty("photos");
    expect(response.body).not.toHaveProperty("log");
  });
});

describe("registering a service with an intake note", () => {
  it("creates the service, its intake note and the note's photos together", async () => {
    const { storage, agent, customer, phone } = await setUp();

    const created = await postService(
      agent,
      { customerId: customer.id, deviceIds: [phone.id], date: "2026-03-15" },
      "Scratched screen, dent on the left edge",
      [{ photo: JPEG }, { photo: WEBP }],
    );

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      date: "2026-03-15",
      status: "RECEIVED",
      customer: { id: customer.id },
      devices: [{ id: phone.id }],
    });
    expect(await readLog(agent, created.body.id)).toMatchObject([
      {
        type: "NOTE",
        text: "Scratched screen, dent on the left edge",
        author: { name: STAFF.name },
        photos: [
          { width: 640, height: 480 },
          { width: 300, height: 200 },
        ],
      },
    ]);
    expect(storage.objects.size).toBe(4);
  });

  it("takes an intake note with only photos, or with only text as JSON", async () => {
    const { agent, customer, phone } = await setUp();
    const fields = { customerId: customer.id, deviceIds: [phone.id], date: "2026-03-15" };

    const photosOnly = await postService(agent, fields, null, [{ photo: JPEG }]);
    const textOnly = await agent.post("/api/services").send({ ...fields, intakeNote: "Like new" });

    expect(photosOnly.status).toBe(201);
    expect(await readLog(agent, photosOnly.body.id)).toMatchObject([
      { type: "NOTE", text: null, photos: [{ width: 640 }] },
    ]);
    expect(textOnly.status).toBe(201);
    expect(await readLog(agent, textOnly.body.id)).toMatchObject([
      { type: "NOTE", text: "Like new", photos: [] },
    ]);
  });

  it("writes no intake note without text or photos, as JSON or multipart", async () => {
    const { storage, agent, customer, phone } = await setUp();
    const generic = await create(agent, "/api/devices", { model: "Charger" });
    const fields = {
      customerId: customer.id,
      deviceIds: [phone.id, generic.id],
      date: "2026-03-15",
      description: "Won't charge",
    };

    const json = await agent.post("/api/services").send({ ...fields, intakeNote: "  " });
    const multipart = await postService(agent, fields, "", []);

    for (const response of [json, multipart]) {
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        description: "Won't charge",
        devices: [{ id: phone.id }, { id: generic.id }],
      });
      expect(await readLog(agent, response.body.id)).toEqual([]);
    }
    expect(storage.objects.size).toBe(0);
  });

  it("refuses intake photos that aren't valid, registering nothing", async () => {
    const { storage, agent, customer, phone } = await setUp();
    const fields = { customerId: customer.id, deviceIds: [phone.id], date: "2026-03-15" };

    const png = await postService(agent, fields, "Cracked", [{ photo: PNG }]);
    const tooMany = await postService(
      agent,
      fields,
      null,
      Array.from({ length: 11 }, () => ({ photo: JPEG })),
    );
    const noDevice = await postService(agent, { ...fields, deviceIds: [] }, null, [
      { photo: JPEG },
    ]);

    expect(png.status).toBe(400);
    expect(png.body.details.fieldErrors.photos).toBeDefined();
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.details.fieldErrors.photos).toBeDefined();
    expect(noDevice.status).toBe(400);
    expect(noDevice.body.details.fieldErrors.deviceIds).toBeDefined();
    // Only the service from the set-up.
    expect(await prisma.service.count()).toBe(1);
    expect(storage.objects.size).toBe(0);
  });

  it("leaves no service, no note and no objects when storing a photo fails", async () => {
    const { storage, agent, customer, phone } = await setUp();
    storage.failPutsAfter = 3;

    const response = await postService(
      agent,
      { customerId: customer.id, deviceIds: [phone.id], date: "2026-03-15" },
      "Two photos",
      [{ photo: JPEG }, { photo: WEBP }],
    );

    expect(response.status).toBe(502);
    expect(await prisma.service.count()).toBe(1);
    expect(await prisma.serviceLogEntry.count()).toBe(0);
    expect(await prisma.photo.count()).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("leaves no service, no note and no objects when the service can't be written", async () => {
    const { storage, agent, service } = await setUp();
    const other = await create(agent, "/api/customers", { name: "Ana", phone: "0601" });
    const tablet = await create(agent, "/api/devices", { model: "iPad", ownerId: other.id });
    // The device is deleted while the photos upload, so writing the service fails.
    storage.duringPut = async () => {
      await prisma.device.deleteMany({ where: { id: tablet.id } });
    };

    const response = await postService(
      agent,
      { customerId: other.id, deviceIds: [tablet.id], date: "2026-03-15" },
      "Too late",
      [{ photo: JPEG }],
    );

    expect(response.status).toBe(400);
    expect(response.body.details.fieldErrors.deviceIds).toBeDefined();
    expect(await prisma.service.findMany({ select: { id: true } })).toEqual([{ id: service.id }]);
    expect(await prisma.serviceLogEntry.count()).toBe(0);
    expect(await prisma.photo.count()).toBe(0);
    expect(storage.objects.size).toBe(0);
  });
});

describe("photo images", () => {
  it("are only reachable by a logged-in staff member", async () => {
    const photo = await request(createApp()).get(`/api/photos/${UNKNOWN_ID}`);
    const thumbnail = await request(createApp()).get(`/api/photos/${UNKNOWN_ID}/thumb`);

    expect(photo.status).toBe(401);
    expect(thumbnail.status).toBe(401);
  });

  it("redirect to the storage's link for the photo and for its thumbnail", async () => {
    const { storage, agent, service } = await setUp();
    const added = await postNote(agent, service.id, null, [{ photo: JPEG }]);
    const { id } = added.body.photos[0];

    const photo = await agent.get(`/api/photos/${id}`);
    const thumbnail = await agent.get(`/api/photos/${id}/thumb`);

    expect(photo.status).toBe(302);
    expect(thumbnail.status).toBe(302);
    expect(photo.headers.location).not.toBe(thumbnail.headers.location);
    const keyOf = (location: string) => location.replace("https://photos.test/", "");
    expect(storage.objects.get(keyOf(photo.headers.location))?.bytes.equals(JPEG)).toBe(true);
    expect(storage.objects.get(keyOf(thumbnail.headers.location))?.bytes.equals(THUMBNAIL)).toBe(
      true,
    );
  });

  it("answer 404 for an unknown photo", async () => {
    const { agent } = await setUp();

    expect((await agent.get(`/api/photos/${UNKNOWN_ID}`)).status).toBe(404);
    expect((await agent.get(`/api/photos/${UNKNOWN_ID}/thumb`)).status).toBe(404);
    expect((await agent.get("/api/photos/not-a-uuid")).status).toBe(404);
  });
});

describe("the filesystem photo storage", () => {
  it("serves a photo's image only to a logged-in staff member", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "servicebook-photos-"));
    const photoStorage = new FilesystemPhotoStorage(dir);
    const { agent } = await authenticatedAgent({ photoStorage });
    const customer = await create(agent, "/api/customers", { name: "Ana", phone: "0601" });
    const device = await create(agent, "/api/devices", { model: "Pixel", ownerId: customer.id });
    const service = await create(agent, "/api/services", {
      customerId: customer.id,
      deviceIds: [device.id],
      date: "2026-03-14",
    });
    const added = await postNote(agent, service.id, null, [{ photo: JPEG }]);

    const redirect = await agent.get(`/api/photos/${added.body.photos[0].id}`);
    const image = await agent.get(redirect.headers.location);
    const anonymous = await request(createApp({ photoStorage })).get(redirect.headers.location);

    expect(redirect.status).toBe(302);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    expect(Buffer.from(image.body).equals(JPEG)).toBe(true);
    expect(anonymous.status).toBe(401);
  });
});
