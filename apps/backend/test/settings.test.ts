import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

function fixtureDataUrl(file: string, type: string) {
  const bytes = readFileSync(fileURLToPath(new URL(`./fixtures/images/${file}`, import.meta.url)));
  return `data:${type};base64,${bytes.toString("base64")}`;
}

const LOGO = fixtureDataUrl("logo.png", "image/png");
const SIGNATURE = fixtureDataUrl("signature.jpg", "image/jpeg");

/** The logo fixture padded to `size` bytes; it still starts like a PNG. */
function pngOfSize(size: number) {
  const png = Buffer.from(LOGO.split(",")[1], "base64");
  const padded = Buffer.concat([png, Buffer.alloc(size - png.length)]);
  return `data:image/png;base64,${padded.toString("base64")}`;
}

const COMPANY = {
  name: "Servis Lisztrapszódia",
  address: "Glavna 1, Subotica",
  phone: "024 123 456",
  email: "servis@example.com",
  taxId: "101234567",
  logo: LOGO,
  signature: SIGNATURE,
};

describe("settings", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const app = createApp();

    const read = await request(app).get("/api/settings");
    const write = await request(app).put("/api/settings").send({ name: "Servis" });

    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
  });

  it("returns empty defaults before the company is set up", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.get("/api/settings");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: null,
      address: null,
      phone: null,
      email: null,
      taxId: null,
      logo: null,
      signature: null,
    });
  });

  it("saves every field, including the images, and reads them back", async () => {
    const { agent } = await authenticatedAgent();

    const saved = await agent.put("/api/settings").send(COMPANY);
    const read = await agent.get("/api/settings");

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(COMPANY);
    expect(read.status).toBe(200);
    expect(read.body).toEqual(COMPANY);
  });

  it("replaces the settings on a later save, and null removes an image", async () => {
    const { agent } = await authenticatedAgent();
    await agent.put("/api/settings").send(COMPANY);

    const saved = await agent
      .put("/api/settings")
      .send({ ...COMPANY, name: "  Servis Plus ", address: " ", signature: null });

    expect(saved.status).toBe(200);
    expect((await agent.get("/api/settings")).body).toEqual({
      ...COMPANY,
      name: "Servis Plus",
      address: null,
      signature: null,
    });
  });

  it("accepts images of up to 1 MB", async () => {
    const { agent } = await authenticatedAgent();
    const largest = pngOfSize(1024 * 1024);

    const saved = await agent
      .put("/api/settings")
      .send({ ...COMPANY, logo: largest, signature: largest });

    expect(saved.status).toBe(200);
    expect(saved.body.logo).toBe(largest);
  });

  it("rejects invalid settings with 400 and keeps the saved ones", async () => {
    const { agent } = await authenticatedAgent();
    await agent.put("/api/settings").send(COMPANY);
    const oversized = pngOfSize(1024 * 1024 + 1);

    const invalid = [
      ["name", { ...COMPANY, name: undefined }],
      ["name", { ...COMPANY, name: "  " }],
      ["email", { ...COMPANY, email: "not-an-email" }],
      ["logo", { ...COMPANY, logo: "https://example.com/logo.png" }],
      ["logo", { ...COMPANY, logo: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" }],
      // Declared as a PNG but the bytes are a JPEG.
      ["signature", { ...COMPANY, signature: SIGNATURE.replace("image/jpeg", "image/png") }],
      ["logo", { ...COMPANY, logo: oversized }],
      ["logo", { ...COMPANY, logo: undefined }],
    ] as const;

    for (const [field, body] of invalid) {
      const response = await agent.put("/api/settings").send(body);

      expect(response.status, field).toBe(400);
      expect(response.body.details.fieldErrors, field).toHaveProperty(field);
    }
    expect((await agent.get("/api/settings")).body).toEqual(COMPANY);
  });
});

describe("the public logo", () => {
  it("is null without a session before a logo is uploaded", async () => {
    const response = await request(createApp()).get("/api/public/logo");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ logo: null });
  });

  it("is the uploaded logo, and nothing else from the settings", async () => {
    const { agent } = await authenticatedAgent();
    await agent.put("/api/settings").send(COMPANY);

    const response = await request(createApp()).get("/api/public/logo");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ logo: LOGO });
  });
});
