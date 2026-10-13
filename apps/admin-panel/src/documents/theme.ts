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

export const colors = {
  text: "#1f2937",
  muted: "#6b7280",
  border: "#d1d5db",
};

/** Styles shared by every document: an A4 page and its type. */
export const documentStyles = StyleSheet.create({
  page: {
    fontFamily: "Noto Sans",
    fontSize: 10,
    lineHeight: 1.4,
    color: colors.text,
    padding: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
  },
});
