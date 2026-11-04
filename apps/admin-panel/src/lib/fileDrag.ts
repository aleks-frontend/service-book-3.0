import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";

/**
 * Whether a drag started on this page, e.g. a photo's thumbnail picked up.
 * Chrome lists such an image as carrying a file, but it isn't one from the
 * computer.
 */
let fromPage = false;

/**
 * Whether a drag carries files from the computer, as opposed to, say, selected
 * text or an image dragged from the page, which are left to the browser.
 */
export function carriesFiles(event: { dataTransfer: DataTransfer | null }) {
  return !fromPage && !!event.dataTransfer?.types.includes("Files");
}

/**
 * Tells drags started on the page from those of files from the computer, and
 * keeps the browser from opening a file dropped anywhere that doesn't take it,
 * which would leave the app and lose what's being written. Called once, at
 * startup.
 */
export function installFileDrag() {
  window.addEventListener("dragstart", () => (fromPage = true));
  window.addEventListener("dragend", () => (fromPage = false));
  // No mouse events fire during a drag, so one means it is over, even if its end never reached the page.
  window.addEventListener("pointermove", () => (fromPage = false));

  window.addEventListener("dragover", (event) => {
    if (event.defaultPrevented || !carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = "none";
  });
  window.addEventListener("drop", (event) => {
    if (carriesFiles(event)) event.preventDefault();
  });
}

/**
 * Makes an element a drop target for files from the computer: `onFiles` gets the dropped
 * files. Spread the returned props on the element; while files are dragged over it, it has
 * a `data-drag-over` attribute to highlight it by. Dragged text and images from the page are left to
 * the browser. While `disabled`, a drop is still kept from the browser but `onFiles` isn't
 * called, and nothing is highlighted.
 */
export function useFileDrop<T extends HTMLElement>({
  disabled = false,
  onFiles,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const ref = useRef<T>(null);
  // Entering a child fires before leaving the target, so a drag is over it until the count is back at 0.
  const depth = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  // A leave can go missing, e.g. when the element under the cursor re-renders: the drag
  // moving on beside the target, or ending anywhere, clears the highlight all the same.
  useEffect(() => {
    if (!dragOver) return;
    function clear() {
      depth.current = 0;
      setDragOver(false);
    }
    function clearBeside(event: DragEvent) {
      if (!ref.current?.contains(event.target as Node)) clear();
    }
    window.addEventListener("dragover", clearBeside);
    window.addEventListener("drop", clear);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("dragover", clearBeside);
      window.removeEventListener("drop", clear);
      window.removeEventListener("dragend", clear);
    };
  }, [dragOver]);

  return {
    ref,
    "data-drag-over": dragOver && !disabled ? "" : undefined,
    onDragEnter(event: ReactDragEvent<T>) {
      if (!carriesFiles(event)) return;
      depth.current += 1;
      setDragOver(true);
    },
    onDragLeave(event: ReactDragEvent<T>) {
      if (!carriesFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragOver(false);
    },
    onDragOver(event: ReactDragEvent<T>) {
      if (!carriesFiles(event)) return;
      // Taken over even while disabled, so the browser doesn't open the file in place of the app.
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    onDrop(event: ReactDragEvent<T>) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragOver(false);
      if (!disabled) onFiles([...event.dataTransfer.files]);
    },
  };
}
