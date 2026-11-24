import {
  type Cents,
  CURRENCIES,
  type Currency,
  cents,
  type GameSummary,
  INCOME_ITEMS,
  type IncomeItem,
  type IncomeReport,
  incomeReport,
  incomeSeries,
  inPeriod,
  multiply,
  PERIOD_CHOICES,
  type PeriodChoice,
  periodOf,
  TREND_SPANS,
  type TrendSpan,
  trendPeriods,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { GameListRow } from "@/components/game/GameListRow";
import { InfoButton } from "@/components/InfoButton";
import { IncomeFilter } from "@/components/income/IncomeFilter";
import { Arc } from "@/components/insurance/PotShares";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import { useGames } from "@/data/games";
import { useGameSummaries } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
import { blindsKey, filterChoices, ratioKey } from "@/lib/income-filter";
import { useListReturn } from "@/lib/list-return";
import { QuietMotion, useCountUp, useEntered, usePlaysIn } from "@/lib/motion";
import { periodName } from "@/lib/period-names";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/me_/income")({
  component: IncomePage,
});

const cardClass = "rounded-2xl border border-line bg-surface";

const ITEM_NAMES: Record<IncomeItem, string> = {
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
const ITEM_FILLS: Record<IncomeItem, { readonly dot: string; readonly stroke: string }> = {
  insurance: { dot: "bg-highlight", stroke: "stroke-highlight" },
  wage: { dot: "bg-accent", stroke: "stroke-accent" },
  tableFee: { dot: "bg-[#a9e4c8]", stroke: "stroke-[#a9e4c8]" },
  rake: { dot: "bg-[#6aa9e9]", stroke: "stroke-[#6aa9e9]" },
};
/** Insurance that lost over the games shown */
/** How long the total's card takes to play in, in milliseconds */
const PLAY_MS = 1250;

const LOSS_FILL = { dot: "bg-loss", stroke: "stroke-loss" };

/** The items counted, as this browser keeps them. Anything else kept gives way to all four. */
function parseItems(stored: unknown): IncomeItem[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return INCOME_ITEMS.filter((item) => stored.includes(item));
}

/** What the page shows, as it was left: the period, and the games it is narrowed to. */
interface View {
  readonly period: PeriodChoice;
  /** Missing for the currency of the newest game. */
  readonly currency?: Currency | undefined;
  /** A chip ratio or the blinds as `ratioKey` and `blindsKey` give them. Missing for any. */
  readonly ratio?: string | undefined;
  readonly blinds?: string | undefined;
}

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

function parseView(stored: unknown): View | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { period, currency, ratio, blinds } = stored as Record<string, unknown>;
  const kept = PERIOD_CHOICES.find((choice) => choice === period);
  if (!kept) return undefined;
  return {
    period: kept,
    currency: CURRENCIES.find((c) => c === currency),
    ratio: text(ratio),
    blinds: text(blinds),
  };
}

/** How the bars were left: how they are cut, and the items they show. */
interface BarsView {
  readonly span: TrendSpan;
  readonly items: readonly IncomeItem[];
}

function parseBars(stored: unknown): BarsView | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { span, items } = stored as Record<string, unknown>;
  const kept = TREND_SPANS.find((value) => value === span);
  const shown = parseItems(items);
  return kept && shown ? { span: kept, items: shown } : undefined;
}

const numbers = (text: string) => text.split("-").map(Number) as [number, number, number];

function IncomePage() {
  const { data: summaries, isError, refetch } = useGameSummaries();

  return (
    <Page
      title={t.me.income.title}
      titleNote={
        <InfoButton title={t.me.income.title} small>
          <p className="text-sm text-muted">{t.me.income.explain}</p>
        </InfoButton>
      }
      actions={
        <Link
          to="/me"
          aria-label={t.me.income.back}
          className="grid min-h-11 shrink-0 place-items-center"
        >
          {/* The emblem, as on the settlement page */}
          <img src="/emblem-on-dark.svg" alt="" className="h-12 w-auto" />
        </Link>
      }
    >
      {isError ? (
        <div role="alert" className={cn(cardClass, "p-5")}>
          <p className="text-sm">{t.me.income.unread}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 min-h-11 rounded-xl border border-line px-5 font-medium"
          >
            {t.common.retry}
          </button>
        </div>
      ) : summaries === undefined ? (
        // While the games are read, the total's place stays empty for a moment
        <section className={cn(cardClass, "min-h-36")} />
      ) : summaries.length === 0 ? (
        <p className={cn(cardClass, "p-5 text-sm text-muted")}>{t.me.income.noneYet}</p>
      ) : (
        <Income summaries={summaries} />
      )}
    </Page>
  );
}

function Income({ summaries }: { summaries: readonly GameSummary[] }) {
  const today = dayOf(Date.now());
  // Come back to from a game, the page is where it was left and nothing plays in again
  const returning = useListReturn("/me/income");
  const [view, setView] = useStoredState<View>("income.view.2", { period: "thisMonth" }, parseView);
  const [items, setItems] = useStoredState<readonly IncomeItem[]>(
    "income.items",
    INCOME_ITEMS,
    parseItems,
  );
  const { data: games } = useGames();

  // The currencies there are games in, in the app's own order. Panda points come up first, and
  // the newest game's currency where there are none
  const currencies = CURRENCIES.filter((c) => summaries.some((s) => s.currency === c));
  const newest = summaries.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
  const currency =
    view.currency && currencies.includes(view.currency)
      ? view.currency
      : currencies.includes("CNY")
        ? "CNY"
        : newest.currency;

  const period = view.period;
  const days = periodOf(period, today);
  // A ratio or blinds kept from before that the period's games do not offer counts as no choice
  const offered = filterChoices(
    summaries.filter((s) => inPeriod(days, s.day)),
    currency,
  );
  const ratio = offered.ratios.find(({ value }) => value === view.ratio)?.value;
  const blinds = offered.blinds.find(({ value }) => value === view.blinds)?.value;
  const narrowed = summaries.filter(
    (s) =>
      s.currency === currency &&
      (!ratio || ratioKey(s) === ratio) &&
      (!blinds || blindsKey(s) === blinds),
  );

  const report = incomeReport(narrowed, { currency, items }, days);
  const change = (next: Partial<View>) => {
    setView({ ...view, currency, ...next });
  };

  const money = (value: Cents) => formatGameMoney(value, currency);
  // Each period with the number of games it has under the filter in force
  const counted = (choice: PeriodChoice) => {
    const within = periodOf(choice, today);
    const count =
      choice === period
        ? report.games.length
        : narrowed.filter((s) => inPeriod(within, s.day)).length;
    return `${periodName(choice, today)} (${count})`;
  };
  // Newest first, as the report has them. One not read yet is left out until it is
  const owing = report.games
    .filter((game) => game.unreceived > 0)
    .flatMap(({ summary }) => games?.find((game) => game.id === summary.id) ?? []);

  const header = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center text-sm">
          <span className="shrink-0 text-muted">{t.me.income.due}</span>
          <span className="mx-1.5 text-muted" aria-hidden>
            ·
          </span>
          <TextMenu
            label={t.me.income.period}
            options={PERIOD_CHOICES.map((choice) => ({
              value: choice,
              label: counted(choice),
            }))}
            value={period}
            onChange={(choice) => change({ period: choice })}
            className="font-medium"
          />
        </div>
        <IncomeFilter
          applied={{ currency, ratio, blinds }}
          currencies={currencies}
          games={summaries.filter((s) => inPeriod(days, s.day))}
          onApply={change}
        />
      </div>
    </>
  );

  return (
    <QuietMotion value={returning}>
      <div className="pb-8">
        <Breakdown
          // What is shown comes in afresh for another period or other games, not for an item ticked
          playKey={[period, currency, ratio, blinds].join()}
          header={header}
          report={report}
          items={items}
          money={money}
          onToggle={(item) =>
            setItems(
              INCOME_ITEMS.filter((i) => (i === item ? !items.includes(i) : items.includes(i))),
            )
          }
        />
        <Trend summaries={narrowed} currency={currency} today={today} money={money} />

        {/* The games with income still to come in, as the games page lists them */}
        {owing.length > 0 && (
          <section className="mt-5">
            <h2 className="flex min-h-11 items-center font-medium">
              {t.me.income.unreceivedTitle}
              <span className="ml-2 text-sm font-normal text-muted tabular-nums">
                {owing.length}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {owing.map((game) => (
                <GameListRow key={game.id} game={game} fromIncome />
              ))}
            </ul>
          </section>
        )}
      </div>
    </QuietMotion>
  );
}

type Money = (value: Cents) => string;

/**
 * What is due over the games shown: the total, a ring of where it came from with each item spelled
 * out beside it, how much of it is still to come in, and the differences the organizer took on.
 */
function Breakdown({
  playKey,
  header,
  report,
  items,
  money,
  onToggle,
}: {
  /** Whatever it changes with plays the card in again from nothing */
  playKey: string;
  /** The line over the total: what it is of, and the choices that make it */
  header: ReactNode;
  report: IncomeReport;
  items: readonly IncomeItem[];
  money: Money;
  onToggle: (item: IncomeItem) => void;
}) {
  const {
    total,
    received,
    unreceived,
    unreceivedGames,
    badDebt,
    badDebtGames,
    byItem,
    gamesByItem,
    absorbed,
  } = report;
  const share = total > 0 ? Math.min(100, Math.max(0, (received / total) * 100)) : 0;
  const allIn = total > 0 && unreceived === 0 && badDebt === 0;
  const badShare = total > 0 ? Math.min(100 - share, Math.max(0, (badDebt / total) * 100)) : 0;

  // All of it plays in together and is there in about a second and a quarter: the total counts
  // up while the ring turns in, the items come down beside it and the bar runs out with what is
  // in and what is still out. The differences open under it as the rest arrives
  const figure = (value: number, end: Cents) =>
    money(value === end ? end : cents(Math.round(value / 100) * 100));
  const playsIn = usePlaysIn(playKey);
  const play = { duration: PLAY_MS, resetKey: playKey };
  const totalShown = useCountUp(total, play);
  const shareShown = useCountUp(share, play);
  // How far the bar has run, from 0 to 100, for what runs in with it
  const barRun = useCountUp(100, play);
  const badDebtShown = useCountUp(badDebt, play);
  const receivedShown = useCountUp(received, play);
  const unreceivedShown = useCountUp(unreceived, play);
  const unreceivedGamesShown = Math.round(useCountUp(unreceivedGames, play));
  const barDone = useCountUp(1, { duration: 1, delay: PLAY_MS, resetKey: playKey }) >= 1;

  return (
    <section className={cn(cardClass, "px-4 pt-1 pb-3")}>
      {header}
      <p
        className={cn(
          "text-4xl font-semibold tracking-tight tabular-nums",
          total < 0 && "text-loss",
        )}
      >
        {figure(totalShown, total)}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <IncomeRing report={report} items={items} playKey={playKey} />
        <ul aria-label={t.me.income.items} className="flex min-w-0 flex-1 flex-col">
          {INCOME_ITEMS.map((item, index) => {
            const amount = byItem[item];
            const count = gamesByItem[item];
            // An item none of the games had is struck out by itself, whatever is ticked
            const on = items.includes(item) && count > 0;
            const fill = amount < 0 ? LOSS_FILL : ITEM_FILLS[item];
            return (
              <li
                key={item + playKey}
                className={cn(playsIn && "animate-settle")}
                style={{ animationDelay: `${150 + index * 200}ms` }}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={t.me.income.counted(ITEM_NAMES[item])}
                  disabled={count === 0}
                  onClick={() => onToggle(item)}
                  className="flex min-h-11 w-full items-start gap-1.5 rounded-lg px-1 py-1 text-left text-sm enabled:active:bg-line"
                >
                  {/* On the middle of the name's line. Hollow while the item is left out */}
                  <span
                    className={cn(
                      "mt-[5px] size-2.5 shrink-0 rounded-full",
                      on ? fill.dot : "border border-muted",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate", !on && "text-muted line-through")}>
                        {ITEM_NAMES[item]}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          !on ? "text-muted line-through" : amount < 0 && "text-loss",
                        )}
                      >
                        {money(amount)}
                      </span>
                    </span>
                    <span className="block truncate text-[11px] leading-tight text-muted tabular-nums">
                      {count === 0
                        ? t.me.income.itemNone
                        : t.me.income.itemGames(count, money(multiply(amount, 1 / count)))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* How much of the total is in. An empty bar where nothing is due */}
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

      {/* Only where there was a difference, opening from its rule once the rest is in */}
      {absorbed !== 0 && (
        <div
          key={playKey}
          className={cn("-mb-3 overflow-hidden", playsIn && "animate-unfold")}
          style={{ animationDelay: `${PLAY_MS - 250}ms` }}
        >
          <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line text-sm">
            <p>
              {absorbed > 0 ? t.me.income.kept : t.me.income.absorbed}
              <span className="ml-2 text-xs text-muted">{t.me.income.absorbedNote}</span>
            </p>
            <p className={cn("shrink-0 tabular-nums", absorbed < 0 && "text-loss")}>
              {money(absorbed)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The items counted as two rings, each read from the top.
 *
 * The outer ring is what was only ever taken in: wages, then table fees, then rake, each as long
 * as its part of the three together. The inner ring is insurance, which can lose: a gain runs
 * clockwise in the app's green and a loss runs back from the top in red, as long as it is against
 * the three together, or a full turn where it is more than they are. The games shown are counted
 * in the middle.
 */
function IncomeRing({
  report,
  items,
  playKey,
}: {
  report: IncomeReport;
  items: readonly IncomeItem[];
  playKey: string;
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
    <div className="relative size-32 shrink-0">
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
 * A bar for each of the last four weeks or months, with the items stacked: insurance at the foot,
 * then wages, table fees and rake. Insurance that lost hangs under the line in red. Which items
 * show and how the bars are cut are the bars' own, and follow nothing chosen above.
 */
function Trend({
  summaries,
  currency,
  today,
  money,
}: {
  summaries: readonly GameSummary[];
  currency: Currency;
  today: string;
  money: Money;
}) {
  const [{ span, items: shown }, setBars] = useStoredState<BarsView>(
    "income.bars.2",
    { span: "months4", items: INCOME_ITEMS },
    parseBars,
  );
  const series = incomeSeries(summaries, currency, trendPeriods(span, today));
  // An item none of the bars has is struck out by itself
  const there = (item: IncomeItem) => series.some(({ byItem }) => byItem[item] !== 0);
  const on = (item: IncomeItem) => shown.includes(item) && there(item);
  const bars = series.map(({ period, byItem }) => ({
    from: period.from ?? "",
    parts: INCOME_ITEMS.map((item) => ({ item, amount: on(item) ? byItem[item] : 0 })),
  }));
  const reach = (parts: readonly { readonly amount: number }[], sign: 1 | -1) =>
    parts.reduce((all, { amount }) => all + Math.max(0, amount * sign), 0);
  const high = Math.max(1, ...bars.map(({ parts }) => reach(parts, 1)));
  const low = Math.max(0, ...bars.map(({ parts }) => reach(parts, -1)));
  // The room under the line, as a part of the 6rem the bars have
  const under = (low / (high + low)) * 6;
  // The bars come in together for another span or currency, and grow out from the line
  const playKey = `${span}${currency}`;
  const grown = useEntered(playKey);

  const nameOf = (from: string) => {
    const [year, month, date] = numbers(from);
    return span === "months4"
      ? t.me.income.month(year, month)
      : t.me.income.weekFrom(t.me.income.day(month, date));
  };
  const shortName = (from: string) => {
    const [, month, date] = numbers(from);
    return span === "months4" ? t.me.income.monthShort(month) : `${month}/${date}`;
  };

  return (
    <section className={cn(cardClass, "mt-3 px-4 pt-2 pb-3")}>
      {/* The items, each over what it came to in these bars, then how the bars are cut */}
      <div className="flex items-start justify-between gap-1">
        <div className="-ml-1.5 flex min-w-0 flex-wrap">
          {INCOME_ITEMS.map((item) => (
            <BarItem
              key={item}
              item={item}
              total={series.reduce((all, { byItem }) => all + byItem[item], 0)}
              lit={on(item)}
              absent={!there(item)}
              playKey={playKey}
              onToggle={() =>
                setBars({
                  span,
                  items: INCOME_ITEMS.filter((i) => (i === item ? !on(i) : shown.includes(i))),
                })
              }
            />
          ))}
        </div>
        <TextMenu
          label={t.me.income.span}
          options={TREND_SPANS.map((value) => ({
            value,
            label: `${t.me.income.spans[value]} (${incomeSeries(
              summaries,
              currency,
              trendPeriods(value, today),
            ).reduce((all, { games }) => all + games, 0)})`,
          }))}
          value={span}
          onChange={(value) => setBars({ span: value, items: shown })}
          align="right"
          className="shrink-0 text-sm whitespace-nowrap"
        />
      </div>

      <ul className="mt-1 grid grid-cols-4 gap-1">
        {bars.map(({ from, parts }) => (
          <Bar
            key={span + from}
            name={nameOf(from)}
            label={shortName(from)}
            parts={parts}
            high={high}
            low={low}
            under={under}
            grown={grown}
            playKey={playKey}
            money={money}
          />
        ))}
      </ul>
    </section>
  );
}

/** An item of the bars: a tap shows or hides it, and under its name is what it came to. */
function BarItem({
  item,
  total,
  lit,
  absent,
  playKey,
  onToggle,
}: {
  item: IncomeItem;
  /** Over all the bars, whether it shows or not */
  total: number;
  lit: boolean;
  /** None of the bars has it: struck out, and not for tapping */
  absent: boolean;
  playKey: string;
  onToggle: () => void;
}) {
  const figure = Math.round(useCountUp(total, { duration: 500, resetKey: playKey }) / 100);
  return (
    <button
      type="button"
      aria-pressed={lit}
      aria-label={t.me.income.barShown(ITEM_NAMES[item])}
      disabled={absent}
      onClick={onToggle}
      className={cn(
        // The figure ends where the name does, and may run back under the dot
        "flex min-h-11 flex-col items-end justify-center px-1.5 text-sm",
        !lit && "text-muted",
      )}
    >
      <span className={cn("flex items-center gap-1.5", absent && "line-through")}>
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            lit ? ITEM_FILLS[item].dot : "border border-muted",
          )}
          aria-hidden
        />
        {ITEM_NAMES[item]}
      </span>
      <span
        className={cn(
          "text-[11px] leading-tight tabular-nums",
          lit && total < 0 ? "text-loss" : "text-muted",
        )}
      >
        {absent ? "—" : figure.toLocaleString("en-US")}
      </span>
    </button>
  );
}

const growClass = "transition-[height] duration-500 ease-out motion-reduce:transition-none";

/**
 * One bar and the figure over it. Every item has its part in the bar whether it shows or not, at
 * no height while it does not, so one ticked or unticked grows in or shrinks away, and the line
 * the bars stand on moves with the room the losses need.
 */
function Bar({
  name,
  label,
  parts,
  high,
  low,
  under,
  grown,
  playKey,
  money,
}: {
  /** For a reader */
  name: string;
  label: string;
  /** Each item's amount, 0 for one that does not show */
  parts: readonly { readonly item: IncomeItem; readonly amount: number }[];
  /** The tallest reach over and under the line among the bars */
  high: number;
  low: number;
  /** The room under the line, in rem */
  under: number;
  grown: boolean;
  playKey: string;
  money: Money;
}) {
  const total = parts.reduce((all, { amount }) => all + amount, 0);
  const figure = Math.round(useCountUp(total, { duration: 500, resetKey: playKey }) / 100);
  const part = (amount: number, of: number) => `${grown && of > 0 ? (amount / of) * 100 : 0}%`;

  return (
    <li
      aria-label={t.me.income.barTotal(name, money(cents(total)))}
      className="flex min-w-0 flex-col items-center"
    >
      <span
        className={cn(
          "mb-1.5 h-4 max-w-full truncate text-[11px] tabular-nums",
          total < 0 ? "text-loss" : "text-muted",
        )}
      >
        {total === 0 && figure === 0 ? "" : figure.toLocaleString("en-US")}
      </span>
      {/* What was taken in stands on the line, the first item at the foot */}
      <span
        className={cn("flex w-2/5 flex-col-reverse overflow-hidden rounded-t", growClass)}
        style={{ height: `${6 - under}rem` }}
        aria-hidden
      >
        {parts.map(({ item, amount }) => (
          <span
            key={item}
            className={cn("w-full shrink-0", growClass, ITEM_FILLS[item].dot)}
            style={{ height: part(Math.max(0, amount), high) }}
          />
        ))}
      </span>
      <span className="h-px w-full bg-line" aria-hidden />
      {/* What was lost hangs under it */}
      <span
        className={cn("flex w-2/5 flex-col", growClass)}
        style={{ height: `${under}rem` }}
        aria-hidden
      >
        {parts.map(({ item, amount }) => (
          <span
            key={item}
            className={cn("w-full shrink-0 rounded-b", growClass, LOSS_FILL.dot)}
            style={{ height: part(Math.max(0, -amount), low) }}
          />
        ))}
      </span>
      <span className="flex min-h-8 items-center text-xs text-muted tabular-nums">{label}</span>
    </li>
  );
}
