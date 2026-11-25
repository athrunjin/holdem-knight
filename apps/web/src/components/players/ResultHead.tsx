import type { Cents } from "@holdem-knight/core";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";

type Money = (value: Cents, signed?: boolean) => string;

const toneOf = (value: number) => (value > 0 ? "text-win" : value < 0 ? "text-loss" : "");

/**
 * What stands over a chart of a player's results, the same in every card: the result as the
 * card's one large figure, with its sign and color, and at its right the wages and table fees
 * paid, the first level with the top of the figure and the last with its foot. Under them one
 * small line: how many games, how many of them won and at what rate, and the average a game.
 * Where the card's title already says how many games, the line leaves that out.
 */
export function ResultHead({
  result,
  shown,
  games,
  hideGames = false,
  won,
  average,
  wage,
  tableFee,
  money,
}: {
  result: Cents;
  /** The figure on its way to the result, while it counts up */
  shown: Cents;
  games: number;
  /** The title has the number of games already */
  hideGames?: boolean;
  won: number;
  average: Cents;
  wage: Cents;
  tableFee: Cents;
  money: Money;
}) {
  const charge = (label: string, amount: Cents) => (
    <span className="flex items-baseline justify-end gap-1.5">
      <span className="text-xs font-medium text-win">{label}</span>
      {money(amount)}
    </span>
  );
  // One line: how many games, unless the title says, how many won and at what rate, the average
  const notes = [
    ...(hideGames ? [] : [t.players.playerPage.headGames(games)]),
    ...(games > 0
      ? [
          t.players.playerPage.headWon(won),
          `${((won / games) * 100).toFixed(2)}%`,
          t.players.playerPage.average(money(average, true)),
        ]
      : []),
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "min-w-0 text-4xl font-semibold tracking-tight tabular-nums",
            toneOf(result),
          )}
        >
          {money(shown, true)}
        </p>
        {/* As tall as the figure: the first charge starts where its digits do, and the last ends
            where they end */}
        {(wage > 0 || tableFee > 0) && (
          <p className="flex h-10 shrink-0 flex-col justify-between pt-[3px] pb-[2px] text-sm leading-tight tabular-nums">
            {wage > 0 && charge(t.common.dealerWage, wage)}
            {tableFee > 0 && charge(t.common.timeCharge, tableFee)}
          </p>
        )}
      </div>
      <p className="truncate text-xs leading-snug text-muted tabular-nums">
        {notes.join(" · ") || t.players.playerPage.headGames(games)}
      </p>
    </>
  );
}
