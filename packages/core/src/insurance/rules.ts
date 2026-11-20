/** Insurance rules: the built-in tables, and parsing the rule form. */
import type {
  CoverLimit,
  InsuranceRounding,
  InsuranceRule,
  RakeRounding,
  TieOuts,
} from "../domain";

/** Rounded to the nearest small blind. */
const DEFAULT_ROUNDING: InsuranceRounding = { mode: "nearest", smallBlinds: 1 };

const BASE_RULE = {
  tieOuts: "include",
  refundPremium: false,
  rounding: DEFAULT_ROUNDING,
} as const satisfies Partial<InsuranceRule>;

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
  /** The odds table the odds were taken from. See `InsuranceRule.oddsTableId`. */
  readonly oddsTableId?: string;
  /** Rounding to the smallest chip. Kept while switched off, so switching back loses nothing. */
  readonly roundOn: boolean;
  readonly roundMode: RakeRounding;
  /** The smallest chip in small blinds, which a rule keeps */
  readonly roundSmallBlinds: string;
  /** The smallest chip itself, where there are no blinds to go by, as in the tools. Never kept in a rule saved for later. */
  readonly roundChips?: string;
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
    ...(rule.oddsTableId !== undefined && { oddsTableId: rule.oddsTableId }),
    // A rule from before rounding carries over as it priced, in whole chips
    roundOn: rule.rounding !== undefined,
    roundMode: rule.rounding?.mode ?? DEFAULT_ROUNDING.mode,
    roundSmallBlinds: String(Number((rule.rounding?.smallBlinds ?? 1).toFixed(2))),
    ...(rule.rounding?.chips !== undefined && { roundChips: String(rule.rounding.chips) }),
  };
}

/** A rule as it is kept for later: the smallest chip in small blinds, never in chips. */
export function ruleToKeep(rule: InsuranceRule): InsuranceRule {
  if (!rule.rounding || rule.rounding.chips === undefined) return rule;
  const { chips: _, ...rounding } = rule.rounding;
  return { ...rule, rounding };
}

/**
 * Everything in a rule's form but its odds and the table they are from, which the odds table sets
 * on its own, and the smallest chip in chips, which is set where the rule is used and never kept.
 */
export function insuranceSettingsOf(form: InsuranceRuleForm) {
  const { odds: _, oddsTableId: __, roundChips: ___, ...settings } = form;
  return settings;
}

/** Whether two rules have the same settings, whatever their odds. */
export const sameInsuranceSettings = (a: InsuranceRule, b: InsuranceRule) =>
  JSON.stringify(insuranceSettingsOf(toInsuranceRuleForm(a))) ===
  JSON.stringify(insuranceSettingsOf(toInsuranceRuleForm(b)));

/**
 * The rule priced at a game's stakes: its smallest chip, kept in small blinds, worked out in chips
 * from the game's small blind, and at least 1. A rule with no rounding, or no blind to go by, is
 * left as it is, and prices in whole chips.
 */
export function ruleAtStakes(
  rule: InsuranceRule,
  smallBlindChips: number | undefined,
): InsuranceRule {
  const { rounding } = rule;
  if (!rounding || !smallBlindChips || smallBlindChips <= 0) return rule;
  const chips = Math.max(1, Math.round((rounding.smallBlinds ?? 1) * smallBlindChips));
  return { ...rule, rounding: { ...rounding, chips } };
}

/**
 * The form with other odds, and the table they were taken from. Odds typed by hand come from no
 * table, so the table the old odds came from is dropped.
 */
export function withOdds(
  form: InsuranceRuleForm,
  odds: readonly string[],
  oddsTableId: string | undefined,
): InsuranceRuleForm {
  const { oddsTableId: _, ...rest } = form;
  return { ...rest, odds, ...(oddsTableId !== undefined && { oddsTableId }) };
}

/** What an odds table is known by when the odds in use are matched to one. */
export interface OddsTableRef {
  readonly id: string;
  readonly oddsHundredths: readonly number[];
}

const sameOdds = (a: readonly (number | null)[], b: readonly (number | null)[]) =>
  a.length === b.length && a.every((odds, i) => odds === b[i]);

/**
 * The table the odds in use belong to. Two tables can hold the same odds, so the one the odds
 * were taken from comes first, for as long as it is still there with these odds. Odds from no
 * table, or from one since changed or deleted, go to the first table that holds them. Undefined
 * when none does.
 */
export function oddsTableInUse<T extends OddsTableRef>(
  tables: readonly T[],
  odds: readonly (number | null)[],
  takenFromId: string | undefined,
): T | undefined {
  const holding = tables.filter((table) => sameOdds(table.oddsHundredths, odds));
  return holding.find((table) => table.id === takenFromId) ?? holding[0];
}

export type InsuranceRuleIssues = {
  /** Outs whose odds are invalid. */
  readonly odds?: readonly number[];
  readonly turnLimit?: true;
  readonly riverLimit?: true;
  readonly roundSmallBlinds?: true;
  readonly roundChips?: true;
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

  const blindsText = form.roundSmallBlinds.trim();
  const smallBlinds = /^\d+(\.\d{1,2})?$/.test(blindsText) ? Number(blindsText) : null;
  const chipsText = form.roundChips?.trim();
  const chips =
    chipsText === undefined ? undefined : /^\d+$/.test(chipsText) ? Number(chipsText) : null;

  const issues: {
    odds?: number[];
    turnLimit?: true;
    riverLimit?: true;
    roundSmallBlinds?: true;
    roundChips?: true;
  } = {};
  if (badOuts.length > 0 || form.odds.length === 0) issues.odds = badOuts;
  if (turnCoverLimit === null) issues.turnLimit = true;
  if (riverCoverLimit === null) issues.riverLimit = true;
  if (form.roundOn && (smallBlinds === null || smallBlinds <= 0)) issues.roundSmallBlinds = true;
  if (form.roundOn && chips !== undefined && (chips === null || chips <= 0)) {
    issues.roundChips = true;
  }
  if (Object.keys(issues).length > 0) return { ok: false, issues };

  return {
    ok: true,
    rule: {
      oddsHundredths: parsedOdds.flatMap((odds) => (odds === null ? [] : [odds])),
      tieOuts: form.tieOuts,
      refundPremium: form.refundPremium,
      ...(turnCoverLimit != null && { turnCoverLimit }),
      ...(riverCoverLimit != null && { riverCoverLimit }),
      ...(form.oddsTableId !== undefined && { oddsTableId: form.oddsTableId }),
      ...(form.roundOn &&
        smallBlinds !== null && {
          rounding: {
            mode: form.roundMode,
            smallBlinds,
            ...(chips != null && { chips }),
          },
        }),
    },
  };
}
