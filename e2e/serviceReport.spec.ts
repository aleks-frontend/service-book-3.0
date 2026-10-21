import { expect, test } from "@playwright/test";
import { dataUrl, IMAGES, readDownload } from "./documents.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

test("a staff member writes the customer report and prints the service report, in the UI language, with a QR code of its public link", async ({
  page,
  baseURL,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  const send = async (method: "post" | "put", path: string, data: object) => {
    const response = await page.request[method](path, { data });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await send("put", "/api/settings", {
    name: "Servis Lisztrapszódia",
    address: "Glavna 1, Subotica",
    phone: "024 123 456",
    email: "servis@example.com",
    taxId: "101234567",
    logo: await dataUrl(`${IMAGES}/logo.png`, "image/png"),
    signature: await dataUrl(`${IMAGES}/signature.jpg`, "image/jpeg"),
  });
  const customer = await send("post", "/api/customers", { name: "Đorđe Živković", phone: "0657" });
  const device = await send("post", "/api/devices", {
    manufacturer: "Lenovo",
    model: "ThinkPad T14",
    serialNumber: "PF-3K2L9",
    ownerId: customer.id,
  });
  const charger = await send("post", "/api/devices", { model: "USB-C punjač 65W" });
  const action = await send("post", "/api/actions", { name: "Čišćenje ventilatora", price: 2500 });
  const service = await send("post", "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: "2026-03-07",
  });
  const lines = `/api/services/${service.id}/lines`;
  await send("post", lines, { type: "WORK", actionId: action.id, quantity: 2 });
  await send("post", lines, { type: "SALE", deviceId: charger.id, quantity: 1, unitPrice: 3200 });

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
    // The service, its customer and devices; section headings are set in capitals.
    `Izveštaj o servisu ${service.number}`,
    "7. mart 2026.",
    "PODACI O MUŠTERIJI",
    "Ime Đorđe Živković",
    "Telefon 0657",
    "UREĐAJI NA SERVISU",
    "Lenovo ThinkPad T14",
    "SN: PF-3K2L9",
    // Both lines, with quantity, unit price and line total, and the grand total in RSD.
    "RAD I PRODAJA",
    "Opis Količina Jedinična cena (RSD) Ukupno po stavci (RSD)",
    "Čišćenje ventilatora 2 2.500 5.000",
    "USB-C punjač 65W 1 3.200 3.200",
    "Ukupno 8.200 RSD",
    // The customer report, signed for the company.
    "IZVEŠTAJ ZA MUŠTERIJU",
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
    "CUSTOMER DETAILS",
    "Name Đorđe Živković",
    "S/N PF-3K2L9",
    "WORK AND SALES",
    "Description Quantity Unit price (RSD) Line total (RSD)",
    "Čišćenje ventilatora 2 2,500 5,000",
    "Total 8,200 RSD",
    "CUSTOMER REPORT",
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
  const send = async (path: string, data: object) => {
    const response = await page.request.post(path, { data });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const customer = await send("/api/customers", { name: "Jelena Ilić", phone: "0601" });
  const device = await send("/api/devices", { model: "Pixel 7", ownerId: customer.id });
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const service = await send("/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  });
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
