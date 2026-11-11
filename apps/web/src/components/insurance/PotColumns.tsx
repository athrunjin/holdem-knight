import type { PotBreakdown } from "@holdem-knight/core";
import { cn } from "@/lib/cn";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

/** The tallest column, in pixels. The others are drawn to the same scale. */
const FULL_HEIGHT = 180;

/** The main pot, then the side pots: numbered only when there is more than one of them. */
export function potName(index: number, count: number) {
  if (index === 0) return "主池";
  return count > 2 ? `边池 ${index}` : "边池";
}

interface Slice {
  readonly key: string;
  readonly label: string;
  readonly chips: number;
  readonly tone: "leader" | "trailer" | "dead";
}

/** The pot from the top down: whoever leads it, then the others as they were entered, then dead money. */
function slices(pot: PotBreakdown, nameOf: (id: string) => string): Slice[] {
  const players = pot.stakes.map(({ playerId, chips }): Slice => {
    const tone = pot.leaders.includes(playerId) ? "leader" : "trailer";
    return { key: playerId, label: nameOf(playerId), chips, tone };
  });
  return [
    ...players.filter(({ tone }) => tone === "leader"),
    ...players.filter(({ tone }) => tone !== "leader"),
    ...(pot.deadChips > 0
      ? [{ key: "dead-money", label: "死钱", chips: pot.deadChips, tone: "dead" as const }]
      : []),
  ];
}

const SLICE_CLASS = {
  leader: "bg-accent text-accent-text font-semibold",
  trailer: "bg-muted/25 text-text",
  dead: "bg-highlight/80 text-accent-text",
} as const;

/**
 * Every pot of a hand side by side, main pot first: a column as tall as the pot is large, cut into
 * who put it in, each part naming its player and chips. The pot's leader is always on top.
 */
export function PotColumns({
  pots,
  nameOf,
}: {
  pots: readonly PotBreakdown[];
  nameOf: (id: string) => string;
}) {
  const total = pots.reduce((sum, pot) => sum + pot.amountChips, 0);
  const largest = Math.max(1, ...pots.map((pot) => pot.amountChips));
  return (
    <section aria-label="总底池" className="rounded-xl border border-line bg-surface p-3">
      <p>
        <span className="block text-sm text-muted">总底池</span>
        <span className="block text-2xl font-semibold tabular-nums">{chipText(total)}</span>
      </p>
      <div className="mt-3 flex items-end gap-2">
        {pots.map((pot, index) => (
          <div key={potName(index, pots.length)} className="min-w-0 flex-1 text-center">
            <p className="mb-1 text-lg leading-tight font-semibold tabular-nums">
              {chipText(pot.amountChips)}
            </p>
            {/* Each part keeps room for its line of text, so a small one is drawn a little tall */}
            <div
              className="flex flex-col gap-0.5 overflow-hidden rounded-xl"
              style={{ height: (pot.amountChips / largest) * FULL_HEIGHT }}
            >
              {slices(pot, nameOf).map(({ key, label, chips, tone }) => (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-5 items-center justify-center gap-1 px-1.5 text-xs leading-none",
                    SLICE_CLASS[tone],
                  )}
                  style={{ flex: `${chips} 1 0%` }}
                >
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 tabular-nums">{chipText(chips)}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-sm font-medium">{potName(index, pots.length)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
