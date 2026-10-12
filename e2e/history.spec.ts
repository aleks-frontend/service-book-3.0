import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

/** A customer with a phone of their own, brought in for service, through the API with the page's session. */
async function customerWithService(page: Page, name: string) {
  const post = async (path: string, data: object) =>
    (await page.request.post(path, { data })).json();
  const customer = await post("/api/customers", { name, phone: "0659" });
  const device = await post("/api/devices", {
    manufacturer: "Xiaomi",
    model: `Redmi ${name}`,
    ownerId: customer.id,
  });
  const service = await post("/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: "2026-03-14",
  });
  return { customer, device, service };
}

test("a customer's drawer lists their devices and services, and an entry opens the service's drawer", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { service } = await customerWithService(page, "Zoran Zorić");

  await page.goto("/customers");
  await page.getByLabel("Pretraga mušterija").fill("Zoran");
  await page.getByRole("row", { name: /Zoran Zorić/ }).click();
  const customerDrawer = page.getByRole("dialog", { name: "Zoran Zorić" });
  await expect(customerDrawer.getByRole("region", { name: "Uređaji" })).toContainText(
    "Xiaomi Redmi Zoran Zorić",
  );

  const history = customerDrawer.getByRole("region", { name: "Istorija servisa" });
  await history.getByRole("button", { name: new RegExp(service.number) }).click();
  await expect(page).toHaveURL(`/customers?service=${service.id}`);
  const serviceDrawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await expect(serviceDrawer).toBeVisible();

  // Closing the service goes back to the customer.
  await page.keyboard.press("Escape");
  await expect(serviceDrawer).toBeHidden();
  await expect(page).toHaveURL("/customers");
  await expect(customerDrawer).toBeVisible();

  // The customer has a service, so they cannot be deleted.
  await customerDrawer.getByRole("button", { name: "Obriši mušteriju" }).click();
  await page
    .getByRole("dialog", { name: "Obrisati mušteriju?" })
    .getByRole("button", { name: "Obriši", exact: true })
    .click();
  await expect(page.getByText("ne može biti obrisan", { exact: false })).toBeVisible();
});

test("a device's drawer lists every service it was on, and an entry opens the service's drawer", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { device, service } = await customerWithService(page, "Vesna Vesić");

  await page.goto("/devices");
  await page.getByLabel("Pretraga uređaja").fill("Redmi Vesna");
  await page.getByRole("row", { name: /Redmi Vesna/ }).click();
  const deviceDrawer = page.getByRole("dialog", { name: `Xiaomi ${device.model}` });
  const history = deviceDrawer.getByRole("region", { name: "Istorija servisa" });
  await expect(history).toContainText("Vesna Vesić");

  await history.getByRole("button", { name: new RegExp(service.number) }).click();
  await expect(page).toHaveURL(`/devices?service=${service.id}`);
  await expect(page.getByRole("dialog", { name: `Servis ${service.number}` })).toBeVisible();
});
