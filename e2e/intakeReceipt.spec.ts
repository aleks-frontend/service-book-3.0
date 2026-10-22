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
    "Podaci o mušteriji",
    "Ime Đorđe Živković",
    "E-mail djordje@example.com",
    "Telefon 0657",
    "Adresa Solunska 11/D",
    "Uređaji na servisu",
    "Lenovo ThinkPad T14",
    "SN: PF-3K2L9",
    "Opis kvara",
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
    "Customer details",
    "Name Đorđe Živković",
    "Devices on service",
    "S/N PF-3K2L9",
    "Fault description",
    "Tax ID 101234567",
    STAFF.name,
  ]) {
    expect(englishReceipt.text).toContain(text);
  }
  expect(englishReceipt.text).not.toContain("Prijemnica");
  expect(englishReceipt.imageCount).toBe(2);
  expect(englishReceipt.qrCodes).toEqual([`${baseURL}/s/${service.publicToken}`]);
});

test("creating a service offers its intake receipt", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const response = await page.request.post("/api/customers", {
    data: { name: "Milica Jovanović", phone: "0641234567" },
  });
  expect(response.ok()).toBe(true);
  const customer = await response.json();
  const device = await page.request.post("/api/devices", {
    data: { manufacturer: "Samsung", model: "Galaxy S21", ownerId: customer.id },
  });
  expect(device.ok()).toBe(true);

  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Novi servis" });
  await addDialog.getByLabel("Mušterija *").fill("Milica Jovanović");
  await page.getByRole("option", { name: /^Milica Jovanović/ }).click();
  await addDialog.getByLabel("Uređaji *").fill("Galaxy S21");
  await page.getByRole("option", { name: /^Samsung Galaxy S21/ }).click();
  await addDialog.getByLabel("Opis").fill("Ne pali se");
  await addDialog.getByRole("button", { name: "Dodaj servis" }).click();
  await expect(addDialog).toBeHidden();

  const prompt = page.getByRole("dialog", { name: "Odštampati prijemnicu?" });
  const download = page.waitForEvent("download");
  await prompt.getByRole("button", { name: "Preuzmi" }).click();
  await expect(prompt).toBeHidden();
  expect((await download).suggestedFilename()).toMatch(/^prijemnica-\d{4}-\d{4}\.pdf$/);
  const receipt = await readDownload(await download);
  expect(receipt.text).toContain("Ime Milica Jovanović");
  expect(receipt.text).toContain("Ne pali se");
});
