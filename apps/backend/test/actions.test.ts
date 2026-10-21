import request from "supertest";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../src/app.js";
import { authenticatedAgent } from "./helpers.js";

const SCREEN_REPLACEMENT = { name: "Screen replacement", price: 4500 };
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

/** Creates actions "Action 01" … "Action NN" through the API, returning their ids. */
async function createNumberedActions(agent: TestAgent, count: number) {
  const ids: string[] = [];
  for (let n = 1; n <= count; n++) {
    const { body } = await agent
      .post("/api/actions")
      .send({ name: `Action ${String(n).padStart(2, "0")}`, price: 1000 });
    ids.push(body.id);
  }
  return ids;
}

function names(response: { body: { items: { name: string }[] } }) {
  return response.body.items.map(({ name }) => name);
}

function ids(response: { body: { items: { id: string }[] } }) {
  return response.body.items.map(({ id }) => id);
}

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

describe("actions: paged list", () => {
  it("returns the first 10 actions by name with the total count", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedActions(agent, 12);

    const response = await agent.get("/api/actions");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 12, page: 1, pageSize: 10 });
    expect(names(response)).toEqual([
      "Action 01",
      "Action 02",
      "Action 03",
      "Action 04",
      "Action 05",
      "Action 06",
      "Action 07",
      "Action 08",
      "Action 09",
      "Action 10",
    ]);
    expect(response.body.items[0]).not.toHaveProperty("legacyId");
  });

  it("returns later pages by offset", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedActions(agent, 12);

    const response = await agent.get("/api/actions?page=2&pageSize=10");

    expect(response.body).toMatchObject({ total: 12, page: 2, pageSize: 10 });
    expect(names(response)).toEqual(["Action 11", "Action 12"]);
  });

  it("supports 25 and 50 rows per page", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedActions(agent, 55);

    const page25 = await agent.get("/api/actions?pageSize=25&page=3");
    const page50 = await agent.get("/api/actions?pageSize=50");

    expect(page25.body).toMatchObject({ total: 55, page: 3, pageSize: 25 });
    expect(names(page25)).toEqual([
      "Action 51",
      "Action 52",
      "Action 53",
      "Action 54",
      "Action 55",
    ]);
    expect(page50.body.items).toHaveLength(50);
    expect(names(page50).at(-1)).toBe("Action 50");
  });

  it("rejects other page sizes and invalid pages with 400", async () => {
    const { agent } = await authenticatedAgent();

    expect((await agent.get("/api/actions?pageSize=20")).status).toBe(400);
    expect((await agent.get("/api/actions?pageSize=1000")).status).toBe(400);
    expect((await agent.get("/api/actions?page=0")).status).toBe(400);
    expect((await agent.get("/api/actions?page=abc")).status).toBe(400);
  });

  it("sorts by name in either direction, breaking ties by id", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedActions(agent, 3);
    const twins = await Promise.all(
      [1000, 2000].map(async (price) => {
        const { body } = await agent.post("/api/actions").send({ name: "Cleaning", price });
        return body.id as string;
      }),
    );
    const twinsById = [...twins].sort();

    const ascending = await agent.get("/api/actions?sortDir=asc");
    const descending = await agent.get("/api/actions?sortDir=desc");

    expect(names(ascending)).toEqual([
      "Action 01",
      "Action 02",
      "Action 03",
      "Cleaning",
      "Cleaning",
    ]);
    expect(names(descending)).toEqual([
      "Cleaning",
      "Cleaning",
      "Action 03",
      "Action 02",
      "Action 01",
    ]);
    // Repeated names keep the same order either way, so pages stay stable.
    expect(ids(ascending).slice(3)).toEqual(twinsById);
    expect(ids(descending).slice(0, 2)).toEqual(twinsById);
  });

  it("searches by part of the name, ignoring case", async () => {
    const { agent } = await authenticatedAgent();
    await agent.post("/api/actions").send(SCREEN_REPLACEMENT);
    await agent.post("/api/actions").send({ name: "Screen protector", price: 800 });
    await agent.post("/api/actions").send({ name: "Cleaning", price: 1000 });

    const response = await agent.get("/api/actions?search=SCREEN");
    const middle = await agent.get("/api/actions?search=protect");

    expect(response.body.total).toBe(2);
    expect(names(response)).toEqual(["Screen protector", "Screen replacement"]);
    expect(names(middle)).toEqual(["Screen protector"]);
  });

  it("pages through search results with the filtered total", async () => {
    const { agent } = await authenticatedAgent();
    await createNumberedActions(agent, 12);
    await agent.post("/api/actions").send({ name: "Cleaning", price: 1000 });

    const response = await agent.get("/api/actions?search=action&page=2");

    expect(response.body).toMatchObject({ total: 12, page: 2 });
    expect(names(response)).toEqual(["Action 11", "Action 12"]);
  });

  it("returns an empty page when there are no actions", async () => {
    const { agent } = await authenticatedAgent();

    const response = await agent.get("/api/actions");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], total: 0, page: 1, pageSize: 10 });
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
    expect(names(list)).toEqual(["Cleaning"]);
  });

  it("returns 404 when deleting an unknown action", async () => {
    const { agent } = await authenticatedAgent();

    const unknown = await agent.delete("/api/actions/00000000-0000-4000-8000-000000000000");
    const malformed = await agent.delete("/api/actions/not-a-uuid");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("actions: bulk delete", () => {
  it("is only reachable by a logged-in staff member", async () => {
    const response = await request(createApp())
      .post("/api/actions/bulk-delete")
      .send({ ids: [UNKNOWN_ID] });

    expect(response.status).toBe(401);
  });

  it("deletes the named actions and keeps the rest", async () => {
    const { agent } = await authenticatedAgent();
    const [first, second, kept] = await createNumberedActions(agent, 3);

    const response = await agent.post("/api/actions/bulk-delete").send({ ids: [first, second] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedIds: [first, second], inUseIds: [] });
    const list = await agent.get("/api/actions");
    expect(ids(list)).toEqual([kept]);
  });

  it("skips ids that name no action", async () => {
    const { agent } = await authenticatedAgent();
    const [action] = await createNumberedActions(agent, 1);

    const response = await agent
      .post("/api/actions/bulk-delete")
      .send({ ids: [action, UNKNOWN_ID] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedIds: [action], inUseIds: [] });
  });

  it("rejects an empty, oversized or malformed list with 400, deleting nothing", async () => {
    const { agent } = await authenticatedAgent();
    const [action] = await createNumberedActions(agent, 1);
    const tooMany = Array.from({ length: 51 }, () => action);

    const empty = await agent.post("/api/actions/bulk-delete").send({ ids: [] });
    const oversized = await agent.post("/api/actions/bulk-delete").send({ ids: tooMany });
    const malformed = await agent
      .post("/api/actions/bulk-delete")
      .send({ ids: [action, "not-a-uuid"] });

    for (const response of [empty, oversized, malformed]) {
      expect(response.status).toBe(400);
      expect(response.body.details.fieldErrors).toHaveProperty("ids");
    }
    expect((await agent.get(`/api/actions/${action}`)).status).toBe(200);
  });
});
