import { expect, test } from "@playwright/test";
import { STAFF } from "./env.js";

test("the language switcher changes the UI between sr, hu and en and remembers the choice", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Prijavi se" })).toBeVisible();

  await page.getByRole("button", { name: "Magyar" }).click();
  await expect(page.getByRole("heading", { name: "Bejelentkezés" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Bejelentkezés" })).toBeVisible();

  await page.getByLabel("E-mail").fill(STAFF.email);
  await page.getByLabel("Jelszó").fill(STAFF.password);
  await page.getByRole("button", { name: "Bejelentkezés" }).click();
  await expect(page.getByRole("link", { name: "Szervizek" })).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("link", { name: "Services" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Customers" })).toBeVisible();

  await page.getByRole("button", { name: "Srpski" }).click();
  await expect(page.getByRole("link", { name: "Mušterije" })).toBeVisible();
});
