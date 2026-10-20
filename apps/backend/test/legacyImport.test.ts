import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent.js";
import { importLegacy } from "../src/lib/legacyImport/importLegacy.js";
import { authenticatedAgent } from "./helpers.js";

/** An anonymised Firebase export with every quirk of the real one. */
const fixture: unknown = JSON.parse(
  readFileSync(new URL("./fixtures/legacy/firebase-export.json", import.meta.url), "utf8"),
);

async function get(agent: TestAgent, path: string) {
  const response = await agent.get(path);
  expect(response.status).toBe(200);
  return response.body;
}

async function counts(agent: TestAgent) {
  const [customers, devices, actions, services] = await Promise.all([
    get(agent, "/api/customers"),
    get(agent, "/api/devices"),
    get(agent, "/api/actions"),
    get(agent, "/api/services?limit=50"),
  ]);
  return {
    customers: customers.total,
    devices: devices.total,
    actions: actions.length,
    services: services.items.length,
  };
}

/** The service with this number, with its lines. */
async function findService(agent: TestAgent, number: string) {
  const { items } = await get(agent, `/api/services?search=${number}`);
  expect(items).toHaveLength(1);
  return get(agent, `/api/services/${items[0].id}`);
}

describe("legacy import", () => {
  it("reports what a dry run would import and writes nothing", async () => {
    const { agent } = await authenticatedAgent();

    const report = await importLegacy(fixture, { dryRun: true });

    expect(report.counts).toEqual({
      customers: 4,
      devices: { owned: 2, generic: 5 },
      actions: 4,
      services: 5,
      workLines: 4,
      saleLines: 3,
      legacyRemarks: 3,
    });
    expect(report.skipped).toEqual([{ record: "false", reason: expect.any(String) }]);
    expect(report.anomalies.map(({ record }) => record).sort()).toEqual([
      // A placeholder manufacturer; names edited away from manufacturer and model.
      "devices/1570000000203",
      "devices/1570000000203",
      "devices/device004",
      // A price of 9333.33.
      "services/1736000000000/newDevices/1",
      // An old `title` field.
      "services/1738000000000",
      // An unknown status; a device flagged as sold attached as serviced.
      "services/1768000000000",
      "services/1768000000000",
    ]);
    expect(report.anomalies).toContainEqual({
      record: "services/1768000000000",
      message: expect.stringContaining('"inprogress"'),
    });
    expect(report.anomalies).toContainEqual({
      record: "devices/1570000000203",
      message: expect.stringContaining("Placeholder manufacturer"),
    });
    expect(await counts(agent)).toEqual({ customers: 0, devices: 0, actions: 0, services: 0 });
  });

  it("imports every record, numbering services in date order per year with mapped statuses", async () => {
    const { agent } = await authenticatedAgent();

    await importLegacy(fixture, { dryRun: false });

    expect(await counts(agent)).toEqual({ customers: 4, devices: 7, actions: 4, services: 5 });
    const services = await get(agent, "/api/services?limit=50&sortDir=asc");
    expect(
      services.items.map(({ number, date, description, status }: Record<string, unknown>) => ({
        number,
        date,
        description,
        status,
      })),
    ).toEqual([
      {
        number: "2025-0001",
        date: "2025-01-02",
        description: "Razbijen ekran",
        status: "DELIVERED",
      },
      { number: "2025-0002", date: "2025-01-27", description: "Spor", status: "RECEIVED" },
      { number: "2025-0003", date: "2025-02-19", description: "Ne puni", status: "COMPLETED" },
      // 23:30 UTC on New Year's Eve is already 2026 in Serbia.
      { number: "2026-0001", date: "2026-01-01", description: "Pregreva se", status: "RECEIVED" },
      { number: "2026-0002", date: "2026-01-03", description: "Ne pali se", status: "DELIVERED" },
    ]);
  });

  it("logs each remark as a legacy remark, dated when the service was taken in", async () => {
    const { agent } = await authenticatedAgent();
    await importLegacy(fixture, { dryRun: false });

    const service = await findService(agent, "2025-0001");

    expect(await get(agent, `/api/services/${service.id}/log`)).toEqual([
      {
        id: expect.any(String),
        type: "LEGACY_REMARK",
        text: "Klijent javio da ekran treperi",
        fromStatus: null,
        toStatus: null,
        author: null,
        createdAt: "2025-01-02T06:40:00.000Z",
      },
    ]);
    expect(
      await get(agent, `/api/services/${(await findService(agent, "2025-0003")).id}/log`),
    ).toEqual([]);
  });

  it("gives a device to the one customer it was serviced for and leaves shared and sold ones generic", async () => {
    const { agent } = await authenticatedAgent();
    await importLegacy(fixture, { dryRun: false });

    const { items } = await get(agent, "/api/devices?pageSize=50");
    const owners = Object.fromEntries(
      items.map(({ model, owner }: { model: string; owner: { name: string } | null }) => [
        model,
        owner?.name ?? null,
      ]),
    );

    expect(owners).toEqual({
      "Galaxy S21": "Petar Petrović",
      "IdeaPad 3": "Kovács Anna",
      // Serviced for Jelena and for Milan.
      "250 G7": null,
      // Only ever sold, or never used.
      "USB-C punjač": null,
      "A400 240GB": null,
      M185: null,
      "iPhone 8": null,
    });
    // Doubled spaces made single.
    expect(items.find(({ model }: { model: string }) => model === "iPhone 8")).toMatchObject({
      manufacturer: "Apple",
      serialNumber: "F2LX123",
    });
    expect(items.find(({ model }: { model: string }) => model === "250 G7")).toMatchObject({
      manufacturer: "HP",
      serialNumber: null,
      description: "crni, 8GB RAM",
    });
  });

  it("turns actions into work lines and sold devices into sale lines, with whole-number totals", async () => {
    const { agent } = await authenticatedAgent();
    await importLegacy(fixture, { dryRun: false });

    const repair = await findService(agent, "2026-0002");
    const sale = await findService(agent, "2025-0003");

    const line = ({ type, label, quantity, unitPrice }: Record<string, unknown>) => ({
      type,
      label,
      quantity,
      unitPrice,
    });
    expect(repair.lines.map(line)).toEqual([
      { type: "WORK", label: "Dijagnostika", quantity: 1, unitPrice: 1000 },
      { type: "SALE", label: "Kingston A400 240GB", quantity: 1, unitPrice: 4500 },
    ]);
    expect(repair.total).toBe(5500);
    // String quantities and prices; 9333.33 is rounded.
    expect(sale.lines.map(line)).toEqual([
      { type: "SALE", label: "Punjač USB-C", quantity: 2, unitPrice: 1200 },
      { type: "SALE", label: "Logitech M185", quantity: 1, unitPrice: 9333 },
    ]);
    expect(sale.total).toBe(11733);
    // A numeric action name at a string price.
    expect((await findService(agent, "2025-0002")).lines.map(line)).toEqual([
      { type: "WORK", label: "1234", quantity: 2, unitPrice: 500 },
    ]);
    expect((await findService(agent, "2025-0001")).total).toBe(3500);
  });

  it("changes nothing when run again: no duplicates, same numbers, tokens and totals", async () => {
    const { agent } = await authenticatedAgent();
    await importLegacy(fixture, { dryRun: false });
    const before = await get(agent, "/api/services?limit=50");
    const service = await findService(agent, "2025-0001");
    await agent.post(`/api/services/${service.id}/log`).send({ text: "Staff note" });

    await importLegacy(fixture, { dryRun: false });

    expect(await counts(agent)).toEqual({ customers: 4, devices: 7, actions: 4, services: 5 });
    const after = await get(agent, "/api/services?limit=50");
    const summary = ({ number, publicToken, total, devices }: Record<string, unknown>) => ({
      number,
      publicToken,
      total,
      devices,
    });
    expect(after.items.map(summary)).toEqual(before.items.map(summary));
    const log = await get(agent, `/api/services/${service.id}/log`);
    expect(log.map(({ type, text }: Record<string, unknown>) => ({ type, text }))).toEqual([
      { type: "LEGACY_REMARK", text: "Klijent javio da ekran treperi" },
      { type: "NOTE", text: "Staff note" },
    ]);
  });

  it("refreshes records whose export changed when run again", async () => {
    const { agent } = await authenticatedAgent();
    await importLegacy(fixture, { dryRun: false });

    const changed = structuredClone(fixture) as {
      ssot: Record<string, Record<string, Record<string, unknown>>>;
    };
    const { customers, actions, devices, services } = changed.ssot;
    customers["1570000000001"].name = "Petar P. Petrović";
    actions["1570000000101"].price = 1200;
    devices["1570000000201"].serial = "R58M999";
    Object.assign(services["1735800000000"], {
      description: "Razbijen ekran i kamera",
      status: "completed",
      remark: "Klijent javio da kamera ne radi",
      actions: [{ rowId: 1, actionId: "1570000000101", quantity: 2, price: 1200 }],
    });
    await importLegacy(changed, { dryRun: false });

    expect(await counts(agent)).toEqual({ customers: 4, devices: 7, actions: 4, services: 5 });
    const service = await findService(agent, "2025-0001");
    expect(service).toMatchObject({
      description: "Razbijen ekran i kamera",
      status: "COMPLETED",
      customer: { name: "Petar P. Petrović" },
      devices: [{ serialNumber: "R58M999" }],
      total: 2400,
    });
    expect(
      (await get(agent, `/api/services/${service.id}/log`)).map(
        ({ text }: { text: string }) => text,
      ),
    ).toEqual(["Klijent javio da kamera ne radi"]);
    const action = (await get(agent, "/api/actions")).find(
      ({ name }: { name: string }) => name === "Dijagnostika",
    );
    expect(action.price).toBe(1200);
  });

  it("lets services created after the import continue each year's numbering", async () => {
    const { agent } = await authenticatedAgent();
    await importLegacy(fixture, { dryRun: false });
    const customer = (await get(agent, "/api/customers?search=Petar")).items[0];
    const device = (await get(agent, `/api/devices?ownerId=${customer.id}`)).items[0];

    const create = (date: string) =>
      agent.post("/api/services").send({ customerId: customer.id, deviceIds: [device.id], date });
    const in2025 = await create("2025-06-01");
    const in2026 = await create("2026-10-19");

    expect(in2025.body.number).toBe("2025-0004");
    expect(in2026.body.number).toBe("2026-0003");
  });

  it("numbers legacy services added to a later export after those already imported", async () => {
    const { agent } = await authenticatedAgent();
    await importLegacy(fixture, { dryRun: false });
    const customer = (await get(agent, "/api/customers?search=Petar")).items[0];
    const device = (await get(agent, `/api/devices?ownerId=${customer.id}`)).items[0];
    await agent
      .post("/api/services")
      .send({ customerId: customer.id, deviceIds: [device.id], date: "2026-10-18" });

    const topUp = structuredClone(fixture) as {
      ssot: { services: Record<string, Record<string, unknown>> };
    };
    topUp.ssot.services["1776500000000"] = {
      ...topUp.ssot.services["1767400000000"],
      date: 1776500000000,
      description: "Ne radi tastatura",
    };
    await importLegacy(topUp, { dryRun: false });

    expect((await counts(agent)).services).toBe(7);
    expect((await findService(agent, "2026-0004")).description).toBe("Ne radi tastatura");
  });
});
