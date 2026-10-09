import { useTranslation } from "react-i18next";
import Select from "react-select";
import type { Action } from "@servicebook/schemas";
import { useActionsQuery } from "@/lib/actions";
import { formatRsd } from "@/lib/format";
import { selectClassNames } from "./selectClassNames";

type ActionPickerProps = {
  id?: string;
  value: Action | null;
  onChange: (action: Action | null) => void;
  placeholder: string;
  "aria-label"?: string;
  invalid?: boolean;
};

/**
 * Picks one action from the price list by typing part of its name. The price
 * list is loaded whole, so the search runs in the browser.
 */
export function ActionPicker({
  id,
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  invalid,
}: ActionPickerProps) {
  const { t, i18n } = useTranslation();
  const { data: actions = [], isLoading } = useActionsQuery();

  return (
    <Select<Action, false>
      inputId={id}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      value={value}
      onChange={(action) => onChange(action)}
      options={actions}
      getOptionValue={(action) => action.id}
      getOptionLabel={(action) => action.name}
      formatOptionLabel={(action, { context }) =>
        context === "value" ? (
          action.name
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium">{action.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatRsd(action.price, i18n.language)}
            </span>
          </div>
        )
      }
      isLoading={isLoading}
      isClearable
      placeholder={placeholder}
      menuPlacement="auto"
      noOptionsMessage={() => t("No actions match your search.")}
      loadingMessage={() => t("Loading…")}
      unstyled
      classNames={selectClassNames<Action, false>(invalid)}
    />
  );
}
