import QRCode from "qrcode";
import { publicServiceUrl } from "@/lib/publicServices";

/** A PNG `data:` URL of the QR code of a service's public link, for printing on its documents. */
export function publicLinkQrCode(publicToken: string) {
  return QRCode.toDataURL(publicServiceUrl(publicToken), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });
}
