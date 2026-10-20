import { useEffect, useState } from "react";

/**
 * `flag`, but only once it has stayed true for `delayMs`; it turns false at
 * once. Keeps loading indicators from flickering on requests that finish fast.
 */
export function useDelayedFlag(flag: boolean, delayMs: number) {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const timeout = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timeout);
  }, [flag, delayMs]);

  return flag && delayed;
}
