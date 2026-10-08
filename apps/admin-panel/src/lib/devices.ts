import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Device, DeviceInput, DeviceListQuery, Page } from "@servicebook/schemas";
import { request, toSearchParams } from "./http";

export const deviceKeys = {
  all: ["devices"] as const,
  list: (query: DeviceListQuery) => ["devices", "list", query] as const,
  detail: (id: string) => ["devices", "detail", id] as const,
};

/** One page of devices; keeps showing the previous page while the next one loads. */
export function useDevicesQuery(query: DeviceListQuery) {
  return useQuery({
    queryKey: deviceKeys.list(query),
    queryFn: () => request<Page<Device>>(`/devices?${toSearchParams(query)}`),
    placeholderData: keepPreviousData,
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
      return queryClient.invalidateQueries({ queryKey: deviceKeys.all });
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
    onError: () => toast.error(t("Could not delete the device. Please try again.")),
  });
}
