import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import type { Action } from "@servicebook/schemas";
import { formatRsd } from "@/lib/format";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type ActionsTableProps = {
  /** The whole price list, already sorted by name. */
  actions: Action[];
  /** Filters the list by name, ignoring case. */
  search: string;
  onEdit: (action: Action) => void;
  onDelete: (action: Action) => void;
  emptyMessage: string;
  noMatchesMessage: string;
};

/** The price list. Unlike customers, it is short enough to search client-side. */
export function ActionsTable({
  actions,
  search,
  onEdit,
  onDelete,
  emptyMessage,
  noMatchesMessage,
}: ActionsTableProps) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<Action>[]>(
    () => [
      {
        accessorKey: "name",
        // A thing's name, which Serbian words differently from a person's.
        header: t("Name", { context: "action" }),
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: "price",
        header: () => <div className="text-right">{t("Price")}</div>,
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums">
            {formatRsd(getValue<number>(), i18n.language)}
          </div>
        ),
        enableGlobalFilter: false,
      },
      {
        id: "rowActions",
        header: () => <span className="sr-only">{t("Row actions")}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("Edit")}
              onClick={() => onEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("Delete")}
              onClick={() => onDelete(row.original)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [t, i18n.language, onEdit, onDelete],
  );

  const table = useReactTable({
    data: actions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (action) => action.id,
    globalFilterFn: "includesString",
    state: { globalFilter: search.trim() },
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {actions.length === 0 ? emptyMessage : noMatchesMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
