import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { Checkbox } from "./ui/checkbox";

/** Shrinks the checkbox column to the checkbox; the next column's padding spaces it. */
export const SELECT_COLUMN_CLASS = "w-px pr-0";

/**
 * A checkbox per row, and one in the header that selects every row the table
 * shows: its page, or the rows matching its filter.
 */
export function selectColumn<T>(
  t: TFunction,
  { name, selectAllLabel }: { name: (row: T) => string; selectAllLabel: string },
): ColumnDef<T> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        aria-label={selectAllLabel}
      />
    ),
    cell: ({ row }) => (
      // Keep the row's own click (e.g. open the drawer) from firing as well.
      <div className="flex" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={t("Select {{name}}", { name: name(row.original) })}
        />
      </div>
    ),
  };
}
