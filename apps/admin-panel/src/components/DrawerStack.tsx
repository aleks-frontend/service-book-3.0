import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { deviceLabel } from "@servicebook/schemas";
import { useCustomerQuery } from "@/lib/customers";
import { useDeviceQuery } from "@/lib/devices";
import { useServiceQuery } from "@/lib/services";
import { useDrawerStack, type DrawerEntry } from "@/lib/useDrawerStack";
import { CustomerDrawer } from "./CustomerDrawer";
import { DeviceDrawer } from "./DeviceDrawer";
import type { DrawerPlace } from "./EntityDrawer";
import { ServiceDrawer } from "./ServiceDrawer";

function sameEntries(a: DrawerEntry[], b: DrawerEntry[]) {
  return (
    a.length === b.length && a.every((entry, i) => entry.kind === b[i].kind && entry.id === b[i].id)
  );
}

/** A drawer's title as text, from the query its drawer already loaded. */
function useDrawerTitle(entry: DrawerEntry | undefined) {
  const { t } = useTranslation();
  const idOf = (kind: DrawerEntry["kind"]) => (entry?.kind === kind ? entry.id : null);
  const { data: customer } = useCustomerQuery(idOf("customer"));
  const { data: device } = useDeviceQuery(idOf("device"));
  const { data: service } = useServiceQuery(idOf("service"));

  switch (entry?.kind) {
    case undefined:
      return undefined;
    case "customer":
      return customer?.name ?? t("Customer");
    case "device":
      return device ? deviceLabel(device) : t("Device");
    case "service":
      return service ? t("Service {{number}}", { number: service.number }) : t("Service");
  }
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

  const backTo = useDrawerTitle(stack.at(-2));

  // A closed drawer stays rendered, without its entity, so it animates out.
  const [rendered, setRendered] = useState(stack);
  const next = [...stack, ...rendered.slice(stack.length)];
  if (!sameEntries(next, rendered)) setRendered(next);

  return next.map((entry, depth) => {
    const id = depth < stack.length ? entry.id : null;
    const place: DrawerPlace = {
      onClose: close,
      onCloseAll: closeAll,
      backTo: depth === stack.length - 1 ? backTo : undefined,
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
