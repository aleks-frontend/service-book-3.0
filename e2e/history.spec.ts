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

test("a device in a customer's drawer opens its own drawer, stacked, which edits the device and leads on to its services", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { device, service } = await customerWithService(page, "Milan Milić");

  await page.goto("/customers");
  await page.getByLabel("Pretraga mušterija").fill("Milan");
  await page.getByRole("row", { name: /Milan Milić/ }).click();
  const customerDrawer = page.getByRole("dialog", { name: "Milan Milić" });
  await customerDrawer
    .getByRole("region", { name: "Uređaji" })
    .getByRole("button", { name: /Redmi Milan Milić/ })
    .click();
  await expect(page).toHaveURL(`/customers?device=${device.id}`);
  const deviceDrawer = page.getByRole("dialog", { name: `Xiaomi ${device.model}` });
  await expect(deviceDrawer.getByRole("region", { name: "Istorija servisa" })).toContainText(
    "Milan Milić",
  );

  // The device drawer edits the device by itself, on any page.
  await deviceDrawer.getByRole("button", { name: "Izmena uređaja" }).click();
  const form = page.getByRole("dialog", { name: "Izmena uređaja" });
  await form.getByLabel("Model").fill("Redmi Note Milan");
  await form.getByRole("button", { name: "Sačuvaj izmene" }).click();
  await expect(form).toBeHidden();
  const renamedDrawer = page.getByRole("dialog", { name: "Xiaomi Redmi Note Milan" });
  await expect(renamedDrawer).toBeVisible();

  await renamedDrawer
    .getByRole("region", { name: "Istorija servisa" })
    .getByRole("button", { name: new RegExp(service.number) })
    .click();
  await expect(page).toHaveURL(`/customers?device=${device.id}&service=${service.id}`);
  const serviceDrawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await expect(serviceDrawer).toBeVisible();

  // Escape closes one drawer at a time, back to the customer.
  await page.keyboard.press("Escape");
  await expect(serviceDrawer).toBeHidden();
  await expect(page).toHaveURL(`/customers?device=${device.id}`);
  await expect(renamedDrawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(renamedDrawer).toBeHidden();
  await expect(page).toHaveURL("/customers");
  // The customer's devices show the edit.
  await expect(customerDrawer.getByRole("region", { name: "Uređaji" })).toContainText(
    "Redmi Note Milan",
  );
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
  await expect(page).toHaveURL(`/devices?device=${device.id}`);
  const deviceDrawer = page.getByRole("dialog", { name: `Xiaomi ${device.model}` });
  const history = deviceDrawer.getByRole("region", { name: "Istorija servisa" });
  await expect(history).toContainText("Vesna Vesić");

  await history.getByRole("button", { name: new RegExp(service.number) }).click();
  await expect(page).toHaveURL(`/devices?device=${device.id}&service=${service.id}`);
  await expect(page.getByRole("dialog", { name: `Servis ${service.number}` })).toBeVisible();
});

test("a link to a device opens its drawer", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { device } = await customerWithService(page, "Dragan Dragić");

  await page.goto(`/customers?device=${device.id}`);
  const deviceDrawer = page.getByRole("dialog", { name: `Xiaomi ${device.model}` });
  await expect(deviceDrawer).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(deviceDrawer).toBeHidden();
  await expect(page).toHaveURL("/customers");
});
