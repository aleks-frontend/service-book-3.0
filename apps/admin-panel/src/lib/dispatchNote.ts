import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { ServiceDetail } from "@servicebook/schemas";
import { settingsQueryOptions } from "./settings";

/** Generates a service's dispatch note in the active UI language and downloads it. */
export function useDownloadDispatchNoteMutation() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  return useMutation({
    mutationFn: async (service: ServiceDetail) => {
      const [settings, { downloadDispatchNote }] = await Promise.all([
        // Refetched if stale, so the header shows the company as it is now.
        queryClient.fetchQuery(settingsQueryOptions),
        import("@/documents/downloadDispatchNote"),
      ]);
      await downloadDispatchNote({ service, settings, t, language: i18n.language });
    },
    onError: () => toast.error(t("Could not create the dispatch note. Please try again.")),
  });
}
