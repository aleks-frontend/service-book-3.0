/**
 * Saves a generated file. A download rather than a new tab: browsers block
 * tabs opened after an `await`, and the file keeps a meaningful name.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
