import type { PotBreakdown } from "@holdem-knight/core";
import { cn } from "@/lib/cn";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number, digits: number) => `${(share * 100).toFixed(digits)}%`;

/** The tallest column, in pixels. The others are drawn to the same scale. */
const FULL_HEIGHT = 180;

/** The most a column may tower over the shortest one. */
const MAX_HEIGHT_RATIO = 5;

/** The main pot, then the side pots: numbered only when there is more than one of them. */
export function potName(index: number, count: number) {
  if (index === 0) return "主池";
  return count > 2 ? `边池 ${index}` : "边池";
}

interface Slice {
  readonly key: string;
  readonly label: string;
  readonly chips: number;
  /** A leader's chance to win the pot, once it is known. */
  readonly chance?: string | undefined;
  readonly tone: "leader" | "trailer" | "dead";
}

/** The pot from the top down: whoever leads it, then the others as they were entered, then dead money. */
function slices(pot: PotBreakdown, nameOf: (id: string) => string): Slice[] {
  const players = pot.stakes.map(({ playerId, chips }): Slice => {
    const tone = pot.leaders.includes(playerId) ? "leader" : "trailer";
    const equity = pot.equity[playerId];
    const chance = tone === "leader" && equity !== undefined ? percentText(equity, 1) : undefined;
    return { key: playerId, label: nameOf(playerId), chips, tone, chance };
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
  tiesSold,
  cardsToCome,
}: {
  pots: readonly PotBreakdown[];
  nameOf: (id: string) => string;
  /** Whether the rule sells cards that split the pot, which are then listed with the outs. */
  tiesSold: boolean;
  /** False once the board is full, when there are no outs left to show. */
  cardsToCome: boolean;
}) {
  const total = pots.reduce((sum, pot) => sum + pot.amountChips, 0);
  const largest = Math.max(1, ...pots.map((pot) => pot.amountChips));
  // A pot far smaller than the largest still gets a fifth of its height, or it could not be read
  const heightOf = (chips: number) =>
    (Math.max(chips, largest / MAX_HEIGHT_RATIO) / largest) * FULL_HEIGHT;
  return (
    <section aria-label="总底池" className="rounded-xl border border-line bg-surface p-3">
      <p>
        <span className="block text-sm text-muted">总底池</span>
        <span className="block text-2xl font-semibold tabular-nums">{chipText(total)}</span>
      </p>
      <div className="mt-3 flex items-end gap-2">
        {pots.map((pot, index) => (
          <div key={potName(index, pots.length)} className="min-w-0 flex-1">
            <p className="mb-1 px-0.5 text-lg leading-tight font-semibold tabular-nums">
              {chipText(pot.amountChips)}
            </p>
            {/* Each part keeps room for its text, so a small one is drawn a little tall */}
            <div
              className="flex flex-col gap-0.5 overflow-hidden rounded-xl"
              style={{ height: heightOf(pot.amountChips) }}
            >
              {slices(pot, nameOf).map(({ key, label, chips, tone, chance }) => (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-5 flex-col justify-center gap-1 px-2 text-xs leading-none",
                    tone === "leader" && "min-h-10",
                    SLICE_CLASS[tone],
                  )}
                  style={{ flex: `${chips} 1 0%` }}
                >
                  <span className="flex min-w-0 items-center justify-between gap-1">
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 tabular-nums">{chipText(chips)}</span>
                  </span>
                  {tone === "leader" && (
                    <span className="flex items-center justify-between gap-1 text-[11px] font-normal">
                      <span>领先</span>
                      <span className="tabular-nums">{chance}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1.5 px-0.5 text-lg leading-tight font-semibold">
              {potName(index, pots.length)}
            </p>
            {cardsToCome && (
              <p className="px-0.5 text-[11px] leading-tight text-muted tabular-nums">
                {pot.outs} Outs / {percentText(pot.outs / pot.unseenCards, 2)}
                {tiesSold && pot.tieOuts > 0 && (
                  <span className="mt-0.5 block">
                    {pot.tieOuts} Outs / {percentText(pot.tieOuts / pot.unseenCards, 2)}
                    <span className="whitespace-nowrap">（平分）</span>
                  </span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
