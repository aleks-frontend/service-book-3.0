import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Customer, CustomerInput, CustomerListQuery, Page } from "@servicebook/schemas";
import { request } from "./http";

const customerKeys = {
  all: ["customers"] as const,
  list: (query: CustomerListQuery) => ["customers", "list", query] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
};

function toSearchParams(query: CustomerListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

/** One page of customers; keeps showing the previous page while the next one loads. */
export function useCustomersQuery(query: CustomerListQuery) {
  return useQuery({
    queryKey: customerKeys.list(query),
    queryFn: () => request<Page<Customer>>(`/customers?${toSearchParams(query)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerQuery(id: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: () => request<Customer>(`/customers/${id}`),
    enabled: id !== null,
  });
}

export function useSaveCustomerMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CustomerInput }) =>
      id
        ? request<Customer>(`/customers/${id}`, { method: "PUT", body: input })
        : request<Customer>("/customers", { method: "POST", body: input }),
    onSuccess: (_customer, { id }) => {
      toast.success(id ? t("Customer updated") : t("Customer created"));
      return queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
    onError: () => toast.error(t("Could not save the customer. Please try again.")),
  });
}

export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      toast.success(t("Customer deleted"));
      queryClient.removeQueries({ queryKey: customerKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
    onError: () => toast.error(t("Could not delete the customer. Please try again.")),
  });
}
