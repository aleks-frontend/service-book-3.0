import { expect, test } from "@playwright/test";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

test("the price list pages, searches and sorts on the server, like the other lists", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  // More than one page at the default ten rows per page.
  for (let n = 1; n <= 12; n++) {
    await page.request.post("/api/actions", {
      data: { name: `Strana usluge ${String(n).padStart(2, "0")}`, price: 100 * n },
    });
  }

  await page.goto("/actions");
  const rows = page.getByRole("row");
  const search = page.getByLabel("Pretraga usluga");
  await search.fill("Strana usluge");
  // The search is debounced; wait for it to run.
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.getByText("1–10 od 12")).toBeVisible();
  await expect(rows).toHaveCount(11);

  await page.getByRole("button", { name: "Sledeća strana" }).click();
  await expect(page.getByText("11–12 od 12")).toBeVisible();
  await expect(rows.nth(1)).toContainText("Strana usluge 11");

  // A new page size starts from the first page.
  await page.getByRole("combobox", { name: "Redova po strani" }).click();
  await page.getByRole("option", { name: "25" }).click();
  await expect(page.getByText("1–12 od 12")).toBeVisible();
  await expect(rows).toHaveCount(13);

  // So does a new sort, and a new search.
  await page.getByRole("combobox", { name: "Redova po strani" }).click();
  await page.getByRole("option", { name: "10" }).click();
  await page.getByRole("button", { name: "Sledeća strana" }).click();
  await expect(page.getByText("11–12 od 12")).toBeVisible();
  await page.getByRole("button", { name: "Naziv" }).click();
  await expect(page.getByText("1–10 od 12")).toBeVisible();
  await expect(rows.nth(1)).toContainText("Strana usluge 12");

  await page.getByRole("button", { name: "Sledeća strana" }).click();
  await expect(page.getByText("11–12 od 12")).toBeVisible();
  const searched = page.waitForRequest(/\/api\/actions\?.*search=Strana(\+|%20)usluge(\+|%20)0/);
  await search.fill("Strana usluge 0");
  expect(new URL((await searched).url()).searchParams.get("page")).toBe("1");
  await expect(page.getByText("1–9 od 9")).toBeVisible();

  await search.fill("nema takve usluge");
  await expect(page.getByText("Nijedna usluga ne odgovara pretrazi.")).toBeVisible();
});

test("deleting the last action on the last page steps back a page", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  for (let n = 1; n <= 11; n++) {
    await page.request.post("/api/actions", {
      data: { name: `Poslednja usluga ${String(n).padStart(2, "0")}`, price: 100 },
    });
  }

  await page.goto("/actions");
  await page.getByLabel("Pretraga usluga").fill("Poslednja usluga");
  await expect(page.getByRole("status")).toHaveText("");
  await page.getByRole("button", { name: "Sledeća strana" }).click();
  await expect(page.getByText("11–11 od 11")).toBeVisible();

  await page
    .getByRole("row", { name: /Poslednja usluga 11/ })
    .getByRole("button", { name: "Obriši" })
    .click();
  await page
    .getByRole("dialog", { name: "Obrisati uslugu?" })
    .getByRole("button", { name: "Obriši", exact: true })
    .click();

  await expect(page.getByText("Usluga je obrisana")).toBeVisible();
  await expect(page.getByText("1–10 od 10")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(11);
});
