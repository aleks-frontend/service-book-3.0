import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Lightbox, { type ControllerRef } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import type { Photo } from "@servicebook/schemas";
import { photoUrl, thumbnailUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * A row of photo thumbnails. Clicking one opens it large in a lightbox that
 * pages through these photos, with zoom, swipe and the arrow keys.
 */
export function PhotoThumbnails({ photos, className }: { photos: Photo[]; className?: string }) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const controller = useRef<ControllerRef>(null);
  const [index, setIndex] = useState(-1);
  const open = index >= 0;
  const alt = (n: number) => t("Photo {{n}}", { n: n + 1 });

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
          <li key={photo.id}>
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
          </li>
        ))}
      </ul>
      <Lightbox
        open={open}
        index={Math.max(index, 0)}
        close={() => setIndex(-1)}
        controller={{ ref: controller }}
        slides={photos.map((photo, n) => ({
          src: photoUrl(photo.id),
          width: photo.width,
          height: photo.height,
          alt: alt(n),
        }))}
        plugins={[Zoom]}
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
        }}
      />
    </>
  );
}
