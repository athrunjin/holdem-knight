import type { Game } from "@holdem-knight/core";
import { cn } from "@/lib/cn";

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
