import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const SERVICE_PARAM = "service";

/** Marks a history entry pushed by opening the drawer, so closing it can go back instead. */
type DrawerState = { pushedByOpen?: boolean } | null;

/**
 * The open service lives in the `?service=<id>` URL param on any page, so a
 * deep link opens it and the back button closes it.
 */
export function useOpenServiceParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const openServiceId = searchParams.get(SERVICE_PARAM);

  function openService(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set(SERVICE_PARAM, id);
    // Switching from one open service to another replaces the entry.
    setSearchParams(next, {
      replace: openServiceId !== null,
      state: { pushedByOpen: true } satisfies DrawerState,
    });
  }

  function closeService() {
    if ((location.state as DrawerState)?.pushedByOpen) {
      navigate(-1);
      return;
    }
    // A deep link has no earlier entry of this page to go back to.
    const next = new URLSearchParams(searchParams);
    next.delete(SERVICE_PARAM);
    setSearchParams(next, { replace: true });
  }

  return { openServiceId, openService, closeService };
}
