import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CreatableSelect from "react-select/creatable";
import type { Action } from "@servicebook/schemas";
import { useActionsQuery } from "@/lib/actions";
import { formatRsd } from "@/lib/format";
import { isCreateOption, toCreateOption, type CreateOption } from "@/lib/createOption";
import { CreateOptionLabel } from "./CreateOptionLabel";
import { selectClassNames } from "./selectClassNames";

const SEARCH_DEBOUNCE_MS = 300;
const MAX_OPTIONS = 10;

type ActionPickerProps = {
  id?: string;
  value: Action | null;
  onChange: (action: Action | null) => void;
  /** Offers a new action with what was typed as its name, unless one of the matches has that name. */
  onCreate?: (name: string) => void;
  placeholder: string;
  "aria-label"?: string;
  invalid?: boolean;
};

type Option = Action | CreateOption;

/**
 * Picks one action from the price list by typing part of its name; the search
 * runs on the server, so it covers the whole price list, not just the first page.
 *
 * The menu renders inline rather than in a portal: inside a modal dialog,
 * anything outside the dialog's content does not receive clicks.
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
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(inputValue.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [inputValue]);

  const { data, isFetching } = useActionsQuery(
    { search, page: 1, pageSize: MAX_OPTIONS },
    { enabled: open },
  );
  const actions = data?.items ?? [];

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
            {t('New action "{{name}}"', { name: option.input })}
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
      // The server already filtered the options by the search.
      filterOption={null}
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
      inputValue={inputValue}
      onInputChange={(next, { action }) => {
        if (action === "input-change") setInputValue(next);
        else if (action === "menu-close") setInputValue("");
      }}
      onMenuOpen={() => setOpen(true)}
      onMenuClose={() => setOpen(false)}
      isLoading={isFetching}
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
