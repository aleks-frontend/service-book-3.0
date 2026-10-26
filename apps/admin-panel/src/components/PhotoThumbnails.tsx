import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import Lightbox, { IconButton, type ControllerRef } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import type { Photo } from "@servicebook/schemas";
import { photoUrl, thumbnailUrl } from "@/lib/photos";
import { useDeletePhotoMutation } from "@/lib/services";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

declare module "yet-another-react-lightbox" {
  // The toolbar's delete button, translated through `labels` like the built-in ones.
  interface Labels {
    "Delete photo"?: string;
  }
}

type PhotoThumbnailsProps = {
  /** The service whose log the photos are in. */
  serviceId: string;
  photos: Photo[];
  className?: string;
};

/**
 * A row of photo thumbnails. Clicking one opens it large in a lightbox that
 * pages through these photos, with zoom, swipe and the arrow keys. Each photo
 * can be deleted, from its thumbnail or from the lightbox, once confirmed.
 */
export function PhotoThumbnails({ serviceId, photos, className }: PhotoThumbnailsProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const controller = useRef<ControllerRef>(null);
  const [index, setIndex] = useState(-1);
  const open = index >= 0;
  const alt = (n: number) => t("Photo {{n}}", { n: n + 1 });
  const deletePhoto = useDeletePhotoMutation(serviceId);
  // The photo being confirmed, and where the lightbox was if it was asked from there.
  const [confirming, setConfirming] = useState<{
    photo: Photo;
    lightboxIndex: number | null;
  } | null>(null);

  function askToDelete(photo: Photo, lightboxIndex: number | null) {
    setConfirming({ photo, lightboxIndex });
    // The confirmation is a dialog of its own, which the lightbox would cover.
    setIndex(-1);
  }

  function cancelDelete() {
    if (confirming?.lightboxIndex != null) setIndex(confirming.lightboxIndex);
    setConfirming(null);
  }

  function confirmDelete() {
    if (!confirming) return;
    deletePhoto.mutate(confirming.photo.id, { onSettled: () => setConfirming(null) });
  }

  // The drawer is a Radix dialog that closes on Escape, listening on the
  // document; while the lightbox is open, Escape closes the lightbox only.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      controller.current?.close();
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open]);

  return (
    <>
      <ul ref={listRef} className={cn("flex flex-wrap gap-2", className)} aria-label={t("Photos")}>
        {photos.map((photo, n) => (
          <li key={photo.id} className="relative">
            <button
              type="button"
              className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setIndex(n)}
            >
              <img
                src={thumbnailUrl(photo.id)}
                alt={alt(n)}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="h-20 w-20 rounded-md border object-cover"
              />
            </button>
            <button
              type="button"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-card text-foreground hover:border-foreground disabled:opacity-50"
              aria-label={t("Delete photo {{n}}", { n: n + 1 })}
              disabled={deletePhoto.isPending}
              onClick={() => askToDelete(photo, null)}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox
        open={open}
        index={Math.max(index, 0)}
        close={() => setIndex(-1)}
        on={{ view: ({ index }) => setIndex(index) }}
        controller={{ ref: controller }}
        slides={photos.map((photo, n) => ({
          src: photoUrl(photo.id),
          width: photo.width,
          height: photo.height,
          alt: alt(n),
        }))}
        plugins={[Zoom]}
        toolbar={{
          buttons: [
            <IconButton
              key="delete"
              label="Delete photo"
              icon={Trash2}
              disabled={deletePhoto.isPending}
              onClick={() => askToDelete(photos[index], index)}
            />,
            "close",
          ],
        }}
        // Fast and mechanical, like the drawer and the dialogs (ADR-0005).
        animation={{ fade: 80, swipe: 160 }}
        carousel={{ finite: true }}
        // One photo has nowhere to page to.
        render={
          photos.length === 1 ? { buttonPrev: () => null, buttonNext: () => null } : undefined
        }
        // Inside the drawer, so the dialog's focus trap and click-outside leave it be.
        portal={{ root: () => listRef.current?.closest("[role=dialog]") ?? null }}
        labels={{
          Lightbox: t("Photo viewer"),
          "Photo gallery": t("Photos"),
          // How a screen reader announces the carousel and each slide in it.
          Carousel: t("gallery"),
          Slide: t("photo"),
          "{index} of {total}": t("{{index}} of {{total}}", {
            index: "{index}",
            total: "{total}",
          }),
          Previous: t("Previous photo"),
          Next: t("Next photo"),
          Close: t("Close"),
          "Zoom in": t("Zoom in"),
          "Zoom out": t("Zoom out"),
          "Delete photo": t("Delete photo"),
        }}
      />
      <ConfirmDeleteDialog
        open={confirming !== null}
        // Once the delete is sent, Escape or a click outside can't back out of it.
        onOpenChange={(open) => !open && !deletePhoto.isPending && cancelDelete()}
        title={t("Delete photo?")}
        description={t("The photo will be permanently deleted.")}
        isDeleting={deletePhoto.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
