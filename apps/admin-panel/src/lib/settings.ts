import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Settings, SettingsInput } from "@servicebook/schemas";
import { request } from "./http";

const settingsKeys = {
  all: ["settings"] as const,
};

/** The company identity; every field is null until it is first saved. */
export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => request<Settings>("/settings"),
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
    },
    onError: () => toast.error(t("Could not save the settings. Please try again.")),
  });
}
