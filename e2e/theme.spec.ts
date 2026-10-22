import { expect, test } from "@playwright/test";
import { logIn } from "./logIn.js";

const DARK = /\bdark\b/;

test("the theme follows the OS preference until switched, and remembers the choice", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await logIn(page);
  const html = page.locator("html");
  const toggle = page.getByRole("button", { name: "Tamna tema" });

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(html).toHaveClass(DARK);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(html).not.toHaveClass(DARK);

  // The choice outlives a reload even though the OS still prefers dark.
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(html).not.toHaveClass(DARK);
});

test("the saved theme is applied before the app's script runs, so the page doesn't flash", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await page.getByRole("button", { name: "Tamna tema" }).click();
  await expect(page.locator("html")).toHaveClass(DARK);

  // Without the app's bundle, only what runs in index.html itself can set the theme.
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator("html")).toHaveClass(DARK);
});
