import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BUILT_IN_RULES,
  oddsTableInUse,
  parseInsuranceRule,
  RULE_30,
  RULE_32,
  toInsuranceRuleForm,
  withOdds,
} from "./rules";

const PRESETS = BUILT_IN_RULES.map(({ id, rule }) => ({
  id,
  oddsHundredths: rule.oddsHundredths,
}));
/** A saved table with the same odds as 1 赔 30, as the organizer may keep under a name of their own. */
const TWIN = { id: "saved-twin", oddsHundredths: RULE_30.oddsHundredths };
const OTHER = { id: "saved-other", oddsHundredths: [4000, 2000, 1000] };
const TABLES = [...PRESETS, TWIN, OTHER];
const PRESET_30 = BUILT_IN_RULES[0].id;

describe("oddsTableInUse", () => {
  it("names the table the odds were taken from, where another holds the same odds", () => {
    expect(oddsTableInUse(TABLES, RULE_30.oddsHundredths, TWIN.id)).toBe(TWIN);
    expect(oddsTableInUse(TABLES, RULE_30.oddsHundredths, PRESET_30)?.id).toBe(PRESET_30);
  });

  it("goes to the first table with these odds when they were taken from none", () => {
    expect(oddsTableInUse(TABLES, RULE_30.oddsHundredths, undefined)?.id).toBe(PRESET_30);
    expect(oddsTableInUse(TABLES, OTHER.oddsHundredths, undefined)).toBe(OTHER);
  });

  it("drops a table that no longer holds these odds", () => {
    // The table was edited after its odds were taken, or other odds were put in use since
    expect(oddsTableInUse(TABLES, RULE_32.oddsHundredths, TWIN.id)?.id).toBe(BUILT_IN_RULES[1].id);
    expect(oddsTableInUse(TABLES, [9900], TWIN.id)).toBeUndefined();
  });

  it("drops a table that was deleted", () => {
    const left = [...PRESETS, OTHER];
    expect(oddsTableInUse(left, RULE_30.oddsHundredths, TWIN.id)?.id).toBe(PRESET_30);
    expect(oddsTableInUse([OTHER], RULE_30.oddsHundredths, TWIN.id)).toBeUndefined();
  });

  it("matches no table to odds that are not valid", () => {
    expect(oddsTableInUse(TABLES, [3000, null], TWIN.id)).toBeUndefined();
  });

  it("only ever names a table that holds the odds, whichever was asked for", () => {
    const table = fc.record({
      id: fc.constantFrom("a", "b", "c", "d"),
      oddsHundredths: fc.array(fc.constantFrom(3000, 1500, 1000), { minLength: 1, maxLength: 2 }),
    });
    fc.assert(
      fc.property(
        fc.uniqueArray(table, { selector: ({ id }) => id }),
        fc.array(fc.constantFrom(3000, 1500, 1000), { minLength: 1, maxLength: 2 }),
        fc.option(fc.constantFrom("a", "b", "c", "d", "gone"), { nil: undefined }),
        (tables, odds, takenFromId) => {
          const inUse = oddsTableInUse(tables, odds, takenFromId);
          const holding = tables.filter((t) => t.oddsHundredths.join() === odds.join());
          if (holding.length === 0) {
            expect(inUse).toBeUndefined();
          } else {
            expect(holding).toContain(inUse);
            // The table asked for is the one named whenever it holds the odds
            const asked = holding.find((t) => t.id === takenFromId);
            if (asked) expect(inUse).toBe(asked);
          }
        },
      ),
    );
  });
});

describe("the table a rule's odds were taken from", () => {
  it("is kept from the form to the rule and back", () => {
    const form = withOdds(toInsuranceRuleForm(RULE_30), ["30", "15"], TWIN.id);
    const parsed = parseInsuranceRule(form);
    expect(parsed.ok && parsed.rule.oddsTableId).toBe(TWIN.id);
    expect(parsed.ok && toInsuranceRuleForm(parsed.rule)).toEqual(form);
  });

  it("is left out of a rule whose odds came from no table", () => {
    const parsed = parseInsuranceRule(toInsuranceRuleForm(RULE_30));
    expect(parsed).toEqual({ ok: true, rule: RULE_30 });
    expect(parsed.ok && "oddsTableId" in parsed.rule).toBe(false);
  });

  it("is dropped when odds are typed by hand", () => {
    const fromTable = withOdds(toInsuranceRuleForm(RULE_30), ["30"], TWIN.id);
    const typed = withOdds(fromTable, ["31"], undefined);
    expect(typed.odds).toEqual(["31"]);
    expect("oddsTableId" in typed).toBe(false);
  });

  it("changes nothing else in the form", () => {
    const form = { ...toInsuranceRuleForm(RULE_30), refundPremium: true, turnLimit: "50" };
    const { odds: _, oddsTableId: __, ...rest } = withOdds(form, ["40"], OTHER.id);
    const { odds: ___, ...before } = form;
    expect(rest).toEqual(before);
  });
});
