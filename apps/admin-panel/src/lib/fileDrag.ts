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
