import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { today } from "./dates.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

const IMAGES = "apps/backend/test/fixtures/images";

/** A fixture as a file to pick; `setInputFiles` can't mix paths with buffers. */
function image(file: string, mimeType: string, name = file) {
  return { name, mimeType, buffer: readFileSync(`${IMAGES}/${file}`) };
}

/** A fresh service, opened in the drawer on its Log tab. */
async function openServiceLog(page: Page, customerName: string) {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const post = async (path: string, data: object) =>
    (await page.request.post(path, { data })).json();
  const customer = await post("/api/customers", { name: customerName, phone: "0611" });
  const device = await post("/api/devices", { model: "iPhone 12", ownerId: customer.id });
  const service = await post("/api/services", {
    customerId: customer.id,
    deviceIds: [device.id],
    date: today(),
  });

  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await drawer.getByRole("tab", { name: "Dnevnik" }).click();
  return { drawer, serviceId: service.id as string };
}

test("a staff member adds a note with photos from the drawer, shrunk before upload, and sees them", async ({
  page,
}) => {
  const { drawer, serviceId } = await openServiceLog(page, "Jelena Jović");
  const picked = drawer.getByRole("list", { name: "Izabrane fotografije" }).getByRole("img");

  // A file the browser can't decode is named in a toast; the others are still picked.
  await drawer
    .getByLabel("Fotografije za belešku")
    .setInputFiles([
      image("large.jpg", "image/jpeg"),
      image("photo.webp", "image/webp"),
      { name: "IMG_0042.heic", mimeType: "image/heic", buffer: Buffer.from("not an image") },
    ]);
  await expect(
    page.getByText(
      "Nije moguće pročitati „IMG_0042.heic”. Sačuvajte je kao JPEG i pokušajte ponovo.",
    ),
  ).toBeVisible();
  await expect(picked).toHaveCount(2);

  // A picked photo can be removed before posting.
  await drawer.getByRole("button", { name: "Ukloni: photo.webp" }).click();
  await expect(picked).toHaveCount(1);
  await expect(picked.first()).toHaveAccessibleName("large.jpg");

  await drawer.getByLabel("Beleška").fill("Ogrebotine na poleđini");
  await drawer.getByRole("button", { name: "Dodaj belešku" }).click();

  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Ogrebotine na poleđini");
  const thumbnail = entries.first().getByRole("img", { name: "Fotografija 1" });
  await expect(thumbnail).toBeVisible();
  // The thumbnail really loads, through the redirect to the storage.
  await expect
    .poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(await thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeLessThanOrEqual(
    400,
  );
  // The composer is empty again.
  await expect(drawer.getByLabel("Beleška")).toHaveValue("");
  await expect(picked).toHaveCount(0);

  // The 4000 × 3000 fixture was shrunk to 2048 px on its long edge before upload.
  const log = await (await page.request.get(`/api/services/${serviceId}/log`)).json();
  expect(log[0].photos).toEqual([{ id: expect.any(String), width: 2048, height: 1536 }]);

  // The link opens the full-size photo.
  const full = await page.request.get(
    (await entries.first().getByRole("link").getAttribute("href"))!,
  );
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("image/jpeg");
});

test("a note can be only photos, and no more than 10 can be picked", async ({ page }) => {
  const { drawer } = await openServiceLog(page, "Nikola Nikolić");
  const picked = drawer.getByRole("list", { name: "Izabrane fotografije" }).getByRole("img");
  const add = drawer.getByRole("button", { name: "Dodaj belešku" });
  await expect(add).toBeDisabled();

  await drawer
    .getByLabel("Fotografije za belešku")
    .setInputFiles(
      Array.from({ length: 11 }, (_, n) => image("photo.jpg", "image/jpeg", `photo-${n + 1}.jpg`)),
    );
  await expect(page.getByText("Beleška može imati najviše 10 fotografija.")).toBeVisible();
  await expect(picked).toHaveCount(10);
  await expect(drawer.getByRole("button", { name: "Dodaj fotografije" })).toBeDisabled();

  // No text is needed when there are photos.
  await add.click();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first().getByRole("img")).toHaveCount(10);
});
