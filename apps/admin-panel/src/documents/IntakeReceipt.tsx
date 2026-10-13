import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import type { Customer, ServiceDetail, Settings, StaffMember } from "@servicebook/schemas";
import { CompanyHeader } from "./CompanyHeader";
import { DeviceRows, DocumentTitle, Field, Section, Signature } from "./DocumentParts";
import { documentStyles } from "./theme";

const styles = StyleSheet.create({
  // White, so there is room to add notes by hand.
  faultBody: {
    minHeight: 140,
    backgroundColor: "#ffffff",
  },
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 36,
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

        <DocumentTitle
          title={t("Intake receipt")}
          service={service}
          qrCode={qrCode}
          t={t}
          language={language}
        />

        <Section title={t("Customer details")}>
          <Field label={t("Name")}>{customer.name}</Field>
          {customer.email && <Field label={t("Email")}>{customer.email}</Field>}
          <Field label={t("Phone")}>{customer.phone}</Field>
          {customer.address && <Field label={t("Address")}>{customer.address}</Field>}
        </Section>

        <Section title={t("Devices on service")}>
          <DeviceRows devices={service.devices} t={t} />
        </Section>

        <Section title={t("Fault description")} bodyStyle={styles.faultBody}>
          <Text>{service.description ?? ""}</Text>
        </Section>

        <View style={styles.signatures} wrap={false}>
          <Signature image={settings.signature} name={staffMember.name} role={settings.name} />
          <Signature name={customer.name} role={t("Customer")} />
        </View>
      </Page>
    </Document>
  );
}
