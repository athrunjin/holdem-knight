import type { Charge, ChargeClock, Game, Timestamp } from "@holdem-knight/core";

/** Local time of day, which `core` leaves to the app. */
function minuteOfDay(time: Timestamp) {
  const date = new Date(time);
  return date.getHours() * 60 + date.getMinutes();
}

/** Open sessions run to the settlement time, or to now before settling. */
export function chargeClock(game: Pick<Game, "settledAt">): ChargeClock {
  return { now: game.settledAt ?? Date.now(), minuteOfDay };
}

/** Each player's table fee and wage, 0 when there is none. */
export function chargesByPlayer(charges: readonly Charge[]) {
  const byPlayer = new Map<string, { tableFee: number; wage: number }>();
  for (const { playerId, kind, amount } of charges) {
    const current = byPlayer.get(playerId) ?? { tableFee: 0, wage: 0 };
    byPlayer.set(
      playerId,
      kind === "table_fee"
        ? { ...current, tableFee: current.tableFee + amount }
        : { ...current, wage: current.wage + amount },
    );
  }
  return byPlayer;
}

/** Time at the table as hours and minutes, e.g. 2小时05分 or 45分. */
export function formatSeatTime(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}分` : `${hours}小时${String(rest).padStart(2, "0")}分`;
}
