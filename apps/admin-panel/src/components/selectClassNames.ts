import type { ClassNamesConfig, GroupBase } from "react-select";
import { cn } from "@/lib/utils";

/** Tailwind classes for an `unstyled` react-select, matching the app's inputs. */
export function selectClassNames<Option, IsMulti extends boolean>(
  invalid: boolean | undefined,
): ClassNamesConfig<Option, IsMulti, GroupBase<Option>> {
  return {
    control: ({ isFocused, isDisabled }) =>
      cn(
        "min-h-10 rounded-md border border-input bg-white px-3 text-sm",
        // The search input inside would otherwise show a text cursor.
        !isDisabled && "cursor-pointer [&_input]:!cursor-pointer",
        isFocused && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        isDisabled && "cursor-not-allowed opacity-50",
        invalid && "border-destructive",
        invalid && isFocused && "ring-destructive",
      ),
    placeholder: () => "text-muted-foreground",
    valueContainer: () => "gap-1 py-1",
    multiValue: () => "items-center rounded-sm bg-muted pl-2",
    multiValueRemove: () => "cursor-pointer rounded-sm px-1 hover:text-destructive",
    indicatorsContainer: () => "gap-1 text-muted-foreground",
    clearIndicator: () => "cursor-pointer rounded-sm p-1 hover:text-foreground",
    dropdownIndicator: () => "cursor-pointer p-1 hover:text-foreground",
    indicatorSeparator: () => "hidden",
    loadingIndicator: () => "p-1",
    menu: () => "z-50 mt-1 mb-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
    menuList: () => "max-h-64",
    option: ({ isFocused }) =>
      cn(
        "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
        isFocused && "bg-accent text-accent-foreground",
      ),
    noOptionsMessage: () => "px-2 py-1.5 text-sm text-muted-foreground",
    loadingMessage: () => "px-2 py-1.5 text-sm text-muted-foreground",
  };
}
