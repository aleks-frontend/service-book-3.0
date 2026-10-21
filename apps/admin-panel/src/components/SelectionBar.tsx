import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import { Button } from "./ui/button";

type SelectionBarProps = {
  count: number;
  onDelete: () => void;
  onClear: () => void;
};

/** "N selected · Delete · Clear" above a table with checked rows; hidden when none are. */
export function SelectionBar({ count, onDelete, onClear }: SelectionBarProps) {
  const { t } = useTranslation();
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted px-3 py-2 text-sm">
      <span className="font-medium">{t("Selected: {{count}}", { count })}</span>
      <Button variant="destructive" size="sm" onClick={onDelete}>
        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
        {t("Delete selected")}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="mr-2 h-4 w-4" aria-hidden />
        {t("Clear selection")}
      </Button>
    </div>
  );
}
