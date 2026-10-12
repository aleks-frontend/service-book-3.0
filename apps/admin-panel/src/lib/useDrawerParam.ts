import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/** Marks a history entry pushed by opening a drawer, so closing it can go back instead. */
type DrawerState = { pushedByOpen?: boolean } | null;

/**
 * The drawer's open entity lives in a URL param on any page, e.g.
 * `?service=<id>` or `?device=<id>`, so a deep link opens it and the back
 * button closes it. Drawers with different params stack.
 */
export function useDrawerParam(param: "service" | "device") {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const openId = searchParams.get(param);

  function open(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set(param, id);
    // Switching from one open entity to another replaces the entry.
    setSearchParams(next, {
      replace: openId !== null,
      state: { pushedByOpen: true } satisfies DrawerState,
    });
  }

  function close() {
    if ((location.state as DrawerState)?.pushedByOpen) {
      navigate(-1);
      return;
    }
    // A deep link has no earlier entry of this page to go back to.
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
  }

  return { openId, open, close };
}
