import { type Cents, cents, type Game, type GameSummary, INCOME_ITEMS } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { useGameSummaries } from "@/data/summaries";
import { localeTag, t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { owesTransfers } from "@/lib/game-history";
import { leaveList } from "@/lib/list-return";
import { GameOptions, OPTION_MARKS } from "./GameOptions";

/** The day a game started, as 26/7/21 */
const STARTED_ON = new Intl.DateTimeFormat(localeTag, {
  year: "2-digit",
  month: "numeric",
  day: "numeric",
});

/** Its day of the week, as 周六 */
const STARTED_WEEKDAY = new Intl.DateTimeFormat(localeTag, { weekday: "short" });

/** The time it started, as 21:05 */
const STARTED_AT = new Intl.DateTimeFormat(localeTag, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * What a settled game came to for the organizer, in the order a row spells it out: their own play,
 * the four items of income, and the differences that fell to them. Parts that are 0 are left out.
 */
function revenueOf(summary: GameSummary) {
  const own = summary.players.find(({ playerId }) => playerId === summary.organizerId);
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

/**
 * A game's line in a list, and what a settled game came to for the organizer, before its date.
 * With anything to spell out, that figure is a button with a chevron: a tap opens the parts in a
 * line under the game, and another closes it. A settled game still owed transfers is marked in
 * its top left corner. Opened from the income page, its results lead back there.
 */
export function GameListRow({ game, fromIncome = false }: { game: Game; fromIncome?: boolean }) {
  const { data: summaries } = useGameSummaries();
  // Only a settled game has one
  const summary = summaries?.find(({ id }) => id === game.id);
  const owed = owesTransfers(game, summary);
  const revenue = summary && revenueOf(summary);
  const [open, setOpen] = useState(false);
  // Still in the page while the parts close up
  const [closing, setClosing] = useState(false);
  const money = (value: Cents) => formatGameMoney(value, game.currency);
  // A gain in green with its plus, a loss in red with its minus
  const figure = revenue && (
    <span
      className={cn(
        "text-[15px] font-medium tabular-nums",
        revenue.total > 0 ? "text-win" : revenue.total < 0 ? "text-loss" : "text-muted",
      )}
    >
      {formatGameMoney(revenue.total, game.currency, "exceptZero")}
    </span>
  );
  const started = (
    <span className="flex flex-col items-end text-sm leading-tight text-muted tabular-nums">
      {STARTED_ON.format(game.createdAt)}
      <span className="text-xs leading-tight">
        {STARTED_WEEKDAY.format(game.createdAt)}·{STARTED_AT.format(game.createdAt)}
      </span>
    </span>
  );

  return (
    <li className="relative rounded-xl border border-line bg-surface">
      {owed && (
        // Small, in the corner over the line, its own corner turning with the frame's
        <span className="absolute top-0 left-0 rounded-tl-[0.6875rem] rounded-br-lg bg-highlight/15 px-1.5 text-[9px] leading-[13px] font-medium text-highlight">
          {t.gamePages.list.unsettled}
        </span>
      )}
      <div className="flex min-h-[2.875rem] items-center justify-between gap-3 px-4 py-px">
        <Link
          // Only a game at the table opens on its table. The rest open on their results
          to={game.status === "open" ? "/games/$gameId" : "/games/$gameId/settlement"}
          params={{ gameId: game.id }}
          {...(fromIncome && { search: { from: "income" as const } })}
          // The list is come back to where it was left
          onClick={leaveList}
          // The whole frame opens the game, but for the button over it
          className="flex min-w-0 flex-wrap items-baseline gap-x-2 after:absolute after:inset-0 after:rounded-xl"
        >
          <CurrencyIcon currency={game.currency} className="size-4.5 self-center text-muted" />
          <span className="font-medium">
            {game.smallBlindChips} / {game.bigBlindChips}
          </span>
          <GameOptions game={game} />
        </Link>
        <span className="flex shrink-0 items-center gap-2">
          {revenue &&
            (revenue.parts.length === 0 ? (
              figure
            ) : (
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? t.gamePages.list.hideRevenue : t.gamePages.list.showRevenue}
                onClick={() => {
                  setClosing(open);
                  setOpen(!open);
                }}
                className="relative z-10 flex min-h-11 items-center gap-0.5"
              >
                {figure}
                <ChevronDown
                  className={cn(
                    "size-4 text-muted transition-transform duration-300",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            ))}
          {started}
        </span>
      </div>
      {revenue && (open || closing) && (
        <div
          onAnimationEnd={() => setClosing(false)}
          className={cn(
            "flex justify-end gap-2 overflow-hidden px-4 motion-reduce:animate-none",
            closing ? "animate-fold" : "animate-unfold",
          )}
        >
          {/* Unrolls leftward from under the figure, where its right end stays */}
          <ul
            className={cn(
              "flex min-w-0 flex-wrap justify-end gap-x-3 gap-y-0.5 pb-2 text-xs motion-reduce:animate-none",
              closing ? "animate-roll-up-right" : "animate-unroll-left",
            )}
          >
            {revenue.parts.map(({ key, label, className, amount }) => (
              <li key={key} className="flex items-baseline gap-1 whitespace-nowrap">
                <span className={cn("font-medium", className)}>{label}</span>
                <span className={cn("tabular-nums", amount < 0 && "text-loss")}>
                  {money(amount)}
                </span>
              </li>
            ))}
          </ul>
          {/* As wide as the chevron and the date over it, so the line ends where the figure does */}
          <span className="invisible flex h-0 shrink-0 items-center gap-2" aria-hidden>
            <span className="-ml-1.5 w-4" />
            {started}
          </span>
        </div>
      )}
    </li>
  );
}
