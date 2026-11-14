/** Settlement: balance check, each player's result in cash, and transfers. */
import {
  type ChipRatio,
  type Game,
  type ImbalanceHandling,
  INSURANCE_PLAYER_ID,
  OPTIMAL_PLAN,
  ORGANIZER_PLAYER_ID,
  type Transfer,
} from "../domain";
import { chipsToCents, type PlayerLedger } from "../ledger";
import { allocate, type Cents, cents, InvalidMoneyError, sum, ZERO } from "../money";

export interface BalanceAdjustments {
  readonly rakeChips: number;
}

const NO_ADJUSTMENTS: BalanceAdjustments = { rakeChips: 0 };

/**
 * Balance difference: all players' results + rake, which is 0 when balanced. Insurance needs no
 * term because the insurance seat is one of the players (ADR 0014).
 * Positive means more was cashed out than bought in. Rake stays 0 until M4.
 */
export function chipDifference(
  players: readonly PlayerLedger[],
  { rakeChips }: BalanceAdjustments = NO_ADJUSTMENTS,
): number {
  const net = players.reduce((total, p) => total + p.cashedOutChips - p.boughtChips, 0);
  return net + rakeChips;
}

export interface PlayerNet {
  readonly playerId: string;
  /** Positive is a win, negative is a loss. */
  readonly net: Cents;
}

/**
 * Each player's result in cash, before any difference is handled. Rounding per player would be a few cents off
 * when the ratio does not divide evenly, so each side's total comes first and `allocate` shares it out.
 * The larger side is the smaller one plus the converted difference, so the cash difference always matches
 * what the chip difference converts to.
 */
function rawNetCents(players: readonly PlayerLedger[], ratio: ChipRatio): PlayerNet[] {
  const chips = players.map((p) => ({ id: p.playerId, net: p.cashedOutChips - p.boughtChips }));
  const sideChips = (sign: number) =>
    chips.reduce((total, p) => (p.net * sign > 0 ? total + Math.abs(p.net) : total), 0);
  const wins = sideChips(1);
  const losses = sideChips(-1);
  const shared = chipsToCents(Math.min(wins, losses), ratio);
  const extra = chipsToCents(Math.abs(wins - losses), ratio);

  const shares = new Map<string, Cents>();
  for (const sign of [1, -1]) {
    const side = chips.filter((p) => p.net * sign > 0);
    if (side.length === 0) continue;
    const isLarger = sideChips(sign) === Math.max(wins, losses);
    const total = cents(shared + (isLarger ? extra : 0));
    const sizes = side.map((p) => Math.abs(p.net));
    allocate(total, sizes).forEach((share, i) => {
      const player = side[i];
      if (player) shares.set(player.id, cents(share * sign));
    });
  }
  return chips.map((p) => ({ playerId: p.id, net: shares.get(p.id) ?? ZERO }));
}

/** Each player's result in cash, adding up to exactly 0. Only for books whose chips already balance. */
export function netCents(players: readonly PlayerLedger[], ratio: ChipRatio): PlayerNet[] {
  if (chipDifference(players) !== 0) {
    throw new InvalidMoneyError("The books do not balance, so results cannot be converted");
  }
  return rawNetCents(players, ratio);
}

export const IMBALANCE_HANDLINGS: readonly ImbalanceHandling[] = ["split", "organizer", "ignore"];

export interface SettlementOutcome {
  /** Results after handling any difference. An organizer who covers it appears as `ORGANIZER_COLLECTOR`. */
  readonly nets: readonly PlayerNet[];
  /** Cash difference before handling. Positive means players are owed more than others lost. */
  readonly difference: Cents;
  /** The part of the difference left unhandled. */
  readonly unresolved: Cents;
}

/**
 * Takes the difference off the side that is too large, in proportion to each player's result.
 * With 200 too much, winners of 3000 and 1000 give up 150 and 50. With too little, losers pay less.
 */
function splitDifference(raw: readonly PlayerNet[], difference: Cents): PlayerNet[] {
  const sign = Math.sign(difference);
  const side = raw.filter((p) => p.net * sign > 0);
  const shares = new Map<string, Cents>();
  allocate(
    cents(Math.abs(difference)),
    side.map((p) => Math.abs(p.net)),
  ).forEach((share, i) => {
    const player = side[i];
    if (player) shares.set(player.playerId, share);
  });
  return raw.map(({ playerId, net }) => ({
    playerId,
    net: cents(net - sign * (shares.get(playerId) ?? ZERO)),
  }));
}

/** Works out results for any books. Unbalanced books with no handling chosen stay unhandled. */
export function settlementOutcome(
  players: readonly PlayerLedger[],
  ratio: ChipRatio,
  handling: ImbalanceHandling | undefined,
): SettlementOutcome {
  const raw = rawNetCents(players, ratio);
  const difference = sum(raw.map((p) => p.net));
  if (difference === 0) return { nets: raw, difference, unresolved: ZERO };

  if (handling === "split") {
    return { nets: splitDifference(raw, difference), difference, unresolved: ZERO };
  }
  if (handling === "organizer") {
    // An organizer who is playing keeps one row: their own result less the difference
    const playing = raw.some((p) => p.playerId === ORGANIZER_COLLECTOR);
    const nets = playing
      ? raw.map((p) =>
          p.playerId === ORGANIZER_COLLECTOR ? { ...p, net: cents(p.net - difference) } : p,
        )
      : [...raw, { playerId: ORGANIZER_COLLECTOR, net: cents(-difference) }];
    return { nets, difference, unresolved: ZERO };
  }
  return { nets: raw, difference, unresolved: difference };
}

export interface InsuranceAttribution {
  /** Results with the insurance row moved to its owner. */
  readonly nets: readonly PlayerNet[];
  /** The insurance result in cash, 0 if the game had none. */
  readonly insuranceNet: Cents;
  /** Who it went to, or `INSURANCE_PLAYER_ID` if it stays on its own row. */
  readonly ownerId: string;
}

/** A player no longer in the game, say after it went back to the table, falls back to the organizer. */
export function attributeInsurance(
  nets: readonly PlayerNet[],
  savedOwner: string | undefined,
): InsuranceAttribution {
  const insuranceNet = nets.find((p) => p.playerId === INSURANCE_PLAYER_ID)?.net ?? ZERO;
  const rest = nets.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const separate = savedOwner === INSURANCE_PLAYER_ID;
  if (separate) return { nets, insuranceNet, ownerId: INSURANCE_PLAYER_ID };

  const known = rest.some((p) => p.playerId === savedOwner) || savedOwner === ORGANIZER_COLLECTOR;
  const ownerId = known && savedOwner ? savedOwner : ORGANIZER_COLLECTOR;
  if (insuranceNet === 0) return { nets: rest, insuranceNet, ownerId };

  const hasOwner = rest.some((p) => p.playerId === ownerId);
  const moved = hasOwner
    ? rest.map((p) => (p.playerId === ownerId ? { ...p, net: cents(p.net + insuranceNet) } : p))
    : [...rest, { playerId: ownerId, net: insuranceNet }];
  return { nets: moved, insuranceNet, ownerId };
}

function largest(balances: Map<string, number>, sign: 1 | -1): [string, number] | undefined {
  let best: [string, number] | undefined;
  for (const [id, balance] of balances) {
    if (balance * sign > 0 && (!best || balance * sign > best[1] * sign)) best = [id, balance];
  }
  return best;
}

/**
 * Transfers: each step has the biggest debtor pay the biggest winner. Every transfer settles at least one person,
 * so there are at most n−1. A strictly minimal count is NP-hard and not attempted.
 */
export function settleTransfers(nets: readonly PlayerNet[]): Transfer[] {
  const balances = new Map<string, number>(nets.map((p) => [p.playerId, p.net]));
  const transfers: Transfer[] = [];
  for (;;) {
    const creditor = largest(balances, 1);
    const debtor = largest(balances, -1);
    if (!creditor || !debtor) return transfers;
    const amount = Math.min(creditor[1], -debtor[1]);
    transfers.push({ from: debtor[0], to: creditor[0], amount: cents(amount) });
    balances.set(creditor[0], creditor[1] - amount);
    balances.set(debtor[0], debtor[1] + amount);
  }
}

/** The organizer as collector or recipient, whether or not they are playing. */
export const ORGANIZER_COLLECTOR = ORGANIZER_PLAYER_ID;

/** Transfers through one person: every loser pays the collector, who pays every winner. */
export function collectorTransfers(nets: readonly PlayerNet[], collectorId: string): Transfer[] {
  return nets
    .filter((p) => p.playerId !== collectorId && p.net !== 0)
    .toSorted((a, b) => a.net - b.net)
    .map(({ playerId, net }) =>
      net < 0
        ? { from: playerId, to: collectorId, amount: cents(-net) }
        : { from: collectorId, to: playerId, amount: net },
    );
}

/** Whether someone can collect: the organizer always can, a player only while in the game. */
export function isValidCollector(nets: readonly PlayerNet[], collectorId: string | undefined) {
  return (
    collectorId === ORGANIZER_COLLECTOR || nets.some(({ playerId }) => playerId === collectorId)
  );
}

/**
 * Who collects at settlement, or `undefined` for the optimal plan. A saved choice comes first.
 * Without one, or with a collector no longer in the game (for example after it went back to the
 * table), a game with insurance, a table fee or wages goes through the organizer, and any other
 * game takes the optimal plan. Rake will count with them once it exists (M4).
 */
export function transferCollector(
  game: Pick<Game, "collectorId" | "insurance" | "tableFee" | "wage">,
  nets: readonly PlayerNet[],
): string | undefined {
  const { collectorId } = game;
  if (collectorId === OPTIMAL_PLAN) return undefined;
  if (collectorId !== undefined && isValidCollector(nets, collectorId)) return collectorId;
  return game.insurance || game.tableFee || game.wage ? ORGANIZER_COLLECTOR : undefined;
}

function sameTransfer(a: Transfer, b: Transfer) {
  return a.from === b.from && a.to === b.to && a.amount === b.amount;
}

/** Whether a transfer has been marked as made. */
export function isTransferDone(game: Pick<Game, "doneTransfers">, transfer: Transfer) {
  return (game.doneTransfers ?? []).some((done) => sameTransfer(done, transfer));
}

/** Marks transfers as made, or as not made again. Marks on other transfers stay as they are. */
export function markTransfers(game: Game, transfers: readonly Transfer[], done: boolean): Game {
  const { doneTransfers = [], ...rest } = game;
  const others = doneTransfers.filter((saved) => !transfers.some((t) => sameTransfer(saved, t)));
  const marked = transfers.map(({ from, to, amount }) => ({ from, to, amount }));
  const next = done ? [...others, ...marked] : others;
  return next.length > 0 ? { ...rest, doneTransfers: next } : rest;
}
