import { expect, test, type Page } from "@playwright/test";
import { today } from "./dates.js";
import { readDownload } from "./documents.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr). The backend runs the fake polisher (AI_POLISH_FAKE),
// which appends " (polished)" to the text it is sent, unless the text holds a marker:
// "[unchanged]", "[unavailable]", "[daily limit]" or "[slow]" (polished after 2s).

async function send(page: Page, path: string, data: object) {
  const response = await page.request.post(path, { data });
  expect(response.ok()).toBe(true);
  return response.json();
}

/** Registers a service, dated today, for a new customer's new device. */
async function registerService(page: Page) {
  const customer = await send(page, "/api/customers", { name: "Petar Petrović", phone: "0602" });
  const device = await send(page, "/api/devices", { model: "Galaxy A52", ownerId: customer.id });
  return send(page, "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: today(),
  });
}

/** Registers a service and opens its Customer report tab. */
async function openCustomerReport(page: Page) {
  const service = await registerService(page);
  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await drawer.getByRole("tab", { name: "Izveštaj za mušteriju" }).click();
  return {
    service,
    drawer,
    report: drawer.getByRole("textbox", { name: "Izveštaj za mušteriju" }),
    polish: drawer.getByRole("button", { name: "Doteraj" }),
    save: drawer.getByRole("button", { name: "Sačuvaj izmene" }),
    bar: drawer.getByText("Doterano uz AI"),
    undo: drawer.getByRole("button", { name: "Poništi" }),
  };
}

/** Completes the service from its card in the list, which asks for its customer report. */
async function completeService(page: Page, number: string) {
  const card = page.getByRole("listitem").filter({ hasText: number });
  await card.getByRole("button", { name: /Promeni status/ }).click();
  await page.getByRole("menuitemradio", { name: "Završen" }).click();
  const dialog = page.getByRole("dialog", { name: `Servis ${number} je završen` });
  return { dialog, report: dialog.getByRole("textbox", { name: "Izveštaj za mušteriju" }) };
}

test("a staff member polishes the customer report with AI, undoes it, polishes again and saves", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { service, report, polish, save, bar, undo } = await openCustomerReport(page);

  // Nothing to polish yet.
  await expect(polish).toBeDisabled();
  await report.fill("   ");
  await expect(polish).toBeDisabled();

  await report.fill("zamenjen kondenzator, ociscen");
  await polish.click();
  await expect(report).toHaveValue("zamenjen kondenzator, ociscen (polished)");
  await expect(bar).toBeVisible();

  // Undo restores the draft from before the polish, and the bar goes.
  await undo.click();
  await expect(report).toHaveValue("zamenjen kondenzator, ociscen");
  await expect(bar).toBeHidden();

  // Polishing twice, Undo goes back to the first polished version.
  await polish.click();
  await expect(report).toHaveValue("zamenjen kondenzator, ociscen (polished)");
  await polish.click();
  await expect(report).toHaveValue("zamenjen kondenzator, ociscen (polished) (polished)");
  await undo.click();
  await expect(report).toHaveValue("zamenjen kondenzator, ociscen (polished)");

  // Native undo takes back a polish too, and counts as an edit: the bar goes.
  await polish.click();
  await expect(report).toHaveValue("zamenjen kondenzator, ociscen (polished) (polished)");
  await report.press("ControlOrMeta+z");
  await expect(report).toHaveValue("zamenjen kondenzator, ociscen (polished)");
  await expect(bar).toBeHidden();

  // Typing after a polish builds on it: the bar goes.
  await polish.click();
  await expect(bar).toBeVisible();
  await report.press("End");
  await report.pressSequentially(" Radi.");
  await expect(bar).toBeHidden();

  // Nothing was saved along the way.
  const unsaved = await page.request.get(`/api/services/${service.id}`);
  expect((await unsaved.json()).customerReport).toBeNull();

  await polish.click();
  await expect(bar).toBeVisible();
  await save.click();
  await expect(page.getByText("Izveštaj za mušteriju je sačuvan")).toBeVisible();
  await expect(bar).toBeHidden();
  const saved = await page.request.get(`/api/services/${service.id}`);
  expect((await saved.json()).customerReport).toBe(
    "zamenjen kondenzator, ociscen (polished) (polished) Radi. (polished)",
  );
});

test("while a polish is in flight the text is read-only and Save is disabled", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { report, polish, save } = await openCustomerReport(page);

  await report.fill("zamenjena baterija [slow]");
  await expect(save).toBeEnabled();
  await polish.click();
  const polishing = page.getByRole("button", { name: "Doterujem…" });
  await expect(polishing).toBeDisabled();
  await expect(report).toHaveAttribute("readonly", "");
  await expect(save).toBeDisabled();

  await expect(report).toHaveValue("zamenjena baterija [slow] (polished)");
  await expect(report).not.toHaveAttribute("readonly");
  await expect(save).toBeEnabled();
});

test("a polish that changes nothing leaves the text alone and says it looks good", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { report, polish, bar } = await openCustomerReport(page);
  const looksGood = page.getByText("Izgleda dobro, nema potrebe za izmenama.");

  await report.fill("Zamenjena baterija. [unchanged]");
  await polish.click();
  await expect(looksGood).toBeVisible();
  await expect(report).toHaveValue("Zamenjena baterija. [unchanged]");
  await expect(bar).toBeHidden();

  // The note goes once the text is edited.
  await report.press("End");
  await report.pressSequentially(" Radi.");
  await expect(looksGood).toBeHidden();
});

test("a failed polish leaves the text alone, says so in a toast, and Save works again", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { service, report, polish, save, bar } = await openCustomerReport(page);
  const unavailable = "AI doterivanje trenutno nije dostupno. Pokušajte ponovo kasnije.";

  await report.fill("zamenjena baterija [unavailable]");
  await polish.click();
  await expect(page.getByText(unavailable, { exact: true })).toBeVisible();
  await expect(report).toHaveValue("zamenjena baterija [unavailable]");
  await expect(report).not.toHaveAttribute("readonly");
  await expect(bar).toBeHidden();
  await expect(save).toBeEnabled();

  // The provider's daily limit is named.
  await report.fill("zamenjena baterija [daily limit]");
  await polish.click();
  await expect(page.getByText(`${unavailable} (dostignut dnevni limit)`)).toBeVisible();
  await expect(report).toHaveValue("zamenjena baterija [daily limit]");

  await save.click();
  await expect(page.getByText("Izveštaj za mušteriju je sačuvan")).toBeVisible();
  const saved = await page.request.get(`/api/services/${service.id}`);
  expect((await saved.json()).customerReport).toBe("zamenjena baterija [daily limit]");
});

test("the Polish button is hidden when the deployment has no AI provider key", async ({ page }) => {
  // The e2e backend always runs the fake polisher, so the panel is told the feature is off.
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    await route.fulfill({ response, json: { ...me, features: { aiPolish: false } } });
  });
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { report, save } = await openCustomerReport(page);

  await report.fill("zamenjena baterija");
  await expect(save).toBeEnabled();
  await expect(page.getByRole("button", { name: "Doteraj" })).toHaveCount(0);

  // Nor in the completion dialog.
  const other = await registerService(page);
  await page.goto("/services");
  const completion = await completeService(page, other.number);
  await completion.report.fill("zamenjena baterija");
  await expect(completion.dialog.getByRole("button", { name: "Samo sačuvaj" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Doteraj" })).toHaveCount(0);
});

test("a staff member polishes the customer report in the completion dialog, undoes it, polishes again and generates the service report", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await registerService(page);
  await page.reload();
  const { dialog, report } = await completeService(page, service.number);
  const polish = dialog.getByRole("button", { name: "Doteraj" });
  const bar = dialog.getByText("Doterano uz AI");
  const undo = dialog.getByRole("button", { name: "Poništi" });
  const footer = ["Preskoči", "Samo sačuvaj", "Sačuvaj i generiši izveštaj"].map((name) =>
    dialog.getByRole("button", { name }),
  );
  const generate = footer[2];

  await expect(polish).toBeDisabled();
  await report.fill("zamenjen ekran");
  await polish.click();
  await expect(report).toHaveValue("zamenjen ekran (polished)");
  await expect(bar).toBeVisible();

  await undo.click();
  await expect(report).toHaveValue("zamenjen ekran");
  await expect(bar).toBeHidden();

  // Native undo takes back a polish too.
  await polish.click();
  await expect(report).toHaveValue("zamenjen ekran (polished)");
  await report.press("ControlOrMeta+z");
  await expect(report).toHaveValue("zamenjen ekran");
  await expect(bar).toBeHidden();

  // While polishing, the text is read-only, the footer is disabled and the dialog stays open.
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/customer-report/polish", async (route) => {
    await released;
    await route.continue();
  });
  await polish.click();
  await expect(dialog.getByRole("button", { name: "Doterujem…" })).toBeDisabled();
  await expect(report).toHaveAttribute("readonly", "");
  for (const button of footer) await expect(button).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  release();
  await expect(report).toHaveValue("zamenjen ekran (polished)");
  await expect(report).not.toHaveAttribute("readonly");
  for (const button of footer) await expect(button).toBeEnabled();
  await expect(bar).toBeVisible();

  const download = page.waitForEvent("download");
  await generate.click();
  await expect(dialog).toBeHidden();
  const pdf = await readDownload(await download);
  expect(pdf.text).toContain("zamenjen ekran (polished)");
  const saved = await page.request.get(`/api/services/${service.id}`);
  expect((await saved.json()).customerReport).toBe("zamenjen ekran (polished)");
});
