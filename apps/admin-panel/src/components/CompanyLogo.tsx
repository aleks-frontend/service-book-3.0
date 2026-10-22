import { useCompanyLogoQuery } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * The logo uploaded in Settings, kept secondary to Service Book's own. It sits
 * on a white plate, as on the printed documents, so a dark logo reads on the
 * header bar and in the dark theme. Renders nothing, and takes no space, until
 * there is one.
 */
export function CompanyLogo({ className }: { className?: string }) {
  const { data: logo } = useCompanyLogoQuery();
  if (!logo) return null;
  return (
    <span className={cn("inline-flex shrink-0 rounded-sm bg-white px-1.5 py-1", className)}>
      <img src={logo} alt="" className="h-6 w-auto max-w-[6rem] object-contain" />
    </span>
  );
}
