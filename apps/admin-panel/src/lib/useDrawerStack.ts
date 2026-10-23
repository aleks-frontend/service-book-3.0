import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const DRAWER_KINDS = ["customer", "device", "service"] as const;

export type DrawerKind = (typeof DRAWER_KINDS)[number];
export type DrawerEntry = { kind: DrawerKind; id: string };
export type OpenDrawer = (kind: DrawerKind, id: string) => void;

/**
 * How many of the top drawers were opened on this page, each pushing its own
 * history entry, so closing them can go back instead. A deep link opens none.
 */
type DrawerState = { opened?: number } | null;

function isDrawerKind(key: string): key is DrawerKind {
  return (DRAWER_KINDS as readonly string[]).includes(key);
}

/**
 * The open drawers, bottom first, live in the URL as one param each, in order:
 * `?customer=<id>&device=<id>&service=<id>`. A deep link opens them, the back
 * button closes the top one, and any drawer can open another on top. Opening
 * an entity already open below goes back to its drawer instead.
 */
export function useDrawerStack() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const opened = (location.state as DrawerState)?.opened ?? 0;

  const stack: DrawerEntry[] = [...searchParams]
    .filter(([key]) => isDrawerKind(key))
    .map(([kind, id]) => ({ kind: kind as DrawerKind, id }));

  /** The page's other params with `entries` as the drawers. */
  function withDrawers(entries: DrawerEntry[]) {
    const next = new URLSearchParams([...searchParams].filter(([key]) => !isDrawerKind(key)));
    for (const { kind, id } of entries) next.append(kind, id);
    return next;
  }

  /** Closes the top `count` drawers. */
  function closeTop(count: number) {
    if (count <= opened) {
      navigate(-count);
      return;
    }
    // A deep link has no earlier entry of this page to go back to.
    setSearchParams(withDrawers(stack.slice(0, -count)), { replace: true });
  }

  const open: OpenDrawer = (kind, id) => {
    const depth = stack.findIndex((entry) => entry.kind === kind && entry.id === id);
    if (depth !== -1) {
      if (depth < stack.length - 1) closeTop(stack.length - 1 - depth);
      return;
    }
    setSearchParams(withDrawers([...stack, { kind, id }]), {
      state: { opened: opened + 1 } satisfies DrawerState,
    });
  };

  function close() {
    closeTop(1);
  }

  /** Pushes a history entry, so the browser's back button reopens them all. */
  function closeAll() {
    setSearchParams(withDrawers([]));
  }

  return { stack, open, close, closeAll };
}
