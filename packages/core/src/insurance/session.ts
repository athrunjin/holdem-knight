/** One all-in worked through card by card, from choosing the players to the last settlement. */
import type {
  InsuranceHand,
  InsuranceHandPlayer,
  InsuranceHandPurchase,
  InsuranceRule,
} from "../domain";
import {
  type AllInHand,
  analyzeAllIn,
  type InsuranceStreet,
  nextStreet,
  type PotAnalysis,
  type PotLeader,
  type Standings,
  showdownStandings,
  tieBlocksInsurance,
  winnersOf,
} from "./analysis";
import type { Card } from "./cards";
import { buildPots, type PotEntry } from "./pots";
import {
  type InsuranceQuote,
  type QuoteInput,
  type QuoteOption,
  quoteInsurance,
  soldOuts,
} from "./quote";

export function blankInsuranceHand(
  base: Pick<InsuranceHand, "id" | "organizerId" | "gameId" | "createdAt">,
): InsuranceHand {
  return {
    ...base,
    status: "open",
    step: "players",
    players: [],
    pools: [],
    board: [],
    purchases: [],
    declined: [],
  };
}

/** A cover player can match anyone, so they stake what the deepest of the others put in. */
export function stakeOf(
  player: InsuranceHandPlayer,
  players: readonly InsuranceHandPlayer[],
): number {
  if (!player.cover) return player.chips;
  return Math.max(0, ...players.filter((p) => !p.cover).map((p) => p.chips));
}

export function playersReady(players: readonly InsuranceHandPlayer[]): boolean {
  return (
    players.length >= 2 &&
    players.filter((p) => p.cover).length <= 1 &&
    players.every((p) => p.cards.length === 2 && (p.cover || p.chips > 0))
  );
}

/** Who has chips in, for pot totals. Works before the hand is complete. */
export function handPotEntries(hand: Pick<InsuranceHand, "players" | "pools">): PotEntry[] {
  const live = hand.players.flatMap((player) => {
    const chips = stakeOf(player, hand.players);
    return chips > 0 ? [{ playerId: player.playerId, chips }] : [];
  });
  const dead = hand.pools.map((chips, i) => ({ playerId: `pool-${i}`, chips, folded: true }));
  return [...live, ...dead];
}

function handPots({ players, pools, board }: InsuranceHand): PotAnalysis[] {
  const hands = players.map(
    (player): AllInHand => ({
      playerId: player.playerId,
      cards: player.cards,
      chips: stakeOf(player, players),
    }),
  );
  const dead = pools.map((chips, i) => ({ playerId: `pool-${i}`, chips }));
  return analyzeAllIn(hands, dead, board);
}

export interface HandOffer {
  readonly key: string;
  readonly street: InsuranceStreet;
  readonly potIndex: number;
  readonly pot: PotAnalysis;
  readonly leader: PotLeader;
  /** The cards this offer sells. */
  readonly outs: readonly Card[];
  readonly input: QuoteInput;
  readonly quote: InsuranceQuote;
}

/** One offer for each leader of each pot, for the card on sale. */
export function handOffers(hand: InsuranceHand, rule: InsuranceRule): HandOffer[] {
  const street = nextStreet(hand.board);
  if (!street) return [];
  return handPots(hand).flatMap((pot, potIndex) =>
    pot.leaders.map((leader): HandOffer => {
      const input: QuoteInput = {
        rule,
        street,
        potChips: pot.amountChips,
        shareChips: leader.shareChips,
        stakeChips: leader.stakeChips,
        outs: soldOuts(rule, leader),
        blockedTie: tieBlocksInsurance(pot),
      };
      const tied = rule.tieOuts === "include" ? leader.tieCards : [];
      return {
        key: `${street}-${potIndex}-${leader.playerId}`,
        street,
        potIndex,
        pot,
        leader,
        outs: [...leader.outs, ...tied],
        input,
        quote: quoteInsurance(input),
      };
    }),
  );
}

/** How the players who have their cards stand on the board so far. See `showdownStandings`. */
export function handStandings(hand: Pick<InsuranceHand, "players" | "board">): Standings {
  return showdownStandings(
    hand.players.filter((p) => p.cards.length === 2),
    hand.board,
  );
}

/** Whether every offer that can be bought has been bought or turned down. */
export function offersDecided(hand: InsuranceHand, offers: readonly HandOffer[]): boolean {
  return offers.every(
    ({ key, quote }) =>
      !quote.ok || hand.declined.includes(key) || hand.purchases.some((p) => p.offerKey === key),
  );
}

export function buyOffer(
  hand: InsuranceHand,
  offer: HandOffer,
  id: string,
  option: QuoteOption,
  oddsHundredths: number,
): InsuranceHand {
  const purchase: InsuranceHandPurchase = {
    id,
    offerKey: offer.key,
    playerId: offer.leader.playerId,
    street: offer.street,
    outs: offer.outs,
    oddsHundredths,
    premiumChips: option.premiumChips,
    payoutChips: option.payoutChips,
  };
  return { ...hand, purchases: [...hand.purchases, purchase] };
}

export function declineOffer(hand: InsuranceHand, key: string): InsuranceHand {
  return { ...hand, declined: [...hand.declined, key] };
}

/** Opens a decision again. */
export function reviseOffer(hand: InsuranceHand, key: string): InsuranceHand {
  return {
    ...hand,
    purchases: hand.purchases.filter((p) => p.offerKey !== key),
    declined: hand.declined.filter((k) => k !== key),
  };
}

/**
 * Deals the next card and works out what was sold on it. A street with nothing sold has nothing to
 * settle, except the river, where the organizer always closes the hand.
 */
export function dealCard(hand: InsuranceHand, card: Card): InsuranceHand {
  const street = nextStreet(hand.board);
  const purchases = hand.purchases.map((purchase) =>
    purchase.street === street ? { ...purchase, hit: purchase.outs.includes(card) } : purchase,
  );
  const board = [...hand.board, card];
  const settle = street === "river" || purchases.some((p) => p.street === street);
  return { ...hand, board, purchases, step: settle ? "settle" : "buy" };
}

/** Takes the last card back, for a card entered wrongly. */
export function undoDeal(hand: InsuranceHand): InsuranceHand {
  const board = hand.board.slice(0, -1);
  const street = nextStreet(board);
  const purchases = hand.purchases.map(({ hit, ...purchase }) =>
    purchase.street === street || hit === undefined ? purchase : { ...purchase, hit },
  );
  return { ...hand, board, purchases, step: "deal" };
}

export interface HandResult {
  readonly premiumChips: number;
  readonly payoutChips: number;
  /** What the insurance seat gains: the premiums less the payouts. */
  readonly seatChips: number;
}

export function handResult({ purchases }: Pick<InsuranceHand, "purchases">): HandResult {
  const settled = purchases.filter((p) => p.hit !== undefined);
  const premiumChips = settled.reduce((total, p) => total + p.premiumChips, 0);
  const payoutChips = settled.reduce((total, p) => total + (p.hit ? p.payoutChips : 0), 0);
  return { premiumChips, payoutChips, seatChips: premiumChips - payoutChips };
}

export interface PlayerHandResult {
  readonly playerId: string;
  readonly cover: boolean;
  /** Won from the pots, dead money included. */
  readonly potChips: number;
  /** Excess nobody called, which came straight back. */
  readonly refundChips: number;
  /** Payouts less premiums. */
  readonly insuranceChips: number;
  /** The hand and the insurance together. */
  readonly netChips: number;
  /** Chips left after the hand. A cover player has more behind, so theirs is unknown. */
  readonly stackChips: number | null;
  /** Premium the player's winnings could not pay. */
  readonly shortChips: number;
}

/**
 * How the finished board pays each player. Everyone but the cover is all-in, so what they end with
 * is all they have. An odd chip goes to the first winner entered, as seats are not recorded.
 * A cover is assumed to have enough behind for their premiums, so they are never short.
 */
export function playerHandResults(hand: InsuranceHand): PlayerHandResult[] {
  const cardsOf = new Map(hand.players.map((p) => [p.playerId, p.cards]));
  const won = new Map<string, number>();
  const refunds = new Map<string, number>();
  const add = (totals: Map<string, number>, id: string, chips: number) =>
    totals.set(id, (totals.get(id) ?? 0) + chips);

  for (const pot of buildPots(handPotEntries(hand))) {
    const [only] = pot.playerIds;
    if (pot.playerIds.length === 1 && only !== undefined) {
      add(refunds, only, pot.amountChips);
      continue;
    }
    const winners = winnersOf(pot.playerIds, cardsOf, hand.board);
    const share = Math.floor(pot.amountChips / winners.length);
    const odd = pot.amountChips - share * winners.length;
    winners.forEach((id, i) => {
      add(won, id, share + (i < odd ? 1 : 0));
    });
  }

  return hand.players.map((player) => {
    const { playerId, cover } = player;
    const insuranceChips = hand.purchases
      .filter((p) => p.playerId === playerId)
      .reduce((total, p) => total + (p.hit ? p.payoutChips : 0) - p.premiumChips, 0);
    const potChips = won.get(playerId) ?? 0;
    const refundChips = refunds.get(playerId) ?? 0;
    const left = potChips + refundChips + insuranceChips;
    return {
      playerId,
      cover,
      potChips,
      refundChips,
      insuranceChips,
      netChips: left - stakeOf(player, hand.players),
      stackChips: cover ? null : Math.max(0, left),
      shortChips: cover ? 0 : Math.max(0, -left),
    };
  });
}

export interface PremiumBuyIn {
  readonly playerId: string;
  readonly shortChips: number;
  /** Whole hands, enough to pay what is short. */
  readonly buyInChips: number;
  /** What the player has once the premium is paid from the buy-in. */
  readonly stackChips: number;
}

/** The buy-ins a hand needs so every premium is paid. The organizer confirms these first. */
export function premiumBuyIns(
  results: readonly PlayerHandResult[],
  handChips: number,
): PremiumBuyIn[] {
  return results.flatMap(({ playerId, shortChips }) => {
    if (shortChips === 0) return [];
    const buyInChips = Math.ceil(shortChips / handChips) * handChips;
    return [{ playerId, shortChips, buyInChips, stackChips: buyInChips - shortChips }];
  });
}
