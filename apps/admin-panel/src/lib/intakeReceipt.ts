import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { ServiceDetail } from "@servicebook/schemas";
import { customerQueryOptions } from "./customers";
import { settingsQueryOptions } from "./settings";
import { meQueryOptions } from "./useMeQuery";

/** Generates a service's intake receipt in the active UI language and downloads it. */
export function useDownloadIntakeReceiptMutation() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  return useMutation({
    mutationFn: async (service: ServiceDetail) => {
      // Refetched if stale, so the receipt shows the company and customer as they are now.
      const [customer, settings, staffMember, { downloadIntakeReceipt }] = await Promise.all([
        queryClient.fetchQuery(customerQueryOptions(service.customer.id)),
        queryClient.fetchQuery(settingsQueryOptions),
        queryClient.fetchQuery(meQueryOptions),
        import("@/documents/downloadIntakeReceipt"),
      ]);
      await downloadIntakeReceipt({
        service,
        customer,
        settings,
        staffMember,
        t,
        language: i18n.language,
      });
    },
    onError: () => toast.error(t("Could not create the intake receipt. Please try again.")),
  });
}
