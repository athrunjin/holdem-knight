import { type Cents, cents, type IncomeItem, type IncomeReport } from "@holdem-knight/core";
import { Check } from "lucide-react";
import { Arc } from "@/components/insurance/PotShares";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { useCountUp, usePlaysIn } from "@/lib/motion";

/** The parts of what the games brought in that 收益 and the card on 我的 both show. */

export const ITEM_NAMES: Record<IncomeItem, string> = {
  rake: t.common.rake,
  insurance: t.common.insurance,
  wage: t.common.dealerWage,
  tableFee: t.common.timeCharge,
};

/**
 * Each item's color in the ring, beside it and in the trend. Insurance has the gold it has
 * everywhere in the app. Wages and table fees are two greens, one deep and one light, and rake
 * leans to blue, so the three that share the outer ring read apart.
 */
export const ITEM_FILLS: Record<IncomeItem, { readonly dot: string; readonly stroke: string }> = {
  insurance: { dot: "bg-highlight", stroke: "stroke-highlight" },
  wage: { dot: "bg-accent", stroke: "stroke-accent" },
  tableFee: { dot: "bg-table-fee", stroke: "stroke-table-fee" },
  rake: { dot: "bg-rake", stroke: "stroke-rake" },
};

/** How long the total's card takes to play in, in milliseconds */
export const PLAY_MS = 1250;

/** Insurance that lost over the games shown */
export const LOSS_FILL = { dot: "bg-loss", stroke: "stroke-loss" };

export type Money = (value: Cents) => string;

/** A figure on its way as whole amounts, with the cents only of the amount arrived at. */
export const runningFigure = (money: Money) => (value: number, end: Cents) =>
  money(value === end ? end : cents(Math.round(value / 100) * 100));

const RING_SIZES = { md: "size-32", sm: "size-24" } as const;

/**
 * The items counted as two rings, each read from the top.
 *
 * The outer ring is what was only ever taken in: wages, then table fees, then rake, each as long
 * as its part of the three together. The inner ring is insurance, which can lose: a gain runs
 * clockwise in the app's green and a loss runs back from the top in red, as long as it is against
 * the three together, or a full turn where it is more than they are. The games shown are counted
 * in the middle.
 */
export function IncomeRing({
  report,
  items,
  playKey,
  size = "md",
}: {
  report: IncomeReport;
  items: readonly IncomeItem[];
  playKey: string;
  size?: keyof typeof RING_SIZES;
}) {
  // How far round the rings are drawn so far: they turn in from the top
  const playsIn = usePlaysIn(playKey);
  const drawn = useCountUp(1, { duration: PLAY_MS, resetKey: playKey });
  const games = Math.round(
    useCountUp(report.games.length, { duration: PLAY_MS, resetKey: playKey }),
  );
  // Each item's arc runs to its length, so one ticked fills in and one unticked shrinks away
  const amount = (item: IncomeItem) => (items.includes(item) ? report.byItem[item] : 0);
  const change = { duration: 500 };
  const outer = [
    { item: "wage" as const, amount: useCountUp(Math.max(0, amount("wage")), change) },
    { item: "tableFee" as const, amount: useCountUp(Math.max(0, amount("tableFee")), change) },
    { item: "rake" as const, amount: useCountUp(Math.max(0, amount("rake")), change) },
  ];
  const taken = outer.reduce((all, part) => all + part.amount, 0);
  const insurance = useCountUp(amount("insurance"), change);
  const scale = Math.max(taken, Math.abs(insurance));
  const turn = (scale > 0 ? Math.abs(insurance) / scale : 0) * drawn;
  let start = 0;

  return (
    <div className={cn("relative shrink-0", RING_SIZES[size])}>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={t.me.income.ring}
        key={playKey}
        className={cn("size-full -rotate-90", playsIn && "animate-appear")}
      >
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="9" className="stroke-line" />
        <circle cx="50" cy="50" r="33" fill="none" strokeWidth="6" className="stroke-line/60" />
        {outer.map(({ item, amount }) => {
          const whole = scale > 0 ? amount / scale : 0;
          const from = start;
          start += whole;
          const length = Math.min(whole, drawn - from);
          return (
            <Arc
              key={item}
              radius={44}
              width={9}
              start={from}
              length={length}
              className={ITEM_FILLS[item].stroke}
            />
          );
        })}
        <Arc
          radius={33}
          width={6}
          start={insurance < 0 ? 1 - turn : 0}
          length={turn}
          className={insurance < 0 ? LOSS_FILL.stroke : ITEM_FILLS.insurance.stroke}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl leading-none font-semibold tabular-nums">{games}</span>
        <span className="mt-1 text-xs text-muted">{t.me.income.gameCount}</span>
      </div>
    </div>
  );
}

/**
 * How much of the total is in: a bar that runs out with what is in, then what is still out with
 * its games, or one line where all of it is in, and the bad debts under it.
 */
export function CollectedBar({
  report,
  playKey,
  money,
}: {
  report: IncomeReport;
  playKey: string;
  money: Money;
}) {
  const { total, received, unreceived, unreceivedGames, badDebt, badDebtGames } = report;
  const share = total > 0 ? Math.min(100, Math.max(0, (received / total) * 100)) : 0;
  const allIn = total > 0 && unreceived === 0 && badDebt === 0;
  const badShare = total > 0 ? Math.min(100 - share, Math.max(0, (badDebt / total) * 100)) : 0;

  const figure = runningFigure(money);
  const playsIn = usePlaysIn(playKey);
  const play = { duration: PLAY_MS, resetKey: playKey };
  const shareShown = useCountUp(share, play);
  // How far the bar has run, from 0 to 100, for what runs in with it
  const barRun = useCountUp(100, play);
  const badDebtShown = useCountUp(badDebt, play);
  const receivedShown = useCountUp(received, play);
  const unreceivedShown = useCountUp(unreceived, play);
  const unreceivedGamesShown = Math.round(useCountUp(unreceivedGames, play));
  const barDone = useCountUp(1, { duration: 1, delay: PLAY_MS, resetKey: playKey }) >= 1;

  return (
    <>
      {/* An empty bar where nothing is due */}
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${shareShown}%` }} />
        {/* Bad debts stand at the far end, in red: what will not come in for now */}
        {badDebt > 0 && (
          <div
            className="absolute inset-y-0 right-0 rounded-full bg-loss"
            style={{ width: `${(badShare * barRun) / 100}%` }}
          />
        )}
      </div>
      {allIn ? (
        // Nothing still out: one line, which turns green with a tick once the bar has run
        <p
          className={cn(
            "mt-1 flex min-h-11 items-center gap-2 text-sm transition-colors duration-300",
            barDone && "text-accent",
          )}
        >
          <span className={cn(!barDone && "text-muted")}>{t.me.income.receivedAll}</span>
          <span className="tabular-nums">{figure(receivedShown, received)}</span>
          {barDone && (
            <Check
              className={cn("size-4", playsIn && "animate-appear")}
              strokeWidth={2.5}
              aria-hidden
            />
          )}
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
          <p className="flex min-h-11 items-center gap-2 whitespace-nowrap">
            <span className="text-muted">{t.me.income.received}</span>
            <span className="tabular-nums">{figure(receivedShown, received)}</span>
          </p>
          <p className="flex min-h-11 items-center gap-2 whitespace-nowrap">
            <span className="text-muted">{t.me.income.unreceived}</span>
            <span className={cn("tabular-nums", unreceived > 0 && "text-highlight")}>
              {figure(unreceivedShown, unreceived)}
            </span>
            {unreceivedGames > 0 && (
              <span className="text-muted">
                · {t.me.income.unreceivedGames(unreceivedGamesShown)}
              </span>
            )}
          </p>
        </div>
      )}
      {/* Under what is still out: what is set down as not coming in for now */}
      {badDebt > 0 && (
        <p className="-mt-2 flex min-h-9 items-center justify-end gap-2 text-sm whitespace-nowrap">
          <span className="text-muted">{t.common.badDebt}</span>
          <span className="text-loss tabular-nums">{figure(badDebtShown, badDebt)}</span>
          <span className="text-muted">· {t.me.income.badDebtGames(badDebtGames)}</span>
        </p>
      )}
    </>
  );
}
