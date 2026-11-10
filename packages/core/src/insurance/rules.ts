/** Insurance rules: the built-in tables, and parsing the rule form. */
import type { InsuranceRule, TieOuts } from "../domain";

const BASE_RULE = { tieOuts: "include", refundPremium: false, coverTurn: true } as const;

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
  readonly coverTurn: boolean;
  readonly turnCapPercent: string;
  readonly riverCapPercent: string;
}

export function toInsuranceRuleForm(rule: InsuranceRule): InsuranceRuleForm {
  return {
    odds: rule.oddsHundredths.map(formatOdds),
    tieOuts: rule.tieOuts,
    refundPremium: rule.refundPremium,
    coverTurn: rule.coverTurn,
    turnCapPercent: rule.turnCapPercent?.toString() ?? "",
    riverCapPercent: rule.riverCapPercent?.toString() ?? "",
  };
}

export type InsuranceRuleIssues = {
  /** Outs whose odds are invalid. */
  readonly odds?: readonly number[];
  readonly turnCapPercent?: true;
  readonly riverCapPercent?: true;
};

export type ParsedInsuranceRule =
  | { readonly ok: true; readonly rule: InsuranceRule }
  | { readonly ok: false; readonly issues: InsuranceRuleIssues };

/** A blank limit means no limit. Returns null if it is not a whole number from `min` to `max`. */
function parseLimit(input: string, min: number, max: number): number | undefined | null {
  const text = input.trim();
  if (text === "") return undefined;
  const value = Number(text);
  return /^\d+$/.test(text) && value >= min && value <= max ? value : null;
}

export function parseInsuranceRule(form: InsuranceRuleForm): ParsedInsuranceRule {
  const parsedOdds = form.odds.map(parseOdds);
  const badOuts = parsedOdds.flatMap((odds, i) => (odds === null ? [i + 1] : []));
  const turnCapPercent = parseLimit(form.turnCapPercent, 1, 1000);
  const riverCapPercent = parseLimit(form.riverCapPercent, 1, 1000);

  const issues: {
    odds?: number[];
    turnCapPercent?: true;
    riverCapPercent?: true;
  } = {};
  if (badOuts.length > 0 || form.odds.length === 0) issues.odds = badOuts;
  if (turnCapPercent === null) issues.turnCapPercent = true;
  if (riverCapPercent === null) issues.riverCapPercent = true;
  if (Object.keys(issues).length > 0) return { ok: false, issues };

  return {
    ok: true,
    rule: {
      oddsHundredths: parsedOdds.flatMap((odds) => (odds === null ? [] : [odds])),
      tieOuts: form.tieOuts,
      refundPremium: form.refundPremium,
      coverTurn: form.coverTurn,
      ...(turnCapPercent != null && { turnCapPercent }),
      ...(riverCapPercent != null && { riverCapPercent }),
    },
  };
}
