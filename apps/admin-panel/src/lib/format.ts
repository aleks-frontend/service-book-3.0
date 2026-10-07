/** BCP 47 locale for each UI language; Serbian is written in Latin script here. */
const LOCALES = { sr: "sr-Latn-RS", hu: "hu-HU", en: "en-GB" } as const;

export function formatDate(date: Date, language: string) {
  const locale = LOCALES[language as keyof typeof LOCALES] ?? LOCALES.sr;
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}
