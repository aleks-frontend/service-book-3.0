import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Earnings, EarningsQuery, StatusCounts } from "@servicebook/schemas";
import { request, toSearchParams } from "./http";

const statisticsKeys = {
  earnings: (query: EarningsQuery) => ["statistics", "earnings", query] as const,
  statusCounts: ["statistics", "status-counts"] as const,
};

/**
 * Earnings in a range; the previous range's stay on screen while the next
 * loads. Waits while `query` is null, i.e. the range is incomplete.
 */
export function useEarningsQuery(query: EarningsQuery | null) {
  return useQuery({
    queryKey: statisticsKeys.earnings(query ?? { from: "", to: "" }),
    queryFn: () => request<Earnings>(`/statistics/earnings?${toSearchParams(query!)}`),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });
}

export function useStatusCountsQuery() {
  return useQuery({
    queryKey: statisticsKeys.statusCounts,
    queryFn: () => request<StatusCounts>("/statistics/status-counts"),
  });
}
