import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { deviceLabel } from "@servicebook/schemas";
import { useCustomerQuery } from "@/lib/customers";
import { useDeviceQuery } from "@/lib/devices";
import { useServiceQuery } from "@/lib/services";
import { useDrawerStack, type DrawerEntry, type OpenDrawer } from "@/lib/useDrawerStack";
import { CustomerDrawer } from "./CustomerDrawer";
import { DeviceDrawer } from "./DeviceDrawer";
import type { DrawerPlace } from "./EntityDrawer";
import { ServiceDrawer } from "./ServiceDrawer";
import { Button } from "./ui/button";

function sameEntries(a: DrawerEntry[], b: DrawerEntry[]) {
  return (
    a.length === b.length && a.every((entry, i) => entry.kind === b[i].kind && entry.id === b[i].id)
  );
}

/** A drawer's title as text, from the query its drawer already loaded. */
function useDrawerTitle(entry: DrawerEntry) {
  const { t } = useTranslation();
  const idOf = (kind: DrawerEntry["kind"]) => (entry.kind === kind ? entry.id : null);
  const { data: customer } = useCustomerQuery(idOf("customer"));
  const { data: device } = useDeviceQuery(idOf("device"));
  const { data: service } = useServiceQuery(idOf("service"));

  switch (entry.kind) {
    case "customer":
      return customer?.name ?? t("Customer");
    case "device":
      return device ? deviceLabel(device) : t("Device");
    case "service":
      return service ? t("Service {{number}}", { number: service.number }) : t("Service");
  }
}

type BelowProps = {
  /** A drawer below the top one. */
  entry: DrawerEntry;
  /** Opening an entity already open goes back to its drawer. */
  onOpen: OpenDrawer;
};

/** Goes back to the drawer just below, from the top drawer's header. */
function BackButton({ entry, onOpen }: BelowProps) {
  const { t } = useTranslation();
  const label = t("Back to {{name}}", { name: useDrawerTitle(entry) });
  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-2 h-8 w-8 shrink-0"
      aria-label={label}
      title={label}
      onClick={() => onOpen(entry.kind, entry.id)}
    >
      <ChevronLeft className="h-5 w-5" aria-hidden />
    </Button>
  );
}

/** A lower drawer's edge, an ink strip beside the top drawer, that goes back to it. */
function DrawerEdge({ entry, onOpen }: BelowProps) {
  const { t } = useTranslation();
  const title = useDrawerTitle(entry);
  return (
    <button
      type="button"
      className="dark flex w-10 flex-col items-center border-l border-border bg-bar py-4 font-display text-lg font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      title={t("Back to {{name}}", { name: title })}
      onClick={() => onOpen(entry.kind, entry.id)}
    >
      <span className="block max-h-full overflow-hidden text-ellipsis whitespace-nowrap [writing-mode:vertical-rl]">
        {title}
      </span>
    </button>
  );
}

/**
 * The drawers open in the URL, each over the one below. Render it once per
 * page; table rows and drawers open more with `useDrawerStack().open`.
 */
export function DrawerStack() {
  const { stack: inUrl, open, close, closeAll } = useDrawerStack();

  // Drawers mount one per render, bottom first, even when a deep link opens
  // several: a drawer hides the page from screen readers as it mounts, and
  // mounting together, the lower one would hide the top one too.
  const [mounted, setMounted] = useState(Math.min(inUrl.length, 1));
  useEffect(() => {
    setMounted(Math.min(mounted + 1, inUrl.length));
  }, [mounted, inUrl.length]);
  const stack = inUrl.slice(0, mounted);

  // A closed drawer stays rendered, without its entity, so it animates out.
  const [rendered, setRendered] = useState(stack);
  const next = [...stack, ...rendered.slice(stack.length)];
  if (!sameEntries(next, rendered)) setRendered(next);

  return next.map((entry, depth) => {
    const id = depth < stack.length ? entry.id : null;
    const below = depth === stack.length - 1 ? stack.slice(0, -1) : [];
    const place: DrawerPlace = {
      onClose: close,
      onCloseAll: closeAll,
      back: below.length > 0 && <BackButton entry={below[below.length - 1]} onOpen={open} />,
      edges:
        below.length > 0 &&
        below.map((lower, i) => (
          <DrawerEdge key={`${i}:${lower.kind}`} entry={lower} onOpen={open} />
        )),
      stacked: depth > 0,
    };
    // A slot reused by another kind of drawer is a new drawer.
    const key = `${depth}:${entry.kind}`;
    switch (entry.kind) {
      case "customer":
        return <CustomerDrawer key={key} customerId={id} place={place} onOpen={open} />;
      case "device":
        return <DeviceDrawer key={key} deviceId={id} place={place} onOpen={open} />;
      case "service":
        return <ServiceDrawer key={key} serviceId={id} place={place} onOpen={open} />;
    }
  });
}
