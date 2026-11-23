import {
  type Cents,
  CURRENCIES,
  type Currency,
  cents,
  type GameIncome,
  type GameSummary,
  INCOME_ITEMS,
  type IncomeItem,
  type IncomeReport,
  incomeReport,
  incomeSeries,
  monthOf,
  multiply,
  PERIOD_CHOICES,
  type PeriodChoice,
  periodOf,
  shiftMonth,
  TREND_SPANS,
  type TrendSpan,
  trendPeriods,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { InfoButton } from "@/components/InfoButton";
import { Arc } from "@/components/insurance/PotShares";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import { useGameSummaries } from "@/data/summaries";
import { t } from "@/i18n";
import { formatSeatTime } from "@/lib/charges";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
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
const LOSS_FILL = { dot: "bg-loss", stroke: "stroke-loss" };

/** Each currency is shown by its mark alone, and named after the animal for a reader. */
const CURRENCY_NAMES: Record<Currency, string> = {
  CNY: t.gamePages.list.panda,
  AUD: t.gamePages.list.kangaroo,
};

/** The items counted, as this browser keeps them. Anything else kept gives way to all four. */
function parseItems(stored: unknown): IncomeItem[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return INCOME_ITEMS.filter((item) => stored.includes(item));
}

const numbers = (text: string) => text.split("-").map(Number) as [number, number, number];

function monthName(month: string) {
  const [year, number] = numbers(month);
  return t.me.income.month(year, number);
}

/** A game's day, with its year only where that is not this one. */
function dayName(day: string, today: string) {
  const [year, month, date] = numbers(day);
  return day.slice(0, 4) === today.slice(0, 4)
    ? t.me.income.day(month, date)
    : t.me.income.dayOfYear(year, month, date);
}

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
          className="-mr-2 grid size-11 shrink-0 place-items-center text-highlight"
        >
          <X className="size-6" strokeWidth={1.75} aria-hidden />
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
  const [shown, setShown] = useState<PeriodChoice>("thisWeek");
  const [items, setItems] = useStoredState<readonly IncomeItem[]>(
    "income.items",
    INCOME_ITEMS,
    parseItems,
  );
  const [onlyUnreceived, setOnlyUnreceived] = useState(false);

  // The currencies there are games in, in the app's own order. The newest game's comes up first
  const currencies = CURRENCIES.filter((c) => summaries.some((s) => s.currency === c));
  const newest = summaries.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
  const [picked, setPicked] = useState<Currency>();
  const currency = picked && currencies.includes(picked) ? picked : newest.currency;

  const view = { currency, items };
  const report = incomeReport(summaries, view, periodOf(shown, today));

  const money = (value: Cents) => formatGameMoney(value, currency);
  // This month and the last go by their names, the last with its year where that is another
  const thisMonth = monthOf(today);
  const lastMonth = shiftMonth(thisMonth, -1);
  const periodName = (choice: PeriodChoice) =>
    choice === "thisMonth"
      ? t.me.income.monthShort(numbers(thisMonth)[1])
      : choice === "lastMonth"
        ? lastMonth.slice(0, 4) === thisMonth.slice(0, 4)
          ? t.me.income.monthShort(numbers(lastMonth)[1])
          : monthName(lastMonth)
        : t.me.income.periods[choice];
  const listed = onlyUnreceived ? report.games.filter((game) => game.unreceived > 0) : report.games;

  return (
    <div className="pb-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <TextMenu
          label={t.me.income.period}
          options={PERIOD_CHOICES.map((choice) => ({
            value: choice,
            label: periodName(choice),
          }))}
          value={shown}
          onChange={(choice) => {
            setOnlyUnreceived(false);
            setShown(choice);
          }}
          className="text-lg font-semibold"
        />
        {currencies.length > 1 && (
          <TextMenu
            label={t.me.income.currency}
            options={currencies.map((c) => ({
              value: c,
              name: CURRENCY_NAMES[c],
              label: <CurrencyIcon currency={c} className="size-5" />,
            }))}
            value={currency}
            onChange={setPicked}
            align="right"
            className="text-sm text-muted"
          />
        )}
      </div>

      <Breakdown
        report={report}
        items={items}
        money={money}
        onToggle={(item) =>
          setItems(
            INCOME_ITEMS.filter((i) => (i === item ? !items.includes(i) : items.includes(i))),
          )
        }
        onlyUnreceived={onlyUnreceived}
        onToggleUnreceived={() => setOnlyUnreceived(!onlyUnreceived)}
      />
      <Trend summaries={summaries} currency={currency} today={today} money={money} />

      <section className="mt-5">
        <div className="flex min-h-11 items-center justify-between">
          <h2 className="font-medium">
            {t.me.income.games}
            <span className="ml-2 text-sm font-normal text-muted">
              {onlyUnreceived ? t.me.income.unreceived : ""}
            </span>
          </h2>
          {(onlyUnreceived || report.unreceivedGames > 0) && (
            <button
              type="button"
              onClick={() => setOnlyUnreceived(!onlyUnreceived)}
              className="min-h-11 text-sm text-highlight"
            >
              {onlyUnreceived ? t.me.income.showAll : t.me.income.onlyUnreceived}
            </button>
          )}
        </div>
        {listed.length === 0 ? (
          <p className="py-3 text-sm text-muted">{t.me.income.noGames}</p>
        ) : (
          <ul className={cn(cardClass, "divide-y divide-line")}>
            {listed.map((game) => (
              <GameRow key={game.summary.id} game={game} today={today} money={money} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type Money = (value: Cents) => string;

/**
 * What is due over the games shown: the total, a ring of where it came from with each item spelled
 * out beside it, how much of it is still to come in, and the differences the organizer took on.
 */
function Breakdown({
  report,
  items,
  money,
  onToggle,
  onlyUnreceived,
  onToggleUnreceived,
}: {
  report: IncomeReport;
  items: readonly IncomeItem[];
  money: Money;
  onToggle: (item: IncomeItem) => void;
  onlyUnreceived: boolean;
  onToggleUnreceived: () => void;
}) {
  const { total, received, unreceived, unreceivedGames, byItem, gamesByItem, absorbed } = report;
  const share = total > 0 ? Math.min(100, Math.max(0, (received / total) * 100)) : 0;

  return (
    <section className={cn(cardClass, "p-4")}>
      <p className="text-sm text-muted">{t.me.income.due}</p>
      <p
        className={cn(
          "mt-1 text-4xl font-semibold tracking-tight tabular-nums",
          total < 0 && "text-loss",
        )}
      >
        {money(total)}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <IncomeRing report={report} items={items} />
        <ul aria-label={t.me.income.items} className="flex min-w-0 flex-1 flex-col">
          {INCOME_ITEMS.map((item) => {
            const on = items.includes(item);
            const amount = byItem[item];
            const count = gamesByItem[item];
            const fill = amount < 0 ? LOSS_FILL : ITEM_FILLS[item];
            return (
              <li key={item}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={t.me.income.counted(ITEM_NAMES[item])}
                  onClick={() => onToggle(item)}
                  className="flex min-h-11 w-full items-start gap-1.5 rounded-lg px-1 py-1 text-left text-sm active:bg-line"
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
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <p className="flex min-h-11 items-center gap-2 whitespace-nowrap">
          <span className="text-muted">{t.me.income.received}</span>
          <span className="tabular-nums">{money(received)}</span>
        </p>
        <button
          type="button"
          disabled={unreceivedGames === 0}
          aria-pressed={onlyUnreceived}
          onClick={onToggleUnreceived}
          className="flex min-h-11 items-center gap-2 whitespace-nowrap"
        >
          <span className="text-muted">{t.me.income.unreceived}</span>
          <span className={cn("tabular-nums", unreceived > 0 && "text-highlight")}>
            {money(unreceived)}
          </span>
          {unreceivedGames > 0 && (
            <span className="text-muted">· {t.me.income.unreceivedGames(unreceivedGames)}</span>
          )}
        </button>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line text-sm">
        <p>
          {absorbed > 0 ? t.me.income.kept : t.me.income.absorbed}
          <span className="ml-2 text-xs text-muted">{t.me.income.absorbedNote}</span>
        </p>
        <p
          className={cn(
            "shrink-0 tabular-nums",
            absorbed < 0 ? "text-loss" : absorbed > 0 ? "text-text" : "text-muted",
          )}
        >
          {absorbed === 0 ? "—" : money(absorbed)}
        </p>
      </div>
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
function IncomeRing({ report, items }: { report: IncomeReport; items: readonly IncomeItem[] }) {
  const amount = (item: IncomeItem) => (items.includes(item) ? report.byItem[item] : 0);
  const outer = (["wage", "tableFee", "rake"] as const).map((item) => ({
    item,
    amount: Math.max(0, amount(item)),
  }));
  const taken = outer.reduce((all, part) => all + part.amount, 0);
  const insurance = amount("insurance");
  const scale = Math.max(taken, Math.abs(insurance));
  const turn = scale > 0 ? Math.abs(insurance) / scale : 0;
  let start = 0;

  return (
    <div className="relative size-32 shrink-0">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={t.me.income.ring}
        className="size-full -rotate-90"
      >
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="9" className="stroke-line" />
        <circle cx="50" cy="50" r="33" fill="none" strokeWidth="6" className="stroke-line/60" />
        {outer.map(({ item, amount }) => {
          const length = scale > 0 ? amount / scale : 0;
          const from = start;
          start += length;
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
        <span className="text-2xl leading-none font-semibold tabular-nums">
          {report.games.length}
        </span>
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
  const [span, setSpan] = useState<TrendSpan>("weeks4");
  const [shown, setShown] = useState<readonly IncomeItem[]>(INCOME_ITEMS);
  const bars = incomeSeries(summaries, currency, trendPeriods(span, today)).map(
    ({ period, byItem }) => {
      const parts = INCOME_ITEMS.filter((item) => shown.includes(item)).map((item) => ({
        item,
        amount: byItem[item],
      }));
      return {
        from: period.from ?? "",
        up: parts.filter(({ amount }) => amount > 0),
        down: parts.filter(({ amount }) => amount < 0),
        total: cents(parts.reduce((all, { amount }) => all + amount, 0)),
      };
    },
  );
  const reach = (parts: readonly { readonly amount: number }[]) =>
    parts.reduce((all, { amount }) => all + Math.abs(amount), 0);
  const high = Math.max(1, ...bars.map(({ up }) => reach(up)));
  const low = Math.max(0, ...bars.map(({ down }) => reach(down)));
  // The room under the line, as a part of the 6rem the bars have
  const under = (low / (high + low)) * 6;

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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm text-muted">{t.me.income.trend}</h2>
        <TextMenu
          label={t.me.income.span}
          options={TREND_SPANS.map((value) => ({ value, label: t.me.income.spans[value] }))}
          value={span}
          onChange={setSpan}
          align="right"
          className="text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-x-1">
        {INCOME_ITEMS.map((item) => {
          const on = shown.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              aria-label={t.me.income.barShown(ITEM_NAMES[item])}
              onClick={() =>
                setShown(INCOME_ITEMS.filter((i) => (i === item ? !on : shown.includes(i))))
              }
              className={cn(
                "flex min-h-11 items-center gap-1.5 px-1.5 text-sm",
                !on && "text-muted",
              )}
            >
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  on ? ITEM_FILLS[item].dot : "border border-muted",
                )}
                aria-hidden
              />
              {ITEM_NAMES[item]}
            </button>
          );
        })}
      </div>

      <ul className="mt-1 grid grid-cols-4 gap-1">
        {bars.map(({ from, up, down, total }) => (
          <li
            key={from}
            aria-label={t.me.income.barTotal(nameOf(from), money(total))}
            className="flex min-w-0 flex-col items-center"
          >
            <span
              className={cn(
                "h-4 max-w-full truncate text-[11px] tabular-nums",
                total < 0 ? "text-loss" : "text-muted",
              )}
            >
              {total === 0 ? "" : Math.round(total / 100).toLocaleString("en-US")}
            </span>
            {/* What was taken in stands on the line, the first item at the foot */}
            <span
              className="flex w-2/5 flex-col-reverse overflow-hidden rounded-t"
              style={{ height: `${6 - under}rem` }}
              aria-hidden
            >
              {up.map(({ item, amount }) => (
                <span
                  key={item}
                  className={cn("w-full shrink-0", ITEM_FILLS[item].dot)}
                  style={{ height: `${(amount / high) * 100}%` }}
                />
              ))}
            </span>
            <span className="h-px w-full bg-line" aria-hidden />
            {/* What was lost hangs under it */}
            <span className="flex w-2/5 flex-col" style={{ height: `${under}rem` }} aria-hidden>
              {down.map(({ item, amount }) => (
                <span
                  key={item}
                  className={cn("w-full shrink-0 rounded-b", LOSS_FILL.dot)}
                  style={{ height: `${(-amount / low) * 100}%` }}
                />
              ))}
            </span>
            <span className="flex min-h-8 items-center text-xs text-muted tabular-nums">
              {shortName(from)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One game: when and what it was, then what it brought in and how much of that is still out. */
function GameRow({ game, today, money }: { game: GameIncome; today: string; money: Money }) {
  const { summary, income, unreceived } = game;
  const day = dayName(summary.day, today);

  return (
    <li>
      <Link
        to="/games/$gameId/settlement"
        params={{ gameId: summary.id }}
        search={{ from: "income" }}
        aria-label={t.me.income.openSettlement(day)}
        className="flex min-h-16 items-center gap-2 py-2 pr-2 pl-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {day}
            <span className="ml-2 text-muted tabular-nums">
              {summary.smallBlindChips} / {summary.bigBlindChips}
            </span>
          </span>
          <span className="block truncate text-xs text-muted">
            {t.me.income.players(summary.playerCount)}
            {summary.playedMs !== undefined && ` · ${formatSeatTime(summary.playedMs)}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block tabular-nums", income < 0 && "text-loss")}>
            {money(income)}
          </span>
          <span className={cn("block text-xs", unreceived > 0 ? "text-highlight" : "text-muted")}>
            {unreceived > 0
              ? t.me.income.gameUnreceived(money(unreceived))
              : income > 0
                ? t.me.income.allReceived
                : ""}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}
