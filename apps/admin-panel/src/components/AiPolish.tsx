import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import type { AiPolish } from "@/lib/useAiPolish";
import { Button } from "./ui/button";

/**
 * The "Polish" button, on the left of the row with the save actions. Not
 * rendered when the deployment doesn't offer AI polish.
 */
export function PolishButton({ polish }: { polish: AiPolish }) {
  const { t } = useTranslation();
  if (!polish.enabled) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!polish.canPolish}
      onClick={() => void polish.polish()}
    >
      {polish.isPolishing ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" aria-hidden />
      )}
      {polish.isPolishing ? t("Polishing…") : t("Polish")}
    </Button>
  );
}

/** "Polished by AI · Undo", under the textarea while the latest polish can be undone. */
export function PolishedBar({ polish }: { polish: AiPolish }) {
  const { t } = useTranslation();
  if (!polish.enabled) return null;

  return (
    // A live region that is always there, so the bar is announced as it appears.
    <div role="status" className="text-sm text-muted-foreground empty:hidden">
      {polish.isPolished && (
        <p className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("Polished by AI")}
          <span aria-hidden>·</span>
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto px-0"
            onClick={polish.undo}
          >
            {t("Undo")}
          </Button>
        </p>
      )}
    </div>
  );
}
