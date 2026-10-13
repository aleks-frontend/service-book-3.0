import { Font, StyleSheet } from "@react-pdf/renderer";
import notoSansBold from "./fonts/NotoSans-Bold.ttf?url";
import notoSansRegular from "./fonts/NotoSans-Regular.ttf?url";

// The PDF standard fonts lack letters such as č, đ and ő, so documents embed Noto Sans.
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: notoSansRegular, fontWeight: 400 },
    { src: notoSansBold, fontWeight: 700 },
  ],
});
// Names and models must not be hyphenated across lines.
Font.registerHyphenationCallback((word) => [word]);

/** The admin panel's colour tokens (`src/index.css`) as hex, so documents look like the app. */
export const colors = {
  text: "#0f1729", // --foreground
  muted: "#5a687c", // --muted-foreground
  border: "#d7dfea", // --border
  primary: "#1450d2", // --primary
  surface: "#f4f7fb", // --muted at about half strength, like the drawer's summary box
};

/** Styles shared by every document: an A4 page with the app's accent band, and its type. */
export const documentStyles = StyleSheet.create({
  page: {
    fontFamily: "Noto Sans",
    fontSize: 10,
    lineHeight: 1.4,
    color: colors.text,
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
  },
  accentBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.primary,
  },
  // Larger text sets its own line height; the page's is relative to its 10pt.
  title: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  /** A small uppercase heading over a section, in the primary colour. */
  eyebrow: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: colors.primary,
  },
  /** A rounded, lightly tinted box, like `DrawerSummary` in the app. */
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    padding: 10,
  },
});
