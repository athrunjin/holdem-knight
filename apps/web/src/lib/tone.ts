/** The colors a figure or a word is told apart by, on the page and in the image of it. */
export type Tone = "text" | "muted" | "highlight" | "win" | "loss";

export const TONE_CLASS: Record<Tone, string> = {
  text: "text-text",
  muted: "text-muted",
  highlight: "text-highlight",
  win: "text-win",
  loss: "text-loss",
};

/** The tone of a win or a loss, muted for neither. */
export function netTone(value: number): Tone {
  if (value === 0) return "muted";
  return value > 0 ? "win" : "loss";
}
