/** BCP 47 locale for each UI language; Serbian is written in Latin script here. */
const LOCALES = { sr: "sr-Latn-RS", hu: "hu-HU", en: "en-GB" } as const;

function toLocale(language: string) {
  return LOCALES[language as keyof typeof LOCALES] ?? LOCALES.sr;
}

export function formatDate(date: Date, language: string) {
  return date.toLocaleDateString(toLocale(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** A whole-dinar amount, e.g. "4.500 RSD" in Serbian or "RSD 4,500" in English. */
export function formatRsd(amount: number, language: string) {
  return new Intl.NumberFormat(toLocale(language), {
    style: "currency",
    currency: "RSD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
