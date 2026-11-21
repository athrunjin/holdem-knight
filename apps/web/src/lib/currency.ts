import { type Cents, type Currency, formatMoney } from "@holdem-knight/core";
import { t } from "@/i18n";

export const CURRENCY_INFO: Record<
  Currency,
  { readonly label: string; readonly symbol: string; readonly locale: string }
> = {
  AUD: { label: t.lib.currency.australianDollar, symbol: "$", locale: "en-AU" },
  CNY: { label: t.lib.currency.chineseYuan, symbol: "¥", locale: "zh-CN" },
};

export function formatGameMoney(
  value: Cents,
  currency: Currency,
  signDisplay: "auto" | "exceptZero" = "auto",
) {
  return formatMoney(value, {
    currency,
    locale: CURRENCY_INFO[currency].locale,
    signDisplay,
    trimZeroCents: true,
  });
}

/** Always with two decimals, for a column of amounts read against each other. */
export function formatGameAmount(
  value: Cents,
  currency: Currency,
  signDisplay: "auto" | "exceptZero" = "auto",
) {
  return formatMoney(value, { currency, locale: CURRENCY_INFO[currency].locale, signDisplay });
}
