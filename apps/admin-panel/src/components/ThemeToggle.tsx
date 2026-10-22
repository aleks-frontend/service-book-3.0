import { useTranslation } from "react-i18next";
import { Moon } from "lucide-react";
import { changeTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Switches between the light and dark themes; pressed while dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const dark = useTheme() === "dark";

  return (
    <button
      type="button"
      title={t("Dark theme")}
      aria-label={t("Dark theme")}
      aria-pressed={dark}
      onClick={() => changeTheme(dark ? "light" : "dark")}
      className={cn(
        "inline-grid h-8 w-8 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dark
          ? "border-foreground bg-foreground text-background"
          : "border-input bg-card text-muted-foreground hover:border-foreground hover:text-foreground",
        className,
      )}
    >
      <Moon className="h-4 w-4" aria-hidden />
    </button>
  );
}
