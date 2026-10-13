import type { ReactNode } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import {
  deviceLabel,
  type Customer,
  type ServiceDetail,
  type Settings,
  type StaffMember,
} from "@servicebook/schemas";
import { formatPlainDate } from "@/lib/format";
import { CompanyHeader } from "./CompanyHeader";
import { colors, documentStyles } from "./theme";

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  qr: {
    width: 110,
    alignItems: "center",
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  qrCaption: {
    fontSize: 8,
    textAlign: "center",
    color: colors.muted,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  sectionTitle: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontWeight: 700,
  },
  sectionBody: {
    padding: 8,
    gap: 2,
  },
  faultBody: {
    minHeight: 140,
  },
  fieldLabel: {
    fontWeight: 700,
  },
  serialNumber: {
    marginLeft: 10,
    fontSize: 9,
    color: colors.muted,
  },
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 40,
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
    borderTopColor: colors.text,
    paddingTop: 4,
    fontWeight: 700,
  },
});

type IntakeReceiptProps = {
  service: ServiceDetail;
  /** The service's customer in full, for their email and address. */
  customer: Customer;
  settings: Settings;
  /** The staff member handing the receipt over, who signs it for the shop. */
  staffMember: StaffMember;
  /** A PNG `data:` URL of the QR code of the service's public link. */
  qrCode: string;
  t: TFunction;
  language: string;
};

/**
 * The intake receipt given to the customer when they leave their devices
 * (see GLOSSARY.md); they bring it back to pick them up.
 */
export function IntakeReceipt({
  service,
  customer,
  settings,
  staffMember,
  qrCode,
  t,
  language,
}: IntakeReceiptProps) {
  return (
    <Document
      title={t("Intake receipt {{number}}", { number: service.number })}
      language={language}
    >
      <Page size="A4" style={documentStyles.page}>
        <CompanyHeader settings={settings} t={t} />

        <View style={styles.titleRow}>
          <View>
            <Text style={documentStyles.title}>
              {t("Intake receipt {{number}}", { number: service.number })}
            </Text>
            <Text>{formatPlainDate(service.date, language)}</Text>
          </View>
          <View style={styles.qr}>
            <Image src={qrCode} style={styles.qrImage} />
            <Text style={styles.qrCaption}>{t("Scan to follow the service online")}</Text>
          </View>
        </View>

        <Section title={t("Customer details")}>
          <Field label={t("Name")}>{customer.name}</Field>
          {customer.email && <Field label={t("Email")}>{customer.email}</Field>}
          <Field label={t("Phone")}>{customer.phone}</Field>
          {customer.address && <Field label={t("Address")}>{customer.address}</Field>}
        </Section>

        <Section title={t("Devices on service")}>
          {service.devices.map((device) => (
            <View key={device.id} wrap={false}>
              <Text>– {deviceLabel(device)}</Text>
              {device.serialNumber && (
                <Text style={styles.serialNumber}>
                  {t("S/N {{serialNumber}}", { serialNumber: device.serialNumber })}
                </Text>
              )}
            </View>
          ))}
        </Section>

        <Section title={t("Fault description")} bodyStyle={styles.faultBody}>
          <Text>{service.description ?? ""}</Text>
        </Section>

        <View style={styles.signatures} wrap={false}>
          {/* With no signature image in Settings, the staff member signs above their name by hand. */}
          <View style={styles.signature}>
            {settings.signature && <Image src={settings.signature} style={styles.signatureImage} />}
            <Text style={styles.signatureName}>{staffMember.name}</Text>
          </View>
          <View style={styles.signature}>
            <Text style={styles.signatureName}>{customer.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function Section({
  title,
  bodyStyle,
  children,
}: {
  title: string;
  bodyStyle?: (typeof styles)[keyof typeof styles];
  children: ReactNode;
}) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={bodyStyle ? [styles.sectionBody, bodyStyle] : styles.sectionBody}>
        {children}
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Text>
      <Text style={styles.fieldLabel}>{label}:</Text> {children}
    </Text>
  );
}
