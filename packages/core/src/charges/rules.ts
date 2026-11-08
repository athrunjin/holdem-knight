/** Table fee and wage settings: defaults and parsing their forms. */
import type { TableFeeRule, WageAdjustment, WageRule } from "../domain";
import { type Cents, cents, toDecimalString, tryParseMoney } from "../money";

/** 100 in the game's currency once a player has sat for 30 minutes. */
export const DEFAULT_TABLE_FEE: TableFeeRule = { amount: cents(10_000), minMinutes: 30 };

/** 25 an hour in the game's currency, at every hour of the day. */
export const DEFAULT_WAGE: WageRule = { hourly: cents(2_500) };

/** Issue codes. The UI decides the wording. */
export type ChargeIssue = "invalid" | "not-positive" | "same-hours";

export interface TableFeeForm {
  readonly amount: string;
  readonly minMinutes: string;
}

export type TableFeeIssues = Partial<Record<keyof TableFeeForm, ChargeIssue>>;

export type ParsedTableFee =
  | { readonly ok: true; readonly rule: TableFeeRule }
  | { readonly ok: false; readonly issues: TableFeeIssues };

export function toTableFeeForm(rule: TableFeeRule): TableFeeForm {
  return { amount: formatAmount(rule.amount), minMinutes: String(rule.minMinutes) };
}

/** Whole currency units without ".00", as typed. */
function formatAmount(amount: Cents) {
  const text = toDecimalString(amount);
  return text.endsWith(".00") ? text.slice(0, -3) : text;
}

/** A whole number from `min` to `max`, or null. */
function parseWhole(input: string, min: number, max: number): number | null {
  const text = input.trim();
  const value = Number(text);
  return /^\d+$/.test(text) && value >= min && value <= max ? value : null;
}

/** Money of at least 0, or of more than 0 when `positive`. */
function amountIssue(value: Cents | null, positive: boolean): ChargeIssue | undefined {
  if (value === null || value < 0) return "invalid";
  return positive && value === 0 ? "not-positive" : undefined;
}

export function parseTableFee(form: TableFeeForm): ParsedTableFee {
  const amount = tryParseMoney(form.amount);
  const minMinutes = parseWhole(form.minMinutes, 0, 24 * 60);
  const issues: TableFeeIssues = {};
  const issue = amountIssue(amount, true);
  if (issue) issues.amount = issue;
  if (minMinutes === null) issues.minMinutes = "invalid";
  if (amount === null || minMinutes === null || Object.keys(issues).length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, rule: { amount, minMinutes } };
}

export type WageAdjustmentKind = WageAdjustment["kind"];

/** Both adjustments keep their inputs, so switching between them loses nothing. */
export interface WageForm {
  readonly hourly: string;
  readonly adjustment: WageAdjustmentKind | "none";
  readonly fromHour: string;
  readonly toHour: string;
  readonly timeHourly: string;
  readonly afterHours: string;
  readonly afterHourly: string;
}

export type WageIssues = Partial<Record<Exclude<keyof WageForm, "adjustment">, ChargeIssue>>;

export type ParsedWage =
  | { readonly ok: true; readonly rule: WageRule }
  | { readonly ok: false; readonly issues: WageIssues };

export function toWageForm(rule: WageRule): WageForm {
  const { hourly, adjustment } = rule;
  const base = formatAmount(hourly);
  return {
    hourly: base,
    adjustment: adjustment?.kind ?? "none",
    fromHour: adjustment?.kind === "time_of_day" ? String(adjustment.fromHour) : "0",
    toHour: adjustment?.kind === "time_of_day" ? String(adjustment.toHour) : "6",
    timeHourly: adjustment?.kind === "time_of_day" ? formatAmount(adjustment.hourly) : base,
    afterHours: adjustment?.kind === "after_start" ? String(adjustment.afterHours) : "4",
    afterHourly: adjustment?.kind === "after_start" ? formatAmount(adjustment.hourly) : base,
  };
}

/** Only the adjustment that is on is checked. Rates may be 0, for wages charged part of the time. */
export function parseWage(form: WageForm): ParsedWage {
  const issues: WageIssues = {};
  const money = (field: "hourly" | "timeHourly" | "afterHourly") => {
    const value = tryParseMoney(form[field]);
    const issue = amountIssue(value, false);
    if (issue) issues[field] = issue;
    return issue ? null : value;
  };
  const whole = (field: "fromHour" | "toHour" | "afterHours", min: number, max: number) => {
    const value = parseWhole(form[field], min, max);
    if (value === null) issues[field] = "invalid";
    return value;
  };

  const hourly = money("hourly");
  let adjustment: WageAdjustment | undefined;
  if (form.adjustment === "time_of_day") {
    const fromHour = whole("fromHour", 0, 23);
    const toHour = whole("toHour", 0, 23);
    const rate = money("timeHourly");
    if (fromHour !== null && fromHour === toHour) issues.toHour = "same-hours";
    if (fromHour !== null && toHour !== null && rate !== null) {
      adjustment = { kind: "time_of_day", fromHour, toHour, hourly: rate };
    }
  } else if (form.adjustment === "after_start") {
    const afterHours = whole("afterHours", 1, 48);
    const rate = money("afterHourly");
    if (afterHours !== null && rate !== null) {
      adjustment = { kind: "after_start", afterHours, hourly: rate };
    }
  }

  if (hourly === null || Object.keys(issues).length > 0) return { ok: false, issues };
  return { ok: true, rule: adjustment ? { hourly, adjustment } : { hourly } };
}
