import { pdf } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import type { ServiceDetail, Settings } from "@servicebook/schemas";
import { downloadBlob } from "./download";
import { publicLinkQrCode } from "./qrCode";
import { ServiceReport } from "./ServiceReport";

/**
 * Renders a service's report in the given language and downloads it.
 * Loaded on demand, so the PDF renderer stays out of the main bundle.
 */
export async function downloadServiceReport({
  service,
  settings,
  t,
  language,
}: {
  service: ServiceDetail;
  settings: Settings;
  t: TFunction;
  language: string;
}) {
  const qrCode = await publicLinkQrCode(service.publicToken);
  const blob = await pdf(
    <ServiceReport
      service={service}
      settings={settings}
      qrCode={qrCode}
      t={t}
      language={language}
    />,
  ).toBlob();
  downloadBlob(blob, t("service-report-{{number}}.pdf", { number: service.number }));
}
