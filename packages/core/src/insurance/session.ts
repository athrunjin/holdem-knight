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
import { type InsuranceQuote, type QuoteInput, type QuoteOption, quoteInsurance } from "./quote";

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

function handPots({
  players,
  pools,
  board,
}: Pick<InsuranceHand, "players" | "pools" | "board">): PotAnalysis[] {
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

/** What the cards of an offer do to its buyer: take the pot from them, or make them split it. */
export type OfferKind = "overtake" | "tie";

export interface HandOffer {
  readonly key: string;
  /**
   * The key of all the cards of this kind for this leader on this pot, which is this offer's own
   * key unless the cards are sold as two covers.
   */
  readonly baseKey: string;
  readonly kind: OfferKind;
  /** Which of the two covers this is, where the cards of its kind are sold as two. */
  readonly part?: 1 | 2;
  readonly street: InsuranceStreet;
  readonly potIndex: number;
  readonly pot: PotAnalysis;
  readonly leader: PotLeader;
  /** The cards this offer sells: of its kind, less those given up and those of the other cover. */
  readonly outs: readonly Card[];
  /** Every card of its kind, however it is sold or given up, in the order they are found. */
  readonly allOuts: readonly Card[];
  /** The cards of its kind the buyer gives up, which no cover is priced on or pays on. */
  readonly skippedOuts: readonly Card[];
  readonly input: QuoteInput;
  readonly quote: InsuranceQuote;
}

/**
 * The offers for the card on sale, for each leader of each pot. Cards that take the pot from the
 * leader are one offer. Under a rule that sells tie cards, those are an offer of their own, priced
 * by their own count and listed after the first; a leader with tie cards only has just that one.
 * A cover on tie cards pays no more than a tie can cost: half the pot when two would split it, two
 * thirds when three would.
 *
 * The buyer may give up cards of a kind, and may have some of them sold as a second cover: each
 * cover is then priced on its own cards, and the second is listed straight after the first. At
 * least one card is always sold.
 */
export function handOffers(hand: InsuranceHand, rule: InsuranceRule): HandOffer[] {
  const street = nextStreet(hand.board);
  if (!street) return [];
  return handPots(hand).flatMap((pot, potIndex) =>
    pot.leaders.flatMap((leader): HandOffer[] => {
      const blockedTie = tieBlocksInsurance(pot);
      const offers = (
        kind: OfferKind,
        allOuts: readonly Card[],
        tieShareChips?: number,
      ): HandOffer[] => {
        const base = `${street}-${potIndex}-${leader.playerId}`;
        const baseKey = kind === "tie" ? `${base}-tie` : base;
        const { first, second, skipped } = outsPlan(hand, baseKey, allOuts);
        const offer = (outs: readonly Card[], part?: 1 | 2): HandOffer => {
          const input: QuoteInput = {
            rule,
            street,
            potChips: pot.amountChips,
            shareChips: leader.shareChips,
            stakeChips: leader.stakeChips,
            outs: outs.length,
            // A tie leaves the buyer part of the pot, so a cover on tie cards pays no more than the rest
            ...(tieShareChips !== undefined && {
              keptChips: tieShareChips,
              capChips: leader.shareChips - tieShareChips,
            }),
            blockedTie,
          };
          return {
            key: part === 2 ? `${baseKey}-2` : baseKey,
            baseKey,
            kind,
            ...(part !== undefined && { part }),
            street,
            potIndex,
            pot,
            leader,
            outs,
            allOuts,
            skippedOuts: skipped,
            input,
            quote: quoteInsurance(input),
          };
        };
        return second.length > 0 ? [offer(first, 1), offer(second, 2)] : [offer(first)];
      };
      const overtake = offers("overtake", leader.outs);
      // A lead with nothing to insure says so once, not once for each kind of card
      if (rule.tieOuts !== "include" || blockedTie || leader.tieCards.length === 0) {
        return overtake;
      }
      const tie = offers("tie", leader.tieCards, leader.tieShareChips);
      return leader.outs.length > 0 ? [...overtake, ...tie] : tie;
    }),
  );
}

/**
 * How the cards of one kind are sold: the first cover, the second where there is one, and the
 * cards given up. Only cards still among the outs count. Giving up every card gives up none, and
 * a second cover that would hold every card sold is the first.
 */
function outsPlan(hand: InsuranceHand, baseKey: string, allOuts: readonly Card[]) {
  const given = hand.skippedOuts?.[baseKey] ?? [];
  const apart = hand.splitOuts?.[baseKey] ?? [];
  const kept = allOuts.filter((card) => !given.includes(card));
  const sold = kept.length > 0 ? kept : allOuts;
  const second = sold.filter((card) => apart.includes(card));
  const first = sold.filter((card) => !apart.includes(card));
  return {
    first: first.length > 0 ? first : second,
    second: first.length > 0 ? second : [],
    skipped: allOuts.filter((card) => !sold.includes(card)),
  };
}

/** How the players who have their cards stand on the board so far. See `showdownStandings`. */
export function handStandings(hand: Pick<InsuranceHand, "players" | "board">): Standings {
  return showdownStandings(
    hand.players.filter((p) => p.cards.length === 2),
    hand.board,
  );
}

export interface PotBreakdown {
  readonly amountChips: number;
  /** What each player has in this pot, in the order the players were entered. */
  readonly stakes: readonly { readonly playerId: string; readonly chips: number }[];
  /** Dead money in this pot. */
  readonly deadChips: number;
  /** Who holds the best hand in this pot on the cards so far. */
  readonly leaders: readonly string[];
  /** Each player's chance to win this pot. Empty before the flop, where it is not worked out. */
  readonly equity: Readonly<Record<string, number>>;
  /** Next cards that take this pot from its leader, and those that only split it. Both 0 before the flop. */
  readonly outs: number;
  readonly tieOuts: number;
  /** Cards nobody has seen, which the next one is dealt from. */
  readonly unseenCards: number;
}

/** Every contested pot, main pot first, by who put it in and who is ahead in it. */
export function handPotBreakdown(
  hand: Pick<InsuranceHand, "players" | "pools" | "board">,
): PotBreakdown[] {
  const cardsOf = new Map(hand.players.map((p) => [p.playerId, p.cards]));
  const seen = hand.board.length + hand.players.reduce((total, p) => total + p.cards.length, 0);
  // The same pots in the same order, with their outs and chances, once there is a flop to deal from
  const analyzed = hand.board.length >= 3 ? handPots(hand) : [];
  return buildPots(handPotEntries(hand))
    .filter((pot) => pot.playerIds.length > 1)
    .map((pot, index) => {
      const [leader] = analyzed[index]?.leaders ?? [];
      const stakes = pot.playerIds.map((playerId) => ({
        playerId,
        chips: pot.stakes[playerId] ?? 0,
      }));
      const staked = stakes.reduce((total, { chips }) => total + chips, 0);
      return {
        amountChips: pot.amountChips,
        stakes,
        deadChips: pot.amountChips - staked,
        leaders: winnersOf(pot.playerIds, cardsOf, hand.board),
        equity: analyzed[index]?.equity ?? {},
        outs: leader?.outs.length ?? 0,
        tieOuts: leader?.tieCards.length ?? 0,
        unseenCards: 52 - seen,
      };
    });
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
    ...(offer.kind === "tie" && { tie: true }),
    oddsHundredths,
    premiumChips: option.premiumChips,
    payoutChips: option.payoutChips,
  };
  return { ...hand, purchases: [...hand.purchases, purchase] };
}

/**
 * Sets how the cards of one kind are sold, by the key they share (`HandOffer.baseKey`): which are
 * given up, and which are sold as a second cover apart from the rest. With neither, they are all
 * sold as one cover again.
 */
export function arrangeOuts(
  hand: InsuranceHand,
  baseKey: string,
  plan: { readonly skipped: readonly Card[]; readonly second: readonly Card[] },
): InsuranceHand {
  const set = (
    all: Readonly<Record<string, readonly number[]>> | undefined,
    cards: readonly Card[],
  ) => {
    const { [baseKey]: _, ...others } = all ?? {};
    return cards.length > 0 ? { ...others, [baseKey]: [...cards] } : others;
  };
  return {
    ...hand,
    skippedOuts: set(hand.skippedOuts, plan.skipped),
    splitOuts: set(hand.splitOuts, plan.second),
  };
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

/**
 * Whether the hand's insurance is being worked out: a cover has been taken or turned down, or a
 * card dealt for one. From then on the hand is priced by the settings it began with, so they stay
 * as they are until it is finished or dropped.
 */
export function handUnderWay(hand: InsuranceHand): boolean {
  return (
    hand.purchases.length > 0 ||
    hand.declined.length > 0 ||
    hand.step === "deal" ||
    hand.step === "settle" ||
    hand.step === "summary"
  );
}

/** What one street's insurance came to for a player: payouts less premiums, and whether any hit. */
export interface StreetInsurance {
  readonly chips: number;
  readonly hit: boolean;
  /** Whoever a cover paid, each once, in the order the covers were bought. */
  readonly paidPlayerIds: readonly string[];
}

/**
 * Whether a street had insurance to decide on: a cover was taken or turned down there. A street
 * whose card was on the board when the hand was entered has neither, like one nobody could insure.
 */
export function streetOffered(
  hand: Pick<InsuranceHand, "purchases" | "declined">,
  street: InsuranceHandPurchase["street"],
): boolean {
  return (
    hand.purchases.some((p) => p.street === street) ||
    hand.declined.some((key) => key.startsWith(`${street}-`))
  );
}

/** A player's insurance on one street, or nothing if they bought none there. */
export function streetInsurance(
  hand: InsuranceHand,
  street: InsuranceHandPurchase["street"],
  playerId?: string,
): StreetInsurance | undefined {
  const bought = hand.purchases.filter(
    (p) => p.street === street && (playerId === undefined || p.playerId === playerId),
  );
  if (bought.length === 0) return undefined;
  return {
    chips: bought.reduce((total, p) => total + (p.hit ? p.payoutChips : 0) - p.premiumChips, 0),
    hit: bought.some((p) => p.hit === true),
    paidPlayerIds: [...new Set(bought.filter((p) => p.hit === true).map((p) => p.playerId))],
  };
}

export interface PlayerHandResult {
  readonly playerId: string;
  readonly cover: boolean;
  /** Won from the pots, dead money included. */
  readonly potChips: number;
  /** The same by pot, for every pot more than one player is in, main pot first. */
  readonly potShares: readonly number[];
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
  // One map for each pot more than one player is in
  const shares: Map<string, number>[] = [];
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
    const inPot = new Map<string, number>();
    shares.push(inPot);
    winners.forEach((id, i) => {
      add(won, id, share + (i < odd ? 1 : 0));
      add(inPot, id, share + (i < odd ? 1 : 0));
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
      potShares: shares.map((inPot) => inPot.get(playerId) ?? 0),
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
