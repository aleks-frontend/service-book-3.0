import { expect, test, type Page } from "@playwright/test";
import { today } from "./dates.js";
import { dataUrl, IMAGES, readDownload } from "./documents.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

/** Calls the API as the logged-in staff member and returns the parsed response. */
async function send(page: Page, method: "post" | "put", path: string, data: object) {
  const response = await page.request[method](path, { data });
  expect(response.ok()).toBe(true);
  return response.json();
}

/** Registers a service, dated today, for a new customer's new device. */
async function createService(page: Page, customerName: string, model: string) {
  const customer = await send(page, "post", "/api/customers", {
    name: customerName,
    phone: "0601",
  });
  const device = await send(page, "post", "/api/devices", { model, ownerId: customer.id });
  return send(page, "post", "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: today(),
  });
}

test("a staff member writes the customer report and prints the service report, in the UI language, with a QR code of its public link", async ({
  page,
  baseURL,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  await send(page, "put", "/api/settings", {
    name: "Servis Lisztrapszódia",
    address: "Glavna 1, Subotica",
    phone: "024 123 456",
    email: "servis@example.com",
    taxId: "101234567",
    logo: await dataUrl(`${IMAGES}/logo.png`, "image/png"),
    signature: await dataUrl(`${IMAGES}/signature.jpg`, "image/jpeg"),
  });
  const customer = await send(page, "post", "/api/customers", {
    name: "Đorđe Živković",
    phone: "0657",
  });
  const device = await send(page, "post", "/api/devices", {
    manufacturer: "Lenovo",
    model: "ThinkPad T14",
    serialNumber: "PF-3K2L9",
    ownerId: customer.id,
  });
  const charger = await send(page, "post", "/api/devices", { model: "USB-C punjač 65W" });
  const action = await send(page, "post", "/api/actions", {
    name: "Čišćenje ventilatora",
    price: 2500,
  });
  const service = await send(page, "post", "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: "2026-03-07",
  });
  const lines = `/api/services/${service.id}/lines`;
  await send(page, "post", lines, { type: "WORK", actionId: action.id, quantity: 2 });
  await send(page, "post", lines, {
    type: "SALE",
    deviceId: charger.id,
    quantity: 1,
    unitPrice: 3200,
  });

  // The customer report is written in its tab and kept across a reload.
  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await drawer.getByRole("tab", { name: "Izveštaj za mušteriju" }).click();
  const report = drawer.getByRole("textbox", { name: "Izveštaj za mušteriju" });
  await report.fill("Očišćen ventilator i zamenjena termalna pasta.\nUz laptop je prodat punjač.");
  await drawer.getByRole("button", { name: "Sačuvaj izmene" }).click();
  await expect(page.getByText("Izveštaj za mušteriju je sačuvan")).toBeVisible();

  await page.reload();
  await drawer.getByRole("tab", { name: "Izveštaj za mušteriju" }).click();
  await expect(report).toHaveValue(
    "Očišćen ventilator i zamenjena termalna pasta.\nUz laptop je prodat punjač.",
  );

  const download = page.waitForEvent("download");
  await drawer.getByRole("button", { name: "Štampa" }).click();
  await page.getByRole("menuitem", { name: "Izveštaj o servisu" }).click();
  expect((await download).suggestedFilename()).toBe(`izvestaj-o-servisu-${service.number}.pdf`);
  const pdf = await readDownload(await download);

  for (const text of [
    // The company header from Settings.
    "Servis Lisztrapszódia",
    "Glavna 1, Subotica",
    "024 123 456 · servis@example.com",
    "PIB 101234567",
    // The service, its customer and devices, under their section headings.
    `Izveštaj o servisu ${service.number}`,
    "7. mart 2026.",
    "Podaci o mušteriji",
    "Ime Đorđe Živković",
    "Telefon 0657",
    "Uređaji na servisu",
    "Lenovo ThinkPad T14",
    "SN: PF-3K2L9",
    // Both lines, with quantity, unit price and line total, and the grand total in RSD.
    "Rad i prodaja",
    "Opis Količina Jedinična cena (RSD) Ukupno po stavci (RSD)",
    "Čišćenje ventilatora 2 2.500 5.000",
    "USB-C punjač 65W 1 3.200 3.200",
    "Ukupno 8.200 RSD",
    // The customer report, signed for the company.
    "Izveštaj za mušteriju",
    "Očišćen ventilator i zamenjena termalna pasta.",
    "Uz laptop je prodat punjač.",
  ]) {
    expect(pdf.text).toContain(text);
  }
  // The logo, the signature and the QR code, which points to the public page on this host.
  expect(pdf.imageCount).toBe(3);
  expect(pdf.qrCodes).toEqual([`${baseURL}/s/${service.publicToken}`]);

  // Another UI language prints a translated report.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "English" }).click();
  await page.goto(`/services?service=${service.id}`);
  const englishDownload = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: `Service ${service.number}` })
    .getByRole("button", { name: "Print" })
    .click();
  await page.getByRole("menuitem", { name: "Service report" }).click();
  expect((await englishDownload).suggestedFilename()).toBe(`service-report-${service.number}.pdf`);
  const english = await readDownload(await englishDownload);
  for (const text of [
    `Service report ${service.number}`,
    "7 March 2026",
    "Customer details",
    "Name Đorđe Živković",
    "S/N PF-3K2L9",
    "Work and sales",
    "Description Quantity Unit price (RSD) Line total (RSD)",
    "Čišćenje ventilatora 2 2,500 5,000",
    "Total 8,200 RSD",
    "Customer report",
    "Očišćen ventilator i zamenjena termalna pasta.",
    "Tax ID 101234567",
  ]) {
    expect(english.text).toContain(text);
  }
  expect(english.text).not.toContain("Izveštaj o servisu");
  expect(english.qrCodes).toEqual([`${baseURL}/s/${service.publicToken}`]);
});

test("completing a service from the list offers its service report", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Jelena Ilić", "Pixel 7");
  await page.reload();

  // The list opens in cards; choosing Completed on one saves it, then offers the report.
  const card = page.getByRole("listitem").filter({ hasText: service.number });
  await card.getByRole("button", { name: /Promeni status/ }).click();
  await page.getByRole("menuitemradio", { name: "Završen" }).click();

  const prompt = page.getByRole("dialog", { name: "Odštampati izveštaj o servisu?" });
  const download = page.waitForEvent("download");
  await prompt.getByRole("button", { name: "Generiši" }).click();
  await expect(prompt).toBeHidden();
  await expect(card.getByRole("button", { name: /Promeni status/ })).toHaveText("Završen");
  expect((await download).suggestedFilename()).toBe(`izvestaj-o-servisu-${service.number}.pdf`);
  const pdf = await readDownload(await download);
  expect(pdf.text).toContain(`Izveštaj o servisu ${service.number}`);
  expect(pdf.text).toContain("Ime Jelena Ilić");
  // The prompt sits over the list; the service did not open.
  await expect(page).toHaveURL("/services");
});

test("completing a service in a list filtered to another status still offers its report", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Nikola Tesić", "Moto G54");
  await page.reload();

  await page.getByRole("combobox", { name: "Filtriraj po statusu" }).click();
  await page.getByRole("option", { name: "Primljen" }).click();
  const card = page.getByRole("listitem").filter({ hasText: service.number });
  await card.getByRole("button", { name: /Promeni status/ }).click();
  await page.getByRole("menuitemradio", { name: "Završen" }).click();

  // The completed service leaves the filtered list, but the offer stays.
  const prompt = page.getByRole("dialog", { name: "Odštampati izveštaj o servisu?" });
  await expect(prompt).toContainText(`Servis ${service.number} je završen.`);
  await expect(card).toHaveCount(0);
  await expect(prompt).toBeVisible();
  const download = page.waitForEvent("download");
  await prompt.getByRole("button", { name: "Generiši" }).click();
  await expect(prompt).toBeHidden();
  expect((await download).suggestedFilename()).toBe(`izvestaj-o-servisu-${service.number}.pdf`);
  const pdf = await readDownload(await download);
  expect(pdf.text).toContain("Ime Nikola Tesić");
});

test("delivering a completed service offers no report", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Vesna Marić", "iPad Air");
  await send(page, "put", `/api/services/${service.id}/status`, { status: "COMPLETED" });
  await page.reload();

  let downloaded = false;
  page.on("download", () => (downloaded = true));
  const card = page.getByRole("listitem").filter({ hasText: service.number });
  const saved = page.waitForResponse((response) =>
    response.url().endsWith(`/api/services/${service.id}/status`),
  );
  // The list refetches before the change's own success handler runs.
  const refetched = page.waitForResponse(
    (response) => /\/api\/services\?/.test(response.url()) && response.request().method() === "GET",
  );
  await card.getByRole("button", { name: /Promeni status/ }).click();
  await page.getByRole("menuitemradio", { name: "Isporučen" }).click();
  expect((await saved).ok()).toBe(true);
  await refetched;

  await expect(card.getByRole("button", { name: /Promeni status/ })).toHaveText("Isporučen");
  await expect(page.getByRole("dialog", { name: "Odštampati izveštaj o servisu?" })).toBeHidden();
  expect(downloaded).toBe(false);
});
