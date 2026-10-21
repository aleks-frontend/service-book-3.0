import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  deviceLabel,
  type CustomerSummary,
  type Device,
  type DeviceListQuery,
  type PageSize,
  type SortDir,
} from "@servicebook/schemas";
import {
  useBulkDeleteDevicesMutation,
  useDeleteDeviceMutation,
  useDevicesQuery,
} from "@/lib/devices";
import { namesSummary } from "@/lib/bulkDelete";
import { useDrawerStack } from "@/lib/useDrawerStack";
import { useScopedRowSelection } from "@/lib/useScopedRowSelection";
import { useSearching } from "@/lib/useSearching";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CustomerPicker } from "@/components/CustomerPicker";
import { DeviceFormDialog } from "@/components/DeviceFormDialog";
import { DevicesTable } from "@/components/DevicesTable";
import { DrawerStack } from "@/components/DrawerStack";
import { LoadingRegion } from "@/components/LoadingRegion";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SelectionBar } from "@/components/SelectionBar";

const SEARCH_DEBOUNCE_MS = 300;

/** The create/edit dialog is either closed, creating, or editing one device. */
type FormState = { open: false } | { open: true; device?: Device };

export function DevicesPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // At most one of these is set: one customer's devices, or only generic ones.
  const [owner, setOwner] = useState<CustomerSummary | null>(null);
  const [genericOnly, setGenericOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const drawers = useDrawerStack();
  const [form, setForm] = useState<FormState>({ open: false });
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
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

  const query: DeviceListQuery = {
    search,
    page,
    pageSize,
    sortDir,
    ownerId: owner?.id,
    generic: genericOnly ? "true" : undefined,
  };
  const { data, isPending, isPlaceholderData, isError } = useDevicesQuery(query);
  const searching = useSearching(searchTyped, search, isPlaceholderData);
  const deleteDevice = useDeleteDeviceMutation();
  const bulkDeleteDevices = useBulkDeleteDevicesMutation();

  // Checked rows belong to the page they were checked on: another page, page
  // size, search, filter or sort starts with nothing selected.
  const { rowSelection, onRowSelectionChange, clearSelection } = useScopedRowSelection(
    JSON.stringify(query),
  );
  const selectedDevices = (data?.items ?? []).filter((device) => rowSelection[device.id]);

  // Deleting the last device on a page leaves it empty: step back a page.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) setPage(page - 1);
  }, [data, page]);

  const handleEdit = useCallback((device: Device) => setForm({ open: true, device }), []);
  const handleDelete = useCallback((device: Device) => setDeviceToDelete(device), []);

  function confirmDelete() {
    if (!deviceToDelete) return;
    deleteDevice.mutate(deviceToDelete.id, {
      onSuccess: () => setDeviceToDelete(null),
    });
  }

  function confirmBulkDelete() {
    bulkDeleteDevices.mutate(
      selectedDevices.map((device) => device.id),
      {
        onSuccess: () => {
          clearSelection();
          setConfirmingBulkDelete(false);
        },
      },
    );
  }

  const isFiltered = Boolean(search || owner || genericOnly);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Devices")}</h1>
        <Button onClick={() => setForm({ open: true })}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t("New device")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("Search by manufacturer, model or serial number")}
          aria-label={t("Search devices")}
          busy={searching}
        />
        <CustomerPicker
          value={owner}
          onChange={(next) => {
            setOwner(next);
            setPage(1);
          }}
          placeholder={t("All owners")}
          aria-label={t("Filter by owner")}
          disabled={genericOnly}
          className="w-full max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={genericOnly}
            onChange={(event) => {
              setGenericOnly(event.target.checked);
              if (event.target.checked) setOwner(null);
              setPage(1);
            }}
          />
          {t("Generic only")}
        </label>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load devices.")}</p>
      ) : (
        <>
          <SelectionBar
            count={selectedDevices.length}
            onDelete={() => setConfirmingBulkDelete(true)}
            onClear={clearSelection}
          />
          <LoadingRegion refreshing={isPlaceholderData}>
            <DevicesTable
              devices={data?.items ?? []}
              sortDir={sortDir}
              rowSelection={rowSelection}
              onRowSelectionChange={onRowSelectionChange}
              onSortDirChange={(next) => {
                setSortDir(next);
                setPage(1);
              }}
              onOpen={(device) => drawers.open("device", device.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              loading={isPending}
              emptyMessage={isFiltered ? t("No devices match your search.") : t("No devices yet.")}
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

      <DeviceFormDialog
        open={form.open}
        onOpenChange={(open) => !open && setForm({ open: false })}
        device={form.open ? form.device : undefined}
      />

      <ConfirmDeleteDialog
        open={deviceToDelete !== null}
        onOpenChange={(open) => !open && setDeviceToDelete(null)}
        title={t("Delete device?")}
        description={t("{{name}} will be permanently deleted.", {
          name: deviceToDelete ? deviceLabel(deviceToDelete) : "",
        })}
        isDeleting={deleteDevice.isPending}
        onConfirm={confirmDelete}
      />

      <ConfirmDeleteDialog
        open={confirmingBulkDelete}
        onOpenChange={setConfirmingBulkDelete}
        title={t("Delete selected devices?")}
        description={t("These devices will be permanently deleted: {{names}}.", {
          names: namesSummary(selectedDevices.map(deviceLabel), t),
        })}
        isDeleting={bulkDeleteDevices.isPending}
        onConfirm={confirmBulkDelete}
      />
    </section>
  );
}
