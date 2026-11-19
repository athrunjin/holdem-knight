/** Rake: what a pot gives up under a game's rule, and parsing the rule's form. */
import type { RakeAmount, RakeRounding, RakeRule } from "../domain";

export const RAKE_ROUNDINGS: readonly RakeRounding[] = ["nearest", "down", "up"];

/** Common rates, picked from a list at game setup. */
export const RAKE_PERCENT_PICKS = ["2.5", "3", "5", "10"] as const;

/** The rule's percentage in hundredths of a percent, so 2.5% is 250. */
const basisPoints = ({ percent }: RakeRule) => Math.round(percent * 100);

/** An amount in chips, from chips or big blinds. Undefined for big blinds with no big blind to go by. */
export function rakeAmountChips(
  { unit, amount }: RakeAmount,
  bigBlindChips: number | undefined,
): number | undefined {
  if (unit === "chips") return amount;
  return bigBlindChips ? amount * bigBlindChips : undefined;
}

/** The smallest chip the rake is rounded to: at least 1, and a whole number of chips. */
function roundingUnit(rule: RakeRule, bigBlindChips: number | undefined) {
  const chips = rule.roundTo && rakeAmountChips(rule.roundTo, bigBlindChips);
  return chips ? Math.max(1, Math.round(chips)) : 1;
}

/** The cap in chips, rounded down to the smallest chip, or Infinity with none. */
function capChips(rule: RakeRule, unit: number, bigBlindChips: number | undefined) {
  const chips = rule.cap && rakeAmountChips(rule.cap, bigBlindChips);
  if (!chips || chips <= 0) return Number.POSITIVE_INFINITY;
  return Math.floor(chips / unit) * unit;
}

/**
 * The rake on a pot of `potChips`: the rule's percentage, rounded to its smallest chip, and no more
 * than its cap. Amounts in big blinds need the game's big blind, and are left out without one.
 * Without a smallest chip the rake rounds down to whole chips, as rules from before rake had
 * settings did. Not a whole number of chips, or below 0, takes nothing.
 */
export function rakeFromPot(potChips: number, rule: RakeRule, bigBlindChips?: number): number {
  if (!Number.isSafeInteger(potChips) || potChips <= 0) return 0;
  const unit = roundingUnit(rule, bigBlindChips);
  const rounding = rule.roundTo ? (rule.rounding ?? "down") : "down";
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
  const unit = roundingUnit(rule, bigBlindChips);
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

/** The rule as typed at game setup. A cap or rounding switched off keeps its values. */
export interface RakeForm {
  readonly percent: string;
  readonly capOn: boolean;
  readonly capUnit: RakeAmount["unit"];
  readonly capAmount: string;
  readonly roundOn: boolean;
  readonly roundUnit: RakeAmount["unit"];
  readonly roundAmount: string;
  readonly rounding: RakeRounding;
  readonly insuranceAfterRake: boolean;
}

export type RakeIssues = Partial<Record<"percent" | "capAmount" | "roundAmount", "invalid">>;

export type ParsedRake =
  | { readonly ok: true; readonly rule: RakeRule }
  | { readonly ok: false; readonly issues: RakeIssues };

/** A number without trailing zeros: 5 for 5, 2.5 for 2.50. */
export const formatRakeNumber = (value: number) => String(Number(value.toFixed(2)));

/** A cap of 2 big blinds when one is switched on, as live rooms cap at a couple of big blinds. */
export const DEFAULT_RAKE_CAP: RakeAmount = { unit: "bigBlinds", amount: 2 };

/**
 * A rule from before rake had settings carries over as it charged: rounded down to whole chips,
 * with no cap.
 */
export function toRakeForm(rule: RakeRule): RakeForm {
  const cap = rule.cap ?? DEFAULT_RAKE_CAP;
  const older = rule.rounding === undefined;
  const roundTo: RakeAmount =
    rule.roundTo ?? (older ? { unit: "chips", amount: 1 } : { unit: "bigBlinds", amount: 1 });
  return {
    percent: formatRakeNumber(rule.percent),
    capOn: rule.cap !== undefined,
    capUnit: cap.unit,
    capAmount: formatRakeNumber(cap.amount),
    roundOn: older || rule.roundTo !== undefined,
    roundUnit: roundTo.unit,
    roundAmount: formatRakeNumber(roundTo.amount),
    rounding: rule.rounding ?? "down",
    insuranceAfterRake: rule.insuranceAfterRake ?? false,
  };
}

/** Above 0 with at most two decimals, and whole for chips; or null. */
function parseAmount(text: string, unit: RakeAmount["unit"]): number | null {
  const trimmed = text.trim();
  const pattern = unit === "chips" ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
  const value = Number(trimmed);
  return pattern.test(trimmed) && value > 0 && value <= 1_000_000_000 ? value : null;
}

export function parseRake(form: RakeForm): ParsedRake {
  const text = form.percent.trim();
  const percent = /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : null;
  const cap = form.capOn ? parseAmount(form.capAmount, form.capUnit) : null;
  const roundTo = form.roundOn ? parseAmount(form.roundAmount, form.roundUnit) : null;
  const issues: RakeIssues = {};
  if (percent === null || percent <= 0 || percent >= 100) issues.percent = "invalid";
  if (form.capOn && cap === null) issues.capAmount = "invalid";
  if (form.roundOn && roundTo === null) issues.roundAmount = "invalid";
  if (percent === null || Object.keys(issues).length > 0) return { ok: false, issues };
  return {
    ok: true,
    rule: {
      percent,
      rounding: form.rounding,
      ...(roundTo !== null && { roundTo: { unit: form.roundUnit, amount: roundTo } }),
      ...(cap !== null && { cap: { unit: form.capUnit, amount: cap } }),
      ...(form.insuranceAfterRake && { insuranceAfterRake: true }),
    },
  };
}
