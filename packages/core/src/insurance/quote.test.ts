import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { InsuranceRule } from "../domain";
import {
  outsHitChance,
  payoutFor,
  premiumReaching,
  premiumWithin,
  priceOption,
  type QuoteInput,
  quoteInsurance,
  roundToChip,
  unseenCards,
} from "./quote";
import {
  formatOdds,
  parseInsuranceRule,
  parseOdds,
  RULE_30,
  RULE_32,
  ruleAtStakes,
  ruleToKeep,
  toInsuranceRuleForm,
} from "./rules";

const input = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  rule: RULE_30,
  street: "river",
  potChips: 1000,
  shareChips: 1000,
  stakeChips: 500,
  outs: 8,
  ...overrides,
});

describe("quoteInsurance", () => {
  it("prices a cover by what it pays: the stake, or the whole pot share", () => {
    const quote = quoteInsurance(input());
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.oddsHundredths).toBe(350);
    // 143 pays 500, the stake of 500 itself. A hit leaves that less the premium.
    expect(quote.stake).toMatchObject({ premiumChips: 143, payoutChips: 500, ifHitChips: 357 });
    // 285 pays 997. One chip more would pay 1,001, which is more than the pot of 1,000.
    expect(quote.fullPot).toEqual({
      premiumChips: 285,
      payoutChips: 997,
      ifHitChips: 712,
      ifMissChips: 715,
      capped: false,
    });
    expect(quote.maxPremiumChips).toBe(285);
  });

  it("pays at least the stake at low odds, and still no more than the pot for a full pot", () => {
    // At 1.4 a premium of 357 pays 499, a chip short of the stake, so the cover takes 358.
    // Priced to leave the stake after the premium, it once asked for 1,250 and paid 1,750.
    const quote = quoteInsurance(input({ outs: 15 }));
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.oddsHundredths).toBe(140);
    expect(quote.stake).toMatchObject({ premiumChips: 358, payoutChips: 501, capped: false });
    expect(quote.fullPot).toMatchObject({ premiumChips: 714, payoutChips: 999, capped: false });
    expect(quote.maxPremiumChips).toBe(714);
  });

  it("prices any premium the organizer sells", () => {
    expect(priceOption({ rule: RULE_30, shareChips: 1000 }, 350, 100)).toEqual({
      premiumChips: 100,
      payoutChips: 350,
      ifHitChips: 250,
      ifMissChips: 900,
      capped: false,
    });
    const refund = { ...RULE_30, refundPremium: true };
    expect(priceOption({ rule: refund, shareChips: 1000 }, 350, 100)).toMatchObject({
      payoutChips: 450,
      ifHitChips: 350,
    });
  });

  it("refuses a pot so small that one chip of premium pays more than it", () => {
    // One out pays 30, so a single chip of premium already pays more than a share of 29
    expect(
      quoteInsurance(input({ outs: 1, potChips: 29, shareChips: 29, stakeChips: 14 })),
    ).toEqual({ ok: false, block: "pot-too-small" });
    const least = quoteInsurance(input({ outs: 1, potChips: 30, shareChips: 30, stakeChips: 15 }));
    expect(least.ok && least.fullPot).toMatchObject({ premiumChips: 1, payoutChips: 30 });
    // The stake of 15 is under what one chip pays, and one chip is the least there is to sell
    expect(least.ok && least.stake).toMatchObject({ premiumChips: 1, payoutChips: 30 });
  });

  it("adds a half-pot cover only when it differs from the stake", () => {
    const even = quoteInsurance(input());
    if (!even.ok) throw new Error("Expected a quote");
    expect(even.halfPot).toBeNull();

    const withDead = quoteInsurance(input({ potChips: 1301, shareChips: 1301 }));
    if (!withDead.ok) throw new Error("Expected a quote");
    // Half of 1,301 rounds up to 651, which 186 pays exactly
    expect(withDead.halfPot).toMatchObject({ premiumChips: 186, payoutChips: 651 });

    // Half of 3,000 is 1,500. 428 pays 1,498, short of it, so the cover takes 429 and pays 1,501
    const uneven = quoteInsurance(input({ potChips: 3000, shareChips: 3000, stakeChips: 1000 }));
    if (!uneven.ok) throw new Error("Expected a quote");
    expect(uneven.halfPot).toMatchObject({ premiumChips: 429, payoutChips: 1501 });
    expect(uneven.stake).toMatchObject({ premiumChips: 286, payoutChips: 1001 });
    expect(uneven.fullPot).toMatchObject({ premiumChips: 857, payoutChips: 2999 });
  });

  it("hands the premium back on a hit when the rule says so", () => {
    const rule = { ...RULE_30, refundPremium: true };
    const quote = quoteInsurance(input({ rule }));
    if (!quote.ok) throw new Error("Expected a quote");
    // The refunded premium is part of the payout: 222 pays 777 and comes back, 999 in all
    expect(quote.fullPot).toMatchObject({ premiumChips: 222, payoutChips: 999, ifHitChips: 777 });
    // 111 would pay 388 and come back, 499 in all, a chip short of the stake
    expect(quote.stake).toMatchObject({ premiumChips: 112, payoutChips: 504, ifHitChips: 392 });
    expect(quote.maxPremiumChips).toBe(222);
  });

  it("holds covers at the street's limit as a share of the pot", () => {
    const rule: InsuranceRule = { ...RULE_30, riverCoverLimit: 60 };
    const quote = quoteInsurance(input({ rule }));
    if (!quote.ok) throw new Error("Expected a quote");
    // The largest cover on sale is one of 600, which takes 172. The pot alone would allow 285.
    expect(quote.maxPremiumChips).toBe(172);
    expect(quote.fullPot).toMatchObject({ premiumChips: 172, payoutChips: 602, capped: true });
    expect(quote.stake).toMatchObject({ premiumChips: 143, capped: false });
    const turn = quoteInsurance(input({ rule, street: "turn" }));
    if (!turn.ok) throw new Error("Expected a quote");
    expect(turn.fullPot.capped).toBe(false);
  });

  it("holds covers at the stake when the limit is the stake", () => {
    const rule: InsuranceRule = { ...RULE_30, turnCoverLimit: "stake" };
    const quote = quoteInsurance(input({ rule, street: "turn" }));
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.maxPremiumChips).toBe(143);
    expect(quote.fullPot).toMatchObject({ premiumChips: 143, payoutChips: 500, capped: true });
    expect(quote.stake.capped).toBe(false);
  });

  it("never pays more than the pot share, whatever the cover, the odds or the rule", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 15 }),
        fc.boolean(),
        fc.constantFrom(undefined, "stake" as const, 25, 50, 99),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        (shareChips, outs, refundPremium, limit, stakePart) => {
          const rule: InsuranceRule = {
            ...RULE_30,
            refundPremium,
            ...(limit !== undefined && { riverCoverLimit: limit }),
          };
          const stakeChips = Math.max(1, Math.floor(shareChips * stakePart));
          const quote = quoteInsurance(
            input({ rule, outs, potChips: shareChips, shareChips, stakeChips }),
          );
          const odds = RULE_30.oddsHundredths[outs - 1] ?? 0;
          if (!quote.ok) {
            // Refused only when a single chip of premium would pay more than the share
            expect(quote.block).toBe("pot-too-small");
            expect(payoutFor(1, odds, refundPremium)).toBeGreaterThan(shareChips);
            return;
          }
          // A cover below the full pot pays at least what it is named for with the smallest
          // premium that does, unless the pot share or the rule's limit holds it under that
          const named: [typeof quote.stake, number][] = [
            [quote.stake, Math.min(stakeChips, shareChips)],
            ...(quote.halfPot
              ? [[quote.halfPot, Math.ceil(shareChips / 2)] as [typeof quote.stake, number]]
              : []),
          ];
          for (const [option, target] of named) {
            if (option.capped) {
              expect(option.premiumChips).toBe(quote.maxPremiumChips);
              continue;
            }
            expect(option.payoutChips).toBeGreaterThanOrEqual(target);
            if (option.premiumChips > 1) {
              expect(payoutFor(option.premiumChips - 1, odds, refundPremium)).toBeLessThan(target);
            }
          }
          const options = [quote.stake, quote.fullPot, ...(quote.halfPot ? [quote.halfPot] : [])];
          for (const option of options) {
            expect(option.premiumChips).toBeGreaterThanOrEqual(1);
            expect(option.premiumChips).toBeLessThanOrEqual(quote.maxPremiumChips);
            expect(option.payoutChips).toBeLessThanOrEqual(shareChips);
          }
          // The highest premium on sale pays no more than the share either, for a custom premium
          expect(payoutFor(quote.maxPremiumChips, odds, refundPremium)).toBeLessThanOrEqual(
            shareChips,
          );
          // With no limit from the rule, the full pot is as near the share as whole chips allow
          if (limit === undefined) {
            expect(payoutFor(quote.fullPot.premiumChips + 1, odds, refundPremium)).toBeGreaterThan(
              shareChips,
            );
          }
        },
      ),
    );
  });

  it("finds the smallest premium whose payout reaches a target", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.boolean(),
        (target, odds, refundPremium) => {
          const premium = premiumReaching(target, odds, refundPremium);
          expect(premium).toBeGreaterThanOrEqual(1);
          expect(payoutFor(premium, odds, refundPremium)).toBeGreaterThanOrEqual(target);
          expect(payoutFor(premium - 1, odds, refundPremium)).toBeLessThan(target);
        },
      ),
    );
  });

  it("finds the largest premium whose payout stays within a cap", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.boolean(),
        (cap, odds, refundPremium) => {
          const premium = premiumWithin(cap, odds, refundPremium);
          expect(premium).toBeGreaterThanOrEqual(0);
          if (premium > 0) expect(payoutFor(premium, odds, refundPremium)).toBeLessThanOrEqual(cap);
          expect(payoutFor(premium + 1, odds, refundPremium)).toBeGreaterThan(cap);
        },
      ),
    );
  });

  it.each([
    ["no outs", { outs: 0 }, "no-outs"],
    ["more outs than the table", { outs: 16 }, "too-many-outs"],
  ])("refuses %s", (_, overrides, block) => {
    expect(quoteInsurance(input(overrides))).toEqual({ ok: false, block });
  });
});

describe("a cap under the pot share", () => {
  it("holds every cover at what a tie can cost", () => {
    // A pot of 300 between two: a tie costs the leader 150
    const two = quoteInsurance(
      input({ potChips: 300, shareChips: 300, stakeChips: 100, outs: 4, capChips: 150 }),
    );
    if (!two.ok) throw new Error("Expected a quote");
    expect(two.stake.payoutChips).toBeGreaterThanOrEqual(100);
    // Half the pot is the cap itself, so the largest cover is that one again
    expect(two.halfPot?.payoutChips).toBeLessThanOrEqual(150);
    expect(two.fullPot.premiumChips).toBe(two.halfPot?.premiumChips);
    expect(two.fullPot.payoutChips).toBeLessThanOrEqual(150);
    expect(two.maxPremiumChips).toBe(two.fullPot.premiumChips);

    // Between three a tie can cost two thirds of it, which is more than half
    const three = quoteInsurance(
      input({ potChips: 300, shareChips: 300, stakeChips: 100, outs: 4, capChips: 200 }),
    );
    if (!three.ok) throw new Error("Expected a quote");
    expect(three.halfPot?.payoutChips).toBeGreaterThanOrEqual(150);
    expect(three.fullPot.premiumChips).toBeGreaterThan(three.halfPot?.premiumChips ?? 0);
    expect(three.fullPot.payoutChips).toBeLessThanOrEqual(200);
    expect(three.fullPot.payoutChips).toBeGreaterThan(150);
  });

  it("marks a cover the cap holds under its target", () => {
    // The stake of 500 is more than the 300 a tie can cost
    const quote = quoteInsurance(input({ capChips: 300, outs: 4 }));
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.stake).toMatchObject({ capped: true });
    expect(quote.stake.payoutChips).toBeLessThanOrEqual(300);
  });

  it("never pays more than the cap, whatever the pot, the odds and the refund", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 2_000_000 }),
        fc.integer({ min: 1, max: 15 }),
        fc.boolean(),
        fc.integer({ min: 2, max: 6 }),
        (shareChips, outs, refundPremium, winners) => {
          const capChips = shareChips - Math.floor(shareChips / winners);
          const quote = quoteInsurance(
            input({
              rule: { ...RULE_30, refundPremium },
              potChips: shareChips,
              shareChips,
              stakeChips: Math.ceil(shareChips / 3),
              outs,
              capChips,
            }),
          );
          if (!quote.ok) return;
          for (const option of [quote.stake, quote.halfPot, quote.fullPot]) {
            if (option) expect(option.payoutChips).toBeLessThanOrEqual(capChips);
          }
        },
      ),
    );
  });
});

describe("tie cards", () => {
  it("leaves the buyer their part of the split pot on top of the payout", () => {
    const overtake = quoteInsurance(input({ outs: 4 }));
    const tie = quoteInsurance(input({ outs: 4, keptChips: 500 }));
    if (!overtake.ok || !tie.ok) throw new Error("Expected quotes");
    // The same cover at the same price: only what a hit leaves differs
    for (const cover of ["stake", "fullPot"] as const) {
      expect(tie[cover].premiumChips).toBe(overtake[cover].premiumChips);
      expect(tie[cover].payoutChips).toBe(overtake[cover].payoutChips);
      expect(tie[cover].ifMissChips).toBe(overtake[cover].ifMissChips);
      expect(tie[cover].ifHitChips).toBe(overtake[cover].ifHitChips + 500);
    }
  });
});

describe("rule tables", () => {
  it("keeps the two built-in tables different only at 1, 2 and 12 outs", () => {
    const differ = RULE_30.oddsHundredths.flatMap((odds, i) =>
      odds === RULE_32.oddsHundredths[i] ? [] : [i + 1],
    );
    expect(differ).toEqual([1, 2, 12]);
  });

  it("parses odds exactly", () => {
    expect(parseOdds("2.2")).toBe(220);
    expect(parseOdds("3.5")).toBe(350);
    expect(parseOdds("30")).toBe(3000);
    expect(parseOdds("1.05")).toBe(105);
    expect(parseOdds("0")).toBeNull();
    expect(parseOdds("1.234")).toBeNull();
    expect(parseOdds("abc")).toBeNull();
    expect(formatOdds(220)).toBe("2.2");
  });

  it("round-trips a rule through its form", () => {
    const rule: InsuranceRule = {
      ...RULE_32,
      tieOuts: "exclude",
      turnCoverLimit: "stake",
      riverCoverLimit: 50,
    };
    expect(parseInsuranceRule(toInsuranceRuleForm(rule))).toEqual({ ok: true, rule });
  });

  it("leaves full-pot limits off the rule and reports which fields are wrong", () => {
    const form = toInsuranceRuleForm(RULE_30);
    expect(parseInsuranceRule(form)).toEqual({ ok: true, rule: RULE_30 });
    const odds = form.odds.map((value, i) => (i === 1 ? "x" : value));
    expect(parseInsuranceRule({ ...form, odds, turnLimit: "101" })).toEqual({
      ok: false,
      issues: { odds: [2], turnLimit: true },
    });
  });
});

describe("quoteInsurance with rounding to the smallest chip", () => {
  // A pot of 3,000, all the buyer's, with 1,000 of it theirs, at 8 outs: 3.5 on 1 赔 30
  const priced = (mode: "nearest" | "down" | "up", chips = 5) => {
    const rule: InsuranceRule = { ...RULE_30, rounding: { mode, smallBlinds: 1, chips } };
    const quote = quoteInsurance({
      rule,
      street: "river",
      potChips: 3000,
      shareChips: 3000,
      stakeChips: 1000,
      outs: 8,
    });
    if (!quote.ok) throw new Error("Expected a quote");
    return quote;
  };

  it("rounds each premium and payout to the nearest smallest chip", () => {
    const quote = priced("nearest");
    // 1,000 ÷ 3.5 is 285.71, so 285, which pays 997.5, so 1,000
    expect(quote.stake).toMatchObject({ premiumChips: 285, payoutChips: 1000 });
    expect(quote.halfPot).toMatchObject({ premiumChips: 430, payoutChips: 1505 });
    expect(quote.fullPot).toMatchObject({ premiumChips: 855, payoutChips: 2995 });
  });

  it("rounds down, or up, when the rule says so", () => {
    expect(priced("down").stake).toMatchObject({ premiumChips: 285, payoutChips: 995 });
    expect(priced("down").fullPot).toMatchObject({ premiumChips: 855, payoutChips: 2990 });
    expect(priced("up").stake).toMatchObject({ premiumChips: 290, payoutChips: 1015 });
    // Rounding up can pay a little over the pot share: the rule's rounding has the last word
    expect(priced("up").fullPot).toMatchObject({ premiumChips: 860, payoutChips: 3010 });
  });

  it("prices in whole chips as before until the smallest chip is known", () => {
    const { rounding: _, ...wholeChips } = RULE_30;
    const input = {
      street: "river",
      potChips: 3000,
      shareChips: 3000,
      stakeChips: 1000,
      outs: 8,
    } as const;
    const quote = quoteInsurance({ ...input, rule: RULE_30 });
    expect(quote).toEqual(quoteInsurance({ ...input, rule: wholeChips }));
    expect(quote.ok && quote.stake.premiumChips).toBe(286);
  });

  it("keeps every premium and payout a whole number of smallest chips", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 100_000 }),
        fc.integer({ min: 1, max: 15 }),
        fc.constantFrom(1, 5, 25),
        fc.constantFrom("nearest", "down", "up"),
        (share, outs, chips, mode) => {
          const rule: InsuranceRule = { ...RULE_30, rounding: { mode, smallBlinds: 1, chips } };
          const quote = quoteInsurance({
            rule,
            street: "river",
            potChips: share,
            shareChips: share,
            stakeChips: Math.ceil(share / 3),
            outs,
          });
          if (!quote.ok) return;
          for (const option of [
            quote.stake,
            quote.fullPot,
            ...(quote.halfPot ? [quote.halfPot] : []),
          ]) {
            expect(option.premiumChips % chips).toBe(0);
            expect(option.payoutChips % chips).toBe(0);
            expect(option.premiumChips).toBeGreaterThanOrEqual(chips);
          }
        },
      ),
    );
  });

  it("rounds halves up, and takes exact multiples as they are", () => {
    expect(roundToChip(12.5, 5, "nearest")).toBe(15);
    expect(roundToChip(12.4, 5, "nearest")).toBe(10);
    expect(roundToChip(15, 5, "up")).toBe(15);
    expect(roundToChip(14.99, 5, "down")).toBe(10);
  });

  it("carries a rule from before rounding over as it priced, and keeps rules without chips", () => {
    const { rounding: _, ...withoutRounding } = RULE_30;
    expect(toInsuranceRuleForm(withoutRounding)).toMatchObject({
      roundOn: false,
      roundMode: "nearest",
    });
    expect(parseInsuranceRule(toInsuranceRuleForm(withoutRounding))).toEqual({
      ok: true,
      rule: withoutRounding,
    });
    const used: InsuranceRule = { ...RULE_30, rounding: { mode: "up", smallBlinds: 2, chips: 10 } };
    expect(ruleToKeep(used).rounding).toEqual({ mode: "up", smallBlinds: 2 });
  });

  it("works the smallest chip out from the game's small blind", () => {
    expect(ruleAtStakes(RULE_30, 5).rounding).toEqual({
      mode: "nearest",
      smallBlinds: 1,
      chips: 5,
    });
    const half: InsuranceRule = { ...RULE_30, rounding: { mode: "down", smallBlinds: 0.5 } };
    expect(ruleAtStakes(half, 25).rounding?.chips).toBe(13);
    expect(ruleAtStakes(half, 1).rounding?.chips).toBe(1);
    expect(ruleAtStakes(RULE_30, undefined)).toBe(RULE_30);
    const { rounding: _, ...wholeChips } = RULE_30;
    expect(ruleAtStakes(wholeChips, 5)).toBe(wholeChips);
  });
});

describe("outsHitChance", () => {
  it("divides the outs by the cards nobody has seen", () => {
    expect(outsHitChance("turn", 9)).toBe(9 / 45);
    expect(outsHitChance("river", 11)).toBe(1 / 4);
    expect(outsHitChance("river", 0)).toBe(0);
  });

  it("counts the unseen cards after the flop and after the turn", () => {
    expect(unseenCards("turn")).toBe(45);
    expect(unseenCards("river")).toBe(44);
  });

  it("never goes past certain", () => {
    expect(outsHitChance("river", 50)).toBe(1);
  });
});
