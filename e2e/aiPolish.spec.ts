import { expect, test, type Page } from "@playwright/test";
import { today } from "./dates.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr). The backend runs the fake polisher (AI_POLISH_FAKE),
// which appends " (polished)" to the text it is sent.

async function send(page: Page, path: string, data: object) {
  const response = await page.request.post(path, { data });
  expect(response.ok()).toBe(true);
  return response.json();
}

/** Registers a service for a new customer's new device and opens its Customer report tab. */
async function openCustomerReport(page: Page) {
  const customer = await send(page, "/api/customers", { name: "Petar Petrović", phone: "0602" });
  const device = await send(page, "/api/devices", { model: "Galaxy A52", ownerId: customer.id });
  const service = await send(page, "/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: today(),
  });
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

  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/customer-report/polish", async (route) => {
    await released;
    await route.continue();
  });

  await report.fill("zamenjena baterija");
  await expect(save).toBeEnabled();
  await polish.click();
  const polishing = page.getByRole("button", { name: "Doterujem…" });
  await expect(polishing).toBeDisabled();
  await expect(report).toHaveAttribute("readonly", "");
  await expect(save).toBeDisabled();

  release();
  await expect(report).toHaveValue("zamenjena baterija (polished)");
  await expect(report).not.toHaveAttribute("readonly");
  await expect(save).toBeEnabled();
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
});
