import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useDelayedFlag } from "@/lib/useDelayedFlag";

/** How long a refresh may take before it is shown, so fast ones don't flicker. */
const SHOW_AFTER_MS = 200;

type LoadingRegionProps = {
  /** New data is loading while the old is still shown, e.g. the next page or a new search. */
  refreshing: boolean;
  children: React.ReactNode;
};

/**
 * Data that stays on screen while newer data loads: it can't be clicked or
 * focused, and once the wait is noticeable it is dimmed with a progress bar
 * running along its top edge until the new data arrives.
 */
export function LoadingRegion({ refreshing, children }: LoadingRegionProps) {
  const { t } = useTranslation();
  const shown = useDelayedFlag(refreshing, SHOW_AFTER_MS);

  // Stale rows are about to change: opening or editing one would act on the wrong data.
  // React 18 has no `inert` prop, so it is set on the element.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = refreshing;
  }, [refreshing]);

  return (
    <div className="relative" aria-busy={refreshing}>
      {shown && (
        <div
          role="progressbar"
          aria-label={t("Loading…")}
          className="absolute inset-x-0 top-0 z-10 h-[3px] overflow-hidden bg-primary/25"
        >
          <div className="h-full w-1/3 animate-progress bg-primary motion-reduce:w-full motion-reduce:animate-pulse" />
        </div>
      )}
      <div
        ref={contentRef}
        className={cn("transition-opacity duration-200", shown && "select-none opacity-50")}
      >
        {children}
      </div>
    </div>
  );
}
