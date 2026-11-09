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
  await completion.dialog.getByRole("button", { name: "Preskoči" }).click();

  // Nor on the description of a new service.
  const newService = await openNewService(page);
  await newService.description.fill("ne pali se");
  await expect(newService.save).toBeEnabled();
  await expect(newService.polish).toHaveCount(0);
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

/**
 * Opens the New service dialog with a new customer's new device picked, so it
 * can be created once the description is in.
 */
async function openNewService(page: Page) {
  const name = `Jovana Janković ${crypto.randomUUID().slice(0, 8)}`;
  const customer = await send(page, "/api/customers", { name, phone: "0603" });
  await send(page, "/api/devices", {
    manufacturer: "Xiaomi",
    model: "Redmi 9",
    ownerId: customer.id,
  });
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Novi servis" });
  await dialog.getByLabel("Mušterija *").fill(name);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  await dialog.getByLabel("Uređaji *").fill("Redmi 9");
  await page.getByRole("option", { name: /^Xiaomi Redmi 9/ }).click();
  return descriptionControls(dialog, "Dodaj servis");
}

/** The description and the polish controls of a service form dialog, saved with `saveLabel`. */
function descriptionControls(dialog: ReturnType<Page["getByRole"]>, saveLabel: string) {
  return {
    dialog,
    description: dialog.getByLabel("Opis"),
    polish: dialog.getByRole("button", { name: "Doteraj" }),
    bar: dialog.getByText("Doterano uz AI"),
    undo: dialog.getByRole("button", { name: "Poništi" }),
    looksGood: dialog.getByText("Izgleda dobro, nema potrebe za izmenama."),
    save: dialog.getByRole("button", { name: saveLabel }),
    cancel: dialog.getByRole("button", { name: "Otkaži" }),
  };
}

test("a staff member polishes the description of a new service, undoes it, and creates it polished", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { dialog, description, polish, bar, undo, looksGood, save } = await openNewService(page);

  await expect(polish).toBeDisabled();
  await description.fill("ne pali se,pao u vodu");
  await polish.click();
  await expect(description).toHaveValue("ne pali se,pao u vodu (polished)");
  await expect(bar).toBeVisible();

  await undo.click();
  await expect(description).toHaveValue("ne pali se,pao u vodu");
  await expect(bar).toBeHidden();

  // Native undo takes back a polish too.
  await polish.click();
  await expect(description).toHaveValue("ne pali se,pao u vodu (polished)");
  await description.press("ControlOrMeta+z");
  await expect(description).toHaveValue("ne pali se,pao u vodu");
  await expect(bar).toBeHidden();

  // Typing after a polish builds on it: the bar goes.
  await polish.click();
  await expect(bar).toBeVisible();
  await description.press("End");
  await description.pressSequentially(" Ekran");
  await expect(bar).toBeHidden();

  // A polish that changes nothing says so, and leaves the text alone.
  await description.fill("Ne pali se. [unchanged]");
  await polish.click();
  await expect(looksGood).toBeVisible();
  await expect(description).toHaveValue("Ne pali se. [unchanged]");

  await description.fill("ne pali se,pao u vodu");
  await expect(looksGood).toBeHidden();
  await polish.click();
  await expect(bar).toBeVisible();
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/services") && response.request().method() === "POST",
  );
  await save.click();
  await expect(dialog).toBeHidden();
  const service = await (await created).json();
  expect(service.description).toBe("ne pali se,pao u vodu (polished)");
  await page
    .getByRole("dialog", { name: "Odštampati prijemnicu?" })
    .getByRole("button", { name: "Ne sada" })
    .click();

  // Opened again, the dialog starts with no polish outcome.
  const again = await openNewService(page);
  await expect(again.bar).toBeHidden();
  await expect(again.description).toHaveValue("");
});

test("while the description is polished, the New service dialog neither saves nor closes", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { dialog, description, save, cancel, polish } = await openNewService(page);

  await description.fill("ne pali se [slow]");
  await polish.click();
  await expect(dialog.getByRole("button", { name: "Doterujem…" })).toBeDisabled();
  await expect(description).toHaveAttribute("readonly", "");
  await expect(save).toBeDisabled();
  await expect(cancel).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  // An outside click is ignored too.
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();

  await expect(description).toHaveValue("ne pali se [slow] (polished)");
  await expect(description).not.toHaveAttribute("readonly");
  await expect(save).toBeEnabled();
  await expect(cancel).toBeEnabled();
});

test("a failed polish of the description leaves it alone and says so in a toast", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const { description, polish, bar, save } = await openNewService(page);
  const unavailable = "AI doterivanje trenutno nije dostupno. Pokušajte ponovo kasnije.";

  await description.fill("ne pali se [unavailable]");
  await polish.click();
  await expect(page.getByText(unavailable, { exact: true })).toBeVisible();
  await expect(description).toHaveValue("ne pali se [unavailable]");
  await expect(bar).toBeHidden();
  await expect(save).toBeEnabled();

  await description.fill("ne pali se [daily limit]");
  await polish.click();
  await expect(page.getByText(`${unavailable} (dostignut dnevni limit)`)).toBeVisible();
  await expect(description).toHaveValue("ne pali se [daily limit]");
});

test("a staff member polishes the description in the Edit service dialog and saves it", async ({
  page,
}) => {
  const unavailable = "AI doterivanje trenutno nije dostupno. Pokušajte ponovo kasnije.";
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const service = await registerService(page);
  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await drawer.getByRole("button", { name: "Izmena servisa" }).click();
  const { dialog, description, polish, bar, undo, looksGood, save, cancel } = descriptionControls(
    page.getByRole("dialog", { name: "Izmena servisa" }),
    "Sačuvaj izmene",
  );

  await description.fill("pukao ekran,ne puni");
  await polish.click();
  await expect(description).toHaveValue("pukao ekran,ne puni (polished)");
  await undo.click();
  await expect(description).toHaveValue("pukao ekran,ne puni");

  // Typing after a polish builds on it: the bar goes.
  await polish.click();
  await expect(bar).toBeVisible();
  await description.press("End");
  await description.pressSequentially(" x");
  await expect(bar).toBeHidden();

  await description.fill("Pukao ekran. [unchanged]");
  await polish.click();
  await expect(looksGood).toBeVisible();

  await description.fill("pukao ekran [unavailable]");
  await polish.click();
  await expect(page.getByText(unavailable, { exact: true })).toBeVisible();
  await expect(description).toHaveValue("pukao ekran [unavailable]");
  await description.fill("pukao ekran [daily limit]");
  await polish.click();
  await expect(page.getByText(`${unavailable} (dostignut dnevni limit)`)).toBeVisible();
  await expect(description).toHaveValue("pukao ekran [daily limit]");

  // While polishing, it neither saves nor closes.
  await description.fill("pukao ekran,ne puni [slow]");
  await polish.click();
  await expect(save).toBeDisabled();
  await expect(cancel).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(description).toHaveValue("pukao ekran,ne puni [slow] (polished)");
  await expect(save).toBeEnabled();
  await expect(bar).toBeVisible();

  await save.click();
  await expect(dialog).toBeHidden();
  await expect(drawer.getByRole("region", { name: "Detalji servisa" })).toContainText(
    "pukao ekran,ne puni [slow] (polished)",
  );
  const saved = await page.request.get(`/api/services/${service.id}`);
  expect((await saved.json()).description).toBe("pukao ekran,ne puni [slow] (polished)");
});
