import { useTranslation } from "react-i18next";
import CreatableSelect from "react-select/creatable";
import type { Action } from "@servicebook/schemas";
import { useActionsQuery } from "@/lib/actions";
import { formatRsd } from "@/lib/format";
import { isCreateOption, toCreateOption, type CreateOption } from "@/lib/createOption";
import { CreateOptionLabel } from "./CreateOptionLabel";
import { selectClassNames } from "./selectClassNames";

type ActionPickerProps = {
  id?: string;
  value: Action | null;
  onChange: (action: Action | null) => void;
  /** Offers to create an action named after the search when no action has that name. */
  onCreate?: (name: string) => void;
  placeholder: string;
  "aria-label"?: string;
  invalid?: boolean;
};

type Option = Action | CreateOption;

/**
 * Picks one action from the price list by typing part of its name. The price
 * list is loaded whole, so the search runs in the browser.
 */
export function ActionPicker({
  id,
  value,
  onChange,
  onCreate,
  placeholder,
  "aria-label": ariaLabel,
  invalid,
}: ActionPickerProps) {
  const { t, i18n } = useTranslation();
  const { data: actions = [], isLoading } = useActionsQuery();

  return (
    <CreatableSelect<Option, false>
      inputId={id}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      value={value}
      // The create row never reaches onChange; it goes to onCreateOption.
      onChange={(action) => onChange(action && !isCreateOption(action) ? action : null)}
      options={actions}
      getOptionValue={(option) => (isCreateOption(option) ? option.input : option.id)}
      getOptionLabel={(option) => (isCreateOption(option) ? option.input : option.name)}
      formatOptionLabel={(option, { context }) =>
        isCreateOption(option) ? (
          <CreateOptionLabel>
            {t('Create action "{{name}}"', { name: option.input })}
          </CreateOptionLabel>
        ) : context === "value" ? (
          option.name
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium">{option.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatRsd(option.price, i18n.language)}
            </span>
          </div>
        )
      }
      isValidNewOption={(input) => {
        const name = input.trim().toLocaleLowerCase();
        return (
          onCreate !== undefined &&
          name !== "" &&
          !actions.some((action) => action.name.toLocaleLowerCase() === name)
        );
      }}
      getNewOptionData={(input) => toCreateOption(input.trim())}
      onCreateOption={(input) => onCreate?.(input.trim())}
      createOptionPosition="last"
      isLoading={isLoading}
      isClearable
      placeholder={placeholder}
      menuPlacement="auto"
      noOptionsMessage={() => t("No actions match your search.")}
      loadingMessage={() => t("Loading…")}
      unstyled
      classNames={selectClassNames<Option, false>(invalid)}
    />
  );
}
