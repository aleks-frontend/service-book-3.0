import type { Page } from "@playwright/test";
import { STAFF } from "./env.js";

/** Logs in through the login page, which defaults to Serbian (sr). */
export async function logIn(page: Page, password = STAFF.password) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(STAFF.email);
  await page.getByLabel("Lozinka").fill(password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
}
