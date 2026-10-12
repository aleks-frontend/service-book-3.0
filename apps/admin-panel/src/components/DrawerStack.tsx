import { useState } from "react";
import { useDrawerStack, type DrawerEntry } from "@/lib/useDrawerStack";
import { CustomerDrawer } from "./CustomerDrawer";
import { DeviceDrawer } from "./DeviceDrawer";
import { ServiceDrawer } from "./ServiceDrawer";

function sameEntries(a: DrawerEntry[], b: DrawerEntry[]) {
  return (
    a.length === b.length && a.every((entry, i) => entry.kind === b[i].kind && entry.id === b[i].id)
  );
}

/**
 * The drawers open in the URL, each over the one below. Render it once per
 * page; table rows and drawers open more with `useDrawerStack().open`.
 */
export function DrawerStack() {
  const { stack, open, close } = useDrawerStack();

  // A closed drawer stays rendered, without its entity, so it animates out.
  const [rendered, setRendered] = useState(stack);
  const next = [...stack, ...rendered.slice(stack.length)];
  if (!sameEntries(next, rendered)) setRendered(next);

  return next.map((entry, depth) => {
    const id = depth < stack.length ? entry.id : null;
    // A slot reused by another kind of drawer is a new drawer.
    const key = `${depth}:${entry.kind}`;
    switch (entry.kind) {
      case "customer":
        return <CustomerDrawer key={key} customerId={id} onClose={close} onOpen={open} />;
      case "device":
        return <DeviceDrawer key={key} deviceId={id} onClose={close} onOpen={open} />;
      case "service":
        return <ServiceDrawer key={key} serviceId={id} onClose={close} onOpen={open} />;
    }
  });
}
