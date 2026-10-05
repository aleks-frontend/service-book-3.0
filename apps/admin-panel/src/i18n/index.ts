import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslations from "./en.json";
import huTranslations from "./hu.json";
import srTranslations from "./sr.json";

export const LANGUAGES = ["sr", "hu", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const DEFAULT_LANGUAGE: Language = "sr";
const LANGUAGE_STORAGE_KEY = "servicebook-language";

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

function readSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Switches the UI language and remembers the choice for the next visit. */
export function changeLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable (private mode); the switch still applies to this visit.
  }
  void i18n.changeLanguage(language);
}

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  resources: {
    sr: { translation: srTranslations },
    hu: { translation: huTranslations },
    en: { translation: enTranslations },
  },
  lng: readSavedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
