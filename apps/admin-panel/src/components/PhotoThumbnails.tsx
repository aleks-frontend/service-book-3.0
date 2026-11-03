import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import Lightbox, { IconButton, type ControllerRef } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import type { Photo } from "@servicebook/schemas";
import { fitPhotoStrip } from "@/lib/photoStrip";
import { photoUrl, thumbnailUrl } from "@/lib/photos";
import { useDeletePhotoMutation } from "@/lib/services";
import { useElementWidth } from "@/lib/useElementWidth";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

declare module "yet-another-react-lightbox" {
  // The toolbar's delete button, translated through `labels` like the built-in ones.
  interface Labels {
    "Delete photo"?: string;
  }
}

// What a compact line is fitted with, in px: keep them in step with `h-[72px] w-[72px]` and `gap-2`.
const COMPACT_TILE = 72;
const TILE_GAP = 8;

type PhotoThumbnailsProps = {
  /** The service whose log the photos are in. */
  serviceId: string;
  photos: Photo[];
  /**
   * Small tiles on one line, as many of the newest as fit its width, after a "+N" tile
   * for the rest that opens the lightbox at the newest of them. No delete × of their own:
   * deleting is left to the lightbox.
   */
  compact?: boolean;
  className?: string;
};

/**
 * A row of photo thumbnails. Clicking one opens it large in a lightbox that pages
 * through all these photos, with zoom, swipe and the arrow keys. Each photo can be
 * deleted from the lightbox, and unless compact from its thumbnail, once confirmed.
 */
export function PhotoThumbnails({
  serviceId,
  photos,
  compact = false,
  className,
}: PhotoThumbnailsProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement | null>(null);
  const [measureList, listWidth] = useElementWidth<HTMLUListElement>();
  const setList = useCallback(
    (list: HTMLUListElement | null) => {
      listRef.current = list;
      if (compact) measureList(list);
    },
    [compact, measureList],
  );
  const controller = useRef<ControllerRef>(null);
  const [index, setIndex] = useState(-1);
  const open = index >= 0;
  const alt = (n: number) => t("Photo {{n}}", { n: n + 1 });
  // All of them until the line has been measured, which happens before it is painted.
  const { hidden } =
    compact && listWidth !== null
      ? fitPhotoStrip({ width: listWidth, tile: COMPACT_TILE, gap: TILE_GAP, count: photos.length })
      : { hidden: 0 };
  const tile = compact ? "h-[72px] w-[72px]" : "h-20 w-20";
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
      <ul
        ref={setList}
        className={cn("flex gap-2", compact ? "flex-nowrap" : "flex-wrap", className)}
        aria-label={t("Photos")}
      >
        {hidden > 0 && (
          <li>
            <button
              type="button"
              className={cn(
                "flex items-center justify-center rounded-md border bg-card text-sm font-bold hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tile,
              )}
              aria-label={t("Show older photos ({{n}})", { n: hidden })}
              onClick={() => setIndex(hidden - 1)}
            >
              +{hidden}
            </button>
          </li>
        )}
        {photos.slice(hidden).map((photo, shown) => {
          // Counted across all the photos, as the lightbox counts them.
          const n = hidden + shown;
          return (
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
                  className={cn("rounded-md border object-cover", tile)}
                />
              </button>
              {!compact && (
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-card text-foreground hover:border-foreground disabled:opacity-50"
                  aria-label={t("Delete photo {{n}}", { n: n + 1 })}
                  disabled={deletePhoto.isPending}
                  onClick={() => askToDelete(photo, null)}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
            </li>
          );
        })}
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
