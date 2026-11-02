import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Me } from "@servicebook/schemas";
import { request } from "./http";

/** The logged-in staff member, and the features this deployment offers. */
export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => request<Me>("/me"),
});

export function useMeQuery() {
  return useQuery(meQueryOptions);
}
