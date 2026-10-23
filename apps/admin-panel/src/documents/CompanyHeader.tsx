import { Image, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { TFunction } from "i18next";
import type { Settings } from "@servicebook/schemas";
import { TAG_LINES_PATH, TAG_PATH } from "@/lib/logo";
import { colors } from "./theme";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 14,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  company: {
    flex: 1,
  },
  mark: {
    width: 28,
    height: 28,
  },
  logo: {
    maxWidth: 121,
    maxHeight: 61.6,
    objectFit: "contain",
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  details: {
    color: colors.muted,
  },
});

/**
 * The company's identity from Settings at the top of every document, over an
 * ink rule with Service Book's tag beside it; unset fields are left out.
 */
export function CompanyHeader({ settings, t }: { settings: Settings; t: TFunction }) {
  const contacts = [settings.phone, settings.email].filter(Boolean).join(" · ");

  return (
    <View style={styles.header} fixed>
      {settings.logo && <Image src={settings.logo} style={styles.logo} />}
      <View style={styles.company}>
        {settings.name && <Text style={styles.name}>{settings.name}</Text>}
        {settings.address && <Text style={styles.details}>{settings.address}</Text>}
        {contacts && <Text style={styles.details}>{contacts}</Text>}
        {settings.taxId && (
          <Text style={styles.details}>
            {t("Tax ID")} {settings.taxId}
          </Text>
        )}
      </View>
      {/* Yellow alone is too faint on paper; the ink outline carries it. */}
      <Svg viewBox="0 0 32 32" style={styles.mark}>
        <Path
          d={TAG_PATH}
          fillRule="evenodd"
          fill={colors.primary}
          stroke={colors.text}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path d={TAG_LINES_PATH} stroke={colors.text} strokeWidth={2.25} strokeLinecap="square" />
      </Svg>
    </View>
  );
}
