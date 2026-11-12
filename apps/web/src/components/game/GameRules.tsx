import type { Charge, Game } from "@holdem-knight/core";
import { useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { gameRuleLines, oddsText } from "@/lib/charges";

interface GameRulesProps {
  game: Pick<Game, "insurance" | "wage" | "tableFee" | "currency">;
  charges: readonly Charge[];
}

/** Whether the game has any rule worth listing: insurance, a table fee or wages. */
export function hasGameRules(game: Pick<Game, "insurance" | "wage" | "tableFee">) {
  return Boolean(game.insurance || game.tableFee || game.wage);
}

/** The whole odds table, by outs. */
function OddsTable({ odds, onClose }: { odds: readonly number[]; onClose: () => void }) {
  return (
    <Modal title="赔率表" onClose={onClose}>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-1 text-sm tabular-nums">
        {odds.map((hundredths, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: each place is that many outs
          <li key={i}>{oddsText(i + 1, hundredths)}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">前面是 outs 张数，后面是赔率。</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
      >
        关闭
      </button>
    </Modal>
  );
}

/**
 * The game's insurance, table fee and wages in brief, in plain lines. Insurance shows a few odds
 * on a second row, with the whole table behind the dots.
 */
export function GameRules({ game, charges }: GameRulesProps) {
  const [showingOdds, setShowingOdds] = useState(false);
  const lines = gameRuleLines(game, charges, game.currency);

  return (
    <dl className="text-xs">
      {lines.map(({ label, rows, oddsHundredths }) => (
        <div key={label} className="flex gap-2 pb-1">
          <dt className="shrink-0 text-muted">{label}</dt>
          <dd className="min-w-0">
            {rows.map((items, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are fixed places
              <div key={row} className="flex flex-wrap items-center gap-x-2">
                {/* Each setting stays whole when the row wraps */}
                {items.map((item) => (
                  <span key={item} className="whitespace-nowrap">
                    {item}
                  </span>
                ))}
                {oddsHundredths && row === rows.length - 1 && (
                  <button
                    type="button"
                    aria-label="完整赔率表"
                    onClick={() => setShowingOdds(true)}
                    className="-my-1 px-1 font-semibold tracking-widest text-highlight"
                  >
                    ···
                  </button>
                )}
              </div>
            ))}
          </dd>
        </div>
      ))}
      {showingOdds && game.insurance && (
        <OddsTable odds={game.insurance.oddsHundredths} onClose={() => setShowingOdds(false)} />
      )}
    </dl>
  );
}
