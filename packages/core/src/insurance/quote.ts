/**
 * Insurance prices. Chips are whole, so premiums round up and payouts round down, in the insurer's
 * favor. No payout is ever more than the pot share it insures.
 */
import type { InsuranceRule } from "../domain";
import type { InsuranceStreet } from "./analysis";

/** Premium needed for a payout of at least `coverChips`. */
export function premiumFor(coverChips: number, oddsHundredths: number): number {
  return Math.ceil((coverChips * 100) / oddsHundredths);
}

/**
 * Premium that leaves the buyer `netChips` on a hit, once the premium is paid. Without a refund each
 * chip of premium earns its odds less itself. At odds of 1 or below that earns nothing, so this
 * falls back to covering `netChips` with the payout alone.
 */
export function premiumForNet(
  netChips: number,
  oddsHundredths: number,
  refundPremium: boolean,
): number {
  const gain = refundPremium ? oddsHundredths : oddsHundredths - 100;
  return gain > 0 ? Math.ceil((netChips * 100) / gain) : premiumFor(netChips, oddsHundredths);
}

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
  /** Whether the premium limit held this option below its target. */
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
       * Highest premium allowed. Its payout may not be more than the pot share, and a hit may not
       * leave more than the rule's cover limit.
       */
      readonly maxPremiumChips: number;
      /** A hit leaves the buyer what they put in. */
      readonly stake: QuoteOption;
      /** A hit leaves the buyer half their share, rounded up. Null when that is already the stake. */
      readonly halfPot: QuoteOption | null;
      /**
       * The payout is the buyer's whole share of the pot: as near it as whole chips allow, and
       * never above it. A hit leaves that less the premium.
       */
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

/** The most a hit may leave the buyer on this street under the rule. */
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

  const premiumToLeave = (netChips: number) =>
    premiumForNet(netChips, oddsHundredths, rule.refundPremium);
  // The insurer never pays more than the pot share at stake, whatever cover is asked for
  const potPremiumChips = premiumWithin(shareChips, oddsHundredths, rule.refundPremium);
  if (potPremiumChips < 1) return { ok: false, block: "pot-too-small" };
  const limitPremiumChips = premiumToLeave(coverLimitChips(input));
  const maxPremiumChips = Math.min(limitPremiumChips, potPremiumChips);
  const halfChips = Math.ceil(shareChips / 2);
  const option = (netChips: number) => {
    const target = premiumToLeave(netChips);
    const premium = Math.min(target, maxPremiumChips);
    return priceOption(input, oddsHundredths, premium, premium < target);
  };
  return {
    ok: true,
    oddsHundredths,
    maxPremiumChips,
    stake: option(stakeChips),
    halfPot: halfChips === stakeChips ? null : option(halfChips),
    // Held below the pot only by the rule's own limit
    fullPot: priceOption(
      input,
      oddsHundredths,
      maxPremiumChips,
      limitPremiumChips < potPremiumChips,
    ),
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
