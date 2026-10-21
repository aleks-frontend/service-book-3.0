import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import type { Action, SortDir } from "@servicebook/schemas";
import { formatRsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SELECT_COLUMN_CLASS, selectColumn } from "./selectColumn";
import { TableSkeletonRows } from "./Skeletons";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type ActionsTableProps = {
  actions: Action[];
  sortDir: SortDir;
  onSortDirChange: (sortDir: SortDir) => void;
  /** The checked rows, keyed by action id. */
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onEdit: (action: Action) => void;
  onDelete: (action: Action) => void;
  /** The first page is still loading: placeholder rows show instead of the empty message. */
  loading: boolean;
  emptyMessage: string;
};

/**
 * One page of the price list. Paging, search and sorting happen on the server;
 * the header checkbox selects the rows on this page only.
 */
export function ActionsTable({
  actions,
  sortDir,
  onSortDirChange,
  rowSelection,
  onRowSelectionChange,
  onEdit,
  onDelete,
  loading,
  emptyMessage,
}: ActionsTableProps) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<Action>[]>(
    () => [
      selectColumn<Action>(t, {
        name: (action) => action.name,
        selectAllLabel: t("Select all on this page"),
      }),
      {
        accessorKey: "name",
        header: ({ column }) => {
          const SortIcon = column.getIsSorted() === "desc" ? ArrowDown : ArrowUp;
          return (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-foreground"
              onClick={() => column.toggleSorting()}
            >
              {/* A thing's name, which Serbian words differently from a person's. */}
              {t("Name", { context: "action" })}
              <SortIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
          );
        },
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
        enableSorting: false,
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

  const sorting: SortingState = [{ id: "name", desc: sortDir === "desc" }];

  const table = useReactTable({
    data: actions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (action) => action.id,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    state: { sorting, rowSelection },
    onRowSelectionChange,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortDirChange(next[0]?.desc ? "desc" : "asc");
    },
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(header.column.id === "select" && SELECT_COLUMN_CLASS)}
                  aria-sort={
                    header.column.getIsSorted()
                      ? header.column.getIsSorted() === "desc"
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 && loading ? (
            <TableSkeletonRows columns={columns.length} />
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn("py-3", cell.column.id === "select" && SELECT_COLUMN_CLASS)}
                  >
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
