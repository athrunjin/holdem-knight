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
import type { ReactNode } from "react";
import { GameListRow } from "@/components/game/GameListRow";
import { InfoButton } from "@/components/InfoButton";
import { IncomeFilter } from "@/components/income/IncomeFilter";
import {
  CollectedBar,
  IncomeRing,
  ITEM_FILLS,
  ITEM_NAMES,
  LOSS_FILL,
  type Money,
  PLAY_MS,
  runningFigure,
} from "@/components/income/IncomeParts";
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
import { QuietMotion, useCountUp, useEntered, usePlaysIn, useQuietArrival } from "@/lib/motion";
import { periodName } from "@/lib/period-names";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/me_/income")({
  component: IncomePage,
});

const cardClass = "rounded-2xl border border-line bg-surface";

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
  const quiet = useQuietArrival(returning);
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
    <QuietMotion value={quiet}>
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
  const { total, byItem, gamesByItem, absorbed } = report;

  // All of it plays in together and is there in about a second and a quarter: the total counts
  // up while the ring turns in, the items come down beside it and the bar runs out with what is
  // in and what is still out. The differences open under it as the rest arrives
  const figure = runningFigure(money);
  const playsIn = usePlaysIn(playKey);
  const totalShown = useCountUp(total, { duration: PLAY_MS, resetKey: playKey });

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

      <CollectedBar report={report} playKey={playKey} money={money} />

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
    <section className={cn(cardClass, "mt-3 px-4 pt-1 pb-3")}>
      {/* What the chart is of and its span, as the first card's head is */}
      <div className="flex min-w-0 items-center text-sm">
        <span className="shrink-0 text-muted">{t.me.income.trend}</span>
        <span className="mx-1.5 text-muted" aria-hidden>
          ·
        </span>
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
          className="font-medium"
        />
      </div>

      {/* The items as chips, each over its bars' column and holding what it came to in them */}
      <div className="grid grid-cols-4 gap-1">
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

      {/* A clear step of space, so the chips' figures and the bars' figures read as two rows */}
      <ul className="mt-4 grid grid-cols-4 gap-1">
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

/** An item of the bars as a chip: a tap shows or hides it, and under its name is what it came to. */
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
  // Six digits and more take a step down, by where the count ends so it does not change midway
  const wide = String(Math.abs(Math.round(total / 100))).length >= 6;
  return (
    <button
      type="button"
      aria-pressed={lit}
      aria-label={t.me.income.barShown(ITEM_NAMES[item])}
      disabled={absent}
      onClick={onToggle}
      className={cn(
        // A chip centered in its column: the dot and name, the figure under them. On it is filled
        // with a tint of line, which keeps the muted figure readable; off or absent it has no fill
        "flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-line px-1 py-1 text-sm",
        lit ? "bg-line/50" : "text-muted",
      )}
    >
      <span className={cn("flex max-w-full items-center gap-1.5", absent && "line-through")}>
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            lit ? ITEM_FILLS[item].dot : "border border-muted",
          )}
          aria-hidden
        />
        <span className="truncate">
          {item === "insurance" ? t.me.income.barInsurance : ITEM_NAMES[item]}
        </span>
      </span>
      <span
        className={cn(
          "max-w-full truncate leading-tight tabular-nums",
          wide ? "text-[10px]" : "text-[11px]",
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
