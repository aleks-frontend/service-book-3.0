import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Customer, CustomerListQuery, PageSize, SortDir } from "@servicebook/schemas";
import { namesSummary } from "@/lib/bulkDelete";
import {
  useBulkDeleteCustomersMutation,
  useCustomersQuery,
  useDeleteCustomerMutation,
} from "@/lib/customers";
import { useDrawerStack } from "@/lib/useDrawerStack";
import { useScopedRowSelection } from "@/lib/useScopedRowSelection";
import { useSearching } from "@/lib/useSearching";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { CustomersTable } from "@/components/CustomersTable";
import { DrawerStack } from "@/components/DrawerStack";
import { LoadingRegion } from "@/components/LoadingRegion";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SelectionBar } from "@/components/SelectionBar";

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

  const drawers = useDrawerStack();
  const [form, setForm] = useState<FormState>({ open: false });
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
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

  const query: CustomerListQuery = { search, page, pageSize, sortDir };
  const { data, isPending, isPlaceholderData, isError } = useCustomersQuery(query);
  const searching = useSearching(searchTyped, search, isPlaceholderData);
  const deleteCustomer = useDeleteCustomerMutation();
  const bulkDeleteCustomers = useBulkDeleteCustomersMutation();

  // Checked rows belong to the page they were checked on: another page, page
  // size, search or sort starts with nothing selected.
  const { rowSelection, onRowSelectionChange, clearSelection } = useScopedRowSelection(
    JSON.stringify(query),
  );
  const selectedCustomers = (data?.items ?? []).filter((customer) => rowSelection[customer.id]);

  // Deleting the last customer on a page leaves it empty: step back a page.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) setPage(page - 1);
  }, [data, page]);

  const handleEdit = useCallback((customer: Customer) => setForm({ open: true, customer }), []);
  const handleDelete = useCallback((customer: Customer) => setCustomerToDelete(customer), []);

  function confirmDelete() {
    if (!customerToDelete) return;
    deleteCustomer.mutate(customerToDelete.id, {
      onSuccess: () => setCustomerToDelete(null),
    });
  }

  function confirmBulkDelete() {
    bulkDeleteCustomers.mutate(
      selectedCustomers.map((customer) => customer.id),
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
        <h1 className="text-2xl font-semibold">{t("Customers")}</h1>
        <Button onClick={() => setForm({ open: true })}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t("New customer")}
        </Button>
      </div>

      <SearchInput
        value={searchInput}
        onChange={setSearchInput}
        placeholder={t("Search by name, phone or email")}
        aria-label={t("Search customers")}
        busy={searching}
      />

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load customers.")}</p>
      ) : (
        <>
          <SelectionBar
            count={selectedCustomers.length}
            onDelete={() => setConfirmingBulkDelete(true)}
            onClear={clearSelection}
          />
          <LoadingRegion refreshing={isPlaceholderData}>
            <CustomersTable
              customers={data?.items ?? []}
              sortDir={sortDir}
              rowSelection={rowSelection}
              onRowSelectionChange={onRowSelectionChange}
              onSortDirChange={(next) => {
                setSortDir(next);
                setPage(1);
              }}
              onOpen={(customer) => drawers.open("customer", customer.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              loading={isPending}
              emptyMessage={search ? t("No customers match your search.") : t("No customers yet.")}
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

      <DrawerStack />

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

      <ConfirmDeleteDialog
        open={confirmingBulkDelete}
        onOpenChange={setConfirmingBulkDelete}
        title={t("Delete selected customers ({{count}})?", { count: selectedCustomers.length })}
        description={t("These customers will be permanently deleted: {{names}}.", {
          names: namesSummary(
            selectedCustomers.map((customer) => customer.name),
            t,
          ),
        })}
        isDeleting={bulkDeleteCustomers.isPending}
        onConfirm={confirmBulkDelete}
      />
    </section>
  );
}
