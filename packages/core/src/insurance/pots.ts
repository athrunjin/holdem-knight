/** Splits all-in contributions into the main pot and side pots. */

export interface PotEntry {
  readonly playerId: string;
  /** Chips this player has put in during the hand. */
  readonly chips: number;
  /** Dead money: chips that stay in the pots, but nobody here can win them back as their own. */
  readonly folded?: boolean;
}

export interface Pot {
  readonly amountChips: number;
  /** Players who can win this pot. */
  readonly playerIds: readonly string[];
  /** What each eligible player put into this pot. */
  readonly stakes: Readonly<Record<string, number>>;
}

export interface PotTotals {
  /** Everything at least two players are contesting, dead money included. */
  readonly effectiveChips: number;
  readonly deadChips: number;
  /** The top player's excess nobody could call, which goes straight back to them. */
  readonly uncalledChips: number;
}

/**
 * One layer per distinct contribution among live players: each player adds what they put in between
 * the previous level and this one. Dead money above the top contested level joins that pot.
 * A top layer with one player is their uncalled excess, which goes straight back to them.
 */
export function buildPots(entries: readonly PotEntry[]): Pot[] {
  const live = entries.filter((e) => !e.folded && e.chips > 0);
  const levels = [...new Set(live.map((e) => e.chips))].toSorted((a, b) => a - b);
  const highest = levels.at(-1) ?? 0;
  const called = live.filter((e) => e.chips === highest).length > 1;
  const top = called ? highest : (levels.at(-2) ?? highest);

  let previous = 0;
  return levels.map((level) => {
    const layer = (chips: number) => Math.max(0, Math.min(chips, level) - previous);
    const eligible = live.filter((e) => e.chips >= level);
    const stakes = Object.fromEntries(eligible.map((e) => [e.playerId, layer(e.chips)]));
    const amountChips = entries.reduce((total, e) => {
      if (e.folded && level > top) return total;
      const beyondTop = e.folded && level === top ? Math.max(0, e.chips - top) : 0;
      return total + layer(e.chips) + beyondTop;
    }, 0);
    previous = level;
    return { amountChips, playerIds: eligible.map((e) => e.playerId), stakes };
  });
}

/**
 * What each live player has in the pots that are contested, leaving out excess nobody called.
 * With the dead money these add up to the effective pot.
 */
export function contestedStakes(entries: readonly PotEntry[]): Record<string, number> {
  const stakes: Record<string, number> = {};
  for (const pot of buildPots(entries)) {
    if (pot.playerIds.length < 2) continue;
    for (const [playerId, chips] of Object.entries(pot.stakes)) {
      stakes[playerId] = (stakes[playerId] ?? 0) + chips;
    }
  }
  return stakes;
}

/** The headline numbers for a table, before any cards are known. */
export function potTotals(entries: readonly PotEntry[]): PotTotals {
  const pots = buildPots(entries);
  const sum = (list: readonly Pot[]) => list.reduce((total, p) => total + p.amountChips, 0);
  return {
    effectiveChips: sum(pots.filter((p) => p.playerIds.length > 1)),
    deadChips: entries.reduce((total, e) => total + (e.folded ? e.chips : 0), 0),
    uncalledChips: sum(pots.filter((p) => p.playerIds.length === 1)),
  };
}
