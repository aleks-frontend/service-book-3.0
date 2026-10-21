import { createContext, useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { ServiceDetail } from "@servicebook/schemas";
import { settingsQueryOptions } from "./settings";

/** Generates a service's report in the active UI language and downloads it. */
export function useDownloadServiceReportMutation() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  return useMutation({
    mutationFn: async (service: ServiceDetail) => {
      const [settings, { downloadServiceReport }] = await Promise.all([
        // Refetched if stale, so the header shows the company as it is now.
        queryClient.fetchQuery(settingsQueryOptions),
        import("@/documents/downloadServiceReport"),
      ]);
      await downloadServiceReport({ service, settings, t, language: i18n.language });
    },
    onError: () => toast.error(t("Could not create the service report. Please try again.")),
  });
}

/** Offers a service's report; provided by `ServiceReportOfferProvider`. */
export const ServiceReportOfferContext = createContext<((service: ServiceDetail) => void) | null>(
  null,
);

/**
 * Returns `offerServiceReport(service)`, which asks whether to generate the service's
 * report. The offer lives above the page, so it stays up when whatever asked for it
 * (a list row that a status filter now hides, …) unmounts.
 */
export function useOfferServiceReport() {
  const offerServiceReport = useContext(ServiceReportOfferContext);
  if (!offerServiceReport) {
    throw new Error("useOfferServiceReport must be used within a ServiceReportOfferProvider");
  }
  return offerServiceReport;
}
