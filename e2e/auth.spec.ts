import { expect, test, type Page } from "@playwright/test";
import { STAFF } from "./env.js";

// The UI defaults to Serbian (sr).
async function logIn(page: Page, password = STAFF.password) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(STAFF.email);
  await page.getByLabel("Lozinka").fill(password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
}

test("a staff member logs in, sees the shell, logs out and is kept out of protected pages", async ({
  page,
}) => {
  await logIn(page);

  await expect(page).toHaveURL("/services");
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  for (const section of [
    "Servisi",
    "Mušterije",
    "Uređaji",
    "Usluge",
    "Statistika",
    "Podešavanja",
  ]) {
    await expect(nav.getByRole("link", { name: section })).toBeVisible();
  }
  await expect(page.getByText(STAFF.name)).toBeVisible();

  await nav.getByRole("link", { name: "Mušterije" }).click();
  await expect(page).toHaveURL("/customers");
  await expect(page.getByRole("heading", { name: "Mušterije" })).toBeVisible();

  await page.getByRole("button", { name: "Odjavi se" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/settings");
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("button", { name: "Prijavi se" })).toBeVisible();
});

test("a wrong password is rejected", async ({ page }) => {
  await logIn(page, "not-the-password");

  await expect(page.getByRole("alert")).toHaveText("Pogrešan e-mail ili lozinka");
  await expect(page).toHaveURL("/login");
});

test("an expired session sends the staff member back to login", async ({ page, context }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");

  await context.clearCookies();
  await page.goto("/devices");

  await expect(page).toHaveURL("/login");
});

test("a 401 from the API while using the app sends the staff member back to login", async ({
  page,
  context,
}) => {
  await logIn(page);
  await expect(page.getByText(STAFF.name)).toBeVisible();

  await context.clearCookies();
  // Returning to the tab refetches the app's data, which now gets a 401.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await expect(page).toHaveURL("/login");
});
