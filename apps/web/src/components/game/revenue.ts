import {
  type Cents,
  cents,
  type GameSummary,
  INCOME_ITEMS,
  ORGANIZER_PLAYER_ID,
} from "@holdem-knight/core";
import { t } from "@/i18n";
import { OPTION_MARKS } from "./GameOptions";

/**
 * What a settled game came to for the organizer, in the order a row spells it out: their own play,
 * the four items of income, and the differences that fell to them. Parts that are 0 are left out.
 * Their own play is the row of the organizer's seat (ADR 0028), not of their space.
 */
export function revenueOf(summary: GameSummary) {
  const own = summary.players.find(({ playerId }) => playerId === ORGANIZER_PLAYER_ID);
  const share = cents((own?.share ?? 0) + summary.absorbed);
  const parts: { key: string; label: string; className: string; amount: Cents }[] = [
    {
      key: "asPlayer",
      label: t.gamePages.list.asPlayer,
      className: "text-muted",
      // Without their share of a difference, which has its own place at the end
      amount: cents((own?.total ?? 0) - (own?.share ?? 0)),
    },
    ...INCOME_ITEMS.map((item) => ({
      key: item,
      label: OPTION_MARKS[item].label,
      className: OPTION_MARKS[item].className,
      amount: summary.income[item],
    })),
    { key: "shared", label: t.gamePages.list.shared, className: "text-muted", amount: share },
  ];
  return {
    total: cents(parts.reduce((all, { amount }) => all + amount, 0)),
    parts: parts.filter(({ amount }) => amount !== 0),
  };
}
