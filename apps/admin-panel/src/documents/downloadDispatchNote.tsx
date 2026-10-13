import { pdf } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import QRCode from "qrcode";
import type { ServiceDetail, Settings } from "@servicebook/schemas";
import { DispatchNote } from "./DispatchNote";
import { downloadBlob } from "./download";

/** The service's public link on the host the admin panel is served from (ADR-0001). */
function publicServiceUrl(publicToken: string) {
  return `${window.location.origin}/s/${publicToken}`;
}

/**
 * Renders a service's dispatch note in the given language and downloads it.
 * Loaded on demand, so the PDF renderer stays out of the main bundle.
 */
export async function downloadDispatchNote({
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
  const qrCode = await QRCode.toDataURL(publicServiceUrl(service.publicToken), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });
  const blob = await pdf(
    <DispatchNote
      service={service}
      settings={settings}
      qrCode={qrCode}
      t={t}
      language={language}
    />,
  ).toBlob();
  downloadBlob(blob, t("dispatch-note-{{number}}.pdf", { number: service.number }));
}
