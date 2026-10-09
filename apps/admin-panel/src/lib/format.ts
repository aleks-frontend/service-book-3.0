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

/**
 * A whole-dinar amount with the locale's digit grouping and "RSD" always after
 * it, e.g. "4.500 RSD" in Serbian and "4,500 RSD" in English.
 */
export function formatRsd(amount: number, language: string) {
  const number = amount.toLocaleString(toLocale(language), { maximumFractionDigits: 0 });
  return `${number} RSD`;
}

/** Today in the browser's time zone, as `YYYY-MM-DD`. */
export function todayPlainDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A `YYYY-MM-DD` date (no time of day), formatted like `formatDate`. */
export function formatPlainDate(date: string, language: string) {
  const [year, month, day] = date.split("-").map(Number);
  return formatDate(new Date(year, month - 1, day), language);
}
