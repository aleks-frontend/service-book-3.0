import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import type { Customer, PageSize, SortDir } from "@servicebook/schemas";
import { useCustomersQuery, useDeleteCustomerMutation } from "@/lib/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CustomerDrawer } from "@/components/CustomerDrawer";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { CustomersTable } from "@/components/CustomersTable";
import { Pagination } from "@/components/Pagination";

const SEARCH_DEBOUNCE_MS = 300;

/** The create/edit dialog is either closed, creating, or editing one customer. */
type FormState = { open: false } | { open: true; customer?: Customer };

export function CustomersPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ open: false });
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // A new search starts from the first page.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data, isPending, isError } = useCustomersQuery({ search, page, pageSize, sortDir });
  const deleteCustomer = useDeleteCustomerMutation();

  // Deleting the last customer on a page leaves it empty: step back a page.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) setPage(page - 1);
  }, [data, page]);

  const handleEdit = useCallback((customer: Customer) => setForm({ open: true, customer }), []);
  const handleDelete = useCallback((customer: Customer) => setCustomerToDelete(customer), []);

  function confirmDelete() {
    if (!customerToDelete) return;
    deleteCustomer.mutate(customerToDelete.id, {
      onSuccess: () => {
        if (openCustomerId === customerToDelete.id) setOpenCustomerId(null);
        setCustomerToDelete(null);
      },
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Customers")}</h1>
        <Button onClick={() => setForm({ open: true })}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t("New customer")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("Search by name, phone or email")}
          aria-label={t("Search customers")}
          className="pl-9"
        />
      </div>

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load customers.")}</p>
      ) : (
        <>
          <CustomersTable
            customers={data?.items ?? []}
            sortDir={sortDir}
            onSortDirChange={(next) => {
              setSortDir(next);
              setPage(1);
            }}
            onOpen={(customer) => setOpenCustomerId(customer.id)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            emptyMessage={
              isPending
                ? t("Loading…")
                : search
                  ? t("No customers match your search.")
                  : t("No customers yet.")
            }
          />
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

      <CustomerDrawer
        customerId={openCustomerId}
        onClose={() => setOpenCustomerId(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CustomerFormDialog
        open={form.open}
        onOpenChange={(open) => !open && setForm({ open: false })}
        customer={form.open ? form.customer : undefined}
      />

      <ConfirmDeleteDialog
        open={customerToDelete !== null}
        onOpenChange={(open) => !open && setCustomerToDelete(null)}
        title={t("Delete customer?")}
        description={t("{{name}} will be permanently deleted.", {
          name: customerToDelete?.name ?? "",
        })}
        isDeleting={deleteCustomer.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
