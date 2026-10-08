import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import type { Device, CustomerSummary, PageSize, SortDir } from "@servicebook/schemas";
import { useDeleteDeviceMutation, useDevicesQuery } from "@/lib/devices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CustomerPicker } from "@/components/CustomerPicker";
import { DeviceDrawer } from "@/components/DeviceDrawer";
import { DeviceFormDialog } from "@/components/DeviceFormDialog";
import { DevicesTable } from "@/components/DevicesTable";
import { Pagination } from "@/components/Pagination";

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

  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ open: false });
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);

  // A new search starts from the first page.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data, isPending, isError } = useDevicesQuery({
    search,
    page,
    pageSize,
    sortDir,
    ownerId: owner?.id,
    generic: genericOnly ? "true" : undefined,
  });
  const deleteDevice = useDeleteDeviceMutation();

  // Deleting the last device on a page leaves it empty: step back a page.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) setPage(page - 1);
  }, [data, page]);

  const handleEdit = useCallback((device: Device) => setForm({ open: true, device }), []);
  const handleDelete = useCallback((device: Device) => setDeviceToDelete(device), []);

  function confirmDelete() {
    if (!deviceToDelete) return;
    deleteDevice.mutate(deviceToDelete.id, {
      onSuccess: () => {
        if (openDeviceId === deviceToDelete.id) setOpenDeviceId(null);
        setDeviceToDelete(null);
      },
    });
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
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("Search by name")}
            aria-label={t("Search devices")}
            className="pl-9"
          />
        </div>
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
          <DevicesTable
            devices={data?.items ?? []}
            sortDir={sortDir}
            onSortDirChange={(next) => {
              setSortDir(next);
              setPage(1);
            }}
            onOpen={(device) => setOpenDeviceId(device.id)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            emptyMessage={
              isPending
                ? t("Loading…")
                : isFiltered
                  ? t("No devices match your search.")
                  : t("No devices yet.")
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

      <DeviceDrawer
        deviceId={openDeviceId}
        onClose={() => setOpenDeviceId(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

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
          name: deviceToDelete?.name ?? "",
        })}
        isDeleting={deleteDevice.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
