/**
 * All-in analysis: for every pot, who leads now, which next cards beat them, and each player's equity.
 * Outs are found by dealing every unseen card, so a card that helps two opponents counts once.
 */
import { type Card, DECK } from "./cards";
import { handScore } from "./evaluator";
import { buildPots, type Pot, type PotEntry } from "./pots";

export interface AllInHand extends PotEntry {
  readonly cards: readonly Card[];
}

/** The street whose card is on sale. Insurance only covers the next card. */
export type InsuranceStreet = "turn" | "river";

export function nextStreet(board: readonly Card[]): InsuranceStreet | null {
  if (board.length === 3) return "turn";
  return board.length === 4 ? "river" : null;
}

export interface OpponentOuts {
  readonly playerId: string;
  readonly cards: readonly Card[];
}

export interface PotLeader {
  readonly playerId: string;
  /** What this leader put into the pot. */
  readonly stakeChips: number;
  /** What this leader wins if nothing changes. Tied leaders share the pot. */
  readonly shareChips: number;
  /** Cards that lose this leader their whole share. */
  readonly outs: readonly Card[];
  /** Cards that make this leader split with more players than now. */
  readonly tieCards: readonly Card[];
  /** Who overtakes on which cards. A card can appear under several opponents. */
  readonly byOpponent: readonly OpponentOuts[];
}

export interface PotAnalysis extends Pot {
  /** Players with the best hand now. More than one means they are tied. */
  readonly leaders: readonly PotLeader[];
  /** Chance of winning this pot, with ties counted as a share, by player. */
  readonly equity: Readonly<Record<string, number>>;
}

/**
 * A tie has no lead to insure. The exception is leaders level in every way with someone behind them:
 * that player's outs are a real risk to both.
 */
export function tieBlocksInsurance({
  leaders,
  equity,
  playerIds,
}: Pick<PotAnalysis, "leaders" | "equity" | "playerIds">): boolean {
  if (leaders.length < 2) return false;
  const chances = leaders.map(({ playerId }) => equity[playerId] ?? 0);
  const uneven = Math.max(...chances) - Math.min(...chances) > 1e-9;
  return uneven || leaders.length === playerIds.length;
}

function unseenCards(hands: readonly Pick<AllInHand, "cards">[], board: readonly Card[]): Card[] {
  const seen = new Set<Card>([...board, ...hands.flatMap((h) => h.cards)]);
  return DECK.filter((card) => !seen.has(card));
}

export function winnersOf(
  playerIds: readonly string[],
  cardsOf: ReadonlyMap<string, readonly Card[]>,
  board: readonly Card[],
): string[] {
  let best = -1;
  let winners: string[] = [];
  for (const playerId of playerIds) {
    const score = handScore([...(cardsOf.get(playerId) ?? []), ...board]);
    if (score > best) {
      best = score;
      winners = [playerId];
    } else if (score === best) {
      winners.push(playerId);
    }
  }
  return winners;
}

function leaderOf(
  pot: Pot,
  playerId: string,
  tiedLeaders: number,
  cardsOf: ReadonlyMap<string, readonly Card[]>,
  board: readonly Card[],
  unseen: readonly Card[],
): PotLeader {
  const outs: Card[] = [];
  const tieCards: Card[] = [];
  const opponents = new Map<string, Card[]>();
  for (const card of unseen) {
    const winners = winnersOf(pot.playerIds, cardsOf, [...board, card]);
    if (!winners.includes(playerId)) {
      outs.push(card);
      for (const winner of winners) {
        opponents.set(winner, [...(opponents.get(winner) ?? []), card]);
      }
    } else if (winners.length > tiedLeaders) {
      tieCards.push(card);
    }
  }
  return {
    playerId,
    stakeChips: pot.stakes[playerId] ?? 0,
    shareChips: Math.floor(pot.amountChips / tiedLeaders),
    outs,
    tieCards,
    byOpponent: [...opponents].map(([opponent, cards]) => ({ playerId: opponent, cards })),
  };
}

/** Every way to finish the board. Boards are at most two cards short here, so this stays small. */
function runouts(unseen: readonly Card[], needed: number): Card[][] {
  if (needed === 0) return [[]];
  if (needed === 1) return unseen.map((card) => [card]);
  return unseen.flatMap((first, i) => unseen.slice(i + 1).map((second) => [first, second]));
}

/** Each player's share of the wins over these ways to finish the board, a split counted as a share. */
function equityOver(
  playerIds: readonly string[],
  cardsOf: ReadonlyMap<string, readonly Card[]>,
  board: readonly Card[],
  finishes: readonly (readonly Card[])[],
): Record<string, number> {
  const shares = new Map<string, number>();
  for (const finish of finishes) {
    const winners = winnersOf(playerIds, cardsOf, [...board, ...finish]);
    for (const winner of winners) {
      shares.set(winner, (shares.get(winner) ?? 0) + 1 / winners.length);
    }
  }
  return Object.fromEntries(playerIds.map((id) => [id, (shares.get(id) ?? 0) / finishes.length]));
}

function potEquity(
  pot: Pot,
  cardsOf: ReadonlyMap<string, readonly Card[]>,
  board: readonly Card[],
  unseen: readonly Card[],
): Record<string, number> {
  return equityOver(pot.playerIds, cardsOf, board, runouts(unseen, 5 - board.length));
}

/**
 * Analyzes each pot with at least two players, largest contest first in main-to-side order.
 * Needs a flop or turn board: preflop has no next single card to sell.
 * Cards folded players held are unknown, so they stay in the deck and count as outs.
 */
export function analyzeAllIn(
  hands: readonly AllInHand[],
  folded: readonly PotEntry[],
  board: readonly Card[],
): PotAnalysis[] {
  const cardsOf = new Map(hands.map((h) => [h.playerId, h.cards]));
  const unseen = unseenCards(hands, board);
  const pots = buildPots([...hands, ...folded.map((entry) => ({ ...entry, folded: true }))]);
  return pots
    .filter((pot) => pot.playerIds.length > 1)
    .map((pot) => {
      const leaderIds = winnersOf(pot.playerIds, cardsOf, board);
      return {
        ...pot,
        leaders: leaderIds.map((id) => leaderOf(pot, id, leaderIds.length, cardsOf, board, unseen)),
        equity: potEquity(pot, cardsOf, board, unseen),
      };
    });
}

export interface Standing {
  readonly playerId: string;
  /** Holds the best hand on the cards so far. Several players do when they are level. */
  readonly leading: boolean;
  /** Chance of ending with the best hand, a split counted as a share. */
  readonly equity: number;
  /** For a player behind: next cards that put them ahead of everyone leading now. */
  readonly outs: readonly Card[];
  /** For a player behind: next cards that bring them level with a leader. */
  readonly tieCards: readonly Card[];
}

export interface Standings {
  readonly players: readonly Standing[];
  /** False when the board is too far from finished to deal every runout, so the equity is sampled. */
  readonly exact: boolean;
}

/** Runouts dealt when there are too many to deal them all. The equity is then good to about a point. */
const SAMPLED_RUNOUTS = 20_000;

/** Mulberry32: the same seed gives the same numbers, so the same cards always show the same equity. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
}

function sampledRunouts(unseen: readonly Card[], needed: number, seed: number): Card[][] {
  const random = seededRandom(seed);
  const deck = [...unseen];
  return Array.from({ length: SAMPLED_RUNOUTS }, () => {
    // The first cards of a fresh partial shuffle are an even draw, whatever order the deck was left in
    for (let place = 0; place < needed; place++) {
      const from = place + Math.floor(random() * (deck.length - place));
      const drawn = deck[from] ?? 0;
      deck[from] = deck[place] ?? 0;
      deck[place] = drawn;
    }
    return deck.slice(0, needed);
  });
}

/**
 * How the players stand as one showdown, whatever each put in: who is ahead on the cards so far,
 * everyone's chance to win, and what the players behind need from the next card.
 * Works before the flop too. Empty until two players hold cards.
 */
export function showdownStandings(
  hands: readonly Pick<AllInHand, "playerId" | "cards">[],
  board: readonly Card[],
): Standings {
  if (hands.length < 2) return { players: [], exact: true };
  const playerIds = hands.map((h) => h.playerId);
  const cardsOf = new Map(hands.map((h) => [h.playerId, h.cards]));
  const unseen = unseenCards(hands, board);
  const leaders = winnersOf(playerIds, cardsOf, board);
  const needed = 5 - board.length;

  const outs = new Map<string, Card[]>();
  const tieCards = new Map<string, Card[]>();
  for (const card of needed > 0 ? unseen : []) {
    const winners = winnersOf(playerIds, cardsOf, [...board, card]);
    const cards = winners.some((id) => leaders.includes(id)) ? tieCards : outs;
    for (const winner of winners) {
      if (!leaders.includes(winner)) cards.set(winner, [...(cards.get(winner) ?? []), card]);
    }
  }

  const exact = needed <= 2;
  const seed = [...board, ...hands.flatMap((h) => h.cards)].reduce(
    (mixed, card) => Math.imul(mixed, 53) + card + 1,
    0,
  );
  const finishes = exact ? runouts(unseen, needed) : sampledRunouts(unseen, needed, seed);
  const equity = equityOver(playerIds, cardsOf, board, finishes);
  return {
    exact,
    players: playerIds.map((playerId) => ({
      playerId,
      leading: leaders.includes(playerId),
      equity: equity[playerId] ?? 0,
      outs: outs.get(playerId) ?? [],
      tieCards: tieCards.get(playerId) ?? [],
    })),
  };
}
