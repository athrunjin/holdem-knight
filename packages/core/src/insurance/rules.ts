/** Insurance rules: the built-in tables, and parsing the rule form. */
import type { CoverLimit, InsuranceRule, TieOuts } from "../domain";

const BASE_RULE = { tieOuts: "include", refundPremium: false } as const;

/** Odds common at live games: one out pays 30. The default for a new game. */
export const RULE_30: InsuranceRule = {
  ...BASE_RULE,
  oddsHundredths: [3000, 1500, 1000, 800, 600, 500, 400, 350, 300, 250, 220, 200, 180, 160, 140],
};

/** The other common table: one out pays 32. */
export const RULE_32: InsuranceRule = {
  ...BASE_RULE,
  oddsHundredths: [3200, 1600, 1000, 800, 600, 500, 400, 350, 300, 250, 220, 210, 180, 160, 140],
};

export const BUILT_IN_RULES = [
  { id: "builtin-30", name: "1 赔 30", rule: RULE_30 },
  { id: "builtin-32", name: "1 赔 32", rule: RULE_32 },
] as const;

/** Parses odds with at most two decimals into hundredths. Returns null if it is not above 0. */
export function parseOdds(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole = "0", fraction = ""] = match;
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function formatOdds(hundredths: number): string {
  return String(hundredths / 100);
}

export interface InsuranceRuleForm {
  readonly odds: readonly string[];
  readonly tieOuts: TieOuts;
  readonly refundPremium: boolean;
  /** `stake`, or a percentage of the pot share from 1 to 100 */
  readonly turnLimit: string;
  readonly riverLimit: string;
}

/** The form value for a cover limit: 100 is the full pot share. */
export const FULL_POT_LIMIT = "100";
export const STAKE_LIMIT = "stake";

const toLimitForm = (limit: CoverLimit | undefined) =>
  limit === undefined ? FULL_POT_LIMIT : String(limit);

export function toInsuranceRuleForm(rule: InsuranceRule): InsuranceRuleForm {
  return {
    odds: rule.oddsHundredths.map(formatOdds),
    tieOuts: rule.tieOuts,
    refundPremium: rule.refundPremium,
    turnLimit: toLimitForm(rule.turnCoverLimit),
    riverLimit: toLimitForm(rule.riverCoverLimit),
  };
}

export type InsuranceRuleIssues = {
  /** Outs whose odds are invalid. */
  readonly odds?: readonly number[];
  readonly turnLimit?: true;
  readonly riverLimit?: true;
};

export type ParsedInsuranceRule =
  | { readonly ok: true; readonly rule: InsuranceRule }
  | { readonly ok: false; readonly issues: InsuranceRuleIssues };

/** Undefined for the full pot share. Returns null unless it is `stake` or a whole percentage from 1 to 100. */
export function parseCoverLimit(input: string): CoverLimit | undefined | null {
  const text = input.trim();
  if (text === STAKE_LIMIT) return STAKE_LIMIT;
  const value = Number(text);
  if (!/^\d+$/.test(text) || value < 1 || value > 100) return null;
  return value === 100 ? undefined : value;
}

export function parseInsuranceRule(form: InsuranceRuleForm): ParsedInsuranceRule {
  const parsedOdds = form.odds.map(parseOdds);
  const badOuts = parsedOdds.flatMap((odds, i) => (odds === null ? [i + 1] : []));
  const turnCoverLimit = parseCoverLimit(form.turnLimit);
  const riverCoverLimit = parseCoverLimit(form.riverLimit);

  const issues: {
    odds?: number[];
    turnLimit?: true;
    riverLimit?: true;
  } = {};
  if (badOuts.length > 0 || form.odds.length === 0) issues.odds = badOuts;
  if (turnCoverLimit === null) issues.turnLimit = true;
  if (riverCoverLimit === null) issues.riverLimit = true;
  if (Object.keys(issues).length > 0) return { ok: false, issues };

  return {
    ok: true,
    rule: {
      oddsHundredths: parsedOdds.flatMap((odds) => (odds === null ? [] : [odds])),
      tieOuts: form.tieOuts,
      refundPremium: form.refundPremium,
      ...(turnCoverLimit != null && { turnCoverLimit }),
      ...(riverCoverLimit != null && { riverCoverLimit }),
    },
  };
}
