import { useTranslation } from "react-i18next";
import { LANGUAGES, changeLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

const LANGUAGE_NAMES = { sr: "Srpski", hu: "Magyar", en: "English" } as const;

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();

  return (
    <div role="group" aria-label={t("Language")} className={cn("flex gap-1", className)}>
      {LANGUAGES.map((language) => {
        const active = i18n.resolvedLanguage === language;
        return (
          <button
            key={language}
            type="button"
            lang={language}
            title={LANGUAGE_NAMES[language]}
            aria-label={LANGUAGE_NAMES[language]}
            aria-pressed={active}
            onClick={() => changeLanguage(language)}
            className={cn(
              "h-8 rounded-md border px-2 text-xs font-semibold uppercase transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            {language}
          </button>
        );
      })}
    </div>
  );
}
