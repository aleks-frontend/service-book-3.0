import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Action } from "@servicebook/schemas";
import {
  useActionsQuery,
  useBulkDeleteActionsMutation,
  useDeleteActionMutation,
} from "@/lib/actions";
import { namesSummary } from "@/lib/bulkDelete";
import { useScopedRowSelection } from "@/lib/useScopedRowSelection";
import { Button } from "@/components/ui/button";
import { ActionFormDialog } from "@/components/ActionFormDialog";
import { ActionsTable } from "@/components/ActionsTable";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SearchInput } from "@/components/SearchInput";
import { SelectionBar } from "@/components/SelectionBar";

/** The create/edit dialog is either closed, creating, or editing one action. */
type FormState = { open: false } | { open: true; action?: Action };

export function ActionsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>({ open: false });
  const [actionToDelete, setActionToDelete] = useState<Action | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  const { data, isPending, isError } = useActionsQuery();
  const deleteAction = useDeleteActionMutation();
  const bulkDeleteActions = useBulkDeleteActionsMutation();

  // Checked rows belong to the search they were checked under, so rows hidden
  // by a new search are never deleted unseen.
  const { rowSelection, onRowSelectionChange, clearSelection } = useScopedRowSelection(
    search.trim(),
  );
  const selectedActions = (data ?? []).filter((action) => rowSelection[action.id]);

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
        <h1 className="text-2xl font-semibold">{t("Actions")}</h1>
        <Button onClick={() => setForm({ open: true })}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t("New action")}
        </Button>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t("Search by name")}
        aria-label={t("Search actions")}
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
          <ActionsTable
            actions={data ?? []}
            search={search}
            rowSelection={rowSelection}
            onRowSelectionChange={onRowSelectionChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={isPending}
            emptyMessage={t("No actions yet.")}
            noMatchesMessage={t("No actions match your search.")}
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
