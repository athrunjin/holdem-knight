import type { LedgerEvent } from "../domain";

export const MIN = 60_000;

let next = 0;
const meta = (occurredAt: number) => ({
  id: `e${++next}`,
  organizerId: "me",
  gameId: "g",
  occurredAt,
});

export const buy = (playerId: string, minute: number, chips = 100): LedgerEvent => ({
  ...meta(minute * MIN),
  type: "buy_in",
  playerId,
  chips,
});

export const rebuy = (playerId: string, minute: number, chips = 100): LedgerEvent => ({
  ...meta(minute * MIN),
  type: "rebuy",
  playerId,
  chips,
});

export const leave = (playerId: string, minute: number, chips = 100): LedgerEvent => ({
  ...meta(minute * MIN),
  type: "cash_out",
  playerId,
  chips,
});

export const undo = (target: LedgerEvent, minute: number): LedgerEvent => ({
  ...meta(minute * MIN),
  type: "reversal",
  reversedEventId: target.id,
});
