import { useEffect, useRef, useState } from "react";

/** How long a change stays marked: as long as its flash animation runs. */
const CHANGED_MS = 300;

/**
 * True for a moment after `value` changes, not on the first render: a row or
 * card marks itself with it so its status change flashes once.
 */
export function useChangedFlag(value: unknown) {
  const [changed, setChanged] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setChanged(true);
    const timer = setTimeout(() => setChanged(false), CHANGED_MS);
    return () => clearTimeout(timer);
  }, [value]);

  return changed;
}
