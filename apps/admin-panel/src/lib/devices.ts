import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type {
  BulkDeleteResult,
  Device,
  DeviceInput,
  DeviceListQuery,
  Page,
} from "@servicebook/schemas";
import { serviceKeys } from "./services";
import { request, toSearchParams, type HttpError } from "./http";

export const deviceKeys = {
  all: ["devices"] as const,
  list: (query: DeviceListQuery) => ["devices", "list", query] as const,
  detail: (id: string) => ["devices", "detail", id] as const,
};

/** One page of devices; keeps showing the previous page while the next one loads. */
export function useDevicesQuery(query: DeviceListQuery, { enabled = true } = {}) {
  return useQuery({
    queryKey: deviceKeys.list(query),
    queryFn: () => request<Page<Device>>(`/devices?${toSearchParams(query)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDeviceQuery(id: string | null) {
  return useQuery({
    queryKey: deviceKeys.detail(id ?? ""),
    queryFn: () => request<Device>(`/devices/${id}`),
    enabled: id !== null,
  });
}

export function useSaveDeviceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DeviceInput }) =>
      id
        ? request<Device>(`/devices/${id}`, { method: "PUT", body: input })
        : request<Device>("/devices", { method: "POST", body: input }),
    onSuccess: (_device, { id }) => {
      toast.success(id ? t("Device updated") : t("Device created"));
      // Services show their devices' labels.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: deviceKeys.all }),
        queryClient.invalidateQueries({ queryKey: serviceKeys.all }),
      ]);
    },
    onError: () => toast.error(t("Could not save the device. Please try again.")),
  });
}

export function useDeleteDeviceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => request<void>(`/devices/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      toast.success(t("Device deleted"));
      queryClient.removeQueries({ queryKey: deviceKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
    onError: (error: HttpError) =>
      toast.error(
        error.code === "DEVICE_IN_USE"
          ? t("This device is attached to a service, so it cannot be deleted.")
          : t("Could not delete the device. Please try again."),
      ),
  });
}

/** Deletes up to `BULK_DELETE_MAX` devices at once; devices still in use are kept and counted. */
export function useBulkDeleteDevicesMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (ids: string[]) =>
      request<BulkDeleteResult>("/devices/bulk-delete", { method: "POST", body: { ids } }),
    onSuccess: ({ deletedIds, inUseIds }) => {
      if (inUseIds.length > 0) {
        toast(
          t("Devices deleted: {{deleted}}. Kept because they are in use: {{inUse}}.", {
            deleted: deletedIds.length,
            inUse: inUseIds.length,
          }),
        );
      } else {
        toast.success(t("Devices deleted: {{count}}", { count: deletedIds.length }));
      }
      for (const id of deletedIds) queryClient.removeQueries({ queryKey: deviceKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
    onError: () => toast.error(t("Could not delete the devices. Please try again.")),
  });
}
