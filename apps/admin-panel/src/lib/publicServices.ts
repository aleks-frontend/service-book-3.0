import { useQuery } from "@tanstack/react-query";
import type { PublicService } from "@servicebook/schemas";
import { request, type HttpError } from "./http";

/**
 * A service as its public status page shows it, read without a session. An
 * unknown token is not retried: it will not appear by asking again.
 */
export function usePublicServiceQuery(publicToken: string) {
  return useQuery<PublicService, HttpError>({
    queryKey: ["public-services", publicToken],
    queryFn: () => request<PublicService>(`/public/services/${encodeURIComponent(publicToken)}`),
    retry: (failureCount, error) => error.status !== 404 && failureCount < 1,
  });
}
