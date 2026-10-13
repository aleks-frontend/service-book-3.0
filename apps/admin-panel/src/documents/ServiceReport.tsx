import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import type { ServiceDetail, Settings } from "@servicebook/schemas";
import { formatAmount, formatRsd } from "@/lib/format";
import { CompanyHeader } from "./CompanyHeader";
import { DeviceRows, DocumentTitle, Field, Section, Signature } from "./DocumentParts";
import { colors, documentStyles } from "./theme";

const styles = StyleSheet.create({
  lineRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    paddingTop: 0,
    color: colors.muted,
    fontWeight: 700,
  },
  labelCell: { flex: 1, paddingRight: 8 },
  quantityCell: { width: 58, paddingLeft: 8, textAlign: "right" },
  priceCell: { width: 110, paddingLeft: 8, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    paddingTop: 8,
    fontSize: 12,
    lineHeight: 1.3,
    fontWeight: 700,
  },
  totalAmount: {
    color: colors.primary,
  },
  noLines: {
    color: colors.muted,
  },
  // White, so the text written for the customer stands out.
  reportBody: {
    backgroundColor: "#ffffff",
  },
  signatures: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 36,
  },
});

type ServiceReportProps = {
  service: ServiceDetail;
  settings: Settings;
  /** A PNG `data:` URL of the QR code of the service's public link. */
  qrCode: string;
  t: TFunction;
  language: string;
};

/**
 * The service report handed to the customer once the service is done (see
 * GLOSSARY.md): its lines and total, and the customer report.
 */
export function ServiceReport({ service, settings, qrCode, t, language }: ServiceReportProps) {
  return (
    <Document
      title={t("Service report {{number}}", { number: service.number })}
      language={language}
    >
      <Page size="A4" style={documentStyles.page}>
        <CompanyHeader settings={settings} t={t} />

        <DocumentTitle
          title={t("Service report")}
          service={service}
          qrCode={qrCode}
          t={t}
          language={language}
        />

        <Section title={t("Customer details")}>
          <Field label={t("Name")}>{service.customer.name}</Field>
          <Field label={t("Phone")}>{service.customer.phone}</Field>
        </Section>

        <Section title={t("Devices on service")}>
          <DeviceRows devices={service.devices} t={t} />
        </Section>

        <Section title={t("Work and sales")} wrap>
          <View style={[styles.lineRow, styles.headerRow]}>
            <Text style={styles.labelCell}>{t("Description")}</Text>
            <Text style={styles.quantityCell}>{t("Quantity")}</Text>
            <Text style={styles.priceCell}>{t("Unit price (RSD)")}</Text>
            <Text style={styles.priceCell}>{t("Line total (RSD)")}</Text>
          </View>
          {service.lines.length === 0 && (
            <Text style={[styles.lineRow, styles.noLines]}>
              {t("No work or sales recorded yet.")}
            </Text>
          )}
          {service.lines.map((line) => (
            <View key={line.id} style={styles.lineRow} wrap={false}>
              <Text style={styles.labelCell}>{line.label}</Text>
              <Text style={styles.quantityCell}>{line.quantity}</Text>
              <Text style={styles.priceCell}>{formatAmount(line.unitPrice, language)}</Text>
              <Text style={styles.priceCell}>
                {formatAmount(line.quantity * line.unitPrice, language)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow} wrap={false}>
            <Text>{t("Total")}</Text>
            <Text style={styles.totalAmount}>{formatRsd(service.total, language)}</Text>
          </View>
        </Section>

        {service.customerReport && (
          <Section title={t("Customer report")} bodyStyle={styles.reportBody} wrap>
            <Text>{service.customerReport}</Text>
          </Section>
        )}

        <View style={styles.signatures} wrap={false}>
          <Signature image={settings.signature} name={settings.name ?? t("Signature")} />
        </View>
      </Page>
    </Document>
  );
}
