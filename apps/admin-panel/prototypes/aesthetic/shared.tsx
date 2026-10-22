// PROTOTYPE (#24): what every direction gets from the shell, and the few pieces they share.
import type { ComponentType, ReactNode } from "react";
import { STATUSES, STATUS_LABELS, type Service, type Status } from "./data";
import type { Mode, Tokens } from "./tokens";

export type View = "cards" | "table";

export type DirectionProps = {
  mode: Mode;
  services: Service[];
  view: View;
  onView: (view: View) => void;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onStatus: (id: string, status: Status) => void;
  /** The service whose status was changed last, so a direction can show the change. */
  changedId: string | null;
};

export type Direction = {
  key: "A" | "B" | "C";
  name: string;
  summary: string;
  className: string;
  tokens: Tokens;
  fonts: { display: string; text: string };
  shape: string[];
  motion: string;
  pdf: string;
  Logo: ComponentType<{ mode: Mode; size?: number }>;
  App: ComponentType<DirectionProps>;
};

/**
 * A status as the direction draws it, with a transparent native select over
 * it, so changing it works like the real StatusSelect without a menu per variant.
 */
export function StatusControl({
  status,
  onChange,
  children,
}: {
  status: Status;
  onChange: (status: Status) => void;
  children: ReactNode;
}) {
  return (
    <span
      className="proto-status"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
      <select
        aria-label="Status"
        value={status}
        onChange={(event) => onChange(event.target.value as Status)}
      >
        {STATUSES.map((option) => (
          <option key={option} value={option}>
            {STATUS_LABELS[option]}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Opens on click, or on Enter when focused, like the real list. */
export function openProps(id: string, onOpen: (id: string) => void) {
  return {
    tabIndex: 0,
    onClick: () => onOpen(id),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && event.target === event.currentTarget) onOpen(id);
    },
  };
}

export const NAV = ["Services", "Customers", "Devices", "Actions", "Statistics", "Settings"];
export const TABS = ["Details", "Customer report", "Log"] as const;
export type Tab = (typeof TABS)[number];
