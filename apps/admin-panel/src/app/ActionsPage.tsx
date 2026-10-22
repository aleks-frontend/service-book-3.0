import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Action, ActionListQuery, PageSize, SortDir } from "@servicebook/schemas";
import {
  useActionsQuery,
  useBulkDeleteActionsMutation,
  useDeleteActionMutation,
} from "@/lib/actions";
import { namesSummary } from "@/lib/bulkDelete";
import { useScopedRowSelection } from "@/lib/useScopedRowSelection";
import { useSearching } from "@/lib/useSearching";
import { Button } from "@/components/ui/button";
import { ActionFormDialog } from "@/components/ActionFormDialog";
import { ActionsTable } from "@/components/ActionsTable";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { LoadingRegion } from "@/components/LoadingRegion";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SelectionBar } from "@/components/SelectionBar";

const SEARCH_DEBOUNCE_MS = 300;

/** The create/edit dialog is either closed, creating, or editing one action. */
type FormState = { open: false } | { open: true; action?: Action };

export function ActionsPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [form, setForm] = useState<FormState>({ open: false });
  const [actionToDelete, setActionToDelete] = useState<Action | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  // A new search starts from the first page.
  const searchTyped = searchInput.trim();
  useEffect(() => {
    if (searchTyped === search) return;
    const timeout = setTimeout(() => {
      setSearch(searchTyped);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchTyped, search]);

  const query: ActionListQuery = { search, page, pageSize, sortDir };
  const { data, isPending, isPlaceholderData, isError } = useActionsQuery(query);
  const searching = useSearching(searchTyped, search, isPlaceholderData);
  const deleteAction = useDeleteActionMutation();
  const bulkDeleteActions = useBulkDeleteActionsMutation();

  // Checked rows belong to the page they were checked on: another page, page
  // size, search or sort starts with nothing selected.
  const { rowSelection, onRowSelectionChange, clearSelection } = useScopedRowSelection(
    JSON.stringify(query),
  );
  const selectedActions = (data?.items ?? []).filter((action) => rowSelection[action.id]);

  // Deleting the last action on a page leaves it empty: step back a page.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) setPage(page - 1);
  }, [data, page]);

  const handleEdit = useCallback((action: Action) => setForm({ open: true, action }), []);
  const handleDelete = useCallback((action: Action) => setActionToDelete(action), []);

  function confirmDelete() {
    if (!actionToDelete) return;
    deleteAction.mutate(actionToDelete.id, { onSuccess: () => setActionToDelete(null) });
  }

  function confirmBulkDelete() {
    bulkDeleteActions.mutate(
      selectedActions.map((action) => action.id),
      {
        onSuccess: () => {
          clearSelection();
          setConfirmingBulkDelete(false);
        },
      },
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-title">{t("Actions")}</h1>
        <Button onClick={() => setForm({ open: true })}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t("New action")}
        </Button>
      </div>

      <SearchInput
        value={searchInput}
        onChange={setSearchInput}
        placeholder={t("Search by name")}
        aria-label={t("Search actions")}
        busy={searching}
      />

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load actions.")}</p>
      ) : (
        <>
          <SelectionBar
            count={selectedActions.length}
            onDelete={() => setConfirmingBulkDelete(true)}
            onClear={clearSelection}
          />
          <LoadingRegion refreshing={isPlaceholderData}>
            <ActionsTable
              actions={data?.items ?? []}
              sortDir={sortDir}
              onSortDirChange={(next) => {
                setSortDir(next);
                setPage(1);
              }}
              rowSelection={rowSelection}
              onRowSelectionChange={onRowSelectionChange}
              onEdit={handleEdit}
              onDelete={handleDelete}
              loading={isPending}
              emptyMessage={search ? t("No actions match your search.") : t("No actions yet.")}
            />
          </LoadingRegion>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </>
      )}

      <ActionFormDialog
        open={form.open}
        onOpenChange={(open) => !open && setForm({ open: false })}
        action={form.open ? form.action : undefined}
      />

      <ConfirmDeleteDialog
        open={actionToDelete !== null}
        onOpenChange={(open) => !open && setActionToDelete(null)}
        title={t("Delete action?")}
        description={t("{{name}} will be permanently deleted.", {
          name: actionToDelete?.name ?? "",
        })}
        isDeleting={deleteAction.isPending}
        onConfirm={confirmDelete}
      />

      <ConfirmDeleteDialog
        open={confirmingBulkDelete}
        onOpenChange={setConfirmingBulkDelete}
        title={t("Delete selected actions ({{count}})?", { count: selectedActions.length })}
        description={t("These actions will be permanently deleted: {{names}}.", {
          names: namesSummary(
            selectedActions.map((action) => action.name),
            t,
          ),
        })}
        isDeleting={bulkDeleteActions.isPending}
        onConfirm={confirmBulkDelete}
      />
    </section>
  );
}
