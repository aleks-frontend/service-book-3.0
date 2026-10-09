import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Select from "react-select";
import { deviceLabel, type DeviceSummary } from "@servicebook/schemas";
import { useDevicesQuery } from "@/lib/devices";
import { selectClassNames } from "./selectClassNames";

const SEARCH_DEBOUNCE_MS = 300;
const MAX_OPTIONS = 10;

type DevicePickerProps = {
  id?: string;
  /** Offers this customer's devices and generic ones. */
  customerId: string | null;
  value: DeviceSummary[];
  onChange: (devices: DeviceSummary[]) => void;
  placeholder: string;
  invalid?: boolean;
  disabled?: boolean;
};

/**
 * Picks the devices a customer brings in, by typing part of the manufacturer,
 * model or serial number; the search runs on the server.
 *
 * Like `CustomerPicker`, the menu renders inline so it works inside a dialog.
 */
export function DevicePicker({
  id,
  customerId,
  value,
  onChange,
  placeholder,
  invalid,
  disabled,
}: DevicePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(inputValue.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [inputValue]);

  const { data, isFetching } = useDevicesQuery(
    { search, page: 1, pageSize: MAX_OPTIONS, availableTo: customerId ?? undefined },
    { enabled: open && customerId !== null },
  );
  const options: DeviceSummary[] = (data?.items ?? []).map(
    ({ id, manufacturer, model, serialNumber, owner }) => ({
      id,
      manufacturer,
      model,
      serialNumber,
      owner,
    }),
  );

  return (
    <Select<DeviceSummary, true>
      inputId={id}
      aria-invalid={invalid}
      isMulti
      value={value}
      onChange={(devices) => onChange([...devices])}
      options={options}
      getOptionValue={(device) => device.id}
      getOptionLabel={deviceLabel}
      formatOptionLabel={(device, { context }) =>
        context === "value" ? (
          deviceLabel(device)
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium">{deviceLabel(device)}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {[device.serialNumber, device.owner ? null : t("Generic")]
                .filter(Boolean)
                .join(" · ")}
            </span>
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
      closeMenuOnSelect={false}
      isLoading={isFetching}
      isClearable={false}
      isDisabled={disabled}
      placeholder={placeholder}
      menuPlacement="auto"
      noOptionsMessage={() => t("No devices match your search.")}
      loadingMessage={() => t("Loading…")}
      unstyled
      classNames={selectClassNames<DeviceSummary, true>(invalid)}
    />
  );
}
