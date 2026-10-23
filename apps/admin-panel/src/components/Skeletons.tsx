import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "./ui/table";

/** How many placeholder rows or cards stand in for a page that hasn't loaded yet. */
const PLACEHOLDER_COUNT = 5;

/** Bar heights, in percent, for a chart that hasn't loaded yet; uneven, so it reads as a chart. */
const CHART_BARS = [45, 70, 55, 85, 40, 65, 90, 60, 75, 50, 80, 35];

/** One grey block where a value will appear; size it with `className`. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("h-4 animate-pulse rounded-sm bg-muted motion-reduce:animate-none", className)}
      style={style}
      aria-hidden
    />
  );
}

/** Grey bars in the shape of the rows to come, while a table's first page loads. */
export function TableSkeletonRows({ columns }: { columns: number }) {
  const { t } = useTranslation();

  return Array.from({ length: PLACEHOLDER_COUNT }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      {Array.from({ length: columns }, (_, column) => (
        <TableCell key={column}>
          {row === 0 && column === 0 && <span className="sr-only">{t("Loading…")}</span>}
          <Skeleton />
        </TableCell>
      ))}
    </TableRow>
  ));
}

/** Grey cards in the shape of the cards to come, while a card list's first page loads. */
export function CardSkeletons({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <ul className={className}>
      <li className="sr-only">{t("Loading…")}</li>
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, card) => (
        // Laid out like a service card: the customer, the devices, the phone, then the footer.
        <li
          key={card}
          className="repair-tag pointer-events-none grid min-w-0 grid-cols-1 gap-1.5"
          aria-hidden
        >
          <div className="flex h-[1.875rem] items-center justify-between gap-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex h-6 items-center">
            <Skeleton className="w-2/3" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-1/4" />
          </div>
          <div className="flex h-[1.6875rem] items-end justify-between gap-2 border-t border-dashed">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-16" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Grey bars in the shape of a bar chart, filling its container, while the chart's data loads. */
export function ChartSkeleton() {
  const { t } = useTranslation();

  return (
    // Padded to where the real chart's axes sit: the amounts on the left, the periods below.
    <div className="h-full pb-6 pl-24 pr-2 pt-2">
      <span className="sr-only">{t("Loading…")}</span>
      <div className="flex h-full items-end gap-2 border-b">
        {CHART_BARS.map((height, bar) => (
          <Skeleton key={bar} className="flex-1 rounded-b-none" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}
