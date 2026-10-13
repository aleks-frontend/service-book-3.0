import { expect, test } from "@playwright/test";
import { dataUrl, IMAGES, readDownload } from "./documents.js";
import { STAFF } from "./env.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

test("a staff member prints a service's intake receipt, in the UI language, with a QR code of its public link", async ({
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
  const company = {
    name: "Servis Lisztrapszódia",
    address: "Glavna 1, Subotica",
    phone: "024 123 456",
    email: "servis@example.com",
    taxId: "101234567",
    logo: await dataUrl(`${IMAGES}/logo.png`, "image/png"),
    signature: await dataUrl(`${IMAGES}/signature.jpg`, "image/jpeg"),
  };
  await send("put", "/api/settings", company);
  const customer = await send("post", "/api/customers", {
    name: "Đorđe Živković",
    phone: "0657",
    email: "djordje@example.com",
    address: "Solunska 11/D",
  });
  const device = await send("post", "/api/devices", {
    manufacturer: "Lenovo",
    model: "ThinkPad T14",
    serialNumber: "PF-3K2L9",
    ownerId: customer.id,
  });
  const action = await send("post", "/api/actions", { name: "Čišćenje ventilatora", price: 2500 });
  const service = await send("post", "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    description: "Pregreva se i gasi posle pola sata",
    date: "2026-03-07",
  });
  // Lines and prices belong on the service report, not on the receipt.
  await send("post", `/api/services/${service.id}/lines`, {
    type: "WORK",
    actionId: action.id,
    quantity: 2,
  });

  await page.goto(`/services?service=${service.id}`);
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: `Servis ${service.number}` })
    .getByRole("button", { name: "Štampa" })
    .click();
  await page.getByRole("menuitem", { name: "Prijemnica" }).click();
  expect((await download).suggestedFilename()).toBe(`prijemnica-${service.number}.pdf`);
  const receipt = await readDownload(await download);

  for (const text of [
    // The company header from Settings.
    "Servis Lisztrapszódia",
    "Glavna 1, Subotica",
    "024 123 456 · servis@example.com",
    "PIB 101234567",
    // The service, the customer and what they left.
    `Prijemnica ${service.number}`,
    "7. mart 2026.",
    // Section headings are set in capitals.
    "PODACI O MUŠTERIJI",
    "Ime Đorđe Živković",
    "E-mail djordje@example.com",
    "Telefon 0657",
    "Adresa Solunska 11/D",
    "UREĐAJI NA SERVISU",
    "Lenovo ThinkPad T14",
    "SN: PF-3K2L9",
    "OPIS KVARA",
    "Pregreva se i gasi posle pola sata",
    // Signed by the staff member who printed it and by the customer.
    STAFF.name,
  ]) {
    expect(receipt.text).toContain(text);
  }
  expect(receipt.text).not.toContain("Čišćenje ventilatora");
  expect(receipt.text).not.toContain("RSD");
  // The logo, the shop's signature and the QR code, which points to the public page on this host.
  expect(receipt.imageCount).toBe(3);
  expect(receipt.qrCodes).toEqual([`${baseURL}/s/${service.publicToken}`]);

  // Without a signature image, the staff member signs by hand above their name.
  await send("put", "/api/settings", { ...company, signature: null });
  // Another UI language prints a translated receipt.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "English" }).click();
  await page.goto(`/services?service=${service.id}`);
  const englishDownload = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: `Service ${service.number}` })
    .getByRole("button", { name: "Print" })
    .click();
  await page.getByRole("menuitem", { name: "Intake receipt" }).click();
  expect((await englishDownload).suggestedFilename()).toBe(`intake-receipt-${service.number}.pdf`);
  const englishReceipt = await readDownload(await englishDownload);
  for (const text of [
    `Intake receipt ${service.number}`,
    "7 March 2026",
    "CUSTOMER DETAILS",
    "Name Đorđe Živković",
    "DEVICES ON SERVICE",
    "S/N PF-3K2L9",
    "FAULT DESCRIPTION",
    "Tax ID 101234567",
    STAFF.name,
  ]) {
    expect(englishReceipt.text).toContain(text);
  }
  expect(englishReceipt.text).not.toContain("Prijemnica");
  expect(englishReceipt.imageCount).toBe(2);
  expect(englishReceipt.qrCodes).toEqual([`${baseURL}/s/${service.publicToken}`]);
});
