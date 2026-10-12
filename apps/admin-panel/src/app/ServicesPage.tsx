import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Loader2, Plus, Search, Table2 } from "lucide-react";
import {
  STATUSES,
  statusSchema,
  type ServiceSort,
  type SortDir,
  type Status,
} from "@servicebook/schemas";
import { useServicesInfiniteQuery } from "@/lib/services";
import { STATUS_LABELS } from "@/lib/statuses";
import { useOpenServiceParam } from "@/lib/useOpenServiceParam";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServiceDrawer } from "@/components/ServiceDrawer";
import { ServiceFormDialog } from "@/components/ServiceFormDialog";
import { ServicesList, type ServicesView } from "@/components/ServicesList";

const VIEW_STORAGE_KEY = "servicebook-services-view";
const SEARCH_DEBOUNCE_MS = 300;
/** The status filter's value for "any status"; a select item's value cannot be empty. */
const ALL_STATUSES = "ALL";

/** The sort menu's choices, each a sort key and a direction. */
const SORT_OPTIONS = {
  "date-desc": { sort: "date", sortDir: "desc", label: "Newest first" },
  "date-asc": { sort: "date", sortDir: "asc", label: "Oldest first" },
  "customer-asc": { sort: "customer", sortDir: "asc", label: "Customer A–Z" },
  "customer-desc": { sort: "customer", sortDir: "desc", label: "Customer Z–A" },
} satisfies Record<string, { sort: ServiceSort; sortDir: SortDir; label: string }>;
type SortOption = keyof typeof SORT_OPTIONS;

function isSortOption(value: string): value is SortOption {
  return value in SORT_OPTIONS;
}

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

export function ServicesPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<ServicesView>(readSavedView);
  const [creating, setCreating] = useState(false);
  const { openServiceId, openService, closeService } = useOpenServiceParam();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { sort, sortDir } = SORT_OPTIONS[sortOption];
  const {
    data,
    isPending,
    isPlaceholderData,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useServicesInfiniteQuery({ search, status: status ?? undefined, sort, sortDir });
  const services = data?.pages.flatMap((page) => page.items) ?? [];

  // Loads the next page when the end of the list scrolls into view.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    // While a new search's results load, the previous ones are shown but not paged further.
    if (!sentinel || !hasNextPage || isPlaceholderData) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isPlaceholderData, isFetchingNextPage, fetchNextPage]);

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("Search by number, customer, phone, device or description")}
            aria-label={t("Search services")}
            className="pl-9"
          />
        </div>
        <Select
          value={status ?? ALL_STATUSES}
          onValueChange={(value) => {
            const parsed = statusSchema.safeParse(value);
            setStatus(parsed.success ? parsed.data : null);
          }}
        >
          <SelectTrigger className="w-44" aria-label={t("Filter by status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t("All statuses")}</SelectItem>
            {STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {t(STATUS_LABELS[option])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortOption}
          onValueChange={(value) => {
            if (isSortOption(value)) setSortOption(value);
          }}
        >
          <SelectTrigger className="w-44" aria-label={t("Sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_OPTIONS).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>
                {t(label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load services.")}</p>
      ) : (
        <>
          <ServicesList
            services={services}
            view={view}
            onOpen={(service) => openService(service.id)}
            emptyMessage={
              isPending
                ? t("Loading…")
                : search || status
                  ? t("No services match your search.")
                  : t("No services yet.")
            }
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
