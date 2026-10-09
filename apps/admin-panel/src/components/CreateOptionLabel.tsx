import { Plus } from "lucide-react";

/** How a picker's "create" row reads, set apart from the options it offers. */
export function CreateOptionLabel({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1.5 font-medium text-primary">
      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}
