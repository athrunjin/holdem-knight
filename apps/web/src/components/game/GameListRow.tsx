import { type Game, gameStage } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { localeTag, t } from "@/i18n";
import { GameOptions } from "./GameOptions";

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
 * A game's line in a list. A settled game still owed transfers says so before its date. Opened
 * from the income page, its results lead back there.
 */
export function GameListRow({ game, fromIncome = false }: { game: Game; fromIncome?: boolean }) {
  const owed = gameStage(game) === "pending";
  return (
    <li>
      <Link
        // Only a game at the table opens on its table. The rest open on their results
        to={game.status === "open" ? "/games/$gameId" : "/games/$gameId/settlement"}
        params={{ gameId: game.id }}
        {...(fromIncome && { search: { from: "income" as const } })}
        className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-1"
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <CurrencyIcon currency={game.currency} className="size-4.5 self-center text-muted" />
          <span className="font-medium">
            {game.smallBlindChips} / {game.bigBlindChips}
          </span>
          <GameOptions game={game} />
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          {owed && (
            <span className="rounded bg-highlight/15 px-1.5 py-0.5 text-xs font-medium text-highlight">
              {t.gamePages.list.unsettled}
            </span>
          )}
          <span className="flex flex-col items-end text-sm leading-tight text-muted tabular-nums">
            {STARTED_ON.format(game.createdAt)}
            <span className="text-xs leading-tight">
              {STARTED_WEEKDAY.format(game.createdAt)}·{STARTED_AT.format(game.createdAt)}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
