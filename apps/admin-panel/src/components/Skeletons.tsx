import { useTranslation } from "react-i18next";
import { TableCell, TableRow } from "./ui/table";

/** How many placeholder rows or cards stand in for a page that hasn't loaded yet. */
const PLACEHOLDER_COUNT = 5;

/** Grey bars in the shape of the rows to come, while a table's first page loads. */
export function TableSkeletonRows({ columns }: { columns: number }) {
  const { t } = useTranslation();

  return Array.from({ length: PLACEHOLDER_COUNT }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      {Array.from({ length: columns }, (_, column) => (
        <TableCell key={column} className="py-3">
          {row === 0 && column === 0 && <span className="sr-only">{t("Loading…")}</span>}
          <div
            className="h-4 animate-pulse rounded bg-muted motion-reduce:animate-none"
            aria-hidden
          />
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
        <li key={card} className="space-y-3 rounded-md border bg-card p-4" aria-hidden>
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}
