import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

/**
 * Holds API responses matching `url` until the returned function is called,
 * so a test can look at the page while they load.
 */
async function holdResponses(page: Page, url: string | RegExp) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

test("the customers table shows it is loading while the next page loads", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  // More than one page at the default ten rows per page.
  for (let i = 1; i <= 11; i++) {
    await page.request.post("/api/customers", {
      data: { name: `Strana ${String(i).padStart(2, "0")}`, phone: `06099900${i}` },
    });
  }

  await page.goto("/customers");
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toBeVisible();
  const firstPageRow = (await rows.nth(1).textContent())!;
  const progress = page.getByRole("progressbar", { name: "Učitavanje…" });
  await expect(progress).toBeHidden();

  const release = await holdResponses(page, /\/api\/customers\?.*page=2/);
  await page.getByRole("button", { name: "Sledeća strana" }).click();

  // The first page stays on screen, marked as loading; it isn't the search that is.
  await expect(progress).toBeVisible();
  await expect(rows.nth(1)).toHaveText(firstPageRow);
  await expect(page.getByRole("status")).toHaveText("");

  release();
  await expect(progress).toBeHidden();
  await expect(rows.nth(1)).not.toHaveText(firstPageRow);
});

test("searching services shows it is loading from the first keystroke until the results arrive", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const search = page.getByRole("searchbox", { name: "Pretraga servisa" });
  const searching = page.getByRole("status");
  await expect(searching).toHaveText("");

  const release = await holdResponses(page, /\/api\/services\?.*search=nema/);
  await search.fill("nema");
  // Before the debounced request is even sent.
  await expect(searching).toHaveText("Učitavanje…");
  // While it loads, the previous results are marked as loading too.
  await expect(page.getByRole("progressbar", { name: "Učitavanje…" })).toBeVisible();

  release();
  await expect(searching).toHaveText("");
  await expect(page.getByText("Nijedan servis ne odgovara pretrazi.")).toBeVisible();
});
