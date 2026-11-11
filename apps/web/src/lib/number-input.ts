import { parseOdds, toDecimalString, tryParseMoney } from "@holdem-knight/core";

/** Money as typed, shown with two decimals once it is valid: 30 reads 30.00 and 36.5 reads 36.50. */
export function formatMoneyText(text: string) {
  const value = tryParseMoney(text);
  return value === null ? text : toDecimalString(value);
}

/** Odds as typed, shown with at least one decimal once valid: 30 reads 30.0 and 2.25 stays 2.25. */
export function formatOddsText(text: string) {
  const value = parseOdds(text);
  if (value === null) return text;
  const whole = Math.floor(value / 100);
  const fraction = value % 100;
  return fraction % 10 === 0
    ? `${whole}.${fraction / 10}`
    : `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** Selects what a tapped field holds, once the tap has placed the cursor, so typing replaces it. */
export function selectOnFocus(input: HTMLInputElement) {
  setTimeout(() => input.select());
}
