import { useTranslation } from "react-i18next";

/** Stand-in for a section that later tickets fill in. */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();

  return (
    <section>
      <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
      <p className="mt-2 text-muted-foreground">{t("This section is coming soon.")}</p>
    </section>
  );
}
