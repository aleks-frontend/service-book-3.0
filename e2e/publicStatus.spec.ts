import { expect, test } from "@playwright/test";
import { readDownload } from "./documents.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

test("the customer scans the QR on their intake receipt and sees the service's status and lines without logging in", async ({
  page,
  browser,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  const send = async (method: "post" | "put", path: string, data: object) => {
    const response = await page.request[method](path, { data });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const customer = await send("post", "/api/customers", { name: "Ivana Ilić", phone: "0631112" });
  const device = await send("post", "/api/devices", {
    manufacturer: "Apple",
    model: "iPhone 13",
    serialNumber: "F2LXK0QZ",
    ownerId: customer.id,
  });
  const glass = await send("post", "/api/devices", { model: "Zaštitno staklo" });
  const action = await send("post", "/api/actions", { name: "Zamena baterije", price: 4500 });
  const service = await send("post", "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    description: "Baterija se brzo prazni",
    date: "2026-04-02",
  });
  const lines = `/api/services/${service.id}/lines`;
  await send("post", lines, { type: "WORK", actionId: action.id, quantity: 1 });
  await send("post", lines, { type: "SALE", deviceId: glass.id, quantity: 2, unitPrice: 700 });
  await send("post", `/api/services/${service.id}/log`, { text: "Interna beleška o kućištu" });
  await send("put", `/api/services/${service.id}/status`, { status: "COMPLETED" });
  await send("put", `/api/services/${service.id}/customer-report`, {
    customerReport: "Zamenjena baterija, postavljeno zaštitno staklo.",
  });

  // The QR code printed on the intake receipt is the link the customer scans.
  await page.goto(`/services?service=${service.id}`);
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog", { name: `Servis ${service.number}` })
    .getByRole("button", { name: "Štampa" })
    .click();
  await page.getByRole("menuitem", { name: "Prijemnica" }).click();
  const [publicLink] = (await readDownload(await download)).qrCodes;

  // A fresh browser with no session, as on the customer's phone.
  const customerContext = await browser.newContext();
  const phone = await customerContext.newPage();
  await phone.goto(publicLink);

  await expect(phone).toHaveURL(`/s/${service.publicToken}`);
  await expect(phone.getByRole("heading", { name: `Servis ${service.number}` })).toBeVisible();
  await expect(phone.getByText("2. april 2026.")).toBeVisible();
  await expect(phone.getByText("Završen", { exact: true })).toBeVisible();
  await expect(phone.getByText("Apple iPhone 13")).toBeVisible();
  await expect(phone.getByText("SN: F2LXK0QZ")).toBeVisible();
  const workAndSales = phone.getByRole("table", { name: "Rad i prodaja" });
  await expect(workAndSales.getByRole("row")).toHaveText([
    /Opis\s*Količina\s*Jedinična cena \(RSD\)\s*Ukupno po stavci \(RSD\)/,
    /Zamena baterije\s*1\s*4\.500\s*4\.500/,
    /Zaštitno staklo\s*2\s*700\s*1\.400/,
    /Ukupno\s*5\.900 RSD/,
  ]);
  await expect(phone.getByText("Zamenjena baterija, postavljeno zaštitno staklo.")).toBeVisible();

  // Nothing internal, and nothing about the customer.
  const pageText = await phone.locator("body").innerText();
  for (const hidden of ["Ivana Ilić", "0631112", "Baterija se brzo prazni", "Interna beleška"]) {
    expect(pageText).not.toContain(hidden);
  }

  // The visitor picks their language, as on the login page.
  await phone.getByRole("button", { name: "English" }).click();
  await expect(phone.getByRole("heading", { name: `Service ${service.number}` })).toBeVisible();
  await expect(phone.getByText("Completed", { exact: true })).toBeVisible();
  await expect(phone.getByRole("table", { name: "Work and sales" })).toContainText(
    /Total\s*5,900 RSD/,
  );

  // A deleted service's link reads the same as one that never existed.
  await page.request.delete(`/api/services/${service.id}`);
  await phone.reload();
  await expect(phone.getByRole("heading", { name: "Service not found" })).toBeVisible();
  await phone.goto("/s/doesNotExist");
  await expect(phone.getByRole("heading", { name: "Service not found" })).toBeVisible();
  await expect(phone).toHaveURL("/s/doesNotExist");

  await customerContext.close();
});

test("staff open and copy a service's public link from its drawer", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await logIn(page);
  await expect(page).toHaveURL("/services");

  const send = async (path: string, data: object) => {
    const response = await page.request.post(path, { data });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const customer = await send("/api/customers", { name: "Petar Perić", phone: "0634445" });
  const device = await send("/api/devices", { model: "Punjač" });
  const service = await send("/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: "2026-04-02",
  });
  const publicLink = new URL(`/s/${service.publicToken}`, page.url()).href;

  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  const link = drawer.getByRole("link", { name: publicLink });
  await expect(link).toHaveAttribute("href", publicLink);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");

  await drawer.getByRole("button", { name: "Kopiraj javni link" }).click();
  await expect(page.getByText("Javni link je kopiran")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(publicLink);

  const publicPage = context.waitForEvent("page");
  await link.click();
  const opened = await publicPage;
  await expect(opened).toHaveURL(`/s/${service.publicToken}`);
  await expect(opened.getByRole("heading", { name: `Servis ${service.number}` })).toBeVisible();
});
