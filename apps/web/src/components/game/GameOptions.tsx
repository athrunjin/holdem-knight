import { chipsToCents, type Game } from "@holdem-knight/core";
import { cn } from "@/lib/cn";
import { CURRENCY_INFO, formatGameMoney } from "@/lib/currency";

/** The options switched on for a game. Rake joins here once games have it. */
function gameOptions(game: Game) {
  const options: { label: string; className: string }[] = [];
  if (game.insurance) options.push({ label: "保险", className: "text-highlight" });
  if (game.tableFee) options.push({ label: "台费", className: "text-win" });
  if (game.wage) options.push({ label: "工资", className: "text-win" });
  return options;
}

/** One small colored label per option that is on. The caller lays them out. */
export function GameOptions({ game }: { game: Game }) {
  return gameOptions(game).map(({ label, className }) => (
    <span key={label} className={cn("text-xs font-medium", className)}>
      {label}
    </span>
  ));
}

/** A game page's title: the blinds in chips, then the currency and what they are worth. */
export function GameTitle({ game }: { game: Game }) {
  const { smallBlindChips, bigBlindChips, currency, chipRatio } = game;
  const money = (chips: number) => formatGameMoney(chipsToCents(chips, chipRatio), currency);
  return (
    <>
      {smallBlindChips} / {bigBlindChips}{" "}
      <small className="text-sm font-normal tracking-normal text-muted">
        {CURRENCY_INFO[currency].label} {money(smallBlindChips)}/{money(bigBlindChips)}
      </small>
    </>
  );
}

/** The options under a game page's title. Keeps its height with none on, so the page does not shift. */
export function GameOptionLine({ game }: { game: Game }) {
  return (
    <p className="flex min-h-5 flex-wrap items-baseline gap-x-2">
      <GameOptions game={game} />
    </p>
  );
}
