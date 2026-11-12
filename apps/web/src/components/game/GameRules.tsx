import type { Charge, Game } from "@holdem-knight/core";
import { gameRuleLines } from "@/lib/charges";

interface GameRulesProps {
  game: Pick<Game, "insurance" | "wage" | "tableFee" | "currency">;
  charges: readonly Charge[];
}

/** Whether the game has any rule worth listing: insurance, a table fee or wages. */
export function hasGameRules(game: Pick<Game, "insurance" | "wage" | "tableFee">) {
  return Boolean(game.insurance || game.tableFee || game.wage);
}

/** The game's insurance, table fee and wages in brief, one plain line each. */
export function GameRules({ game, charges }: GameRulesProps) {
  return (
    <dl className="text-xs">
      {gameRuleLines(game, charges, game.currency).map(({ label, items }) => (
        <div key={label} className="flex gap-2 pb-1">
          <dt className="shrink-0 text-muted">{label}</dt>
          {/* Each setting stays whole when the line wraps */}
          <dd className="flex min-w-0 flex-wrap gap-x-2">
            {items.map((item) => (
              <span key={item} className="whitespace-nowrap">
                {item}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
