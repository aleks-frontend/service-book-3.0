import request from "supertest";
import { describe, expect, it } from "vitest";
import { createStaffMember } from "../src/lib/staffMembers.js";
import { createApp } from "../src/app.js";
import { STAFF, authenticatedAgent } from "./helpers.js";

describe("API authentication", () => {
  it("rejects an unauthenticated request to a non-auth /api route with 401", async () => {
    const response = await request(createApp()).get("/api/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("lets a seeded staff member log in and identifies them on later requests", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.get("/api/me");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "Test Staff", email: "staff@example.com" });
  });
});

describe("API authentication: staff accounts", () => {
  it("has no public sign-up", async () => {
    const response = await request(createApp())
      .post("/api/auth/sign-up/email")
      .send({ email: "stranger@example.com", password: "let-me-in-please", name: "Stranger" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: "EMAIL_PASSWORD_SIGN_UP_DISABLED" });

    const login = await request(createApp())
      .post("/api/auth/sign-in/email")
      .send({ email: "stranger@example.com", password: "let-me-in-please" });
    expect(login.status).toBe(401);
  });

  it("rejects a wrong password", async () => {
    await createStaffMember(STAFF);

    const response = await request(createApp())
      .post("/api/auth/sign-in/email")
      .send({ email: STAFF.email, password: "wrong-password" });

    expect(response.status).toBe(401);
  });

  it("refuses to create a second staff member with the same email", async () => {
    await createStaffMember(STAFF);

    await expect(createStaffMember({ ...STAFF, name: "Someone else" })).rejects.toThrow(
      /already exists/,
    );
  });

  it("ends the session on logout", async () => {
    const { agent } = await authenticatedAgent();

    const logout = await agent.post("/api/auth/sign-out").set("Origin", "http://localhost:3001");
    expect(logout.status).toBe(200);

    const response = await agent.get("/api/me");
    expect(response.status).toBe(401);
  });
});

describe("API authentication: unknown /api paths", () => {
  it("returns 401 for an unknown /api path when unauthenticated", async () => {
    const response = await request(createApp()).get("/api/does-not-exist");

    expect(response.status).toBe(401);
  });

  it("returns a JSON 404 for an unknown /api path when authenticated", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });
});
