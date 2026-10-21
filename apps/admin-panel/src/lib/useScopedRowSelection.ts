import { useState } from "react";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";

/**
 * Checked table rows that belong to `scope` (e.g. the page, search and sort
 * they were checked under): when the scope changes, nothing is selected.
 */
export function useScopedRowSelection(scope: string) {
  const [selection, setSelection] = useState<{ scope: string; rows: RowSelectionState }>({
    scope,
    rows: {},
  });
  const rowSelection = selection.scope === scope ? selection.rows : {};

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) =>
    setSelection({
      scope,
      rows: typeof updater === "function" ? updater(rowSelection) : updater,
    });
  const clearSelection = () => setSelection({ scope, rows: {} });

  return { rowSelection, onRowSelectionChange, clearSelection };
}
