import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import type { CustomerSummary } from "@servicebook/schemas";
import { useCustomersQuery } from "@/lib/customers";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

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
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data, isFetching } = useCustomersQuery(
    { search, page: 1, pageSize: MAX_OPTIONS },
    { enabled: open },
  );
  const options = data?.items ?? [];

  function openList() {
    setQuery("");
    setSearch("");
    setActiveIndex(0);
    setOpen(true);
  }

  function select(customer: CustomerSummary | null) {
    onChange(customer && { id: customer.id, name: customer.name, phone: customer.phone });
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => Math.min(Math.max(index + step, 0), options.length - 1));
    } else if (event.key === "Enter" && open) {
      // Picking an option must not submit the surrounding form.
      event.preventDefault();
      if (options[activeIndex]) select(options[activeIndex]);
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[activeIndex] ? optionId(activeIndex) : undefined}
            aria-invalid={invalid}
            autoComplete="off"
            disabled={disabled}
            placeholder={value ? undefined : placeholder}
            value={open ? query : (value?.name ?? "")}
            onFocus={() => !open && openList()}
            onClick={() => !open && openList()}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              value && !disabled && "pr-9",
              invalid && "border-destructive focus-visible:ring-destructive",
            )}
          />
          {value && !disabled && (
            <button
              type="button"
              aria-label={t("Clear")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              onClick={() => select(null)}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem]"
        // Typing continues in the input while the list is open.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (inputRef.current?.parentElement?.contains(event.target as Node)) {
            event.preventDefault();
          }
        }}
      >
        <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <li className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-label={t("Loading…")} />
              ) : (
                t("No customers match your search.")
              )}
            </li>
          ) : (
            options.map((customer, index) => (
              <li
                key={customer.id}
                id={optionId(index)}
                role="option"
                aria-selected={customer.id === value?.id}
                className={cn(
                  "flex cursor-pointer items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-sm",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
                // Keep focus in the input so the popover stays put until the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(customer)}
              >
                <span className="truncate font-medium">{customer.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{customer.phone}</span>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
