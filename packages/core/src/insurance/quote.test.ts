import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { InsuranceRule } from "../domain";
import {
  outsHitChance,
  payoutFor,
  premiumFor,
  premiumForNet,
  priceOption,
  type QuoteInput,
  quoteInsurance,
  soldOuts,
  unseenCards,
} from "./quote";
import {
  formatOdds,
  parseInsuranceRule,
  parseOdds,
  RULE_30,
  RULE_32,
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
  it("prices both covers so a hit leaves the stake or the pot share", () => {
    const quote = quoteInsurance(input());
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.oddsHundredths).toBe(350);
    expect(quote.stake).toMatchObject({ premiumChips: 200, payoutChips: 700, ifHitChips: 500 });
    expect(quote.fullPot).toEqual({
      premiumChips: 400,
      payoutChips: 1400,
      ifHitChips: 1000,
      ifMissChips: 600,
      capped: false,
    });
    expect(quote.maxPremiumChips).toBe(400);
  });

  it("adds a half-pot cover only when it differs from the stake", () => {
    const even = quoteInsurance(input());
    if (!even.ok) throw new Error("Expected a quote");
    expect(even.halfPot).toBeNull();

    const withDead = quoteInsurance(input({ potChips: 1301, shareChips: 1301 }));
    if (!withDead.ok) throw new Error("Expected a quote");
    expect(withDead.halfPot).toMatchObject({ premiumChips: 261, ifHitChips: 652 });
  });

  it("hands the premium back on a hit when the rule says so", () => {
    const rule = { ...RULE_30, refundPremium: true };
    const quote = quoteInsurance(input({ rule }));
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.fullPot.payoutChips).toBe(1287);
    expect(quote.fullPot.ifHitChips).toBe(1001);
    expect(quote.stake).toMatchObject({ premiumChips: 143, ifHitChips: 500 });
    expect(quote.maxPremiumChips).toBe(286);
  });

  it("holds covers at the street's limit as a share of the pot", () => {
    const rule: InsuranceRule = { ...RULE_30, riverCoverLimit: 75 };
    const quote = quoteInsurance(input({ rule }));
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.maxPremiumChips).toBe(300);
    expect(quote.fullPot).toMatchObject({ premiumChips: 300, ifHitChips: 750, capped: true });
    expect(quote.stake).toMatchObject({ premiumChips: 200, capped: false });
    const turn = quoteInsurance(input({ rule, street: "turn" }));
    if (!turn.ok) throw new Error("Expected a quote");
    expect(turn.fullPot.capped).toBe(false);
  });

  it("holds covers at the stake when the limit is the stake", () => {
    const rule: InsuranceRule = { ...RULE_30, turnCoverLimit: "stake" };
    const quote = quoteInsurance(input({ rule, street: "turn" }));
    if (!quote.ok) throw new Error("Expected a quote");
    expect(quote.maxPremiumChips).toBe(200);
    expect(quote.fullPot).toMatchObject({ premiumChips: 200, ifHitChips: 500, capped: true });
    expect(quote.stake.capped).toBe(false);
  });

  it.each([
    ["no outs", { outs: 0 }, "no-outs"],
    ["more outs than the table", { outs: 16 }, "too-many-outs"],
  ])("refuses %s", (_, overrides, block) => {
    expect(quoteInsurance(input(overrides))).toEqual({ ok: false, block });
  });

  it("leaves at least the target on a hit, with or without a refund", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 101, max: 5000 }),
        fc.boolean(),
        (net, odds, refundPremium) => {
          const premium = premiumForNet(net, odds, refundPremium);
          const rule = { ...RULE_30, refundPremium };
          const { ifHitChips } = priceOption({ rule, shareChips: net }, odds, premium);
          expect(ifHitChips).toBeGreaterThanOrEqual(net);
        },
      ),
    );
  });

  it("always covers at least the target, whatever the odds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 5000 }),
        (cover, odds) => {
          expect(payoutFor(premiumFor(cover, odds), odds, false)).toBeGreaterThanOrEqual(cover);
        },
      ),
    );
  });
});

describe("soldOuts", () => {
  const leader = { outs: [1, 2, 3], tieCards: [4, 5] };

  it("sells tie cards by default and leaves them out when the rule says so", () => {
    expect(soldOuts(RULE_30, leader)).toBe(5);
    expect(soldOuts({ ...RULE_30, tieOuts: "exclude" }, leader)).toBe(3);
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
