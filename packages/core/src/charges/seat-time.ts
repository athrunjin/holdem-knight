/** Each player's time at the table, read from the ledger's timestamps (ADR 0001). */
import type { ChipEvent, LedgerEvent, TimerRun, Timestamp } from "../domain";

/** One stretch at the table. `to` is missing while the player is still seated. */
export interface SeatSession {
  readonly from: Timestamp;
  readonly to?: Timestamp;
}

/**
 * Each player's sessions, oldest first. A buy-in sits a player down, a cash-out ends the session, and
 * reversing that cash-out (返回) starts a new one. Hand changes leave the sessions alone. A player
 * whose every record is reversed was added by mistake, so their sessions are dropped.
 *
 * Events with the same timestamp were written together and count as one change, as in the stacks.
 */
export function seatSessions(events: readonly LedgerEvent[]): Map<string, SeatSession[]> {
  const byId = new Map(events.map((e) => [e.id, e]));
  const active = new Map<string, ChipEvent[]>();
  const sessions = new Map<string, SeatSession[]>();
  const seatedNow = (playerId: string) => {
    const last = active.get(playerId)?.at(-1);
    return last !== undefined && last.type !== "cash_out";
  };

  let index = 0;
  while (index < events.length) {
    const occurredAt = events[index]?.occurredAt ?? 0;
    const before = new Map<string, boolean>();
    const touch = (playerId: string) => {
      if (!before.has(playerId)) before.set(playerId, seatedNow(playerId));
      return active.get(playerId) ?? [];
    };

    for (; events[index]?.occurredAt === occurredAt; index++) {
      const event = events[index];
      if (!event) break;
      const target = event.type === "reversal" ? byId.get(event.reversedEventId) : event;
      if (target?.type !== "buy_in" && target?.type !== "rebuy" && target?.type !== "cash_out") {
        continue;
      }
      const records = touch(target.playerId);
      active.set(
        target.playerId,
        event.type === "reversal"
          ? records.filter((e) => e.id !== target.id)
          : [...records, target],
      );
    }

    for (const [playerId, wasSeated] of before) {
      if ((active.get(playerId) ?? []).length === 0) {
        sessions.delete(playerId);
        continue;
      }
      const seated = seatedNow(playerId);
      if (seated === wasSeated) continue;
      const list = sessions.get(playerId) ?? [];
      const last = list.at(-1);
      if (seated) list.push({ from: occurredAt });
      else if (last) list[list.length - 1] = { from: last.from, to: occurredAt };
      sessions.set(playerId, list);
    }
  }
  return sessions;
}

/** Total time in sessions. A session still open runs to `now`. */
export function seatedMs(sessions: readonly SeatSession[], now: Timestamp): number {
  return sessions.reduce((total, { from, to = now }) => total + Math.max(0, to - from), 0);
}

/** The parts of each session while the game clock ran. Sessions still open end at `now`. */
export function withinRuns(
  sessions: readonly SeatSession[],
  runs: readonly TimerRun[],
  now: Timestamp,
): SeatSession[] {
  return sessions.flatMap(({ from, to = now }) =>
    runs.flatMap((run) => {
      const start = Math.max(from, run.from);
      const end = Math.min(to, run.to);
      return end > start ? [{ from: start, to: end }] : [];
    }),
  );
}
