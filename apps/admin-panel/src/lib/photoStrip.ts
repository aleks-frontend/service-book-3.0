/**
 * How many of a one-line strip's photos to show in `width` px of `tile` px tiles `gap` px
 * apart, and how many to leave to a "+N" tile. When some don't fit, the "+N" tile takes a
 * slot of its own; at least one photo always shows.
 */
export function fitPhotoStrip({
  width,
  tile,
  gap,
  count,
}: {
  width: number;
  tile: number;
  gap: number;
  count: number;
}): { shown: number; hidden: number } {
  const room = Math.floor((width + gap) / (tile + gap));
  if (count <= room) return { shown: count, hidden: 0 };
  const shown = Math.max(room - 1, 1);
  return { shown, hidden: count - shown };
}
