/**
 * Money utilities.
 *
 * Rule: all money in the system is integer cents (for example $12.50 is stored as 1250),
 * which avoids floating-point errors (0.1 + 0.2 !== 0.3). Convert to decimals only to display or parse user input.
 *
 * See docs/adr/0004-money-as-integer-cents.md
 */

declare const CentsBrand: unique symbol;

/** An integer amount in cents. A branded type stops plain numbers being used as money by mistake. */
export type Cents = number & { readonly [CentsBrand]: true };

export class InvalidMoneyError extends Error {
  override readonly name = "InvalidMoneyError";
}

/** Marks an integer as cents. Throws if it is not a safe integer. */
export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidMoneyError(`Money must be integer cents, got: ${value}`);
  }
  // Normalize -0 to 0 to avoid showing "-$0.00"
  return (value === 0 ? 0 : value) as Cents;
}

export const ZERO: Cents = cents(0);

export function add(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtract(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function negate(a: Cents): Cents {
  return cents(-a);
}

export function sum(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return cents(total);
}

export function compare(a: Cents, b: Cents): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Rounding modes:
 * - `half-up`: round to nearest (.5 away from 0)
 * - `floor`: round down (rake usually does, in the players' favor)
 * - `ceil`: round up
 */
export type RoundingMode = "half-up" | "floor" | "ceil";

/** Tolerance for floating-point math, removing errors like 0.1 * 3 = 0.30000000000000004. */
const EPSILON = 1e-9;

function roundNumber(raw: number, mode: RoundingMode): number {
  const nearest = Math.round(raw);
  if (Math.abs(raw - nearest) < EPSILON * Math.max(1, Math.abs(raw))) {
    return nearest;
  }
  switch (mode) {
    case "floor":
      return Math.floor(raw);
    case "ceil":
      return Math.ceil(raw);
    case "half-up":
      return Math.sign(raw) * Math.round(Math.abs(raw));
  }
}

/**
 * Multiplies money by a factor (such as a 0.05 rake or 3.5 insurance odds), rounding to the cent as specified.
 */
export function multiply(a: Cents, factor: number, mode: RoundingMode = "half-up"): Cents {
  if (!Number.isFinite(factor)) {
    throw new InvalidMoneyError(`Factor must be a finite number, got: ${factor}`);
  }
  return cents(roundNumber(a * factor, mode));
}

/**
 * Splits money by ratio so the parts add up to exactly the original amount (largest remainder method).
 * Used for dividing pots, sharing dealer fees and so on.
 *
 * @example allocate(cents(100), [1, 1, 1]) // => [34, 33, 33]
 */
export function allocate(total: Cents, ratios: readonly number[]): Cents[] {
  if (ratios.length === 0) {
    throw new InvalidMoneyError("Split ratios cannot be empty");
  }
  if (ratios.some((r) => !Number.isFinite(r) || r < 0)) {
    throw new InvalidMoneyError("Split ratios must be non-negative finite numbers");
  }
  const ratioSum = ratios.reduce((acc, r) => acc + r, 0);
  if (ratioSum === 0) {
    throw new InvalidMoneyError("Split ratios cannot add up to 0");
  }

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const exact = ratios.map((r) => (abs * r) / ratioSum);
  const shares = exact.map((x) => Math.floor(x));
  let remainder = abs - shares.reduce((acc, s) => acc + s, 0);

  // Give the remaining cents out by largest fraction; on a tie, earlier entries go first
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    shares[i] = (shares[i] ?? 0) + 1;
    remainder -= 1;
  }

  return shares.map((s) => cents(sign * s));
}

const MONEY_PATTERN = /^([+-])?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a money string typed by the user (in whole currency units) into cents. Returns null if it cannot be parsed.
 * Accepts "12", "12.5", "12.50", "-3.2", "1,234.56" and " $20 ".
 * Rejects more than two decimal places.
 */
export function tryParseMoney(input: string): Cents | null {
  const normalized = input
    .trim()
    .replace(/[,\s]/g, "")
    .replace(/^([+-]?)[$¥￥]/, "$1");
  const match = MONEY_PATTERN.exec(normalized);
  if (!match) return null;
  const [, sign, whole = "0", fraction = ""] = match;
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value)) return null;
  return cents(sign === "-" ? -value : value);
}

/** Same as tryParseMoney, but throws if the input cannot be parsed. */
export function parseMoney(input: string): Cents {
  const result = tryParseMoney(input);
  if (result === null) {
    throw new InvalidMoneyError(`Could not parse amount: "${input}"`);
  }
  return result;
}

/** Converts to a decimal string with no currency symbol, e.g. -1250 => "-12.50". */
export function toDecimalString(value: Cents): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export interface FormatMoneyOptions {
  /** ISO 4217 currency code, default AUD */
  currency?: string;
  /** Locale, default en-AU */
  locale?: string;
  /** Whether positive amounts show "+" (for showing wins and losses) */
  signDisplay?: "auto" | "always" | "exceptZero";
  /** Whether to drop ".00" for whole amounts */
  trimZeroCents?: boolean;
}

/** Formats for display in a currency, e.g. 1250 => "$12.50". */
export function formatMoney(value: Cents, options: FormatMoneyOptions = {}): string {
  const {
    currency = "AUD",
    locale = "en-AU",
    signDisplay = "auto",
    trimZeroCents = false,
  } = options;
  const fractionDigits = trimZeroCents && value % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    signDisplay,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}
