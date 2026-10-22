import { TAG_LINES_PATH, TAG_PATH } from "@/lib/logo";
import { cn } from "@/lib/utils";

/** The tag's colours: yellow with an ink outline, in either theme. */
const TAG_YELLOW = "#F5C400";
const TAG_INK = "#1C2124";

/** The mark alone, for small sizes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7 shrink-0", className)} aria-hidden>
      <path
        d={TAG_PATH}
        fillRule="evenodd"
        fill={TAG_YELLOW}
        stroke={TAG_INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d={TAG_LINES_PATH} stroke={TAG_INK} strokeWidth="2.25" strokeLinecap="square" />
    </svg>
  );
}

/** The mark and the wordmark, for the header and the login page. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[1.375rem] font-extrabold leading-none tracking-[0.01em]">
        Service Book
      </span>
    </span>
  );
}
