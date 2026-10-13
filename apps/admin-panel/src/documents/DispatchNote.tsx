import type { ReactNode } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import { deviceLabel, type ServiceDetail, type Settings } from "@servicebook/schemas";
import { formatAmount, formatPlainDate, formatRsd } from "@/lib/format";
import { CompanyHeader } from "./CompanyHeader";
import { colors, documentStyles } from "./theme";

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  facts: {
    marginBottom: 20,
    gap: 2,
  },
  fact: {
    flexDirection: "row",
  },
  factLabel: {
    width: 90,
    color: colors.muted,
  },
  factValue: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    color: colors.muted,
    fontWeight: 700,
  },
  labelCell: { flex: 1, paddingRight: 8 },
  quantityCell: { width: 50, textAlign: "right" },
  priceCell: { width: 110, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    paddingTop: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 40,
  },
  signature: {
    width: 180,
    alignItems: "center",
  },
  signatureImage: {
    maxWidth: 160,
    maxHeight: 60,
    objectFit: "contain",
    marginBottom: 4,
  },
  signatureLine: {
    alignSelf: "stretch",
    borderTopWidth: 1,
    borderTopColor: colors.text,
    paddingTop: 2,
    textAlign: "center",
    color: colors.muted,
  },
  qr: {
    width: 120,
    alignItems: "center",
  },
  qrImage: {
    width: 90,
    height: 90,
  },
  qrCaption: {
    fontSize: 8,
    textAlign: "center",
    color: colors.muted,
  },
});

type DispatchNoteProps = {
  service: ServiceDetail;
  settings: Settings;
  /** A PNG `data:` URL of the QR code of the service's public link. */
  qrCode: string;
  t: TFunction;
  language: string;
};

/** The dispatch note handed to the customer on pickup (see GLOSSARY.md). */
export function DispatchNote({ service, settings, qrCode, t, language }: DispatchNoteProps) {
  const devices = service.devices.map(deviceLabel).join(", ") || "—";

  return (
    <Document title={t("Dispatch note {{number}}", { number: service.number })} language={language}>
      <Page size="A4" style={documentStyles.page}>
        <CompanyHeader settings={settings} t={t} />

        <View style={styles.titleRow}>
          <Text style={documentStyles.title}>{t("Dispatch note")}</Text>
          <Text>{service.number}</Text>
        </View>

        <View style={styles.facts}>
          <Fact label={t("Date")}>{formatPlainDate(service.date, language)}</Fact>
          <Fact label={t("Customer")}>
            {service.customer.name}, {service.customer.phone}
          </Fact>
          <Fact label={t("Devices")}>{devices}</Fact>
        </View>

        <View style={[styles.row, styles.headerRow]} fixed>
          <Text style={styles.labelCell}>{t("Line")}</Text>
          <Text style={styles.quantityCell}>{t("Quantity")}</Text>
          <Text style={styles.priceCell}>{t("Unit price (RSD)")}</Text>
          <Text style={styles.priceCell}>{t("Amount (RSD)")}</Text>
        </View>
        {service.lines.map((line) => (
          <View key={line.id} style={styles.row} wrap={false}>
            <Text style={styles.labelCell}>{line.label}</Text>
            <Text style={styles.quantityCell}>{line.quantity}</Text>
            <Text style={styles.priceCell}>{formatAmount(line.unitPrice, language)}</Text>
            <Text style={styles.priceCell}>
              {formatAmount(line.quantity * line.unitPrice, language)}
            </Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text>{t("Total")}</Text>
          <Text>{formatRsd(service.total, language)}</Text>
        </View>

        <View style={styles.footer} wrap={false}>
          <View style={styles.signature}>
            {settings.signature && <Image src={settings.signature} style={styles.signatureImage} />}
            <Text style={styles.signatureLine}>{t("Signature")}</Text>
          </View>
          <View style={styles.qr}>
            <Image src={qrCode} style={styles.qrImage} />
            <Text style={styles.qrCaption}>{t("Scan to follow the service online")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{children}</Text>
    </View>
  );
}
