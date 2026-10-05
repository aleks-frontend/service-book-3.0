import { useQuery } from "@tanstack/react-query";
import type { StaffMember } from "@servicebook/schemas";
import { request } from "./http";

/** The logged-in staff member. */
export function useMeQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => request<StaffMember>("/me"),
  });
}
