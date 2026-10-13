import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import type { Settings } from "@servicebook/schemas";
import { colors } from "./theme";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: 12,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    maxWidth: 120,
    maxHeight: 60,
    objectFit: "contain",
  },
  name: {
    fontSize: 13,
    fontWeight: 700,
  },
  details: {
    color: colors.muted,
  },
});

/** The company's identity from Settings at the top of every document; unset fields are left out. */
export function CompanyHeader({ settings, t }: { settings: Settings; t: TFunction }) {
  const contacts = [settings.phone, settings.email].filter(Boolean).join(" · ");

  return (
    <View style={styles.header} fixed>
      {settings.logo && <Image src={settings.logo} style={styles.logo} />}
      <View>
        {settings.name && <Text style={styles.name}>{settings.name}</Text>}
        {settings.address && <Text style={styles.details}>{settings.address}</Text>}
        {contacts && <Text style={styles.details}>{contacts}</Text>}
        {settings.taxId && (
          <Text style={styles.details}>
            {t("Tax ID")} {settings.taxId}
          </Text>
        )}
      </View>
    </View>
  );
}
