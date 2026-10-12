import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { Service } from "@servicebook/schemas";
import { formatPlainDate, formatRsd } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

type ServiceHistoryProps<T extends Service> = {
  /** Undefined while loading. */
  services: T[] | undefined;
  isError: boolean;
  emptyMessage: string;
  /** The line under the service number, e.g. its devices or its customer. */
  describe: (service: T) => ReactNode;
  onOpen: (service: T) => void;
};

/** A customer's or device's services, newest first, each opening its own drawer. */
export function ServiceHistory<T extends Service>({
  services,
  isError,
  emptyMessage,
  describe,
  onOpen,
}: ServiceHistoryProps<T>) {
  const { t, i18n } = useTranslation();

  return (
    <section className="space-y-2" aria-label={t("Service history")}>
      <h3 className="text-sm font-semibold">
        {t("Service history")}
        {services && services.length > 0 && (
          <span className="ml-1.5 font-normal text-muted-foreground">({services.length})</span>
        )}
      </h3>
      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load the service history.")}</p>
      ) : services === undefined ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {services.map((service) => (
            <li key={service.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                onClick={() => onOpen(service)}
              >
                <div className="min-w-0 space-y-0.5">
                  <div>
                    <span className="font-medium tabular-nums">{service.number}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatPlainDate(service.date, i18n.language)}
                    </span>
                  </div>
                  <div className="truncate text-muted-foreground">{describe(service)}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={service.status} />
                  <span className="tabular-nums">{formatRsd(service.total, i18n.language)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
