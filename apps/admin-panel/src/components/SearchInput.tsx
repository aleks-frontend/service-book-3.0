import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { Input } from "./ui/input";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
  /** The search is still running: the magnifier turns into a spinner. */
  busy?: boolean;
};

/** A list's search box. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  busy = false,
}: SearchInputProps) {
  const { t } = useTranslation();

  return (
    <div className="relative w-full max-w-sm">
      {/* Centred by flex, not a transform, which the spinner's rotation would override. */}
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
        aria-hidden
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </span>
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9"
      />
      {/* Always mounted: screen readers announce a live region's changes, not its arrival. */}
      <span role="status" className="sr-only">
        {busy ? t("Loading…") : ""}
      </span>
    </div>
  );
}
