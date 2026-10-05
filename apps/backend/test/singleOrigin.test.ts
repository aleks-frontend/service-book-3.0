import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const adminPanelDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/admin-panel",
);

describe("single origin: serving the admin panel", () => {
  const app = createApp({ adminPanelDir });

  it("serves the admin panel's index.html at the root", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Admin panel fixture");
  });

  it("serves the admin panel's static assets", async () => {
    const response = await request(app).get("/assets/app.js");

    expect(response.status).toBe(200);
    expect(response.text).toContain("admin panel asset");
  });

  it("falls back to index.html for client-side routes", async () => {
    const response = await request(app).get("/customers?service=abc");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Admin panel fixture");
  });

  it("never serves index.html for /api paths", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(401);
    expect(response.text).not.toContain("Admin panel fixture");
  });
});
