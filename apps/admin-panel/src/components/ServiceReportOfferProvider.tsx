import { useState, type ReactNode } from "react";
import type { ServiceDetail } from "@servicebook/schemas";
import { ServiceReportOfferContext, useDownloadServiceReportMutation } from "@/lib/serviceReport";
import { CompletionDialog } from "./CompletionDialog";

/**
 * Holds the offer of a service's report (see `useOfferServiceReport`) above the pages
 * and their drawers, so it outlives the list row or card that made it.
 */
export function ServiceReportOfferProvider({ children }: { children: ReactNode }) {
  const serviceReport = useDownloadServiceReportMutation();
  const [offered, setOffered] = useState<ServiceDetail>();

  return (
    <ServiceReportOfferContext.Provider value={setOffered}>
      {children}
      <CompletionDialog
        service={offered}
        onClose={() => setOffered(undefined)}
        onGenerate={(service) => serviceReport.mutate(service)}
      />
    </ServiceReportOfferContext.Provider>
  );
}
