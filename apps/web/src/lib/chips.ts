import { netTone, TONE_CLASS } from "@/lib/tone";

/** A chip count with an explicit sign, e.g. +200, −50 or 0. */
export function formatSignedChips(chips: number) {
  const value = Math.abs(chips).toLocaleString("zh-CN");
  if (chips === 0) return value;
  return chips > 0 ? `+${value}` : `−${value}`;
}

/**
 * A figure that can break after a thousands separator, for a cell that lets its text wrap: seven
 * digits in a column sized for six then take two lines instead of running into the next column.
 */
export function breakable(figure: string) {
  return figure.replaceAll(",", ",\u200B");
}

/** Text color for a win or loss. */
export function netColor(chips: number) {
  return TONE_CLASS[netTone(chips)];
}
