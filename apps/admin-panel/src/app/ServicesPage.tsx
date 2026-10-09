import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LayoutGrid, Loader2, Plus, Table2 } from "lucide-react";
import { useServicesInfiniteQuery } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ServiceDrawer } from "@/components/ServiceDrawer";
import { ServiceFormDialog } from "@/components/ServiceFormDialog";
import { ServicesList, type ServicesView } from "@/components/ServicesList";

const VIEW_STORAGE_KEY = "servicebook-services-view";
const SERVICE_PARAM = "service";

function readSavedView(): ServicesView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

function saveView(view: ServicesView) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies to this visit.
  }
}

/** Marks a history entry pushed by opening the drawer, so closing it can go back instead. */
type DrawerState = { openedFromList?: boolean } | null;

/**
 * The open service lives in the `?service=<id>` URL param, so a deep link
 * opens it and the back button closes it.
 */
function useOpenServiceParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const openServiceId = searchParams.get(SERVICE_PARAM);

  function openService(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set(SERVICE_PARAM, id);
    // Switching from one open service to another replaces the entry.
    setSearchParams(next, {
      replace: openServiceId !== null,
      state: { openedFromList: true } satisfies DrawerState,
    });
  }

  function closeService() {
    if ((location.state as DrawerState)?.openedFromList) {
      navigate(-1);
      return;
    }
    // A deep link has no list entry to go back to.
    const next = new URLSearchParams(searchParams);
    next.delete(SERVICE_PARAM);
    setSearchParams(next, { replace: true });
  }

  return { openServiceId, openService, closeService };
}

export function ServicesPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<ServicesView>(readSavedView);
  const [creating, setCreating] = useState(false);
  const { openServiceId, openService, closeService } = useOpenServiceParam();

  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useServicesInfiniteQuery();
  const services = data?.pages.flatMap((page) => page.items) ?? [];

  // Loads the next page when the end of the list scrolls into view.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function changeView(next: ServicesView) {
    setView(next);
    saveView(next);
  }

  const viewButtonClass = (option: ServicesView) =>
    cn("h-9 w-9", view === option && "bg-accent text-accent-foreground");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Services")}</h1>
        <div className="flex items-center gap-3">
          <div role="group" aria-label={t("View")} className="flex rounded-md border bg-card p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={viewButtonClass("table")}
              aria-label={t("Table view")}
              aria-pressed={view === "table"}
              onClick={() => changeView("table")}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={viewButtonClass("cards")}
              aria-label={t("Card view")}
              aria-pressed={view === "cards"}
              onClick={() => changeView("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t("Add")}
          </Button>
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load services.")}</p>
      ) : (
        <>
          <ServicesList
            services={services}
            view={view}
            onOpen={(service) => openService(service.id)}
            emptyMessage={isPending ? t("Loading…") : t("No services yet.")}
          />
          <div ref={sentinelRef} />
          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Load more")}
              </Button>
            </div>
          )}
        </>
      )}

      <ServiceDrawer serviceId={openServiceId} onClose={closeService} />
      <ServiceFormDialog open={creating} onOpenChange={setCreating} />
    </section>
  );
}
