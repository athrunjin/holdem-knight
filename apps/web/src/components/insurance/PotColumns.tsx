import type { PotBreakdown } from "@holdem-knight/core";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { PotHeading } from "./PotShares";

const chipText = (chips: number) => chips.toLocaleString("zh-CN");
const percentText = (share: number, digits: number) => `${(share * 100).toFixed(digits)}%`;

/**
 * The largest pot's column, in pixels. The others are drawn to the same scale, unless their parts
 * need more room than that to be read.
 */
const FULL_HEIGHT = 180;

/** The most a column may tower over the shortest one. */
const MAX_HEIGHT_RATIO = 5;

/** The main pot, then the side pots: numbered only when there is more than one of them. */
export function potName(index: number, count: number) {
  if (index === 0) return t.insurance.potColumns.mainPot;
  return count > 2 ? t.insurance.potColumns.sidePot(index) : t.insurance.potColumns.sidePot2;
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
      ? [
          {
            key: "dead-money",
            label: t.common.deadMoney,
            chips: pot.deadChips,
            tone: "dead" as const,
          },
        ]
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
 * who put it in, each part naming its player and chips. The pot's leader is always on top. Every
 * part of every pot is on show, so the parts of a column always add up to the chips above it.
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
    <section
      aria-label={t.insurance.potColumns.totalPot}
      className="rounded-xl border border-line bg-surface p-3"
    >
      <PotHeading title={t.insurance.potColumns.totalPot} chips={total} />
      {/*
        Three rows shared by every column: the pot drawn, its name, and what is said of its outs.
        So the columns stand on one line and the names sit on another, however many lines of
        outs a pot has under it.
      */}
      <div className="mt-3 grid auto-cols-fr grid-flow-col grid-rows-[auto_auto_auto] gap-x-2">
        {pots.map((pot, index) => (
          <div
            key={potName(index, pots.length)}
            className="row-span-3 grid min-w-0 grid-rows-subgrid"
          >
            <div className="min-w-0 self-end">
              <p className="mb-1 px-0.5 text-lg leading-tight font-semibold tabular-nums">
                {chipText(pot.amountChips)}
              </p>
              {/*
              The scale sets the least a column is tall, never the most: every part keeps room for
              its text, so a pot with many parts for its size grows past the scale instead of
              losing them. A fixed height here cut parts off the bottom of small pots.
            */}
              <ul
                aria-label={t.insurance.potColumns.whatMakesUpThe(potName(index, pots.length))}
                // Square corners: the parts are stacked blocks
                className="flex flex-col gap-0.5 overflow-hidden"
                style={{ minHeight: heightOf(pot.amountChips) }}
              >
                {slices(pot, nameOf).map(({ key, label, chips, tone, chance }) => (
                  <li
                    key={key}
                    className={cn(
                      "flex min-h-5 shrink-0 flex-col justify-center gap-1 px-2 text-xs leading-none",
                      tone === "leader" && "min-h-10",
                      SLICE_CLASS[tone],
                    )}
                    // From nothing up by its chips, so the parts share the column by size; the
                    // least height of each is kept, and it never shrinks under its text
                    style={{ flex: `${chips} 0 0px` }}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-1">
                      <span className="truncate">{label}</span>
                      <span className="shrink-0 tabular-nums">{chipText(chips)}</span>
                    </span>
                    {tone === "leader" && (
                      <span className="flex items-center justify-between gap-1 text-[11px] font-normal">
                        <span>{t.common.ahead}</span>
                        <span className="tabular-nums">{chance}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-1.5 px-0.5 text-lg leading-tight font-semibold">
              {potName(index, pots.length)}
            </p>
            {/* Always there, so the row is kept even for a pot with nothing to say */}
            {!cardsToCome && <span />}
            {cardsToCome && (
              <p className="px-0.5 text-[11px] leading-tight text-muted tabular-nums">
                {pot.outs} Outs / {percentText(pot.outs / pot.unseenCards, 2)}
                {tiesSold && pot.tieOuts > 0 && (
                  <span className="mt-0.5 block">
                    {pot.tieOuts} Outs / {percentText(pot.tieOuts / pot.unseenCards, 2)}
                    <span className="whitespace-nowrap">{t.insurance.potColumns.tie}</span>
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
