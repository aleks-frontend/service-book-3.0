import { useCallback, useRef, useState } from "react";

/**
 * A ref to put on an element, and its width in px, border included, kept up to date as
 * it is resized; null until the element is mounted. Measured before the browser paints.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((element: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    observer.current = new ResizeObserver(([entry]) => setWidth(entry.borderBoxSize[0].inlineSize));
    observer.current.observe(element);
  }, []);
  return [ref, width] as const;
}
