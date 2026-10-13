import { readFile } from "node:fs/promises";
import { expect, test, type Download } from "@playwright/test";
import { logIn } from "./logIn.js";
import { readPdf } from "./pdf.js";

// The UI defaults to Serbian (sr).

const IMAGES = "apps/backend/test/fixtures/images";

async function dataUrl(path: string, type: string) {
  return `data:${type};base64,${(await readFile(path)).toString("base64")}`;
}

async function readDownload(download: Download) {
  return readPdf(new Uint8Array(await readFile((await download.path())!)));
}

test("a staff member prints a service's dispatch note, in the UI language, with a QR code of its public link", async ({
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

  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });

  const download = page.waitForEvent("download");
  await drawer.getByRole("button", { name: "Otpremnica" }).click();
  expect((await download).suggestedFilename()).toBe(`otpremnica-${service.number}.pdf`);
  const note = await readDownload(await download);

  // The company header from Settings.
  for (const text of [
    "Servis Lisztrapszódia",
    "Glavna 1, Subotica",
    "024 123 456",
    "servis@example.com",
    "PIB 101234567",
  ]) {
    expect(note.text).toContain(text);
  }
  // The service, its customer and devices.
  expect(note.text).toContain("Otpremnica");
  expect(note.text).toContain(service.number);
  expect(note.text).toContain("7. mart 2026.");
  expect(note.text).toContain("Đorđe Živković");
  expect(note.text).toContain("0657");
  expect(note.text).toContain("Lenovo ThinkPad T14");
  // Both lines, with quantity, unit price and line total, and the grand total in RSD.
  expect(note.text).toContain("Količina");
  expect(note.text).toContain("Čišćenje ventilatora 2 2.500 5.000");
  expect(note.text).toContain("USB-C punjač 65W 1 3.200 3.200");
  expect(note.text).toContain("Ukupno 8.200 RSD");
  expect(note.text).toContain("Potpis");
  // The logo, the signature and the QR code, which points to the public page on this host.
  expect(note.imageCount).toBe(3);
  expect(note.qrCodes).toEqual([`${baseURL}/s/${service.publicToken}`]);

  // Another UI language prints a translated note.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "English" }).click();
  await page.goto(`/services?service=${service.id}`);
  const englishDownload = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: `Service ${service.number}` })
    .getByRole("button", { name: "Dispatch note" })
    .click();
  expect((await englishDownload).suggestedFilename()).toBe(`dispatch-note-${service.number}.pdf`);
  const englishNote = await readDownload(await englishDownload);
  expect(englishNote.text).toContain("Dispatch note");
  expect(englishNote.text).toContain("7 March 2026");
  expect(englishNote.text).toContain("Quantity");
  expect(englishNote.text).toContain("Čišćenje ventilatora 2 2,500 5,000");
  expect(englishNote.text).toContain("Total 8,200 RSD");
  expect(englishNote.text).toContain("Tax ID 101234567");
  expect(englishNote.text).not.toContain("Otpremnica");
  expect(englishNote.qrCodes).toEqual([`${baseURL}/s/${service.publicToken}`]);
});
