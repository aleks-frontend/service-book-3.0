import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const DRAWER_KINDS = ["customer", "device", "service"] as const;

export type DrawerKind = (typeof DRAWER_KINDS)[number];
export type DrawerEntry = { kind: DrawerKind; id: string };
export type OpenDrawer = (kind: DrawerKind, id: string) => void;

/** Marks a history entry pushed by opening a drawer, so closing it can go back instead. */
type DrawerState = { pushedByOpen?: boolean } | null;

function isDrawerKind(key: string): key is DrawerKind {
  return (DRAWER_KINDS as readonly string[]).includes(key);
}

/**
 * The open drawers, bottom first, live in the URL as one param each, in order:
 * `?customer=<id>&device=<id>&service=<id>`. A deep link opens them, the back
 * button closes the top one, and any drawer can open another on top, even one
 * for an entity already open below.
 */
export function useDrawerStack() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const stack: DrawerEntry[] = [...searchParams]
    .filter(([key]) => isDrawerKind(key))
    .map(([kind, id]) => ({ kind: kind as DrawerKind, id }));

  const open: OpenDrawer = (kind, id) => {
    const next = new URLSearchParams(searchParams);
    next.append(kind, id);
    setSearchParams(next, { state: { pushedByOpen: true } satisfies DrawerState });
  };

  function close() {
    if ((location.state as DrawerState)?.pushedByOpen) {
      navigate(-1);
      return;
    }
    // A deep link has no earlier entry of this page to go back to.
    const next = new URLSearchParams([...searchParams].filter(([key]) => !isDrawerKind(key)));
    for (const { kind, id } of stack.slice(0, -1)) next.append(kind, id);
    setSearchParams(next, { replace: true });
  }

  return { stack, open, close };
}
