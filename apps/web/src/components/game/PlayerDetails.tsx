import {
  type Cents,
  cents,
  chargeStatuses,
  chargesFrom,
  chipsToCents,
  type Game,
  type LedgerEvent,
  type PlayerLedger,
} from "@holdem-knight/core";
import { useEffect, useState } from "react";
import { chargesByPlayer, gameMinuteOfDay } from "@/lib/charges";

/** What detail mode shows under a seated player. */
export interface PlayerDetail {
  readonly seatedMs: number;
  /** Missing when the game has no table fee. */
  readonly tableFee?: Cents;
  /** Counted time still needed before the table fee applies. */
  readonly tableFeeShortMs: number;
  /** Missing when the game has no wages. */
  readonly wage?: Cents;
  /** The cash result so far, less the table fee and wages so far. */
  readonly net: Cents;
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
 * Each player's details while detail mode is on, kept live while the game clock runs. Only time
 * while the clock runs counts, so a paused clock leaves the figures still.
 */
export function usePlayerDetails(
  game: Game,
  events: readonly LedgerEvent[],
  players: readonly PlayerLedger[],
  enabled: boolean,
): ReadonlyMap<string, PlayerDetail> | undefined {
  const now = useNow(enabled && game.timer?.runningSince !== undefined);
  if (!enabled) return undefined;

  const { tableFee, wage, chipRatio } = game;
  const netChips = new Map(players.map((p) => [p.playerId, p.netChips]));
  const statuses = chargeStatuses(game, events, { now, minuteOfDay: gameMinuteOfDay(game) });
  // Charges waived at settlement stay waived if the game is reopened
  const owed = chargesByPlayer(chargesFrom(game, statuses));
  return new Map(
    statuses.map((status) => {
      const cash = chipsToCents(netChips.get(status.playerId) ?? 0, chipRatio);
      const due = owed.get(status.playerId) ?? { tableFee: 0, wage: 0 };
      const detail: PlayerDetail = {
        seatedMs: status.seatedMs,
        tableFeeShortMs: status.tableFeeShortMs,
        net: cents(cash - due.tableFee - due.wage),
        ...(tableFee && { tableFee: cents(due.tableFee) }),
        ...(wage && { wage: cents(due.wage) }),
      };
      return [status.playerId, detail];
    }),
  );
}

/** Counted time as `1:02:03`. */
export function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  return `${Math.floor(seconds / 3600)}:${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
