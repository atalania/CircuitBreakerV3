/** Squared px movement below this counts as a tap (not scroll / drag). */
export const TAP_MOVE_THRESH2 = 14 * 14;

/**
 * True when drag-from-palette / fine ports are painful (touch) or narrow layout.
 */
export function shouldUseTapPlace() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 900px)").matches
  );
}

export function tapPlaceMediaQueries() {
  return [
    window.matchMedia("(max-width: 900px)"),
    window.matchMedia("(pointer: coarse)"),
  ];
}
