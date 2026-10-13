import QRCode from "qrcode";

/** The service's public link on the host the admin panel is served from (ADR-0001). */
function publicServiceUrl(publicToken: string) {
  return `${window.location.origin}/s/${publicToken}`;
}

/** A PNG `data:` URL of the QR code of a service's public link, for printing on its documents. */
export function publicLinkQrCode(publicToken: string) {
  return QRCode.toDataURL(publicServiceUrl(publicToken), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });
}
