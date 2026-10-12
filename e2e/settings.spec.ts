import { expect, test } from "@playwright/test";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

const IMAGES = "apps/backend/test/fixtures/images";

test("a staff member sets the company identity, with a logo and signature, and it is kept", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  await page.getByRole("link", { name: "Podešavanja" }).click();
  await expect(page.getByRole("heading", { name: "Podešavanja" })).toBeVisible();

  await page.getByLabel("Naziv firme *").fill("Servis Lisztrapszódia");
  await page.getByLabel("Adresa").fill("Glavna 1, Subotica");
  await page.getByLabel("Telefon").fill("024 123 456");
  await page.getByLabel("E-mail").fill("servis@example.com");
  await page.getByLabel("PIB").fill("101234567");

  // Only PNG and JPEG images can be printed on documents.
  await page.getByLabel("Logo", { exact: true }).setInputFiles({
    name: "logo.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("R0lGODlhAQABAAAAACw=", "base64"),
  });
  await page.getByRole("button", { name: "Sačuvaj izmene" }).click();
  await expect(page.getByText("Slika mora biti PNG ili JPEG")).toBeVisible();

  await page.getByLabel("Logo", { exact: true }).setInputFiles(`${IMAGES}/logo.png`);
  await page.getByLabel("Potpis", { exact: true }).setInputFiles(`${IMAGES}/signature.jpg`);
  await expect(page.getByRole("img", { name: "Logo" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Potpis" })).toBeVisible();
  await page.getByRole("button", { name: "Sačuvaj izmene" }).click();
  await expect(page.getByText("Podešavanja su sačuvana")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Naziv firme *")).toHaveValue("Servis Lisztrapszódia");
  await expect(page.getByLabel("PIB")).toHaveValue("101234567");
  await expect(page.getByRole("img", { name: "Logo" })).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  await expect(page.getByRole("img", { name: "Potpis" })).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );

  // Removing the signature and saving clears it.
  await page.getByRole("button", { name: "Ukloni: Potpis" }).click();
  await page.getByRole("button", { name: "Sačuvaj izmene" }).click();
  await expect(page.getByText("Podešavanja su sačuvana")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Naziv firme *")).toHaveValue("Servis Lisztrapszódia");
  await expect(page.getByRole("img", { name: "Potpis" })).toBeHidden();
  await expect(page.getByRole("img", { name: "Logo" })).toBeVisible();
});
