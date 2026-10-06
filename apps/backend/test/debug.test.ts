import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

describe("debug: Sentry test error", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get("/api/debug/error");

    expect(response.status).toBe(401);
  });

  it("throws an unhandled error through to the Express error handler", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.get("/api/debug/error");

    expect(response.status).toBe(500);
  });
});
