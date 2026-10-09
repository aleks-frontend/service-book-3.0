import { expect, test } from "@playwright/test";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

/** Today in the browser's (and the test runner's) time zone, as `YYYY-MM-DD`. */
function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

test("a staff member registers a service for a new customer and opens it via ?service=", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Novi servis" });
  await expect(addDialog).toBeVisible();
  // The date starts as today.
  await expect(addDialog.getByLabel("Datum")).toHaveValue(today());

  // A new customer, created inline.
  await addDialog.getByRole("button", { name: "Nova mušterija" }).click();
  const customerDialog = page.getByRole("dialog", { name: "Nova mušterija" });
  await customerDialog.getByLabel("Ime").fill("Petar Petrović");
  await customerDialog.getByLabel("Telefon").fill("0601112233");
  await customerDialog.getByRole("button", { name: "Dodaj mušteriju" }).click();
  await expect(customerDialog).toBeHidden();
  await expect(addDialog.getByText("Petar Petrović")).toBeVisible();

  // A new device for them, created inline.
  await addDialog.getByRole("button", { name: "Novi uređaj" }).click();
  const deviceDialog = page.getByRole("dialog", { name: "Novi uređaj" });
  await deviceDialog.getByLabel("Proizvođač").fill("Apple");
  await deviceDialog.getByLabel("Model *").fill("iPhone 13");
  await deviceDialog.getByRole("button", { name: "Dodaj uređaj" }).click();
  await expect(deviceDialog).toBeHidden();
  await expect(addDialog.getByText("Apple iPhone 13")).toBeVisible();

  await addDialog.getByLabel("Opis").fill("Ne puni bateriju");
  await addDialog.getByRole("button", { name: "Dodaj servis" }).click();
  await expect(addDialog).toBeHidden();

  // The new service is at the top of the list.
  const firstRow = page.getByRole("row").nth(1);
  await expect(firstRow).toContainText("Petar Petrović");
  await expect(firstRow).toContainText("Apple iPhone 13");
  await expect(firstRow).toContainText("Primljen");
  const number = (await firstRow.getByRole("cell").first().textContent())!;
  expect(number).toMatch(new RegExp(`^${today().slice(0, 4)}-\\d{4}$`));

  // Opening it puts it in the URL.
  await firstRow.click();
  await expect(page).toHaveURL(/\/services\?service=[0-9a-f-]{36}$/);
  const drawer = page.getByRole("dialog", { name: `Servis ${number}` });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel("Opis")).toHaveValue("Ne puni bateriju");

  // A reload keeps it open, and the back button closes it.
  await page.reload();
  await expect(drawer).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/services");
  await expect(drawer).toBeHidden();

  // A deep link opens it too; closing it then stays on the Services page.
  await page.goForward();
  await expect(drawer).toBeVisible();
  const deepLink = page.url();
  await page.goto(deepLink);
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL("/services");
});

test("the table/cards toggle switches the list view and is remembered", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  // A service to show, created through the API with the page's session.
  const customer = await (
    await page.request.post("/api/customers", { data: { name: "Jovana Jović", phone: "0612" } })
  ).json();
  const device = await (
    await page.request.post("/api/devices", { data: { model: "ThinkPad", ownerId: customer.id } })
  ).json();
  const created = await page.request.post("/api/services", {
    data: { customerId: customer.id, deviceIds: [device.id], date: today() },
  });
  expect(created.status()).toBe(201);
  await page.reload();

  const tableButton = page.getByRole("button", { name: "Prikaz tabele" });
  const cardsButton = page.getByRole("button", { name: "Prikaz kartica" });
  await expect(tableButton).toHaveAttribute("aria-pressed", "true");

  await cardsButton.click();
  await expect(cardsButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table")).toBeHidden();
  await expect(page.getByRole("listitem").first()).toContainText("Jovana Jović");

  await page.reload();
  await expect(cardsButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table")).toBeHidden();

  await tableButton.click();
  await page.reload();
  await expect(tableButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table")).toBeVisible();
});
