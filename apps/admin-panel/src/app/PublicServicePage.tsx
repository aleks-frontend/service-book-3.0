import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { deviceLabel, type PublicService } from "@servicebook/schemas";
import { formatAmount, formatPlainDate, formatRsd } from "@/lib/format";
import { usePublicServiceQuery } from "@/lib/publicServices";
import { cn } from "@/lib/utils";
import { BrandBar } from "@/components/BrandBar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/Skeletons";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Narrower cells on a phone, so every column but the unit price fits without scrolling. */
const CELL = "px-2 sm:px-4";
const AMOUNT = cn(CELL, "text-right");
/** The unit price follows from the quantity and line total, so a phone leaves it out. */
const UNIT_PRICE = cn(AMOUNT, "hidden sm:table-cell");

/**
 * The read-only page a customer reaches by scanning the QR code on their
 * intake receipt or service report: no login, nothing about the customer
 * and nothing internal (ADR-0001, ADR-0003).
 */
export function PublicServicePage() {
  const { publicToken = "" } = useParams();
  const { data: service, error, isPending } = usePublicServiceQuery(publicToken);

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 p-4 sm:py-10">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border bg-card">
        <BrandBar className="px-4 sm:px-6" />
        <main className="space-y-6 p-4 sm:p-6">
          {service ? (
            <ServiceStatus service={service} />
          ) : isPending ? (
            <StatusSkeleton />
          ) : (
            <Unavailable notFound={error?.status === 404} />
          )}
        </main>
      </div>
      <div className="flex gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>
  );
}

function ServiceStatus({ service }: { service: PublicService }) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-title tabular-nums">
            {t("Service {{number}}", { number: service.number })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatPlainDate(service.date, i18n.language)}
          </p>
        </div>
        <StatusBadge status={service.status} className="text-sm" />
      </header>

      <Section id="devices" title={t("Devices on service")}>
        <ul className="divide-y">
          {service.devices.map((device, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
              <span className="font-medium">{deviceLabel(device)}</span>
              {device.serialNumber && (
                <span className="text-muted-foreground">
                  {t("S/N {{serialNumber}}", { serialNumber: device.serialNumber })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="work-and-sales" title={t("Work and sales")}>
        <Table aria-labelledby="work-and-sales">
          <TableHeader>
            <TableRow>
              <TableHead className={CELL}>{t("Description")}</TableHead>
              <TableHead className={AMOUNT}>{t("Quantity")}</TableHead>
              <TableHead className={UNIT_PRICE}>{t("Unit price (RSD)")}</TableHead>
              <TableHead className={AMOUNT}>{t("Line total (RSD)")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {service.lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className={cn(CELL, "text-muted-foreground")}>
                  {t("No work or sales recorded yet.")}
                </TableCell>
              </TableRow>
            )}
            {service.lines.map((line, index) => (
              <TableRow key={index}>
                <TableCell className={CELL}>{line.label}</TableCell>
                <TableCell className={AMOUNT}>{line.quantity}</TableCell>
                <TableCell className={UNIT_PRICE}>
                  {formatAmount(line.unitPrice, i18n.language)}
                </TableCell>
                <TableCell className={AMOUNT}>
                  {formatAmount(line.quantity * line.unitPrice, i18n.language)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              {/* Under the quantity and, on a wider screen, the unit price. */}
              <TableCell colSpan={2} className={cn(AMOUNT, "sm:hidden")}>
                {t("Total")}
              </TableCell>
              <TableCell colSpan={3} className={cn(AMOUNT, "hidden sm:table-cell")}>
                {t("Total")}
              </TableCell>
              <TableCell className={cn(AMOUNT, "whitespace-nowrap")}>
                {formatRsd(service.total, i18n.language)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Section>

      {service.customerReport && (
        <Section id="customer-report" title={t("Customer report")}>
          <p className="whitespace-pre-line text-sm">{service.customerReport}</p>
        </Section>
      )}
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 id={id} className="border-b-2 border-foreground pb-1 text-sm font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <span className="sr-only">{t("Loading…")}</span>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="w-32" />
      <Skeleton className="h-24" />
    </div>
  );
}

/** The same for a token that never existed and one whose service was deleted. */
function Unavailable({ notFound }: { notFound: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <LogoMark className="h-10 w-10" />
      <h1 className="font-display text-3xl font-extrabold leading-none">
        {notFound ? t("Service not found") : t("Could not load the service")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {notFound
          ? t("Check the link, or ask the shop for a new one.")
          : t("Could not reach the server. Please try again.")}
      </p>
    </div>
  );
}
