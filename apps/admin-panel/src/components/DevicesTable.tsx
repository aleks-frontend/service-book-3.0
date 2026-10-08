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
import { deviceLabel, type Device, type SortDir } from "@servicebook/schemas";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

/** Shrinks the checkbox column to the checkbox; the next column's padding spaces it. */
const SELECT_COLUMN_CLASS = "w-px pr-0";

type DevicesTableProps = {
  devices: Device[];
  sortDir: SortDir;
  onSortDirChange: (sortDir: SortDir) => void;
  /** The checked rows, keyed by device id. */
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onOpen: (device: Device) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  emptyMessage: string;
};

/**
 * One page of devices. Paging, search, filters and sorting happen on the
 * server; the header checkbox selects the rows on this page only.
 */
export function DevicesTable({
  devices,
  sortDir,
  onSortDirChange,
  rowSelection,
  onRowSelectionChange,
  onOpen,
  onEdit,
  onDelete,
  emptyMessage,
}: DevicesTableProps) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<Device>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label={t("Select all on this page")}
          />
        ),
        cell: ({ row }) => (
          // Keep the row's own click (open the drawer) from firing as well.
          <div onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              aria-label={t("Select {{name}}", { name: deviceLabel(row.original) })}
            />
          </div>
        ),
      },
      {
        id: "device",
        accessorFn: deviceLabel,
        header: ({ column }) => {
          const SortIcon = column.getIsSorted() === "desc" ? ArrowDown : ArrowUp;
          return (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-foreground"
              onClick={() => column.toggleSorting()}
            >
              {t("Device")}
              <SortIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
          );
        },
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        id: "owner",
        header: t("Owner"),
        enableSorting: false,
        cell: ({ row }) => {
          const { owner } = row.original;
          return owner ? (
            <div>
              <div>{owner.name}</div>
              <div className="text-xs text-muted-foreground">{owner.phone}</div>
            </div>
          ) : (
            <span className="text-muted-foreground">{t("Generic")}</span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: t("Added on"),
        enableSorting: false,
        cell: ({ getValue }) => formatDate(getValue<Date>(), i18n.language),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("Row actions")}</span>,
        cell: ({ row }) => (
          // Keep the row's own click (open the drawer) from firing as well.
          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
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

  const sorting: SortingState = [{ id: "device", desc: sortDir === "desc" }];

  const table = useReactTable({
    data: devices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (device) => device.id,
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onOpen(row.original)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.target === event.currentTarget) {
                    onOpen(row.original);
                  }
                }}
              >
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
