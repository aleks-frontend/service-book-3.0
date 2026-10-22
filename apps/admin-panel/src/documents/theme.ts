import { Font, StyleSheet } from "@react-pdf/renderer";
import archivoBold from "./fonts/Archivo-Bold.ttf?url";
import archivoRegular from "./fonts/Archivo-Regular.ttf?url";
import bigShouldersExtraBold from "./fonts/BigShouldersDisplay-ExtraBold.ttf?url";

// The admin panel's faces (ADR-0005). The PDF standard fonts lack letters such as č, đ and ő;
// these cover them.
Font.register({
  family: "Archivo",
  fonts: [
    { src: archivoRegular, fontWeight: 400 },
    { src: archivoBold, fontWeight: 700 },
  ],
});
Font.register({
  family: "Big Shoulders Display",
  fonts: [{ src: bigShouldersExtraBold, fontWeight: 800 }],
});
// Names and models must not be hyphenated across lines.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The admin panel's light colour tokens (`src/index.css`) as hex; keep them in
 * sync. Documents are ink-light: colour goes on text, rules, borders and the
 * logo only, never on a filled or tinted area.
 */
export const colors = {
  text: "#1C2124", // --foreground
  muted: "#545D63", // --muted-foreground
  border: "#C4CACC", // --border
  primary: "#F5C400", // --primary; too faint for text on paper, so only the logo's fill
};

/** Styles shared by every document: an A4 page and its type. */
export const documentStyles = StyleSheet.create({
  page: {
    fontFamily: "Archivo",
    fontSize: 10,
    lineHeight: 1.4,
    color: colors.text,
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
  },
  // Larger text sets its own line height; the page's is relative to its 10pt.
  title: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  /** The service number, in the display face as in the app. */
  serviceNumber: {
    fontFamily: "Big Shoulders Display",
    fontWeight: 800,
    fontSize: 16,
    lineHeight: 1.1,
  },
  /** A section's heading, over a rule. */
  sectionTitle: {
    fontWeight: 700,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
  },
  sectionBody: {
    paddingTop: 6,
  },
});
