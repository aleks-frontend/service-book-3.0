import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Select from "react-select";
import type { CustomerSummary } from "@servicebook/schemas";
import { useCustomersQuery } from "@/lib/customers";
import { selectClassNames } from "./selectClassNames";

const SEARCH_DEBOUNCE_MS = 300;
const MAX_OPTIONS = 10;

type CustomerPickerProps = {
  id?: string;
  value: CustomerSummary | null;
  onChange: (customer: CustomerSummary | null) => void;
  placeholder: string;
  "aria-label"?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Picks one customer by typing part of their name, phone or email; the search
 * runs on the server, so it covers every customer, not just the first page.
 *
 * The menu renders inline rather than in a portal: inside a modal dialog,
 * anything outside the dialog's content does not receive clicks.
 */
export function CustomerPicker({
  id,
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  invalid,
  disabled,
  className,
}: CustomerPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(inputValue.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [inputValue]);

  const { data, isFetching } = useCustomersQuery(
    { search, page: 1, pageSize: MAX_OPTIONS },
    { enabled: open },
  );
  const options: CustomerSummary[] = (data?.items ?? []).map(({ id, name, phone }) => ({
    id,
    name,
    phone,
  }));

  return (
    <Select<CustomerSummary, false>
      inputId={id}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      className={className}
      value={value}
      onChange={(customer) => onChange(customer)}
      options={options}
      getOptionValue={(customer) => customer.id}
      getOptionLabel={(customer) => customer.name}
      formatOptionLabel={(customer, { context }) =>
        context === "value" ? (
          customer.name
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium">{customer.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{customer.phone}</span>
          </div>
        )
      }
      // The server already filtered the options by the search.
      filterOption={null}
      inputValue={inputValue}
      onInputChange={(next, { action }) => {
        if (action === "input-change") setInputValue(next);
        else if (action === "menu-close") setInputValue("");
      }}
      onMenuOpen={() => setOpen(true)}
      onMenuClose={() => setOpen(false)}
      isLoading={isFetching}
      isClearable
      isDisabled={disabled}
      placeholder={placeholder}
      menuPlacement="auto"
      noOptionsMessage={() => t("No customers match your search.")}
      loadingMessage={() => t("Loading…")}
      unstyled
      classNames={selectClassNames<CustomerSummary, false>(invalid)}
    />
  );
}
