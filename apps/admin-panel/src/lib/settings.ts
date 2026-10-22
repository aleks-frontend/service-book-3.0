import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Settings, SettingsInput } from "@servicebook/schemas";
import { request } from "./http";

const settingsKeys = {
  all: ["settings"] as const,
  logo: ["settings", "logo"] as const,
};

/** The company identity; every field is null until it is first saved. */
export const settingsQueryOptions = queryOptions({
  queryKey: settingsKeys.all,
  queryFn: () => request<Settings>("/settings"),
});

export function useSettingsQuery() {
  return useQuery(settingsQueryOptions);
}

/** The company's logo alone, which is readable without logging in. */
export function useCompanyLogoQuery() {
  return useQuery({
    queryKey: settingsKeys.logo,
    queryFn: () => request<{ logo: string | null }>("/public/logo"),
    select: ({ logo }) => logo,
    staleTime: Infinity,
  });
}

export function useSaveSettingsMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (input: SettingsInput) =>
      request<Settings>("/settings", { method: "PUT", body: input }),
    onSuccess: (settings) => {
      toast.success(t("Settings saved"));
      queryClient.setQueryData(settingsKeys.all, settings);
      queryClient.setQueryData(settingsKeys.logo, { logo: settings.logo });
    },
    onError: () => toast.error(t("Could not save the settings. Please try again.")),
  });
}
