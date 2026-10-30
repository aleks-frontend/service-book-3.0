import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { today } from "./dates.js";
import { logIn } from "./logIn.js";

// The UI defaults to Serbian (sr).

const IMAGES = "apps/backend/test/fixtures/images";

/** A fixture as a file to pick; `setInputFiles` can't mix paths with buffers. */
function image(file: string, mimeType: string, name = file) {
  return { name, mimeType, buffer: readFileSync(`${IMAGES}/${file}`) };
}

/** A file that isn't an image, which a note can't carry. */
const PDF = { name: "racun.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") };

/** A fixture file, as `image` builds one. */
type Fixture = ReturnType<typeof image>;

/**
 * Fires a clipboard or drag event of `type` at `target`, carrying a
 * `DataTransfer` built in the page: of `files`, or of `text` when dragging a
 * selection. Returns whether the event was taken over, i.e. kept from the
 * browser.
 */
async function fire(
  target: Locator,
  type: "paste" | "dragenter" | "dragover" | "dragleave" | "drop",
  { files = [], text }: { files?: Fixture[]; text?: string },
) {
  return target.evaluate(
    (element, { type, files, text }) => {
      const data = new DataTransfer();
      for (const { name, mimeType, base64 } of files) {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        data.items.add(new File([bytes], name, { type: mimeType }));
      }
      if (text !== undefined) data.setData("text/plain", text);
      const init = { bubbles: true, cancelable: true };
      const event =
        type === "paste"
          ? new ClipboardEvent(type, { ...init, clipboardData: data })
          : new DragEvent(type, { ...init, dataTransfer: data });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    },
    {
      type,
      text,
      files: files.map(({ name, mimeType, buffer }) => ({
        name,
        mimeType,
        base64: buffer.toString("base64"),
      })),
    },
  );
}

/** Pastes files into `target` as Ctrl+V (⌘+V) would. Returns whether the paste was taken over. */
function paste(target: Locator, files: Fixture[]) {
  return fire(target, "paste", { files });
}

/** Fires a drag event of `type` at `target`, of `files` or of selected `text`. Returns whether it was taken over. */
function drag(
  target: Locator,
  type: "dragenter" | "dragover" | "dragleave" | "drop",
  data: { files?: Fixture[]; text?: string },
) {
  return fire(target, type, data);
}

/** Drops `files` onto `target` as dragging them from a file manager would: entering, moving over, then dropping. */
async function drop(target: Locator, files: Fixture[]) {
  await drag(target, "dragenter", { files });
  await drag(target, "dragover", { files });
  return drag(target, "drop", { files });
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
  await drawer.getByRole("tab", { name: "Dnevnik rada" }).click();
  return { drawer, serviceId: service.id as string };
}

test("a staff member adds a note with photos from the drawer, shrunk before upload, and sees them", async ({
  page,
}) => {
  const { drawer, serviceId } = await openServiceLog(page, "Jelena Jović");
  const composer = drawer.getByTestId("note-composer");
  const picked = composer.getByRole("list", { name: "Izabrane fotografije" }).getByRole("img");
  // The note's text and its Photos button share one box; "Add note" is outside it.
  await expect(composer.getByLabel("Beleška")).toBeVisible();
  await expect(composer.getByRole("button", { name: "Fotografije", exact: true })).toBeEnabled();
  await expect(composer.getByRole("button", { name: "Dodaj belešku" })).toHaveCount(0);
  await expect(composer.getByLabel("Beleška")).toHaveAttribute(
    "placeholder",
    "Dodajte internu belešku ili fotografije…",
  );
  // No photo picked, no counter.
  const counter = composer.getByText(/^\d+\/10$/);
  await expect(counter).toHaveCount(0);
  // Clicking an empty part of the box, right of the Photos button, puts the cursor in the text.
  const box = (await composer.boundingBox())!;
  await composer.click({ position: { x: box.width - 8, y: box.height - 8 } });
  await expect(composer.getByLabel("Beleška")).toBeFocused();

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
  await expect(counter).toHaveText("2/10");
  await expect(composer.getByText("2 od 10 fotografija")).toBeAttached();

  // A picked photo can be removed before posting.
  await drawer.getByRole("button", { name: "Ukloni: photo.webp" }).click();
  await expect(picked).toHaveCount(1);
  await expect(counter).toHaveText("1/10");
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
  await expect(counter).toHaveCount(0);

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
  const composer = drawer.getByTestId("note-composer");
  await expect(composer.getByText("10/10")).toBeVisible();
  await expect(composer.getByRole("button", { name: "Fotografije", exact: true })).toBeDisabled();

  // No text is needed when there are photos.
  await add.click();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first().getByRole("img")).toHaveCount(10);
  // The counter goes with the photos.
  await expect(composer.getByText("10/10")).toHaveCount(0);
});

test("a staff member pastes photos into the note's text, shrunk before upload like picked ones", async ({
  page,
}) => {
  const { drawer, serviceId } = await openServiceLog(page, "Petar Perić");
  const composer = drawer.getByTestId("note-composer");
  const text = composer.getByLabel("Beleška");
  const picked = composer.getByRole("list", { name: "Izabrane fotografije" }).getByRole("img");
  const onlyPhotos = page.getByText("Belešci se mogu dodati samo fotografije.");

  // Plain text pastes as before.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => navigator.clipboard.writeText("Ne pali se"));
  await text.focus();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(text).toHaveValue("Ne pali se");

  // Several images at once; a file that isn't one is skipped with a toast, the images still added.
  expect(
    await paste(text, [image("large.jpg", "image/jpeg"), PDF, image("photo.webp", "image/webp")]),
  ).toBe(true);
  await expect(onlyPhotos).toBeVisible();
  await expect(picked).toHaveCount(2);
  await expect(picked.first()).toHaveAccessibleName("large.jpg");
  await expect(composer.getByText("2/10")).toBeVisible();
  // Nothing went into the text.
  await expect(text).toHaveValue("Ne pali se");

  // Only a file that isn't an image: nothing is added, not even its name to the text, and the toast says why.
  await expect(onlyPhotos).toBeHidden({ timeout: 10_000 });
  expect(await paste(text, [PDF])).toBe(true);
  await expect(onlyPhotos).toBeVisible();
  await expect(picked).toHaveCount(2);

  // Pasted photos count towards the limit, the first ones that fit kept.
  await paste(
    text,
    Array.from({ length: 9 }, (_, n) => image("photo.jpg", "image/jpeg", `photo-${n + 1}.jpg`)),
  );
  await expect(page.getByText("Beleška može imati najviše 10 fotografija.")).toBeVisible();
  await expect(picked).toHaveCount(10);
  await expect(composer.getByText("10/10")).toBeVisible();

  await drawer.getByRole("button", { name: "Dodaj belešku" }).click();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Ne pali se");
  await expect(entries.first().getByRole("img")).toHaveCount(10);

  // The 4000 × 3000 fixture was shrunk to 2048 px on its long edge before upload.
  const log = await (await page.request.get(`/api/services/${serviceId}/log`)).json();
  expect(log[0].photos[0]).toEqual({ id: expect.any(String), width: 2048, height: 1536 });
});

test("pasting into the note while it is saving adds nothing", async ({ page }) => {
  const { drawer } = await openServiceLog(page, "Sava Savić");
  const text = drawer.getByLabel("Beleška");
  await text.fill("Zamenjena baterija");

  // The note's post hangs until released.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/services/*/log", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await held;
    await route.fallback();
  });
  await drawer.getByRole("button", { name: "Dodaj belešku" }).click();
  await expect(drawer.getByRole("button", { name: "Dodaj belešku" })).toBeDisabled();

  await paste(text, [image("photo.jpg", "image/jpeg")]);
  await expect(drawer.getByRole("list", { name: "Izabrane fotografije" })).toHaveCount(0);

  release();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first().getByRole("img")).toHaveCount(0);
});

test("a staff member drops photos onto the note, highlighted while dragged over, shrunk before upload like picked ones", async ({
  page,
}) => {
  const { drawer, serviceId } = await openServiceLog(page, "Marko Marković");
  const composer = drawer.getByTestId("note-composer");
  const text = composer.getByLabel("Beleška");
  const photosButton = composer.getByRole("button", { name: "Fotografije", exact: true });
  const picked = composer.getByRole("list", { name: "Izabrane fotografije" }).getByRole("img");
  const onlyPhotos = page.getByText("Belešci se mogu dodati samo fotografije.");
  const photo = [image("photo.jpg", "image/jpeg")];
  await text.fill("Pukla maska");

  // Dragging selected text over the box doesn't highlight it, nor is it taken over.
  expect(await drag(composer, "dragenter", { text: "Pukla" })).toBe(false);
  await expect(composer).not.toHaveAttribute("data-drag-over");
  await drag(composer, "dragleave", { text: "Pukla" });

  // Files dragged over the box highlight it, and moving over its children doesn't clear that.
  await drag(composer, "dragenter", { files: photo });
  await expect(composer).toHaveAttribute("data-drag-over");
  expect(await drag(composer, "dragover", { files: photo })).toBe(true);
  await drag(text, "dragenter", { files: photo });
  await drag(composer, "dragleave", { files: photo });
  await expect(composer).toHaveAttribute("data-drag-over");
  await drag(photosButton, "dragenter", { files: photo });
  await drag(text, "dragleave", { files: photo });
  await expect(composer).toHaveAttribute("data-drag-over");
  // Leaving the box clears it, and nothing is added.
  await drag(photosButton, "dragleave", { files: photo });
  await expect(composer).not.toHaveAttribute("data-drag-over");
  await expect(picked).toHaveCount(0);

  // Several images dropped at once; a file that isn't one is skipped with a toast, the images still added.
  expect(
    await drop(text, [image("large.jpg", "image/jpeg"), PDF, image("photo.webp", "image/webp")]),
  ).toBe(true);
  await expect(composer).not.toHaveAttribute("data-drag-over");
  await expect(onlyPhotos).toBeVisible();
  await expect(picked).toHaveCount(2);
  await expect(picked.first()).toHaveAccessibleName("large.jpg");
  await expect(composer.getByText("2/10")).toBeVisible();
  await expect(text).toHaveValue("Pukla maska");

  // Only a file that isn't an image: nothing is added, and the toast says why.
  await expect(onlyPhotos).toBeHidden({ timeout: 10_000 });
  await drop(composer, [PDF]);
  await expect(onlyPhotos).toBeVisible();
  await expect(picked).toHaveCount(2);

  // Dropped photos count towards the limit, the first ones that fit kept.
  await drop(
    photosButton,
    Array.from({ length: 9 }, (_, n) => image("photo.jpg", "image/jpeg", `photo-${n + 1}.jpg`)),
  );
  await expect(page.getByText("Beleška može imati najviše 10 fotografija.")).toBeVisible();
  await expect(picked).toHaveCount(10);
  await expect(composer.getByText("10/10")).toBeVisible();

  await drawer.getByRole("button", { name: "Dodaj belešku" }).click();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Pukla maska");
  await expect(entries.first().getByRole("img")).toHaveCount(10);

  // The 4000 × 3000 fixture was shrunk to 2048 px on its long edge before upload.
  const log = await (await page.request.get(`/api/services/${serviceId}/log`)).json();
  expect(log[0].photos[0]).toEqual({ id: expect.any(String), width: 2048, height: 1536 });
});

test("dropping onto the note while it is saving adds nothing, and the box isn't highlighted", async ({
  page,
}) => {
  const { drawer } = await openServiceLog(page, "Nikola Nikolić");
  const composer = drawer.getByTestId("note-composer");
  await drawer.getByLabel("Beleška").fill("Zamenjen konektor");

  // The note's post hangs until released.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/services/*/log", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await held;
    await route.fallback();
  });
  await drawer.getByRole("button", { name: "Dodaj belešku" }).click();
  await expect(drawer.getByRole("button", { name: "Dodaj belešku" })).toBeDisabled();

  const photo = [image("photo.jpg", "image/jpeg")];
  await drag(composer, "dragenter", { files: photo });
  await drag(composer, "dragover", { files: photo });
  await expect(composer).not.toHaveAttribute("data-drag-over");
  await drag(composer, "drop", { files: photo });
  await expect(drawer.getByRole("list", { name: "Izabrane fotografije" })).toHaveCount(0);

  release();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first().getByRole("img")).toHaveCount(0);
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
  await drawer.getByRole("tab", { name: "Dnevnik rada" }).click();

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
  await drawer.getByRole("tab", { name: "Dnevnik rada" }).click();

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
  // The intake note is a composer too: its text, previews and Photos button in one box.
  const composer = addDialog.getByTestId("note-composer");
  await expect(composer.getByLabel("Beleška o stanju pri prijemu")).toHaveAttribute(
    "placeholder",
    "Ogrebotine, pukotine, udubljenja… ili dodajte fotografije. Čuva se kao prva beleška u dnevniku.",
  );
  await composer.getByLabel("Beleška o stanju pri prijemu").fill("Napukao ekran u donjem uglu");
  await expect(composer.getByRole("button", { name: "Fotografije", exact: true })).toBeEnabled();
  // One photo picked, one pasted into the note's text and one dropped onto the box.
  await addDialog
    .getByLabel("Fotografije za belešku")
    .setInputFiles([image("photo.jpg", "image/jpeg")]);
  await paste(composer.getByLabel("Beleška o stanju pri prijemu"), [
    image("photo.webp", "image/webp"),
  ]);
  await drop(composer, [image("large.jpg", "image/jpeg")]);
  const picked = composer.getByRole("list", { name: "Izabrane fotografije" }).getByRole("img");
  await expect(picked).toHaveCount(3);
  await expect(composer.getByText("3/10")).toBeVisible();

  // The first save fails, after a while; the form keeps everything, photos included.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    "**/api/services",
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      await route.fulfill({ status: 500, json: { error: "Internal server error" } });
    },
    { times: 1 },
  );
  const add = addDialog.getByRole("button", { name: "Dodaj servis" });
  await add.click();
  // While the service is saving, a pasted or dropped photo isn't added.
  await expect(composer.getByRole("button", { name: "Fotografije", exact: true })).toBeDisabled();
  await paste(composer.getByLabel("Beleška o stanju pri prijemu"), [
    image("photo.jpg", "image/jpeg"),
  ]);
  await drop(composer, [image("photo.jpg", "image/jpeg")]);
  await expect(picked).toHaveCount(3);
  release();
  await expect(page.getByText("Čuvanje servisa nije uspelo. Pokušajte ponovo.")).toBeVisible();
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByLabel("Beleška o stanju pri prijemu")).toHaveValue(
    "Napukao ekran u donjem uglu",
  );
  await expect(picked).toHaveCount(3);

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
  await expect(drawer.getByRole("region", { name: "Fotografije" }).getByRole("img")).toHaveCount(3);
  await drawer.getByRole("tab", { name: "Dnevnik rada" }).click();
  const entries = drawer.getByTestId("log-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Napukao ekran u donjem uglu");
  await expect(entries.first()).toContainText("E2E Staff");
  await expect(entries.first().getByRole("img")).toHaveCount(3);

  // A new service's form starts without the previous intake photos.
  await page.goto("/services");
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(addDialog.getByLabel("Beleška o stanju pri prijemu")).toHaveValue("");
  await expect(picked).toHaveCount(0);
});
