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
  type Player,
  RAKE_PLAYER_ID,
  type RakeEvent,
  type StackSetEvent,
} from "../domain";
import { type Cents, multiply } from "../money";
import { comparePlayers, playerNameKey } from "../player";

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
            : event.type === "insurance_buy" ||
                event.type === "insurance_settle" ||
                event.type === "rake"
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

/** Rake still in effect, oldest first. */
export function rakeRecords(events: readonly LedgerEvent[]): RakeEvent[] {
  const reversed = reversedEventIds(events);
  return events.filter((e): e is RakeEvent => e.type === "rake" && !reversed.has(e.id));
}

/** All the rake taken so far, in chips. */
export function rakeChips(events: readonly LedgerEvent[]): number {
  return rakeRecords(events).reduce((total, e) => total + e.chips, 0);
}

/**
 * The rake seat as a player who has already left with every chip of rake: nothing bought, so its
 * result is the rake, and the table balances with it as one more result. Missing with no rake.
 */
function rakeSeat(events: readonly LedgerEvent[]): PlayerLedger[] {
  const chips = rakeChips(events);
  if (chips === 0) return [];
  return [
    {
      playerId: RAKE_PLAYER_ID,
      boughtChips: 0,
      cashedOutChips: chips,
      seated: false,
      stackChips: 0,
      netChips: chips,
    },
  ];
}

/** Each player's totals, in order of first buy-in, then the rake seat if the game has rake. */
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
  const players = [...byPlayer.values()].map((player) => {
    const stackChips = player.seated ? (stacks.get(player.playerId) ?? 0) : 0;
    const netChips = stackChips + player.cashedOutChips - player.boughtChips;
    return { ...player, stackChips, netChips };
  });
  return [...players, ...rakeSeat(events)];
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
 * An increase records the difference. A decrease reverses the latest buys and records any excess
 * again. Hands an insurance hand bought for a premium are never among them (ADR 0018).
 */
export function adjustHands(
  events: readonly LedgerEvent[],
  playerId: string,
  handChips: number,
  change: HandChange,
): HandAdjustment {
  const allBuys = activeChipEvents(events).filter(
    (e) => e.playerId === playerId && e.type !== "cash_out",
  );
  // A hand bought to pay an insurance premium belongs to its insurance hand, and goes only with it
  const buys = allBuys.filter((e) => e.handId === undefined);
  const kept = allBuys.reduce((total, e) => total + (e.handId === undefined ? 0 : e.chips), 0);
  const bought = allBuys.reduce((total, e) => total + e.chips, 0);
  const requested = "to" in change ? change.to * handChips : bought + change.by * handChips;
  const target = Math.max(requested, kept + (buys.length > 0 ? handChips : 0), handChips);

  if (target === bought) return { reversedEventIds: [] };
  if (target > bought) {
    const type = allBuys.length === 0 ? "buy_in" : "rebuy";
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
  // A first buy-in taken back whole is recorded again as one, beside any hand bought for a premium
  const type = reversedEventIds.length === buys.length ? "buy_in" : "rebuy";
  return { reversedEventIds, buy: { type, chips: -remaining } };
}

/**
 * Players from the latest games: the newest game's players first, and players from one game in
 * alphabetical order. Each player appears once, at their newest game. The insurance seat, players
 * taken back out and players not in `players` are left out.
 */
export function recentPlayers(
  gamesNewestFirst: readonly (readonly LedgerEvent[])[],
  players: readonly Player[],
  limit: number,
): Player[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const seen = new Set<string>();
  const recent: Player[] = [];
  for (const events of gamesNewestFirst) {
    const inGame: Player[] = [];
    for (const { playerId } of activeChipEvents(events)) {
      const player = byId.get(playerId);
      if (!player || seen.has(playerId)) continue;
      seen.add(playerId);
      inGame.push(player);
    }
    recent.push(...inGame.sort(comparePlayers));
    if (recent.length >= limit) break;
  }
  return recent.slice(0, limit);
}

/**
 * The name each player reads in one game, so that no two rows read the same (ADR 0043). Counts the
 * players in `players` with a buy-in or rebuy in effect, in the order of their earliest buy-in or
 * rebuy in the ledger, reversed or not, so taking back and recording again a first buy-in moves
 * nobody. Among players whose names share a key, the first keeps the name and each later one reads
 * it with `_1`, `_2` and so on, skipping a label that is a counted player's real name or already
 * given. Seats and the organizer are not players and get nothing; a player not in the map reads
 * their plain name.
 */
export function gamePlayerNames(
  events: readonly LedgerEvent[],
  players: readonly Player[],
): Map<string, string> {
  const byId = new Map(players.map((player) => [player.id, player]));
  const inEffect = new Set(
    activeChipEvents(events).flatMap((e) => (e.type === "cash_out" ? [] : [e.playerId])),
  );
  const seated: Player[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type !== "buy_in" && event.type !== "rebuy") continue;
    const player = byId.get(event.playerId);
    if (!player || seen.has(player.id) || !inEffect.has(player.id)) continue;
    seen.add(player.id);
    seated.push(player);
  }

  const realNames = new Set(seated.map(({ name }) => playerNameKey(name)));
  const given = new Set<string>();
  const nextSuffix = new Map<string, number>();
  const names = new Map<string, string>();
  for (const player of seated) {
    const key = playerNameKey(player.name);
    let suffix = nextSuffix.get(key);
    let label = player.name;
    if (suffix === undefined) {
      suffix = 1;
    } else {
      const base = player.name.trim();
      while (true) {
        label = `${base}_${suffix}`;
        const labelKey = playerNameKey(label);
        suffix += 1;
        if (!realNames.has(labelKey) && !given.has(labelKey)) break;
      }
    }
    nextSuffix.set(key, suffix);
    given.add(playerNameKey(label));
    names.set(player.id, label);
  }
  return names;
}

/**
 * Puts namesakes in order of recency: players whose names share a key take the positions their
 * group holds, in the order of `recentIds` (most recent first), those not in it last. Everyone
 * else keeps their position.
 */
export function orderNamesakesByRecent(
  players: readonly Player[],
  recentIds: readonly string[],
): Player[] {
  const rank = new Map(recentIds.map((id, index) => [id, index]));
  const groups = new Map<string, number[]>();
  players.forEach((player, index) => {
    const key = playerNameKey(player.name);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const ordered = [...players];
  for (const positions of groups.values()) {
    if (positions.length < 2) continue;
    const members = positions
      .map((index) => players[index] as Player)
      .toSorted((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    positions.forEach((position, i) => {
      ordered[position] = members[i] as Player;
    });
  }
  return ordered;
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

/** What undoing insurance appends to the ledger. */
export interface InsuranceUndo {
  /** Reversed together, the seat's cash-out among them where it has to come back first. */
  readonly reversedEventIds: readonly string[];
  /** Bought by the seat in the same change, where it holds less than it has to give back. */
  readonly seatTopUpChips: number;
  /**
   * Stacks written a moment later: a player's, so taking back a hand bought leaves it as it is,
   * and the seat's, where the hand set its chips outright and they go back to what they were.
   */
  readonly keptStacks: readonly { readonly playerId: string; readonly chips: number }[];
  /** Players whose stack changed after the hand set it, and so is not restored. */
  readonly keptPlayerIds: readonly string[];
}

const NO_UNDO: InsuranceUndo = {
  reversedEventIds: [],
  seatTopUpChips: 0,
  keptStacks: [],
  keptPlayerIds: [],
};

/**
 * How the seat takes results back. After a settle attempt it has left and holds nothing, so its
 * cash-out is reversed in the same change. And where it holds less than the premiums it gives
 * back, it buys whole hands first, as it does to pay a hit: a stack stops at 0, and the rest
 * would be lost.
 */
function seatUndo(
  events: readonly LedgerEvent[],
  settleIds: readonly string[],
  handChips: number | undefined,
): Pick<InsuranceUndo, "reversedEventIds" | "seatTopUpChips"> {
  if (settleIds.length === 0) return { reversedEventIds: [], seatTopUpChips: 0 };
  const byId = new Map(events.map((e) => [e.id, e]));
  // What the seat gained from these results, which it now gives back
  const gained = settleIds.reduce((total, id) => {
    const settle = byId.get(id);
    if (settle?.type !== "insurance_settle") return total;
    const purchase = byId.get(settle.purchaseId);
    return total + (purchase?.type === "insurance_buy" ? purchase.chips : 0) - settle.chips;
  }, 0);
  const cashOut = latestCashOut(events, INSURANCE_PLAYER_ID);
  const seat = summarizeByPlayer(events).find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const stack = (seat?.stackChips ?? 0) + (cashOut?.chips ?? 0);
  const short = gained - stack;
  const hand = handChips ?? short;
  return {
    reversedEventIds: cashOut ? [cashOut.id] : [],
    seatTopUpChips: short <= 0 ? 0 : Math.ceil(short / hand) * hand,
  };
}

/**
 * Takes back one purchase from an outs count, with its result if it has one. What is already
 * reversed is left alone, so asking twice does nothing more.
 */
export function undoInsurance(
  events: readonly LedgerEvent[],
  { purchase, settleId }: Pick<InsuranceRecord, "purchase" | "settleId">,
  handChips: number | undefined,
): InsuranceUndo {
  const reversed = reversedEventIds(events);
  const settle = settleId !== undefined && !reversed.has(settleId) ? [settleId] : [];
  const bought = reversed.has(purchase.id) ? [] : [purchase.id];
  // Only a result moved the seat
  const seat = seatUndo(events, settle, handChips);
  return {
    ...NO_UNDO,
    seatTopUpChips: seat.seatTopUpChips,
    reversedEventIds: [...seat.reversedEventIds, ...settle, ...bought],
  };
}

/**
 * Takes back a finished insurance hand: its purchases and results, and the hands players bought
 * to pay a premium. A stack the hand set goes back to what it was only while nothing has changed
 * it since. Once the player's chips were typed, bought, or cashed out after the hand, they are
 * the count at the table and stay, whatever the hand is found to have got wrong.
 *
 * A change made after the hand and taken back again is no change: a later hand undone first, or a
 * player who left and came back, leaves this hand's stacks to be restored.
 *
 * The seat's chips, where the hand set them outright, go back to what they were before it. Buy-ins
 * the seat was given or gave back with the hand are a record of their own, and stay.
 */
export function undoInsuranceHand(
  events: readonly LedgerEvent[],
  handId: string,
  handChips: number | undefined,
): InsuranceUndo {
  const reversed = reversedEventIds(events);
  const ofHand = (e: LedgerEvent) =>
    e.type !== "reversal" && e.type !== "rake" && e.handId === handId && !reversed.has(e.id);
  const last = events.findLastIndex(ofHand);
  if (last < 0) return NO_UNDO;

  const indexOf = new Map(events.map((e, index) => [e.id, index]));
  const movesStack = (e: LedgerEvent | undefined): e is ChipEvent | StackSetEvent =>
    e !== undefined && (isChipEvent(e) || e.type === "stack_set");
  const changedSince = new Set(
    events.slice(last + 1).flatMap((e) => {
      if (e.type !== "reversal") return movesStack(e) && !reversed.has(e.id) ? [e.playerId] : [];
      // Taking back something older than the hand moves the stack the hand set
      const at = indexOf.get(e.reversedEventId);
      const target = at === undefined || at > last ? undefined : events[at];
      return movesStack(target) ? [target.playerId] : [];
    }),
  );

  const handEvents = events.filter(ofHand);
  const kept = (e: LedgerEvent) => e.type === "stack_set" && changedSince.has(e.playerId);
  const undone = handEvents.filter((e) => !kept(e));
  const seat = seatUndo(
    events,
    undone.flatMap((e) => (e.type === "insurance_settle" ? [e.id] : [])),
    handChips,
  );

  const ledger = summarizeByPlayer(events);
  // Taking back a hand bought moves the stack by it, so a stack that stays is written again
  const keptStacks = handEvents.flatMap((e) => {
    if (e.type !== "rebuy" || !changedSince.has(e.playerId)) return [];
    const player = ledger.find((p) => p.playerId === e.playerId);
    return player?.seated ? [{ playerId: player.playerId, chips: player.stackChips }] : [];
  });
  const seatChips = seatBeforeHand(events, handEvents, changedSince);
  return {
    reversedEventIds: [...seat.reversedEventIds, ...undone.map((e) => e.id)],
    // Chips written outright need no hands bought to reach them
    seatTopUpChips: seatChips === undefined ? seat.seatTopUpChips : 0,
    keptStacks:
      seatChips === undefined
        ? keptStacks
        : [...keptStacks, { playerId: INSURANCE_PLAYER_ID, chips: seatChips }],
    keptPlayerIds: handEvents.flatMap((e) =>
      e.type === "stack_set" && changedSince.has(e.playerId) ? [e.playerId] : [],
    ),
  };
}

/** The seat's chips in these events, with those it cashed out, which come back as it sits again. */
function seatChipsIn(events: readonly LedgerEvent[]): number {
  const seat = summarizeByPlayer(events).find((p) => p.playerId === INSURANCE_PLAYER_ID);
  return (seat?.stackChips ?? 0) + (latestCashOut(events, INSURANCE_PLAYER_ID)?.chips ?? 0);
}

/**
 * What the seat goes back to where the hand set its chips itself: the organizer counted them, or
 * changed its Buy-ins apart from them. Reversals cannot restore that, as the chips set took no
 * account of what the hand or the Buy-ins moved, and a stack that stopped at 0 has lost the rest.
 * So the seat is written back to what it had before the hand, moved by whatever later hands won
 * or lost it. Undefined where the hand set no chips for the seat, or they were set again since.
 */
function seatBeforeHand(
  events: readonly LedgerEvent[],
  handEvents: readonly LedgerEvent[],
  changedSince: ReadonlySet<string>,
): number | undefined {
  const set = handEvents.findLast(
    (e): e is StackSetEvent => e.type === "stack_set" && e.playerId === INSURANCE_PLAYER_ID,
  );
  if (!set || changedSince.has(INSURANCE_PLAYER_ID)) return undefined;
  // The seat's chips are set a moment after everything else of the hand is written
  const before = seatChipsIn(events.filter((e) => e.occurredAt < set.occurredAt - 1));
  return Math.max(0, seatChipsIn(events) - set.chips + before);
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
  | "insurance_undo"
  | "rake"
  | "rake_undo";

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
      } else if (target.type === "rake") {
        entries.push({ id, kind: undoing ? "rake_undo" : "rake", playerId, chips, occurredAt });
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
