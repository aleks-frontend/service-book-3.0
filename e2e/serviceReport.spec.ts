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

/** Opens the status menu of the service's card in the list and chooses a status. */
async function chooseStatus(page: Page, number: string, status: string) {
  const card = page.getByRole("listitem").filter({ hasText: number });
  await card.getByRole("button", { name: /Promeni status/ }).click();
  await page.getByRole("menuitemradio", { name: status }).click();
  return card;
}

/** Fails the test if the page downloads anything from here on. */
function noDownloads(page: Page) {
  let downloaded = false;
  page.on("download", () => (downloaded = true));
  return () => expect(downloaded).toBe(false);
}

test("completing a service asks for its customer report, then saves it and generates the service report", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Jelena Ilić", "Pixel 7");
  await send(page, "put", `/api/services/${service.id}/customer-report`, {
    customerReport: "Zamenjen ekran.",
  });
  await page.reload();

  // The list opens in cards; choosing Completed on one saves it, then asks for the report.
  const card = await chooseStatus(page, service.number, "Završen");
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  const report = dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" });
  await expect(report).toHaveValue("Zamenjen ekran.");
  await report.fill("Zamenjen ekran i baterija.");

  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Sačuvaj i generiši izveštaj" }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByRole("button", { name: /Promeni status/ })).toHaveText("Završen");
  expect((await download).suggestedFilename()).toBe(`izvestaj-o-servisu-${service.number}.pdf`);
  const pdf = await readDownload(await download);
  expect(pdf.text).toContain(`Izveštaj o servisu ${service.number}`);
  expect(pdf.text).toContain("Ime Jelena Ilić");
  expect(pdf.text).toContain("Zamenjen ekran i baterija.");
  // The dialog sat over the list; the service did not open.
  await expect(page).toHaveURL("/services");

  // The edit is saved: the customer report tab shows it.
  await card.click();
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await drawer.getByRole("tab", { name: "Izveštaj za mušteriju" }).click();
  await expect(drawer.getByRole("textbox", { name: "Izveštaj za mušteriju" })).toHaveValue(
    "Zamenjen ekran i baterija.",
  );
});

test("“Save only” saves the customer report and generates nothing", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Milan Perić", "Galaxy S21");
  await page.goto(`/services?service=${service.id}`);
  const assertNoDownloads = noDownloads(page);

  // Completing from the drawer asks too; with nothing saved yet, the report starts empty.
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await drawer.getByRole("button", { name: /Promeni status/ }).click();
  await page.getByRole("menuitemradio", { name: "Završen" }).click();
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  const report = dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" });
  await expect(report).toHaveValue("");
  await report.fill("Očišćen port za punjenje.");
  await dialog.getByRole("button", { name: "Samo sačuvaj" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Izveštaj za mušteriju je sačuvan")).toBeVisible();

  await drawer.getByRole("tab", { name: "Izveštaj za mušteriju" }).click();
  await expect(drawer.getByRole("textbox", { name: "Izveštaj za mušteriju" })).toHaveValue(
    "Očišćen port za punjenje.",
  );
  assertNoDownloads();
});

test("skipping the completion dialog saves nothing, generates nothing and keeps the service completed", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Ivana Kostić", "iPhone 12");
  await send(page, "put", `/api/services/${service.id}/customer-report`, {
    customerReport: "Zamenjena baterija.",
  });
  await page.reload();
  const assertNoDownloads = noDownloads(page);

  const card = await chooseStatus(page, service.number, "Završen");
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  await dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" }).fill("Ne čuva se.");
  await dialog.getByRole("button", { name: "Preskoči" }).click();
  await expect(dialog).toBeHidden();

  // Escape skips too.
  await chooseStatus(page, service.number, "U radu");
  await expect(card.getByRole("button", { name: /Promeni status/ })).toHaveText("U radu");
  await chooseStatus(page, service.number, "Završen");
  await expect(dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" })).toHaveValue(
    "Zamenjena baterija.",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(card.getByRole("button", { name: /Promeni status/ })).toHaveText("Završen");
  const saved = await (await page.request.get(`/api/services/${service.id}`)).json();
  expect(saved.status).toBe("COMPLETED");
  expect(saved.customerReport).toBe("Zamenjena baterija.");
  assertNoDownloads();
});

/** The completion dialog's warning that the service report would carry no customer report. */
const EMPTY_REPORT_WARNING = "Izveštaj o servisu će biti bez izveštaja za mušteriju.";

test("an empty customer report warns before generating the service report", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Zoran Babić", "Redmi Note 12");
  const other = await createService(page, "Sanja Đurić", "Nokia G21");
  await page.reload();

  // A whitespace-only report counts as empty: the first click only warns.
  let downloads = 0;
  page.on("download", () => downloads++);
  await chooseStatus(page, service.number, "Završen");
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  const generate = dialog.getByRole("button", { name: "Sačuvaj i generiši izveštaj" });
  const warning = dialog.getByText(EMPTY_REPORT_WARNING);
  await dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" }).fill("   ");
  await expect(warning).toBeHidden();
  await generate.click();
  await expect(warning).toBeVisible();
  await expect(dialog).toBeVisible();

  // The second click generates it anyway, and only it downloads.
  const download = page.waitForEvent("download");
  await generate.click();
  await expect(dialog).toBeHidden();
  expect((await download).suggestedFilename()).toBe(`izvestaj-o-servisu-${service.number}.pdf`);
  expect(downloads).toBe(1);

  // Typing a report once warned clears the warning and generates in one click.
  await chooseStatus(page, other.number, "Završen");
  const otherDialog = page.getByRole("dialog", { name: `Servis ${other.number} je završen` });
  const otherGenerate = otherDialog.getByRole("button", { name: "Sačuvaj i generiši izveštaj" });
  const otherWarning = otherDialog.getByText(EMPTY_REPORT_WARNING);
  await otherGenerate.click();
  await expect(otherWarning).toBeVisible();
  await otherDialog
    .getByRole("textbox", { name: "Izveštaj za mušteriju" })
    .fill("Zamenjen displej.");
  await expect(otherWarning).toBeHidden();
  const otherDownload = page.waitForEvent("download");
  await otherGenerate.click();
  await expect(otherDialog).toBeHidden();
  const pdf = await readDownload(await otherDownload);
  expect(pdf.text).toContain("Zamenjen displej.");
});

test("“Save only” and “Skip” close the dialog with an empty customer report, warned or not", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Petar Vasić", "Honor 90");
  await page.reload();
  const assertNoDownloads = noDownloads(page);
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  const warning = dialog.getByText(EMPTY_REPORT_WARNING);

  /** Completes the service again, so the dialog opens afresh. */
  async function complete() {
    await chooseStatus(page, service.number, "U radu");
    await chooseStatus(page, service.number, "Završen");
    await expect(dialog).toBeVisible();
  }

  // Unwarned, each closes on the first click.
  await chooseStatus(page, service.number, "Završen");
  await dialog.getByRole("button", { name: "Samo sačuvaj" }).click();
  await expect(dialog).toBeHidden();
  await complete();
  await dialog.getByRole("button", { name: "Preskoči" }).click();
  await expect(dialog).toBeHidden();

  // Once warned, neither generates.
  for (const button of ["Samo sačuvaj", "Preskoči"]) {
    await complete();
    await dialog.getByRole("button", { name: "Sačuvaj i generiši izveštaj" }).click();
    await expect(warning).toBeVisible();
    await dialog.getByRole("button", { name: button }).click();
    await expect(dialog).toBeHidden();
  }
  assertNoDownloads();
});

test("a customer report that fails to save keeps the dialog open and generates nothing", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Dragan Lukić", "Xperia 10");
  await page.reload();
  const assertNoDownloads = noDownloads(page);
  await page.route(`**/api/services/${service.id}/customer-report`, (route) =>
    route.fulfill({ status: 500 }),
  );

  await chooseStatus(page, service.number, "Završen");
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  const report = dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" });
  await report.fill("Zamenjen zvučnik.");
  // Ctrl+Enter in the textarea is the primary action.
  await report.press("Control+Enter");

  await expect(
    page.getByText("Čuvanje izveštaja za mušteriju nije uspelo. Pokušajte ponovo."),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(report).toHaveValue("Zamenjen zvučnik.");
  await expect(dialog.getByRole("button", { name: "Sačuvaj i generiši izveštaj" })).toBeEnabled();
  assertNoDownloads();
});

test("completing a service in a list filtered to another status still asks for its report", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Nikola Tesić", "Moto G54");
  await page.reload();

  await page.getByRole("combobox", { name: "Filtriraj po statusu" }).click();
  await page.getByRole("option", { name: "Primljen" }).click();
  const card = await chooseStatus(page, service.number, "Završen");

  // The completed service leaves the filtered list, but the dialog stays.
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  await expect(dialog).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" }).fill("Zamenjen konektor.");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Sačuvaj i generiši izveštaj" }).click();
  await expect(dialog).toBeHidden();
  expect((await download).suggestedFilename()).toBe(`izvestaj-o-servisu-${service.number}.pdf`);
  const pdf = await readDownload(await download);
  expect(pdf.text).toContain("Ime Nikola Tesić");
  expect(pdf.text).toContain("Zamenjen konektor.");
});

test("delivering a completed service asks for no report", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Vesna Marić", "iPad Air");
  await send(page, "put", `/api/services/${service.id}/status`, { status: "COMPLETED" });
  await page.reload();

  const assertNoDownloads = noDownloads(page);
  const saved = page.waitForResponse((response) =>
    response.url().endsWith(`/api/services/${service.id}/status`),
  );
  // The list refetches before the change's own success handler runs.
  const refetched = page.waitForResponse(
    (response) => /\/api\/services\?/.test(response.url()) && response.request().method() === "GET",
  );
  const card = await chooseStatus(page, service.number, "Isporučen");
  expect((await saved).ok()).toBe(true);
  await refetched;

  await expect(card.getByRole("button", { name: /Promeni status/ })).toHaveText("Isporučen");
  await expect(
    page.getByRole("dialog", { name: `Servis ${service.number} je završen` }),
  ).toBeHidden();
  assertNoDownloads();
});

test("the completion dialog lists the service's staff notes for reference, never in the report", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Dragan Simić", "Moto G84");
  await send(page, "put", `/api/services/${service.id}/status`, { status: "IN_PROGRESS" });
  await send(page, "post", `/api/services/${service.id}/log`, { text: "Naručen novi ekran." });
  await send(page, "post", `/api/services/${service.id}/log`, {
    text: "Ekran zamenjen, testirano.",
  });
  await page.reload();

  await chooseStatus(page, service.number, "Završen");
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  const report = dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" });
  await expect(report).toHaveValue("");

  // Collapsed at first, so the notes don't crowd out the report.
  const toggle = dialog.getByRole("button", { name: "Beleške iz dnevnika rada" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByText("Naručen novi ekran.")).toBeHidden();

  // Expanded: the staff notes, oldest first, with author and time; the two status
  // changes are left out.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const notes = dialog.getByTestId("staff-note");
  await expect(notes).toHaveCount(2);
  await expect(notes.nth(0)).toContainText("Naručen novi ekran.");
  await expect(notes.nth(1)).toContainText("Ekran zamenjen, testirano.");
  await expect(notes.nth(0)).toContainText("E2E Staff");
  await expect(notes.nth(0).locator("time")).toBeVisible();
  // Read-only, and never copied into the report.
  await expect(dialog.getByRole("textbox")).toHaveCount(1);
  await expect(report).toHaveValue("");
});

test("the completion dialog shows when a service has no staff notes", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await createService(page, "Ana Kovač", "Redmi Note 12");
  await page.reload();

  await chooseStatus(page, service.number, "Završen");
  const dialog = page.getByRole("dialog", { name: `Servis ${service.number} je završen` });
  await dialog.getByRole("button", { name: "Beleške iz dnevnika rada" }).click();
  await expect(dialog.getByText("U dnevniku rada još nema beleški.")).toBeVisible();
  await expect(dialog.getByTestId("staff-note")).toHaveCount(0);
});
