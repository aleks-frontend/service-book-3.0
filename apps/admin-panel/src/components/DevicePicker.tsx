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
  placeholder: string;
  "aria-label"?: string;
  invalid?: boolean;
  disabled?: boolean;
} & (
  | {
      /** Picks several devices, e.g. those a customer brings in. */
      multiple: true;
      value: DeviceSummary[];
      onChange: (devices: DeviceSummary[]) => void;
    }
  | {
      /** Picks one device, e.g. one sold on a sale line. */
      multiple?: false;
      value: DeviceSummary | null;
      onChange: (device: DeviceSummary | null) => void;
    }
);

/**
 * Picks devices available to a customer by typing part of the manufacturer,
 * model or serial number; the search runs on the server.
 *
 * Like `CustomerPicker`, the menu renders inline so it works inside a dialog.
 */
export function DevicePicker(props: DevicePickerProps) {
  const { id, customerId, placeholder, "aria-label": ariaLabel, invalid, disabled } = props;
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
    <Select<DeviceSummary, boolean>
      inputId={id}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      isMulti={props.multiple}
      value={props.value}
      onChange={(picked) => {
        if (props.multiple) props.onChange([...(picked as readonly DeviceSummary[])]);
        else props.onChange(picked as DeviceSummary | null);
      }}
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
      closeMenuOnSelect={!props.multiple}
      isLoading={isFetching}
      isClearable={!props.multiple}
      isDisabled={disabled}
      placeholder={placeholder}
      menuPlacement="auto"
      noOptionsMessage={() => t("No devices match your search.")}
      loadingMessage={() => t("Loading…")}
      unstyled
      classNames={selectClassNames<DeviceSummary, boolean>(invalid)}
    />
  );
}
