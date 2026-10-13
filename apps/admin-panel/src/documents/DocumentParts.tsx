import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import { deviceLabel, type DeviceSummary, type ServiceDetail } from "@servicebook/schemas";
import { formatPlainDate } from "@/lib/format";
import { colors, documentStyles } from "./theme";

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  subtitle: {
    flexDirection: "row",
    gap: 3,
  },
  number: {
    fontWeight: 700,
    color: colors.primary,
  },
  date: {
    color: colors.muted,
  },
  qr: {
    alignItems: "center",
    width: 112,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
  },
  qrImage: {
    width: 76,
    height: 76,
  },
  qrCaption: {
    fontSize: 7,
    lineHeight: 1.3,
    textAlign: "center",
    color: colors.muted,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  field: {
    flexDirection: "row",
  },
  fieldLabel: {
    width: 70,
    color: colors.muted,
  },
  fieldValue: {
    flex: 1,
  },
  device: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  deviceDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 4,
  },
  serialNumber: {
    color: colors.muted,
  },
  signature: {
    width: 220,
  },
  signatureImage: {
    maxWidth: 160,
    maxHeight: 60,
    objectFit: "contain",
    marginBottom: 4,
  },
  signatureName: {
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    paddingTop: 4,
    fontWeight: 700,
  },
  signatureRole: {
    fontSize: 8,
    color: colors.muted,
  },
});

/** A document's title over the service number and date, with the QR code of its public link beside them. */
export function DocumentTitle({
  title,
  service,
  qrCode,
  t,
  language,
}: {
  title: string;
  service: ServiceDetail;
  /** A PNG `data:` URL of the QR code of the service's public link. */
  qrCode: string;
  t: TFunction;
  language: string;
}) {
  return (
    <View style={styles.titleRow}>
      <View>
        <Text style={documentStyles.title}>{title}</Text>
        <View style={styles.subtitle}>
          <Text style={styles.number}>{service.number}</Text>
          <Text style={styles.date}>· {formatPlainDate(service.date, language)}</Text>
        </View>
      </View>
      <View style={styles.qr}>
        <Image src={qrCode} style={styles.qrImage} />
        <Text style={styles.qrCaption}>{t("Scan to follow the service online")}</Text>
      </View>
    </View>
  );
}

/**
 * A small uppercase heading over a rounded, lightly tinted box. Kept on one
 * page unless `wrap` lets a long one break, its heading staying with its start.
 */
export function Section({
  title,
  bodyStyle,
  wrap = false,
  children,
}: {
  title: string;
  bodyStyle?: Styles[string];
  wrap?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.section} wrap={wrap}>
      <Text style={[documentStyles.eyebrow, styles.sectionTitle]} minPresenceAhead={40}>
        {title}
      </Text>
      <View style={bodyStyle ? [documentStyles.card, bodyStyle] : documentStyles.card}>
        {children}
      </View>
    </View>
  );
}

/** A muted label beside its value, like `DrawerSummaryRow` in the app. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{children}</Text>
    </View>
  );
}

/** The service's devices, one per row with its serial number, for a `Section`. */
export function DeviceRows({ devices, t }: { devices: DeviceSummary[]; t: TFunction }) {
  return devices.map((device, index) => (
    <View
      key={device.id}
      style={index > 0 ? [styles.device, styles.deviceDivider] : styles.device}
      wrap={false}
    >
      <Text>{deviceLabel(device)}</Text>
      {device.serialNumber && (
        <Text style={styles.serialNumber}>
          {t("S/N {{serialNumber}}", { serialNumber: device.serialNumber })}
        </Text>
      )}
    </View>
  ));
}

/**
 * A signature line with who signs under it and, when given, the Settings
 * signature image above it; without one, it is signed above the line by hand.
 */
export function Signature({
  image,
  name,
  role,
}: {
  image?: string | null;
  name: string;
  role?: string | null;
}) {
  return (
    <View style={styles.signature}>
      {image && <Image src={image} style={styles.signatureImage} />}
      <Text style={styles.signatureName}>{name}</Text>
      {role && <Text style={styles.signatureRole}>{role}</Text>}
    </View>
  );
}
