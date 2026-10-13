import { pdf } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import QRCode from "qrcode";
import type { Customer, ServiceDetail, Settings, StaffMember } from "@servicebook/schemas";
import { downloadBlob } from "./download";
import { IntakeReceipt } from "./IntakeReceipt";

/** The service's public link on the host the admin panel is served from (ADR-0001). */
function publicServiceUrl(publicToken: string) {
  return `${window.location.origin}/s/${publicToken}`;
}

/**
 * Renders a service's intake receipt in the given language and downloads it.
 * Loaded on demand, so the PDF renderer stays out of the main bundle.
 */
export async function downloadIntakeReceipt({
  service,
  customer,
  settings,
  staffMember,
  t,
  language,
}: {
  service: ServiceDetail;
  customer: Customer;
  settings: Settings;
  staffMember: StaffMember;
  t: TFunction;
  language: string;
}) {
  const qrCode = await QRCode.toDataURL(publicServiceUrl(service.publicToken), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });
  const blob = await pdf(
    <IntakeReceipt
      service={service}
      customer={customer}
      settings={settings}
      staffMember={staffMember}
      qrCode={qrCode}
      t={t}
      language={language}
    />,
  ).toBlob();
  downloadBlob(blob, t("intake-receipt-{{number}}.pdf", { number: service.number }));
}
