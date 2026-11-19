/** Rake: what a pot gives up under a game's rule. */
import type { RakeRule } from "../domain";

/**
 * The rake on a pot of `potChips`: the rule's percentage, rounded down to whole chips, so a pot never
 * gives up a part chip. Not a whole number of chips, or below 0, takes nothing.
 */
export function rakeFromPot(potChips: number, { percent }: RakeRule): number {
  if (!Number.isSafeInteger(potChips) || potChips <= 0) return 0;
  return Math.floor((potChips * percent) / 100);
}

/**
 * The smallest pot that gives up `rakeChips` under the rule: what a rake typed in by hand came from,
 * as far as the rule can tell. 0 for no rake.
 */
export function potForRake(rakeChips: number, { percent }: RakeRule): number {
  if (!Number.isSafeInteger(rakeChips) || rakeChips <= 0) return 0;
  return Math.ceil((rakeChips * 100) / percent);
}
