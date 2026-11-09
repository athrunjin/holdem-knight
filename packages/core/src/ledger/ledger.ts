/**
 * Ledger derivations. The ledger only appends events (ADR 0005), and all balances are computed from them.
 * Results are in chips; use `chipsToCents` to display cash.
 */
import {
  type ChipEvent,
  type ChipRatio,
  type Game,
  INSURANCE_PLAYER_ID,
  type InsuranceBuyEvent,
  type LedgerEvent,
} from "../domain";
import { type Cents, multiply } from "../money";

function isChipEvent(event: LedgerEvent): event is ChipEvent {
  return event.type === "buy_in" || event.type === "rebuy" || event.type === "cash_out";
}

function reversedEventIds(events: readonly LedgerEvent[]): Set<string> {
  return new Set(events.flatMap((e) => (e.type === "reversal" ? [e.reversedEventId] : [])));
}

/** Buy-ins, rebuys and cash-outs that have not been reversed, in their original order. */
export function activeChipEvents(events: readonly LedgerEvent[]): ChipEvent[] {
  const reversed = reversedEventIds(events);
  return events.filter((e): e is ChipEvent => isChipEvent(e) && !reversed.has(e.id));
}

/** The player's latest cash-out still in effect. Reversing it puts them back at the table. */
export function latestCashOut(
  events: readonly LedgerEvent[],
  playerId: string,
): ChipEvent | undefined {
  return activeChipEvents(events).findLast((e) => e.playerId === playerId && e.type === "cash_out");
}

/**
 * The player's first buy-in, if it is the only record in effect for them, so they can be removed
 * as a mistake without losing anything else.
 */
export function soleBuyIn(events: readonly LedgerEvent[], playerId: string): ChipEvent | undefined {
  const reversed = reversedEventIds(events);
  const typedStack = events.some(
    (e) =>
      (e.type === "stack_set" || e.type === "insurance_buy") &&
      e.playerId === playerId &&
      !reversed.has(e.id),
  );
  const records = activeChipEvents(events).filter((e) => e.playerId === playerId);
  const [only] = records;
  return !typedStack && records.length === 1 && only?.type === "buy_in" ? only : undefined;
}

/**
 * Each player's current chips, replaying events in order. Every event changes the stack by some
 * amount, and reversing it takes that amount back, so a typed stack survives later hand changes:
 * at 700 chips, removing a 500-chip hand leaves 200. Reversing a cash-out restores the chips left with.
 *
 * Events with the same timestamp were written together and count as one change, because a
 * reversal plus its replacement buy must not stop at 0 halfway. The stack never goes below 0.
 *
 * Insurance never touches a player's stack, and moves the seat only when its card is dealt: by the
 * premium, less the payout on a hit (ADR 0015).
 */
function liveStacks(events: readonly LedgerEvent[]): Map<string, number> {
  const byId = new Map(events.map((e) => [e.id, e]));
  const stacks = new Map<string, number>();
  const applied = new Map<string, number>();
  const insuranceOf = (id: string) => {
    const target = byId.get(id);
    if (target?.type !== "insurance_settle") return 0;
    const purchase = byId.get(target.purchaseId);
    return (purchase?.type === "insurance_buy" ? purchase.chips : 0) - target.chips;
  };
  const stackOf = (playerId: string) => stacks.get(playerId) ?? 0;

  let index = 0;
  while (index < events.length) {
    const occurredAt = events[index]?.occurredAt;
    const changes = new Map<string, number>();
    const addChange = (playerId: string, change: number) =>
      changes.set(playerId, (changes.get(playerId) ?? 0) + change);

    for (; events[index]?.occurredAt === occurredAt; index++) {
      const event = events[index];
      if (!event) break;
      if (event.type === "reversal") {
        const target = byId.get(event.reversedEventId);
        if (target && target.type !== "reversal") {
          addChange(INSURANCE_PLAYER_ID, -insuranceOf(target.id));
          // Returning to the table brings back the chips they left with
          const change = target.type === "cash_out" ? target.chips : -(applied.get(target.id) ?? 0);
          addChange(target.playerId, change);
        }
        continue;
      }
      const current = stackOf(event.playerId);
      addChange(INSURANCE_PLAYER_ID, insuranceOf(event.id));
      const change =
        event.type === "stack_set"
          ? event.chips - current
          : event.type === "cash_out"
            ? -current
            : event.type === "insurance_buy" || event.type === "insurance_settle"
              ? 0
              : event.chips;
      applied.set(event.id, change);
      addChange(event.playerId, change);
    }
    for (const [playerId, change] of changes) {
      stacks.set(playerId, Math.max(0, stackOf(playerId) + change));
    }
  }
  return stacks;
}

export interface PlayerLedger {
  readonly playerId: string;
  /** Total chips from buy-ins and rebuys. */
  readonly boughtChips: number;
  /** Total chips cashed out. */
  readonly cashedOutChips: number;
  /** Whether the player is still seated: their last event is not a cash-out. */
  readonly seated: boolean;
  /** Chips in front of the player now. 0 once they have left. */
  readonly stackChips: number;
  /** Win or loss so far: stack + cashed out - bought. */
  readonly netChips: number;
}

/** Each player's totals, in order of first buy-in. */
export function summarizeByPlayer(events: readonly LedgerEvent[]): PlayerLedger[] {
  const byPlayer = new Map<string, Omit<PlayerLedger, "stackChips" | "netChips">>();
  for (const event of activeChipEvents(events)) {
    const { playerId, type, chips } = event;
    const current = byPlayer.get(playerId) ?? {
      playerId,
      boughtChips: 0,
      cashedOutChips: 0,
      seated: true,
    };
    byPlayer.set(
      playerId,
      type === "cash_out"
        ? { ...current, cashedOutChips: current.cashedOutChips + chips, seated: false }
        : { ...current, boughtChips: current.boughtChips + chips, seated: true },
    );
  }
  const stacks = liveStacks(events);
  return [...byPlayer.values()].map((player) => {
    const stackChips = player.seated ? (stacks.get(player.playerId) ?? 0) : 0;
    const netChips = stackChips + player.cashedOutChips - player.boughtChips;
    return { ...player, stackChips, netChips };
  });
}

export interface LedgerTotals {
  readonly boughtChips: number;
  readonly cashedOutChips: number;
  /** Table balance: all stacks + cashed out - bought. 0 means every chip is accounted for. */
  readonly balanceChips: number;
}

export function ledgerTotals(players: readonly PlayerLedger[]): LedgerTotals {
  const boughtChips = players.reduce((total, p) => total + p.boughtChips, 0);
  const cashedOutChips = players.reduce((total, p) => total + p.cashedOutChips, 0);
  const balanceChips = players.reduce((total, p) => total + p.netChips, 0);
  return { boughtChips, cashedOutChips, balanceChips };
}

/** Whether this player's next buy is a first buy-in or a rebuy. */
export function nextBuyType(events: readonly LedgerEvent[], playerId: string): "buy_in" | "rebuy" {
  return activeChipEvents(events).some((e) => e.playerId === playerId) ? "rebuy" : "buy_in";
}

/** Chips in the latest buy-in or rebuy, to prefill the next one. Returns undefined if there is none. */
export function lastBuyChips(events: readonly LedgerEvent[]): number | undefined {
  return activeChipEvents(events).findLast((e) => e.type !== "cash_out")?.chips;
}

/** A change in hands: `by` adds to the current count and `to` sets a target. */
export type HandChange = { readonly by: number } | { readonly to: number };

/** The ledger is append-only, so adjusting hands becomes reversals plus one new buy. */
export interface HandAdjustment {
  readonly reversedEventIds: readonly string[];
  readonly buy?: { readonly type: "buy_in" | "rebuy"; readonly chips: number };
}

/**
 * Works out which events to append to bring a player to the target hands. At least 1 hand remains.
 *
 * An increase records the difference. A decrease reverses the latest buys and records any excess again.
 */
export function adjustHands(
  events: readonly LedgerEvent[],
  playerId: string,
  handChips: number,
  change: HandChange,
): HandAdjustment {
  const buys = activeChipEvents(events).filter(
    (e) => e.playerId === playerId && e.type !== "cash_out",
  );
  const bought = buys.reduce((total, e) => total + e.chips, 0);
  const requested = "to" in change ? change.to * handChips : bought + change.by * handChips;
  const target = Math.max(requested, handChips);

  if (target === bought) return { reversedEventIds: [] };
  if (target > bought) {
    const type = buys.length === 0 ? "buy_in" : "rebuy";
    return { reversedEventIds: [], buy: { type, chips: target - bought } };
  }

  const reversedEventIds: string[] = [];
  let remaining = bought - target;
  for (const buy of buys.toReversed()) {
    if (remaining <= 0) break;
    reversedEventIds.push(buy.id);
    remaining -= buy.chips;
  }
  if (remaining === 0) return { reversedEventIds };
  const type = reversedEventIds.length === buys.length ? "buy_in" : "rebuy";
  return { reversedEventIds, buy: { type, chips: -remaining } };
}

/**
 * Players with chip events still in effect, latest first, across any number of games.
 * The insurance seat is left out, and so is a player whose only buy-in was reversed.
 */
export function recentPlayerIds(events: readonly LedgerEvent[], limit: number): string[] {
  const latest = new Map<string, number>();
  for (const { playerId, occurredAt } of activeChipEvents(events)) {
    if (playerId === INSURANCE_PLAYER_ID) continue;
    latest.set(playerId, Math.max(latest.get(playerId) ?? occurredAt, occurredAt));
  }
  return [...latest]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([playerId]) => playerId);
}

/** Everything except the insurance seat's own buy-in, which is written when the game starts. */
export function hasPlayerEvents(events: readonly LedgerEvent[]): boolean {
  const byId = new Map(events.map((e) => [e.id, e]));
  return events.some((event) => {
    const target = event.type === "reversal" ? byId.get(event.reversedEventId) : event;
    return !target || target.type === "reversal" || target.playerId !== INSURANCE_PLAYER_ID;
  });
}

export function insuranceActive(events: readonly LedgerEvent[]): boolean {
  return insuranceRecords(events).length > 0;
}

export interface InsuranceSeatChange {
  readonly reversedEventIds: readonly string[];
  readonly buyInChips?: number;
}

/**
 * Keeps the insurance seat in step with the game's settings: one hand while insurance is on, and
 * nothing while it is off. Once the seat has done anything beyond its buy-in, it stays as it is.
 */
export function insuranceSeatChange(
  game: Pick<Game, "insurance" | "handChips">,
  events: readonly LedgerEvent[],
): InsuranceSeatChange {
  const seat = activeChipEvents(events).filter((e) => e.playerId === INSURANCE_PLAYER_ID);
  const [first] = seat;
  const wanted = game.insurance === undefined ? undefined : game.handChips;
  if (!first) return wanted === undefined ? { reversedEventIds: [] } : stakeSeat([], wanted);
  if (seat.length > 1 || insuranceActive(events) || first.chips === wanted) {
    return { reversedEventIds: [] };
  }
  return stakeSeat([first.id], wanted);
}

function stakeSeat(reversedEventIds: readonly string[], chips: number | undefined) {
  return chips === undefined ? { reversedEventIds } : { reversedEventIds, buyInChips: chips };
}

export type InsuranceStatus = "pending" | "hit" | "miss";

export interface InsuranceRecord {
  readonly purchase: InsuranceBuyEvent;
  readonly status: InsuranceStatus;
  /** The event recording the result. Reversing both takes the purchase back. */
  readonly settleId?: string;
}

/** Purchases still in effect, oldest first, with their results. */
export function insuranceRecords(events: readonly LedgerEvent[]): InsuranceRecord[] {
  const reversed = reversedEventIds(events);
  const live = events.filter((e) => !reversed.has(e.id));
  return live.flatMap((event): InsuranceRecord[] => {
    if (event.type !== "insurance_buy") return [];
    const settle = live.find((e) => e.type === "insurance_settle" && e.purchaseId === event.id);
    if (settle?.type !== "insurance_settle") return [{ purchase: event, status: "pending" }];
    return [{ purchase: event, status: settle.hit ? "hit" : "miss", settleId: settle.id }];
  });
}

/** Chips to add so the insurance seat can pay `payoutChips`: enough whole hands to cover the shortfall. `stackChips` includes the premium. */
export function insuranceTopUp(stackChips: number, payoutChips: number, handChips: number): number {
  const short = payoutChips - stackChips;
  return short <= 0 ? 0 : Math.ceil(short / handChips) * handChips;
}

/** Converts chips to cash at the game's ratio, rounded half up to the cent. */
export function chipsToCents(chips: number, ratio: ChipRatio): Cents {
  return multiply(ratio.amount, chips / ratio.chips, "half-up");
}

export type RecordKind =
  | "buy_in"
  | "rebuy"
  | "reduce"
  | "remove"
  | "stack_set"
  | "stack_undo"
  | "cash_out"
  | "return"
  | "insurance_buy"
  | "insurance_hit"
  | "insurance_miss"
  | "insurance_undo";

/** One thing that happened in a game, as the organizer would describe it. */
export interface RecordEntry {
  readonly id: string;
  readonly kind: RecordKind;
  readonly playerId: string;
  readonly chips: number;
  readonly occurredAt: number;
}

/**
 * The ledger as a timeline, oldest first. A reversal has no meaning of its own to the organizer, so it
 * is named after what it did. Events one player wrote together become one entry: reversing 3 hands
 * and buying 1 again reads as removing 2.
 */
export function gameRecord(events: readonly LedgerEvent[]): RecordEntry[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const bought = new Map<string, number>();
  const entries: RecordEntry[] = [];

  let index = 0;
  while (index < events.length) {
    const occurredAt = events[index]?.occurredAt ?? 0;
    const buys = new Map<string, { id: string; added?: ChipEvent; reversed: number }>();
    const trackBuy = (id: string, playerId: string) => {
      const buy = buys.get(playerId) ?? { id, reversed: 0 };
      buys.set(playerId, buy);
      return buy;
    };

    for (; events[index]?.occurredAt === occurredAt; index++) {
      const event = events[index];
      if (!event) break;
      const target = event.type === "reversal" ? byId.get(event.reversedEventId) : event;
      if (!target || target.type === "reversal") continue;

      const { id } = event;
      const { playerId, chips } = target;
      const undoing = event.type === "reversal";
      if (target.type === "insurance_buy" || target.type === "insurance_settle") {
        const settled = target.type === "insurance_settle";
        const result = settled && target.hit ? "insurance_hit" : "insurance_miss";
        const kind = undoing ? "insurance_undo" : settled ? result : "insurance_buy";
        entries.push({ id, kind, playerId, chips, occurredAt });
      } else if (target.type === "buy_in" || target.type === "rebuy") {
        const buy = trackBuy(id, playerId);
        if (undoing) buy.reversed += chips;
        else buy.added = target;
      } else if (target.type === "cash_out") {
        const kind = undoing ? "return" : "cash_out";
        entries.push({ id, kind, playerId, chips, occurredAt });
      } else {
        const kind = undoing ? "stack_undo" : "stack_set";
        entries.push({ id, kind, playerId, chips, occurredAt });
      }
    }

    for (const [playerId, { id, added, reversed }] of buys) {
      const addedChips = added?.chips ?? 0;
      const total = (bought.get(playerId) ?? 0) + addedChips - reversed;
      bought.set(playerId, total);
      if (reversed === 0 && added) {
        entries.push({
          id,
          kind: added.type as RecordKind,
          playerId,
          chips: addedChips,
          occurredAt,
        });
      } else if (reversed > addedChips) {
        const kind = total === 0 ? "remove" : "reduce";
        entries.push({ id, kind, playerId, chips: reversed - addedChips, occurredAt });
      }
    }
  }
  return entries;
}
