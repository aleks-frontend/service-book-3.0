import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

const SCREEN_REPLACEMENT = { name: "Screen replacement", price: 4500 };

describe("actions: create and read", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp()).get("/api/actions");

    expect(response.status).toBe(401);
  });

  it("creates an action that can then be read back", async () => {
    const { agent } = await authenticatedAgent();

    const created = await agent.post("/api/actions").send(SCREEN_REPLACEMENT);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(SCREEN_REPLACEMENT);
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body).not.toHaveProperty("legacyId");

    const read = await agent.get(`/api/actions/${created.body.id}`);

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ id: created.body.id, ...SCREEN_REPLACEMENT });
  });

  it("trims the name", async () => {
    const { agent } = await authenticatedAgent();

    const created = await agent.post("/api/actions").send({ name: "  Cleaning ", price: 1000 });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Cleaning", price: 1000 });
  });

  it("rejects an action without a name with 400", async () => {
    const { agent } = await authenticatedAgent();

    const missing = await agent.post("/api/actions").send({ price: 1000 });
    const blank = await agent.post("/api/actions").send({ name: "  ", price: 1000 });

    expect(missing.status).toBe(400);
    expect(missing.body.details.fieldErrors).toHaveProperty("name");
    expect(blank.status).toBe(400);
    expect(blank.body.details.fieldErrors).toHaveProperty("name");
  });

  it("accepts only a whole, non-negative price in RSD", async () => {
    const { agent } = await authenticatedAgent();

    const free = await agent.post("/api/actions").send({ name: "Diagnostics", price: 0 });
    // The last one is past what the database column can store.
    const invalidPrices = [undefined, -100, 99.5, "1500", null, 3_000_000_000];
    const rejected = await Promise.all(
      invalidPrices.map((price) => agent.post("/api/actions").send({ name: "Cleaning", price })),
    );

    expect(free.status).toBe(201);
    for (const response of rejected) {
      expect(response.status).toBe(400);
      expect(response.body.details.fieldErrors).toHaveProperty("price");
    }
  });

  it("returns 404 for an unknown action", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent.get("/api/actions/00000000-0000-4000-8000-000000000000");
    const malformed = await agent.get("/api/actions/not-a-uuid");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("actions: full list", () => {
  it("returns every action, sorted by name, without paging", async () => {
    const { agent } = await authenticatedAgent();
    // More than the largest page size, so a paged response would cut it short.
    for (let n = 60; n >= 1; n--) {
      await agent
        .post("/api/actions")
        .send({ name: `Action ${String(n).padStart(2, "0")}`, price: n * 100 });
    }

    const response = await agent.get("/api/actions");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(60);
    expect(response.body[0]).toMatchObject({ name: "Action 01", price: 100 });
    expect(response.body[59]).toMatchObject({ name: "Action 60", price: 6000 });
    expect(response.body[0]).not.toHaveProperty("legacyId");
  });

  it("returns an empty list when there are no actions", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.get("/api/actions");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("actions: update and delete", () => {
  it("replaces an action's name and price on update", async () => {
    const { agent } = await authenticatedAgent();
    const { body: action } = await agent.post("/api/actions").send(SCREEN_REPLACEMENT);

    const updated = await agent
      .put(`/api/actions/${action.id}`)
      .send({ name: "Screen replacement (OLED)", price: 6000 });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: action.id,
      name: "Screen replacement (OLED)",
      price: 6000,
    });

    const read = await agent.get(`/api/actions/${action.id}`);
    expect(read.body).toMatchObject({ name: "Screen replacement (OLED)", price: 6000 });
  });

  it("rejects an update with an invalid price with 400", async () => {
    const { agent } = await authenticatedAgent();
    const { body: action } = await agent.post("/api/actions").send(SCREEN_REPLACEMENT);

    const response = await agent
      .put(`/api/actions/${action.id}`)
      .send({ ...SCREEN_REPLACEMENT, price: -1 });

    expect(response.status).toBe(400);
    expect(response.body.details.fieldErrors).toHaveProperty("price");
    expect((await agent.get(`/api/actions/${action.id}`)).body.price).toBe(4500);
  });

  it("returns 404 when updating an unknown action", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent
      .put("/api/actions/00000000-0000-4000-8000-000000000000")
      .send(SCREEN_REPLACEMENT);
    const malformed = await agent.put("/api/actions/not-a-uuid").send(SCREEN_REPLACEMENT);

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });

  it("deletes an action, removing it from the list", async () => {
    const { agent } = await authenticatedAgent();
    const { body: action } = await agent.post("/api/actions").send(SCREEN_REPLACEMENT);
    await agent.post("/api/actions").send({ name: "Cleaning", price: 1000 });

    const deleted = await agent.delete(`/api/actions/${action.id}`);

    expect(deleted.status).toBe(204);
    expect((await agent.get(`/api/actions/${action.id}`)).status).toBe(404);
    const list = await agent.get("/api/actions");
    expect(list.body.map(({ name }: { name: string }) => name)).toEqual(["Cleaning"]);
  });

  it("returns 404 when deleting an unknown action", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent.delete("/api/actions/00000000-0000-4000-8000-000000000000");
    const malformed = await agent.delete("/api/actions/not-a-uuid");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});
