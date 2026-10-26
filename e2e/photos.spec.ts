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

  // The full-size photo is served too.
  const full = await page.request.get(`/api/photos/${log[0].photos[0].id}`);
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

/** Posts a note with photos straight to the API: each one `photo.jpg` (640 × 480) with its 160 px thumbnail. */
async function postPhotoNote(page: Page, serviceId: string, text: string | null, count: number) {
  const body = new FormData();
  if (text !== null) body.append("text", text);
  for (let n = 0; n < count; n++) {
    const photo = readFileSync(`${IMAGES}/photo.jpg`);
    const thumbnail = readFileSync(`${IMAGES}/thumbnail.jpg`);
    body.append("photos", new Blob([photo], { type: "image/jpeg" }), "photo.jpg");
    body.append("thumbnails", new Blob([thumbnail], { type: "image/jpeg" }), "photo.jpg");
  }
  const response = await page.request.post(`/api/services/${serviceId}/log`, { multipart: body });
  expect(response.status()).toBe(201);
}

test("photos open in a lightbox from a note and from the Photos strip", async ({ page }) => {
  const { drawer, serviceId } = await openServiceLog(page, "Milan Milić");
  const strip = drawer.getByRole("region", { name: "Fotografije" });
  // No photos, no strip.
  await expect(drawer.getByTestId("log-entry")).toHaveCount(0);
  await expect(strip).toHaveCount(0);

  await postPhotoNote(page, serviceId, "Prijem", 2);
  await postPhotoNote(page, serviceId, "Posle popravke", 1);
  await page.reload();
  await drawer.getByRole("tab", { name: "Dnevnik" }).click();

  const lightbox = page.getByRole("dialog", { name: "Pregled fotografija" });
  const current = lightbox.locator(".yarl__slide_current img");
  const counter = lightbox.locator(".yarl__slide_current");

  // The strip collects every photo of the service, oldest first.
  const log = await (await page.request.get(`/api/services/${serviceId}/log`)).json();
  const oldestFirst = log.flatMap((entry: { photos: { id: string }[] }) =>
    entry.photos.map((photo) => `/api/photos/${photo.id}/thumb`),
  );
  await expect(strip.getByRole("img")).toHaveCount(3);
  expect(
    await strip.getByRole("img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src"))),
  ).toEqual(oldestFirst);

  // From the second note, the lightbox pages through that note's one photo only.
  const second = drawer.getByTestId("log-entry").nth(1);
  await second.getByRole("button", { name: "Fotografija 1" }).click();
  await expect(lightbox).toBeVisible();
  await expect(counter).toHaveAccessibleName("1 od 1");
  // The full-size photo, not the thumbnail.
  await expect.poll(() => current.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(640);
  await expect(lightbox.getByRole("button", { name: "Sledeća fotografija" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
  // Escape closed the lightbox only, not the drawer.
  await expect(drawer).toBeVisible();

  // From the strip, it pages through all of them.
  await strip.getByRole("button", { name: "Fotografija 2" }).click();
  await expect(counter).toHaveAccessibleName("2 od 3");
  await lightbox.getByRole("button", { name: "Sledeća fotografija" }).click();
  await expect(counter).toHaveAccessibleName("3 od 3");
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toHaveAccessibleName("2 od 3");
  await lightbox.getByRole("button", { name: "Prethodna fotografija" }).click();
  await expect(counter).toHaveAccessibleName("1 od 3");
  await lightbox.getByRole("button", { name: "Zatvori" }).click();
  await expect(lightbox).toBeHidden();
  await expect(drawer).toBeVisible();
});

test("a staff member deletes photos from a note's thumbnails and from the lightbox", async ({
  page,
}) => {
  const { drawer, serviceId } = await openServiceLog(page, "Vesna Vasić");
  await postPhotoNote(page, serviceId, "Napukao ekran", 2);
  await postPhotoNote(page, serviceId, null, 1);
  await page.reload();
  await drawer.getByRole("tab", { name: "Dnevnik" }).click();

  const entries = drawer.getByTestId("log-entry");
  const strip = drawer.getByRole("region", { name: "Fotografije" });
  const confirm = page.getByRole("dialog", { name: "Obrisati fotografiju?" });
  const lightbox = page.getByRole("dialog", { name: "Pregled fotografija" });
  await expect(strip.getByRole("img")).toHaveCount(3);

  // Nothing is deleted until it is confirmed.
  await entries.first().getByRole("button", { name: "Obriši fotografiju 1" }).click();
  await confirm.getByRole("button", { name: "Otkaži" }).click();
  await expect(confirm).toBeHidden();
  await expect(entries.first().getByRole("img")).toHaveCount(2);

  // From a note's thumbnail: it leaves the note and the strip, and the note keeps its text.
  await entries.first().getByRole("button", { name: "Obriši fotografiju 1" }).click();
  await confirm.getByRole("button", { name: "Obriši" }).click();
  await expect(confirm).toBeHidden();
  await expect(entries.first().getByRole("img")).toHaveCount(1);
  await expect(entries.first()).toContainText("Napukao ekran");
  await expect(strip.getByRole("img")).toHaveCount(2);

  // From the lightbox: cancelling goes back to the same photo.
  await strip.getByRole("button", { name: "Fotografija 2" }).click();
  await lightbox.getByRole("button", { name: "Obriši fotografiju" }).click();
  await expect(lightbox).toBeHidden();
  await confirm.getByRole("button", { name: "Otkaži" }).click();
  await expect(lightbox.locator(".yarl__slide_current")).toHaveAccessibleName("2 od 2");

  // The last photo of a note with no text takes the note with it.
  await lightbox.getByRole("button", { name: "Obriši fotografiju" }).click();
  await confirm.getByRole("button", { name: "Obriši" }).click();
  await expect(confirm).toBeHidden();
  await expect(lightbox).toBeHidden();
  await expect(entries).toHaveCount(1);
  await expect(strip.getByRole("img")).toHaveCount(1);
  await expect(drawer).toBeVisible();
});

test("a staff member registers a service with photos of its condition at intake, kept through a failed save", async ({
  page,
}) => {
  await logIn(page);
  await expect(page).toHaveURL("/services");
  const post = async (path: string, data: object) =>
    (await page.request.post(path, { data })).json();
  const customer = await post("/api/customers", { name: "Dragana Dragić", phone: "0612" });
  await post("/api/devices", {
    manufacturer: "Samsung",
    model: "Galaxy A54",
    ownerId: customer.id,
  });

  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Novi servis" });
  await addDialog.getByLabel("Mušterija *").fill("Dragana Dragić");
  await page.getByRole("option", { name: /^Dragana Dragić/ }).click();
  await addDialog.getByLabel("Uređaji *").fill("Galaxy A54");
  await page.getByRole("option", { name: /^Samsung Galaxy A54/ }).click();

  await expect(addDialog.getByRole("group", { name: "Stanje pri prijemu" })).toBeVisible();
  await addDialog.getByLabel("Beleška o stanju pri prijemu").fill("Napukao ekran u donjem uglu");
  await addDialog
    .getByLabel("Fotografije za belešku")
    .setInputFiles([image("photo.jpg", "image/jpeg"), image("photo.webp", "image/webp")]);
  const picked = addDialog.getByRole("list", { name: "Izabrane fotografije" }).getByRole("img");
  await expect(picked).toHaveCount(2);

  // The first save fails; the form keeps everything, photos included.
  await page.route(
    "**/api/services",
    (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, json: { error: "Internal server error" } })
        : route.fallback(),
    { times: 1 },
  );
  const add = addDialog.getByRole("button", { name: "Dodaj servis" });
  await add.click();
  await expect(page.getByText("Čuvanje servisa nije uspelo. Pokušajte ponovo.")).toBeVisible();
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByLabel("Beleška o stanju pri prijemu")).toHaveValue(
    "Napukao ekran u donjem uglu",
  );
  await expect(picked).toHaveCount(2);

  // The retry registers the service with its intake note and photos.
  const [created] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith("/api/services") && response.status() === 201,
    ),
    add.click(),
  ]);
  const service = await created.json();
  await expect(addDialog).toBeHidden();
  await page
    .getByRole("dialog", { name: "Odštampati prijemnicu?" })
    .getByRole("button", { name: "Ne sada" })
    .click();

  await page.goto(`/services?service=${service.id}`);
  const drawer = page.getByRole("dialog", { name: `Servis ${service.number}` });
  await expect(drawer.getByRole("region", { name: "Fotografije" }).getByRole("img")).toHaveCount(2);
  await drawer.getByRole("tab", { name: "Dnevnik" }).click();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Napukao ekran u donjem uglu");
  await expect(entries.first()).toContainText("E2E Staff");
  await expect(entries.first().getByRole("img")).toHaveCount(2);

  // A new service's form starts without the previous intake photos.
  await page.goto("/services");
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(addDialog.getByLabel("Beleška o stanju pri prijemu")).toHaveValue("");
  await expect(picked).toHaveCount(0);
});
