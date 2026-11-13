import {
  type Charge,
  chargeStatuses,
  chargesFrom,
  type Game,
  type LedgerEvent,
  type PlayerChargeStatus,
} from "@holdem-knight/core";
import { useEffect, useState } from "react";
import { gameMinuteOfDay } from "@/lib/charges";

/** What the game page's cards are worked out from, as of `now`. */
export interface LiveCharges {
  readonly now: number;
  /** Empty when the game charges nothing. */
  readonly statuses: readonly PlayerChargeStatus[];
  readonly charges: readonly Charge[];
}

/** The current time, updated every second while `ticking`. */
function useNow(ticking: boolean) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    if (!ticking) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [ticking]);

  return now;
}

/**
 * Each player's time and charges so far, kept live while the game is open. Only time while the
 * game clock runs counts, so a paused clock leaves the charges still, though `now` goes on.
 */
export function useLiveCharges(game: Game, events: readonly LedgerEvent[]): LiveCharges {
  const now = useNow(game.status === "open");
  if (!game.tableFee && !game.wage) return { now, statuses: [], charges: [] };

  const statuses = chargeStatuses(game, events, { now, minuteOfDay: gameMinuteOfDay(game) });
  // Charges waived on a card stay waived at settlement, and if the game is reopened
  return { now, statuses, charges: chargesFrom(game, statuses) };
}
