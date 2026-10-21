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

test("the actions matching a search can be deleted together, more than one request's worth", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  for (let n = 1; n <= 52; n++) {
    await post(page, "/api/actions", { name: `Bulk action ${n}`, price: 100 });
  }
  await post(page, "/api/actions", { name: "Kept cleaning", price: 100 });

  await page.goto("/actions");
  await page.getByLabel("Pretraga usluga").fill("Bulk action");
  await page.getByRole("checkbox", { name: "Izaberi sve prikazane" }).check();
  await expect(page.getByText("Izabrano: 52")).toBeVisible();

  await page.getByRole("button", { name: "Obriši izabrano" }).click();
  await expect(page.getByText("i još 49", { exact: false })).toBeVisible();
  await confirmDelete(page, "Obrisati izabrane usluge (52)?");

  await expect(page.getByText("Obrisano usluga: 52")).toBeVisible();
  await page.getByLabel("Pretraga usluga").fill("");
  await expect(page.getByRole("row", { name: /Kept cleaning/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Bulk action/ })).toHaveCount(0);
});
