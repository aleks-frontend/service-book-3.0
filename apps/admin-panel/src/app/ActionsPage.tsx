import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import type { Action } from "@servicebook/schemas";
import { useActionsQuery, useDeleteActionMutation } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionFormDialog } from "@/components/ActionFormDialog";
import { ActionsTable } from "@/components/ActionsTable";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

/** The create/edit dialog is either closed, creating, or editing one action. */
type FormState = { open: false } | { open: true; action?: Action };

export function ActionsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>({ open: false });
  const [actionToDelete, setActionToDelete] = useState<Action | null>(null);

  const { data, isPending, isError } = useActionsQuery();
  const deleteAction = useDeleteActionMutation();

  const handleEdit = useCallback((action: Action) => setForm({ open: true, action }), []);
  const handleDelete = useCallback((action: Action) => setActionToDelete(action), []);

  function confirmDelete() {
    if (!actionToDelete) return;
    deleteAction.mutate(actionToDelete.id, { onSuccess: () => setActionToDelete(null) });
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

      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Search by name")}
          aria-label={t("Search actions")}
          className="pl-9"
        />
      </div>

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load actions.")}</p>
      ) : (
        <ActionsTable
          actions={data ?? []}
          search={search}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyMessage={isPending ? t("Loading…") : t("No actions yet.")}
          noMatchesMessage={t("No actions match your search.")}
        />
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
    </section>
  );
}
