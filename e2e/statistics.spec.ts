import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr). The services are dated in 2019, away from
// the other tests' services, which share the database.

/** Services in March and July 2019 through the API with the page's session, plus a cancelled one. */
async function servicesIn2019(page: Page) {
  const post = async (path: string, data: object) =>
    (await page.request.post(path, { data })).json();
  const customer = await post("/api/customers", { name: "Statistika", phone: "0661" });
  const device = await post("/api/devices", { model: "Pixel 4", ownerId: customer.id });
  const action = await post("/api/actions", { name: "Zamena baterije", price: 5000 });
  const cable = await post("/api/devices", { model: "Kabl" });

  const service = async (date: string) =>
    post("/api/services", { customerId: customer.id, deviceIds: [device.id], date });
  const march = await service("2019-03-10");
  await post(`/api/services/${march.id}/lines`, { type: "WORK", actionId: action.id, quantity: 1 });
  const july = await service("2019-07-20");
  await post(`/api/services/${july.id}/lines`, {
    type: "SALE",
    deviceId: cable.id,
    quantity: 2,
    unitPrice: 1500,
  });
  const cancelled = await service("2019-05-05");
  await post(`/api/services/${cancelled.id}/lines`, {
    type: "WORK",
    actionId: action.id,
    quantity: 3,
  });
  await page.request.put(`/api/services/${cancelled.id}/status`, {
    data: { status: "CANCELLED" },
  });
}

test("changing the range updates the earnings chart and total", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  await servicesIn2019(page);

  await page.getByRole("navigation").getByRole("link", { name: "Statistika" }).click();
  await expect(page).toHaveURL("/statistics");
  await expect(page.getByRole("heading", { name: "Statistika" })).toBeVisible();

  const earnings = page.getByRole("region", { name: "Zarada" });
  const chart = earnings.getByRole("figure", { name: "Grafikon zarade" });

  await page.getByLabel("Od").fill("2019-01-01");
  await page.getByLabel("Do").fill("2019-12-31");
  // 1 × 5000 + 2 × 1500; the cancelled service earns nothing.
  await expect(earnings).toContainText("Ukupno: 8.000 RSD");
  await expect(chart).toContainText("jul 2019.");

  await page.getByLabel("Do").fill("2019-05-31");
  await expect(earnings).toContainText("Ukupno: 5.000 RSD");
  await expect(chart).toContainText("maj 2019.");
  await expect(chart).not.toContainText("jul 2019.");

  await page.getByRole("combobox", { name: "Grupiši po" }).click();
  await page.getByRole("option", { name: "Godina" }).click();
  await expect(chart).toContainText("2019");
  await expect(chart).not.toContainText("maj 2019.");
  await expect(earnings).toContainText("Ukupno: 5.000 RSD");

  // Every status shows its count; other tests' services count too.
  const counts = await (await page.request.get("/api/statistics/status-counts")).json();
  expect(counts.CANCELLED).toBeGreaterThan(0);
  const statuses = page.getByRole("region", { name: "Servisi po statusu" });
  for (const [label, status] of [
    ["Primljen", "RECEIVED"],
    ["Otkazan", "CANCELLED"],
  ]) {
    await expect(
      statuses.locator("div").filter({ hasText: label }).getByRole("definition"),
    ).toHaveText(String(counts[status]));
  }
});
