/** Rake: what a pot gives up under a game's rule, and parsing the rule's form. */
import type { RakeCap, RakeRounding, RakeRule } from "../domain";

export const RAKE_ROUNDINGS: readonly RakeRounding[] = ["nearest", "down", "up"];

/** Common rates, picked from a list at game setup. */
export const RAKE_PERCENT_PICKS = ["2.5", "3", "5", "10"] as const;

/** The rule's percentage in hundredths of a percent, so 2.5% is 250. */
const basisPoints = ({ percent }: RakeRule) => Math.round(percent * 100);

/** The cap in chips, rounded down to the smallest chip, or Infinity with none. */
function capChips(rule: RakeRule, unit: number, bigBlindChips: number | undefined) {
  const { cap } = rule;
  if (!cap) return Number.POSITIVE_INFINITY;
  const chips = cap.unit === "chips" ? cap.amount : bigBlindChips ? cap.amount * bigBlindChips : 0;
  if (chips <= 0) return Number.POSITIVE_INFINITY;
  return Math.floor(chips / unit) * unit;
}

/**
 * The rake on a pot of `potChips`: the rule's percentage, rounded to its smallest chip, and no more
 * than its cap. A cap in big blinds needs the game's big blind. Rules from before rake had settings
 * round down to whole chips. Not a whole number of chips, or below 0, takes nothing.
 */
export function rakeFromPot(potChips: number, rule: RakeRule, bigBlindChips?: number): number {
  if (!Number.isSafeInteger(potChips) || potChips <= 0) return 0;
  const unit = rule.roundTo ?? 1;
  const rounding = rule.rounding ?? "down";
  // Whole numbers throughout: the rake is potChips × points / 10000, counted in units of the chip
  const numerator = potChips * basisPoints(rule);
  const denominator = 10_000 * unit;
  const whole = Math.floor(numerator / denominator);
  const rest = numerator % denominator;
  const units =
    rounding === "down"
      ? whole
      : rounding === "up"
        ? whole + (rest > 0 ? 1 : 0)
        : whole + (rest * 2 >= denominator ? 1 : 0);
  return Math.min(units * unit, capChips(rule, unit, bigBlindChips));
}

/**
 * The smallest pot that gives up at least `rakeChips` under the rule: what a rake typed in by hand
 * came from, as far as the rule can tell. 0 for no rake, or for one above the cap.
 */
export function potForRake(rakeChips: number, rule: RakeRule, bigBlindChips?: number): number {
  if (!Number.isSafeInteger(rakeChips) || rakeChips <= 0) return 0;
  const unit = rule.roundTo ?? 1;
  let low = 1;
  let high = Math.ceil(((rakeChips + unit) * 10_000) / basisPoints(rule)) + 1;
  if (rakeFromPot(high, rule, bigBlindChips) < rakeChips) return 0;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (rakeFromPot(middle, rule, bigBlindChips) >= rakeChips) high = middle;
    else low = middle + 1;
  }
  return low;
}

/** The rule as typed at game setup. */
export interface RakeForm {
  readonly percent: string;
  readonly roundTo: string;
  readonly rounding: RakeRounding;
  readonly capUnit: RakeCap["unit"] | "none";
  /** Kept while there is no cap, so switching one back on loses nothing. */
  readonly capAmount: string;
  readonly insuranceAfterRake: boolean;
}

export type RakeIssues = Partial<Record<"percent" | "roundTo" | "capAmount", "invalid">>;

export type ParsedRake =
  | { readonly ok: true; readonly rule: RakeRule }
  | { readonly ok: false; readonly issues: RakeIssues };

/** A percentage without trailing zeros: 5 for 5, 2.5 for 2.50. */
export const formatRakePercent = (percent: number) => String(Number(percent.toFixed(2)));

/** A rule from before rake had settings keeps rounding down to whole chips, as it did. */
export function toRakeForm(rule: RakeRule): RakeForm {
  return {
    percent: formatRakePercent(rule.percent),
    roundTo: String(rule.roundTo ?? 1),
    rounding: rule.rounding ?? "down",
    capUnit: rule.cap?.unit ?? "none",
    capAmount: String(rule.cap?.amount ?? 3),
    insuranceAfterRake: rule.insuranceAfterRake ?? false,
  };
}

/** A whole number from 1 to `max`, or null. */
function parseWhole(text: string, max: number) {
  const trimmed = text.trim();
  const value = Number(trimmed);
  return /^\d+$/.test(trimmed) && value >= 1 && value <= max ? value : null;
}

export function parseRake(form: RakeForm): ParsedRake {
  const text = form.percent.trim();
  const percent = /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : null;
  const roundTo = parseWhole(form.roundTo, 1_000_000);
  const capAmount = form.capUnit === "none" ? null : parseWhole(form.capAmount, 1_000_000_000);
  const issues: RakeIssues = {};
  if (percent === null || percent <= 0 || percent >= 100) issues.percent = "invalid";
  if (roundTo === null) issues.roundTo = "invalid";
  if (form.capUnit !== "none" && capAmount === null) issues.capAmount = "invalid";
  if (percent === null || roundTo === null || Object.keys(issues).length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    rule: {
      percent,
      roundTo,
      rounding: form.rounding,
      ...(form.capUnit !== "none" &&
        capAmount !== null && {
          cap: { unit: form.capUnit, amount: capAmount },
        }),
      ...(form.insuranceAfterRake && { insuranceAfterRake: true }),
    },
  };
}
