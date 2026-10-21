import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ServiceDetail } from "@servicebook/schemas";
import { ServiceReportOfferContext, useDownloadServiceReportMutation } from "@/lib/serviceReport";
import { OfferDocumentDialog } from "./OfferDocumentDialog";

/**
 * Holds the offer of a service's report (see `useOfferServiceReport`) above the pages
 * and their drawers, so it outlives the list row or card that made it.
 */
export function ServiceReportOfferProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const serviceReport = useDownloadServiceReportMutation();
  const [offered, setOffered] = useState<ServiceDetail>();

  return (
    <ServiceReportOfferContext.Provider value={setOffered}>
      {children}
      <OfferDocumentDialog
        service={offered}
        onClose={() => setOffered(undefined)}
        title={t("Print the service report?")}
        description={({ number }) =>
          t("Service {{number}} is completed. Generate the service report for the customer?", {
            number,
          })
        }
        confirmLabel={t("Generate")}
        onConfirm={(service) => serviceReport.mutate(service)}
      />
    </ServiceReportOfferContext.Provider>
  );
}
