import { CompanyLogo } from "./CompanyLogo";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

/**
 * The app header's ink bar in small, with Service Book's logo and the
 * company's, atop the cards of the pages outside the app: login and the
 * public status page.
 */
export function BrandBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "dark flex items-center justify-between gap-3 border-b-4 border-primary bg-bar py-3 text-foreground",
        className,
      )}
    >
      <Logo />
      <CompanyLogo />
    </div>
  );
}
