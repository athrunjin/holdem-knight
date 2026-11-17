/**
 * Insurance prices. A cover is named for what it pays on a hit: the stake, half the pot share or
 * all of it. Chips are whole. A cover of the stake or of half the pot pays at least that, so its
 * premium is the smallest that does. Nothing pays more than the pot share it insures, so a full
 * pot's premium is the largest whose payout stays within it.
 */
import type { InsuranceRule } from "../domain";
import type { InsuranceStreet } from "./analysis";

/** What `premiumChips` pays on a hit, including any refunded premium. */
export function payoutFor(
  premiumChips: number,
  oddsHundredths: number,
  refundPremium: boolean,
): number {
  const payout = Math.floor((premiumChips * oddsHundredths) / 100);
  return refundPremium ? payout + premiumChips : payout;
}

/**
 * The largest premium whose payout on a hit, any refunded premium included, is no more than
 * `capChips`. Chips are whole, so that payout can fall a little short of the cap. Zero when even
 * one chip of premium would pay more.
 */
export function premiumWithin(
  capChips: number,
  oddsHundredths: number,
  refundPremium: boolean,
): number {
  const perChip = refundPremium ? oddsHundredths + 100 : oddsHundredths;
  let premium = Math.max(0, Math.floor((capChips * 100) / perChip));
  // The payout rounds down on its own, so the estimate can be a chip off either way
  while (premium > 0 && payoutFor(premium, oddsHundredths, refundPremium) > capChips) premium--;
  while (payoutFor(premium + 1, oddsHundredths, refundPremium) <= capChips) premium++;
  return premium;
}

/**
 * The smallest premium whose payout on a hit, any refunded premium included, is at least
 * `targetChips`. Chips are whole, so that payout can be a little over the target.
 */
export function premiumReaching(
  targetChips: number,
  oddsHundredths: number,
  refundPremium: boolean,
): number {
  const perChip = refundPremium ? oddsHundredths + 100 : oddsHundredths;
  let premium = Math.max(0, Math.ceil((targetChips * 100) / perChip));
  // The payout rounds down on its own, so the estimate can be a chip off either way
  while (payoutFor(premium, oddsHundredths, refundPremium) < targetChips) premium++;
  while (premium > 0 && payoutFor(premium - 1, oddsHundredths, refundPremium) >= targetChips) {
    premium--;
  }
  return premium;
}

export interface QuoteInput {
  readonly rule: InsuranceRule;
  readonly street: InsuranceStreet;
  readonly potChips: number;
  /** What the buyer wins if nothing changes. */
  readonly shareChips: number;
  /** What the buyer put in. */
  readonly stakeChips: number;
  /** How many cards are sold. */
  readonly outs: number;
  /**
   * What the buyer still wins of the pot when a card sold comes. Nothing for cards that overtake,
   * which is the default; their part of the split for tie cards.
   */
  readonly keptChips?: number;
  /** The buyer is tied in a way that leaves no lead to insure. */
  readonly blockedTie?: boolean;
}

export interface QuoteOption {
  readonly premiumChips: number;
  readonly payoutChips: number;
  /**
   * Result of the pot and the insurance together if a card sold comes: payout − premium, and for
   * tie cards the buyer's part of the split pot as well.
   */
  readonly ifHitChips: number;
  /** Result if the out misses: the pot share − premium. */
  readonly ifMissChips: number;
  /** Whether the pot share or the rule's cover limit held this option below its target. */
  readonly capped: boolean;
}

/** `pot-too-small`: a single chip of premium would already pay more than the pot share. */
export type QuoteBlock = "tied-lead" | "no-outs" | "too-many-outs" | "pot-too-small";

export type InsuranceQuote =
  | { readonly ok: false; readonly block: QuoteBlock }
  | {
      readonly ok: true;
      readonly oddsHundredths: number;
      /**
       * Highest premium allowed. Its payout may be no more than the pot share, nor than the rule's
       * cover limit for the street.
       */
      readonly maxPremiumChips: number;
      /** Pays at least what the buyer put in. */
      readonly stake: QuoteOption;
      /** Pays at least half the buyer's share, rounded up. Null when that is already the stake. */
      readonly halfPot: QuoteOption | null;
      /** Pays the buyer's whole share of the pot, as near it as whole chips allow and never above. */
      readonly fullPot: QuoteOption;
    };

/** Prices any premium for a quote, for the amount the organizer actually sells. */
export function priceOption(
  input: Pick<QuoteInput, "rule" | "shareChips" | "keptChips">,
  oddsHundredths: number,
  premiumChips: number,
  capped = false,
): QuoteOption {
  const payoutChips = payoutFor(premiumChips, oddsHundredths, input.rule.refundPremium);
  return {
    premiumChips,
    payoutChips,
    ifHitChips: (input.keptChips ?? 0) + payoutChips - premiumChips,
    ifMissChips: input.shareChips - premiumChips,
    capped,
  };
}

/**
 * What the largest cover on sale pays on this street under the rule: the stake, or a part of the
 * pot share. Undefined where the rule sets no limit, and the pot share itself is the only one.
 */
function coverLimitChips({ rule, street, shareChips, stakeChips }: QuoteInput): number | undefined {
  const limit = street === "turn" ? rule.turnCoverLimit : rule.riverCoverLimit;
  if (limit === undefined) return undefined;
  if (limit === "stake") return Math.min(stakeChips, shareChips);
  return Math.ceil((shareChips * limit) / 100);
}

export function quoteInsurance(input: QuoteInput): InsuranceQuote {
  const { rule, shareChips, stakeChips, outs } = input;
  if (input.blockedTie) return { ok: false, block: "tied-lead" };
  if (outs === 0) return { ok: false, block: "no-outs" };
  const oddsHundredths = rule.oddsHundredths[outs - 1];
  if (oddsHundredths === undefined) return { ok: false, block: "too-many-outs" };

  const { refundPremium } = rule;
  // Nothing pays more than the pot share, and one chip of premium is the least there is to sell
  const potPremiumChips = premiumWithin(shareChips, oddsHundredths, refundPremium);
  if (potPremiumChips < 1) return { ok: false, block: "pot-too-small" };
  // A cover below the full pot pays at least what it is named for, and its premium is the
  // smallest that does: the payout is set first, and the premium rounded to it
  const reaching = (payoutChips: number) =>
    Math.max(1, premiumReaching(payoutChips, oddsHundredths, refundPremium));
  const limitChips = coverLimitChips(input);
  const maxPremiumChips =
    limitChips === undefined ? potPremiumChips : Math.min(reaching(limitChips), potPremiumChips);
  const halfChips = Math.ceil(shareChips / 2);
  const option = (payoutChips: number) => {
    const target = reaching(payoutChips);
    const premium = Math.min(target, maxPremiumChips);
    return priceOption(input, oddsHundredths, premium, premium < target);
  };
  return {
    ok: true,
    oddsHundredths,
    maxPremiumChips,
    stake: option(Math.min(stakeChips, shareChips)),
    halfPot: halfChips === stakeChips ? null : option(halfChips),
    // Held under the pot share only by the rule's own limit
    fullPot: priceOption(input, oddsHundredths, maxPremiumChips, maxPremiumChips < potPremiumChips),
  };
}

/** Cards nobody has seen in a heads-up all-in: 52 less four hole cards and the board so far. */
export function unseenCards(street: InsuranceStreet): number {
  return street === "turn" ? 45 : 44;
}

/** Chance the next card is one of `outs` in a heads-up all-in. */
export function outsHitChance(street: InsuranceStreet, outs: number): number {
  const unseen = unseenCards(street);
  return Math.min(outs, unseen) / unseen;
}
