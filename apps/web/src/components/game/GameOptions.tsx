import { chipsToCents, type Game } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { cn } from "@/lib/cn";
import { formatGameAmount } from "@/lib/currency";
import { GAME_OPTIONS, type GameOption, hasOption } from "@/lib/game-history";

/** What a game can charge or offer: each one's name, and its color while it is on. */
export const OPTION_MARKS: Record<GameOption, { label: string; className: string }> = {
  insurance: { label: "保险", className: "text-highlight" },
  wage: { label: "工资", className: "text-win" },
  tableFee: { label: "台费", className: "text-win" },
  rake: { label: "抽水", className: "text-win" },
};

function gameOptions(game: Game) {
  return GAME_OPTIONS.map((option) => ({ ...OPTION_MARKS[option], on: hasOption(game, option) }));
}

/** One small colored label per option that is on. The caller lays them out. */
export function GameOptions({ game }: { game: Game }) {
  return gameOptions(game)
    .filter((option) => option.on)
    .map(({ label, className }) => (
      <span key={label} className={cn("text-xs font-medium", className)}>
        {label}
      </span>
    ));
}

/** A game page's title: the blinds in chips. */
export function GameTitle({ game }: { game: Game }) {
  return `${game.smallBlindChips} / ${game.bigBlindChips}`;
}

/** Beside a game page's title: the currency, then what the blinds are worth in it. */
export function GameBlindsCash({ game }: { game: Game }) {
  const { smallBlindChips, bigBlindChips, currency, chipRatio } = game;
  const cash = (chips: number) => formatGameAmount(chipsToCents(chips, chipRatio), currency);
  return (
    <p className="flex items-center gap-1 text-sm whitespace-nowrap text-muted tabular-nums">
      <CurrencyIcon currency={currency} className="size-4.5" />
      <span>
        {cash(smallBlindChips)}/{cash(bigBlindChips)}
      </span>
    </p>
  );
}

/** Display only, so a Buy-in that is not a whole number of big blinds rounds to one decimal. */
function buyInBigBlinds(handChips: number, bigBlindChips: number) {
  return (handChips / bigBlindChips).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

/** The icon takes its own small room in the line, and the tap target reaching past it is 44px. */
const settingsClass = "relative size-4 shrink-0 text-muted after:absolute after:-inset-3.5";

/** Where the settings icon leads: to the settings page, or to the game's rules shown on this page. */
export type GameSettingsAction =
  | { readonly kind: "edit" }
  | { readonly kind: "view"; readonly open: boolean; readonly onToggle: () => void };

/**
 * The line under a game page's title: the Buy-in in big blinds, then every option in a fixed
 * order, with the ones the game does not use struck through in gray so the line never changes
 * shape, and the settings icon last. Its parts wrap sooner than overlap.
 */
export function GameOptionLine({
  game,
  settings,
}: {
  game: Game;
  /** Missing where the settings can be neither changed nor shown. */
  settings?: GameSettingsAction | undefined;
}) {
  const { id: gameId, handChips, bigBlindChips } = game;
  const icon = <Settings className="size-4" aria-hidden />;
  return (
    <p className="flex min-h-5 flex-wrap items-center gap-x-1 text-xs">
      {handChips !== undefined && (
        <span className="font-semibold tabular-nums">
          {buyInBigBlinds(handChips, bigBlindChips)}BB
        </span>
      )}
      {gameOptions(game).map(({ label, on, className }) => (
        <span key={label} className={on ? cn("font-medium", className) : "text-muted line-through"}>
          {/* A reader hears which options are off, which the strike only shows */}
          {label}
          {!on && <span className="sr-only">（未开启）</span>}
        </span>
      ))}
      {settings?.kind === "edit" && (
        <Link
          to="/games/$gameId/settings"
          params={{ gameId }}
          aria-label="修改设置"
          className={settingsClass}
        >
          {icon}
        </Link>
      )}
      {settings?.kind === "view" && (
        <button
          type="button"
          aria-label="查看设置"
          aria-expanded={settings.open}
          onClick={settings.onToggle}
          className={cn(settingsClass, settings.open && "text-highlight")}
        >
          {icon}
        </button>
      )}
    </p>
  );
}
