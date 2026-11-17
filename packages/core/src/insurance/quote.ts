/**
 * Insurance prices. A cover is named for what it pays on a hit: the stake, half the pot share or
 * all of it. Chips are whole and nothing pays more than its target, so a premium is the largest
 * whose payout stays within it, and no payout is ever more than the pot share it insures.
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

export interface QuoteInput {
  readonly rule: InsuranceRule;
  readonly street: InsuranceStreet;
  readonly potChips: number;
  /** What the buyer wins if nothing changes. */
  readonly shareChips: number;
  /** What the buyer put in. */
  readonly stakeChips: number;
  readonly outs: number;
  /** The buyer is tied in a way that leaves no lead to insure. */
  readonly blockedTie?: boolean;
}

export interface QuoteOption {
  readonly premiumChips: number;
  readonly payoutChips: number;
  /** Result of the pot and the insurance together if the out comes: payout − premium. */
  readonly ifHitChips: number;
  /** Result if the out misses: the pot share − premium. */
  readonly ifMissChips: number;
  /** Whether the rule's cover limit held this option below its target. */
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
      /** Pays what the buyer put in. */
      readonly stake: QuoteOption;
      /** Pays half the buyer's share, rounded up. Null when that is already the stake. */
      readonly halfPot: QuoteOption | null;
      /** Pays the buyer's whole share of the pot. */
      readonly fullPot: QuoteOption;
    };

/** Prices any premium for a quote, for the amount the organizer actually sells. */
export function priceOption(
  input: Pick<QuoteInput, "rule" | "shareChips">,
  oddsHundredths: number,
  premiumChips: number,
  capped = false,
): QuoteOption {
  const payoutChips = payoutFor(premiumChips, oddsHundredths, input.rule.refundPremium);
  return {
    premiumChips,
    payoutChips,
    ifHitChips: payoutChips - premiumChips,
    ifMissChips: input.shareChips - premiumChips,
    capped,
  };
}

/** The most a cover may pay on this street under the rule. */
function coverLimitChips({ rule, street, shareChips, stakeChips }: QuoteInput): number {
  const limit = street === "turn" ? rule.turnCoverLimit : rule.riverCoverLimit;
  if (limit === undefined) return shareChips;
  if (limit === "stake") return Math.min(stakeChips, shareChips);
  return Math.ceil((shareChips * limit) / 100);
}

export function quoteInsurance(input: QuoteInput): InsuranceQuote {
  const { rule, shareChips, stakeChips, outs } = input;
  if (input.blockedTie) return { ok: false, block: "tied-lead" };
  if (outs === 0) return { ok: false, block: "no-outs" };
  const oddsHundredths = rule.oddsHundredths[outs - 1];
  if (oddsHundredths === undefined) return { ok: false, block: "too-many-outs" };

  // One chip of premium is the least there is to sell. It has to pay no more than the pot share.
  const premiumToPay = (payoutChips: number) =>
    premiumWithin(payoutChips, oddsHundredths, rule.refundPremium);
  const potPremiumChips = premiumToPay(shareChips);
  if (potPremiumChips < 1) return { ok: false, block: "pot-too-small" };
  // A target under one chip's payout, such as a small stake at long odds, still sells that chip
  const sold = (payoutChips: number) => Math.max(1, premiumToPay(payoutChips));
  const maxPremiumChips = Math.min(sold(coverLimitChips(input)), potPremiumChips);
  const halfChips = Math.ceil(shareChips / 2);
  const option = (payoutChips: number) => {
    const target = sold(payoutChips);
    const premium = Math.min(target, maxPremiumChips);
    return priceOption(input, oddsHundredths, premium, premium < target);
  };
  return {
    ok: true,
    oddsHundredths,
    maxPremiumChips,
    stake: option(Math.min(stakeChips, shareChips)),
    halfPot: halfChips === stakeChips ? null : option(halfChips),
    fullPot: option(shareChips),
  };
}

/** Outs as sold under the rule: tie cards join them if the rule says so. */
export function soldOuts(
  rule: InsuranceRule,
  leader: { readonly outs: readonly number[]; readonly tieCards: readonly number[] },
): number {
  return leader.outs.length + (rule.tieOuts === "include" ? leader.tieCards.length : 0);
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
