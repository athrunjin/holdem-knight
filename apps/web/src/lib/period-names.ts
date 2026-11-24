import { monthOf, type PeriodChoice, shiftMonth } from "@holdem-knight/core";
import { t } from "@/i18n";

/**
 * What a period is called in a menu. This month and the last go by their names, the last with
 * its year where that is another.
 */
export function periodName(choice: PeriodChoice, today: string): string {
  const thisMonth = monthOf(today);
  const lastMonth = shiftMonth(thisMonth, -1);
  const number = (month: string) => Number(month.slice(5));
  if (choice === "thisMonth") return t.me.income.monthShort(number(thisMonth));
  if (choice === "lastMonth")
    return lastMonth.slice(0, 4) === thisMonth.slice(0, 4)
      ? t.me.income.monthShort(number(lastMonth))
      : t.me.income.month(Number(lastMonth.slice(0, 4)), number(lastMonth));
  return t.me.income.periods[choice];
}
