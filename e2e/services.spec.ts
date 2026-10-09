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
  const details = drawer.getByRole("region", { name: "Detalji servisa" });
  await expect(details).toContainText("Petar Petrović");
  await expect(details).toContainText("Apple iPhone 13");
  await expect(details).toContainText("Ne puni bateriju");

  // The details are changed in the edit modal, and the drawer shows the change.
  await drawer.getByRole("button", { name: "Izmena servisa" }).click();
  const editDialog = page.getByRole("dialog", { name: "Izmena servisa" });
  await expect(editDialog.getByLabel("Opis")).toHaveValue("Ne puni bateriju");
  await editDialog.getByLabel("Opis").fill("Ne puni bateriju, pukao ekran");
  await editDialog.getByRole("button", { name: "Sačuvaj izmene" }).click();
  await expect(editDialog).toBeHidden();
  await expect(details).toContainText("Ne puni bateriju, pukao ekran");

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

test("a work line starts at the action's price, and the total follows quantity and price as they are typed", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  const post = async (path: string, data: object) =>
    (await page.request.post(path, { data })).json();
  const customer = await post("/api/customers", { name: "Milan Milić", phone: "0634" });
  const device = await post("/api/devices", { model: "Pixel 7", ownerId: customer.id });
  await post("/api/actions", { name: "Zamena ekrana", price: 4500 });
  const service = await post("/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: today(),
  });

  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  const total = drawer.getByTestId("service-total");
  await expect(total).toHaveText("0 RSD");

  // Picking the action fills in its price.
  await drawer.getByRole("button", { name: "Dodaj stavku" }).click();
  const addDialog = page.getByRole("dialog", { name: "Dodavanje stavke" });
  await addDialog.getByLabel("Usluga").fill("ekran");
  await page.getByRole("option", { name: /Zamena ekrana/ }).click();
  await expect(addDialog.getByLabel("Jedinična cena (RSD)")).toHaveValue("4500");
  await addDialog.getByLabel("Količina").fill("2");
  await addDialog.getByRole("button", { name: "Dodaj stavku" }).click();
  await expect(addDialog).toBeHidden();

  const line = drawer.getByTestId("service-line");
  await expect(line).toContainText("Zamena ekrana");
  await expect(total).toHaveText("9.000 RSD");

  // The total changes with every keystroke, before anything is saved.
  await line.getByLabel("Količina").fill("3");
  await expect(total).toHaveText("13.500 RSD");
  await line.getByLabel("Jedinična cena (RSD)").fill("4000");
  await expect(total).toHaveText("12.000 RSD");

  // Leaving the field saves the line; the list shows the new total.
  const saved = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes("/lines/"),
  );
  await line.getByLabel("Jedinična cena (RSD)").press("Enter");
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(total).toHaveText("12.000 RSD");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row", { name: new RegExp(service.number) })).toContainText(
    "12.000 RSD",
  );
});

test("an action or device missing from the pickers is created from the add-line dialog and picked", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  const post = async (path: string, data: object) =>
    (await page.request.post(path, { data })).json();
  const customer = await post("/api/customers", { name: "Nada Nadić", phone: "0645" });
  const device = await post("/api/devices", { model: "Aspire 5", ownerId: customer.id });
  const service = await post("/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: today(),
  });

  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await drawer.getByRole("button", { name: "Dodaj stavku" }).click();
  const addDialog = page.getByRole("dialog", { name: "Dodavanje stavke" });

  // The search becomes the new action's name; only its price is left to type.
  await addDialog.getByLabel("Usluga").fill("Čišćenje tastature");
  await page.getByRole("option", { name: "Dodaj uslugu „Čišćenje tastature“" }).click();
  const actionDialog = page.getByRole("dialog", { name: "Nova usluga" });
  await expect(actionDialog.getByLabel("Naziv")).toHaveValue("Čišćenje tastature");
  await page.keyboard.type("1200");
  await actionDialog.getByRole("button", { name: "Dodaj uslugu" }).click();
  await expect(actionDialog).toBeHidden();
  await expect(addDialog).toContainText("Čišćenje tastature");
  await expect(addDialog.getByLabel("Jedinična cena (RSD)")).toHaveValue("1200");

  // Sale: a device is created from the picker's "New device" row.
  await addDialog.getByRole("button", { name: "Prodaja" }).click();
  await addDialog.getByLabel("Prodati uređaj").fill("Punjač");
  await page.getByRole("option", { name: "Novi uređaj" }).click();
  const deviceDialog = page.getByRole("dialog", { name: "Novi uređaj" });
  await deviceDialog.getByLabel("Model *").fill("USB-C punjač");
  await deviceDialog.getByRole("button", { name: "Dodaj uređaj" }).click();
  await expect(deviceDialog).toBeHidden();
  await expect(addDialog).toContainText("USB-C punjač");
  await addDialog.getByLabel("Jedinična cena (RSD)").fill("900");
  await addDialog.getByRole("button", { name: "Dodaj stavku" }).click();
  await expect(addDialog).toBeHidden();

  await expect(drawer.getByTestId("service-line")).toContainText("USB-C punjač");
  await expect(drawer.getByTestId("service-total")).toHaveText("900 RSD");
  // The action is in the price list for the next service.
  const actions = await (await page.request.get("/api/actions")).json();
  expect(actions).toContainEqual(
    expect.objectContaining({ name: "Čišćenje tastature", price: 1200 }),
  );
});
