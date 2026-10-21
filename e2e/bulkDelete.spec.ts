import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

async function post(page: Page, path: string, data: object) {
  return (await page.request.post(path, { data })).json();
}

async function confirmDelete(page: Page, title: string) {
  await page
    .getByRole("dialog", { name: title })
    .getByRole("button", { name: "Obriši", exact: true })
    .click();
}

test("customers on a page can be deleted together, keeping one who owns a device", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  for (const name of ["Bulk Ana", "Bulk Bojan"]) {
    await post(page, "/api/customers", { name, phone: "0601" });
  }
  const owner = await post(page, "/api/customers", { name: "Bulk Cvijeta", phone: "0602" });
  await post(page, "/api/devices", { model: "Nokia 3310", ownerId: owner.id });

  await page.goto("/customers");
  await page.getByLabel("Pretraga mušterija").fill("Bulk");
  // The search is debounced; a new search clears the selection, so wait for it to run.
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.getByRole("row")).toHaveCount(4);
  await page.getByRole("checkbox", { name: "Izaberi sve na ovoj strani" }).check();
  await expect(page.getByText("Izabrano: 3")).toBeVisible();

  await page.getByRole("button", { name: "Obriši izabrano" }).click();
  await expect(page.getByText("Bulk Ana, Bulk Bojan, Bulk Cvijeta")).toBeVisible();
  await confirmDelete(page, "Obrisati izabrane mušterije (3)?");

  await expect(
    page.getByText("Obrisano mušterija: 2. Zadržano jer imaju uređaje ili servise: 1."),
  ).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("row", { name: /Bulk Cvijeta/ })).toBeVisible();
  await expect(page.getByText("Izabrano:")).toBeHidden();
});

test("the actions on a page can be deleted together", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  // More than one page at the default ten rows per page.
  for (let n = 1; n <= 12; n++) {
    await post(page, "/api/actions", {
      name: `Bulk action ${String(n).padStart(2, "0")}`,
      price: 100,
    });
  }

  await page.goto("/actions");
  await page.getByLabel("Pretraga usluga").fill("Bulk action");
  // The search is debounced; a new search clears the selection, so wait for it to run.
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.getByText("1–10 od 12")).toBeVisible();
  const selectPage = page.getByRole("checkbox", { name: "Izaberi sve na ovoj strani" });
  await selectPage.check();
  await expect(page.getByText("Izabrano: 10")).toBeVisible();

  // Another page starts with nothing selected.
  await page.getByRole("button", { name: "Sledeća strana" }).click();
  await expect(page.getByText("11–12 od 12")).toBeVisible();
  await expect(page.getByText("Izabrano:")).toBeHidden();
  await page.getByRole("button", { name: "Prethodna strana" }).click();
  await expect(page.getByText("1–10 od 12")).toBeVisible();

  await selectPage.check();
  await page.getByRole("button", { name: "Obriši izabrano" }).click();
  await expect(page.getByText("i još 7", { exact: false })).toBeVisible();
  await confirmDelete(page, "Obrisati izabrane usluge (10)?");

  await expect(page.getByText("Obrisano usluga: 10")).toBeVisible();
  await expect(page.getByText("1–2 od 2")).toBeVisible();
  await expect(page.getByRole("row", { name: /Bulk action 1[12]/ })).toHaveCount(2);
});
