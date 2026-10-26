import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type {
  CursorPage,
  DeviceService,
  LogEntry,
  Service,
  ServiceDetail,
  ServiceInput,
  ServiceLine,
  ServiceLineInput,
  ServiceLineUpdate,
  ServiceListQuery,
  Status,
} from "@servicebook/schemas";
import { PHOTO_FIELD, THUMBNAIL_FIELD } from "@servicebook/schemas";
import { request, toSearchParams, type HttpError } from "./http";
import type { PickedPhoto } from "./photos";

export const serviceKeys = {
  all: ["services"] as const,
  lists: ["services", "list"] as const,
  list: (query: ServiceListQuery) => ["services", "list", query] as const,
  // Histories sit under `lists`, so every change that refreshes the lists refreshes them too.
  customerHistory: (customerId: string) => ["services", "list", "customer", customerId] as const,
  deviceHistory: (deviceId: string) => ["services", "list", "device", deviceId] as const,
  detail: (id: string) => ["services", "detail", id] as const,
  log: (id: string) => ["services", "log", id] as const,
};

/**
 * The services matching a search, status and sort, one cursor page at a time
 * for infinite scrolling. Keeps showing the previous results while new ones load.
 */
export function useServicesInfiniteQuery(query: Omit<ServiceListQuery, "cursor">) {
  return useInfiniteQuery({
    queryKey: serviceKeys.list(query),
    queryFn: ({ pageParam }) =>
      request<CursorPage<Service>>(`/services?${toSearchParams({ ...query, cursor: pageParam })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

export function useServiceQuery(id: string | null) {
  return useQuery({
    queryKey: serviceKeys.detail(id ?? ""),
    queryFn: () => request<ServiceDetail>(`/services/${id}`),
    enabled: id !== null,
  });
}

/** A customer's services, newest first, for the history in their drawer. */
export function useCustomerServicesQuery(customerId: string) {
  return useQuery({
    queryKey: serviceKeys.customerHistory(customerId),
    queryFn: () => request<Service[]>(`/customers/${customerId}/services`),
  });
}

/** Every service a device is attached to or sold on, newest first, for its drawer. */
export function useDeviceServicesQuery(deviceId: string) {
  return useQuery({
    queryKey: serviceKeys.deviceHistory(deviceId),
    queryFn: () => request<DeviceService[]>(`/devices/${deviceId}/services`),
  });
}

export function useSaveServiceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ServiceInput }) =>
      id
        ? request<ServiceDetail>(`/services/${id}`, { method: "PUT", body: input })
        : request<ServiceDetail>("/services", { method: "POST", body: input }),
    onSuccess: (service, { id }) => {
      toast.success(
        id
          ? t("Service {{number}} updated", { number: service.number })
          : t("Service {{number}} created", { number: service.number }),
      );
      queryClient.setQueryData(serviceKeys.detail(service.id), service);
      return queryClient.invalidateQueries({ queryKey: serviceKeys.lists });
    },
    onError: () => toast.error(t("Could not save the service. Please try again.")),
  });
}

export function useDeleteServiceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => request<void>(`/services/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      toast.success(t("Service deleted"));
      queryClient.removeQueries({ queryKey: serviceKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: serviceKeys.lists });
    },
    onError: () => toast.error(t("Could not delete the service. Please try again.")),
  });
}

/**
 * Adds, edits, removes or reorders one service's lines. Each change refetches
 * the service (for its lines and total) and the list (for its total).
 */
export function useServiceLineMutations(serviceId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const lines = `/services/${serviceId}/lines`;

  function refetch() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) }),
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists }),
    ]);
  }

  const add = useMutation({
    mutationFn: (input: ServiceLineInput) =>
      request<ServiceLine>(lines, { method: "POST", body: input }),
    onSuccess: refetch,
    onError: () => toast.error(t("Could not add the line. Please try again.")),
  });

  const update = useMutation({
    mutationFn: ({ lineId, input }: { lineId: string; input: ServiceLineUpdate }) =>
      request<ServiceLine>(`${lines}/${lineId}`, { method: "PATCH", body: input }),
    onSuccess: refetch,
    onError: () => toast.error(t("Could not save the line. Please try again.")),
  });

  const remove = useMutation({
    mutationFn: (lineId: string) => request<void>(`${lines}/${lineId}`, { method: "DELETE" }),
    onSuccess: refetch,
    onError: (error: HttpError) =>
      toast.error(
        error.status === 404
          ? t("This line was already removed.")
          : t("Could not remove the line. Please try again."),
      ),
  });

  const reorder = useMutation({
    mutationFn: (lineIds: string[]) =>
      request<ServiceLine[]>(`${lines}/order`, { method: "PUT", body: { lineIds } }),
    onSuccess: refetch,
    // Someone else may have added or removed a line meanwhile; show the current ones.
    onError: () => {
      toast.error(t("Could not reorder the lines. Please try again."));
      return refetch();
    },
  });

  return { add, update, remove, reorder };
}

/** Saves a service's customer report; a blank one clears it. */
export function useSaveCustomerReportMutation(serviceId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (customerReport: string) =>
      request<ServiceDetail>(`/services/${serviceId}/customer-report`, {
        method: "PUT",
        body: { customerReport },
      }),
    onSuccess: (service) => {
      toast.success(t("Customer report saved"));
      queryClient.setQueryData(serviceKeys.detail(service.id), service);
    },
    onError: () => toast.error(t("Could not save the customer report. Please try again.")),
  });
}

/**
 * Moves a service to another status. The server logs the change, so the
 * service's log is refetched along with the list.
 */
export function useChangeStatusMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      request<ServiceDetail>(`/services/${id}/status`, { method: "PUT", body: { status } }),
    onSuccess: (service) => {
      queryClient.setQueryData(serviceKeys.detail(service.id), service);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceKeys.lists }),
        queryClient.invalidateQueries({ queryKey: serviceKeys.log(service.id) }),
      ]);
    },
    onError: () => toast.error(t("Could not change the status. Please try again.")),
  });
}

/** A service's log, oldest entry first. */
export function useServiceLogQuery(serviceId: string) {
  return useQuery({
    queryKey: serviceKeys.log(serviceId),
    queryFn: () => request<LogEntry[]>(`/services/${serviceId}/log`),
  });
}

/** A note's text and photos as the API takes them: JSON for text only, multipart with photos. */
function noteBody(text: string | null, photos: PickedPhoto[]) {
  if (photos.length === 0) return { text };
  const body = new FormData();
  if (text) body.append("text", text);
  for (const { name, photo, thumbnail } of photos) {
    body.append(PHOTO_FIELD, photo, name);
    body.append(THUMBNAIL_FIELD, thumbnail, name);
  }
  return body;
}

/** Adds a staff member's note, with text, photos or both, to the end of a service's log. */
export function useAddNoteMutation(serviceId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ text, photos }: { text: string | null; photos: PickedPhoto[] }) =>
      request<LogEntry>(`/services/${serviceId}/log`, {
        method: "POST",
        body: noteBody(text, photos),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKeys.log(serviceId) }),
    onError: () => toast.error(t("Could not add the note. Please try again.")),
  });
}
