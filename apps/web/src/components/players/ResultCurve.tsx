import {
  type Cents,
  CURRENCIES,
  type Currency,
  cents,
  type GameSummary,
  playerCurve,
  playerReport,
} from "@holdem-knight/core";
import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { IncomeFilter } from "@/components/income/IncomeFilter";
import { Modal } from "@/components/insurance/Modal";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { blindsKey, filterChoices, ratioKey } from "@/lib/income-filter";
import { useCountUp, useEntered } from "@/lib/motion";
import { useStoredState } from "@/lib/stored-state";

type Money = (value: Cents, signed?: boolean) => string;

const toneOf = (value: number) => (value > 0 ? "text-win" : value < 0 ? "text-loss" : "");

const parts = (day: string) => day.split("-").map(Number) as [number, number, number];
const dayName = (day: string) => t.me.income.day(parts(day)[1], parts(day)[2]);
const shortDay = (day: string) => `${parts(day)[1]}/${parts(day)[2]}`;
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const toDay = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

/**
 * A day as typed: `2026-11-18`, with `/` or `.` between its parts as well, the month and the day
 * with or without a leading zero. Nothing for anything that is not a day of the calendar.
 */
export function parseTypedDay(text: string): string | undefined {
  const match = /^\s*(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*$/.exec(text);
  if (!match) return undefined;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || date < 1 || date > daysIn(year, month)) return undefined;
  return toDay(year, month, date);
}

/**
 * Round amounts to mark an axis with, about three steps of them, from at or under the lowest
 * value to at or over the highest. Each step is 1, 2 or 5 times a power of ten, in cents.
 */
export function axisTicks(low: number, high: number): number[] {
  // Amounts are in cents: no step is finer than one whole unit
  const rough = Math.max((high - low) / 3, 100);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((m) => m * power >= rough) ?? 10) * power;
  const ticks = [Math.floor(low / step) * step];
  // Up to the first mark at or over the highest value, and two marks at the least
  while ((ticks.at(-1) ?? 0) < high || ticks.length < 2) ticks.push((ticks.at(-1) ?? 0) + step);
  return ticks;
}

/**
 * A smooth line through points that never overshoots them: between two games the curve stays
 * between their values, so it shows no gain or loss that was not there (a monotone cubic).
 */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  }
  const slopes = points.slice(1).map(([x, y], i) => {
    const [px, py] = points[i] as readonly [number, number];
    return (y - py) / (x - px);
  });
  const tangents = points.map((_, i) => {
    const before = slopes[i - 1];
    const after = slopes[i];
    if (before === undefined) return after ?? 0;
    if (after === undefined) return before;
    // Flat at a peak or a dip, and never steeper than either side allows
    if (before * after <= 0) return 0;
    return (2 * before * after) / (before + after);
  });
  return points
    .map(([x, y], i) => {
      if (i === 0) return `M${x} ${y}`;
      const [px, py] = points[i - 1] as readonly [number, number];
      const third = (x - px) / 3;
      return `C${px + third} ${py + (tangents[i - 1] ?? 0) * third} ${x - third} ${
        y - (tangents[i] ?? 0) * third
      } ${x} ${y}`;
    })
    .join(" ");
}

/**
 * The days and the tick each player's curve was left with, kept while the app is open so the page
 * is as it was left when it is come back to from a game.
 */
const left = new Map<
  string,
  { from: string | undefined; to: string | undefined; withCharges: boolean }
>();

/** How the curve was left: the games it is narrowed to. The same for every player. */
interface CurveView {
  /** Missing for panda points, or the currency the player last played in */
  readonly currency?: Currency | undefined;
  readonly ratio?: string | undefined;
  readonly blinds?: string | undefined;
}

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

function parseCurveView(stored: unknown): CurveView | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { currency, ratio, blinds } = stored as Record<string, unknown>;
  return {
    currency: CURRENCIES.find((c) => c === currency),
    ratio: text(ratio),
    blinds: text(blinds),
  };
}

/**
 * The player's running result, game by game, from one day to another: from their first game to
 * now until other days are picked after the title. It is narrowed by currency, ratio and blinds
 * by itself, apart from the card over it. Over the curve what the stretch came to, and what it
 * came to after the charges paid in it, whose tick draws that as a second line. The axes are
 * marked with a few amounts and days, and the line ends in a dot at where the player stands. The
 * curve is drawn again from the left whenever its days or its games change.
 */
export function ResultCurve({
  playerId,
  summaries,
  today,
}: {
  playerId: string;
  /** Every settled game the player was in */
  summaries: readonly GameSummary[];
  today: string;
}) {
  const [view, setView] = useStoredState<CurveView>("player.curve", {}, parseCurveView);
  // A day picked, or missing for the first game and for now
  const [from, setFrom] = useState(() => left.get(playerId)?.from);
  const [to, setTo] = useState(() => left.get(playerId)?.to);
  const [picking, setPicking] = useState<"from" | "to">();
  const [withCharges, setWithCharges] = useState(() => left.get(playerId)?.withCharges ?? false);
  left.set(playerId, { from, to, withCharges });
  const fill = useId();

  // The currencies the player has games in, in the app's own order. Panda points come up first
  const currencies = CURRENCIES.filter((c) => summaries.some((s) => s.currency === c));
  const currency =
    view.currency && currencies.includes(view.currency)
      ? view.currency
      : (currencies.find((c) => c === "CNY") ?? currencies[0] ?? "CNY");
  // A ratio or blinds kept from before that the player's games do not have counts as no choice
  const offered = filterChoices(summaries, currency);
  const ratio = offered.ratios.find(({ value }) => value === view.ratio)?.value;
  const blinds = offered.blinds.find(({ value }) => value === view.blinds)?.value;
  const narrowed = summaries.filter(
    (s) =>
      s.currency === currency &&
      (!ratio || ratioKey(s) === ratio) &&
      (!blinds || blindsKey(s) === blinds),
  );
  const money: Money = (value, signed = false) =>
    formatGameMoney(value, currency, signed ? "exceptZero" : "auto");

  const points = playerCurve(playerReport(narrowed, playerId, currency).games);
  const earliest = points[0]?.summary.day ?? today;
  const start = points.findIndex(({ summary }) => summary.day >= (from ?? earliest));
  const shown =
    start < 0 ? [] : points.slice(start).filter(({ summary }) => summary.day <= (to ?? today));
  // The stretch starts from nothing: what was won before it is no part of it
  const before = start > 0 ? points[start - 1] : undefined;
  const end = shown.at(-1);
  const totals = [0, ...shown.map((point) => point.total - (before?.total ?? 0))];
  const afters = [0, ...shown.map((point) => point.afterCharges - (before?.afterCharges ?? 0))];
  const result = cents(totals.at(-1) ?? 0);
  const after = cents(afters.at(-1) ?? 0);

  // Drawn afresh for other days or other games, and the figures run to their new values
  const drawKey = [from, to, currency, ratio, blinds].join();
  const drawn = useEntered(drawKey);
  const resultShown = cents(Math.round(useCountUp(result, { duration: 700 })));
  const afterShown = cents(Math.round(useCountUp(after, { duration: 700 })));

  // Both lines have their room whether the second shows or not, so ticking it moves nothing
  const values = [...totals, ...afters];
  const ticks = axisTicks(Math.min(0, ...values), Math.max(0, ...values));
  const [low, high] = [ticks[0] ?? 0, ticks.at(-1) ?? 1];
  // In a box 100 wide and 100 tall, which the chart stretches to its own shape
  const x = (index: number) => (index / Math.max(1, totals.length - 1)) * 100;
  const y = (value: number) => ((high - value) / (high - low)) * 100;
  const line = (series: readonly number[]) =>
    smoothPath(series.map((value, i) => [x(i), y(value)] as const));
  const tone = toneOf(result) || "text-muted";
  const middle = shown[Math.floor((shown.length - 1) / 2)];
  const revealClass =
    "transition-[clip-path] ease-out motion-reduce:transition-none [clip-path:inset(-1rem_100%_-1rem_0)]";
  const revealed = "[clip-path:inset(-1rem_-1rem_-1rem_0)]";

  return (
    <section className="mt-3 rounded-2xl border border-line bg-surface px-4 pt-1 pb-3">
      <div className="flex items-center justify-between gap-2">
        {/* The title, then from which day to which: a tap on either opens the days to pick from */}
        <div className="flex min-w-0 items-center text-sm">
          <h2 className="shrink-0 text-muted">{t.players.playerPage.curve}</h2>
          <span className="mx-1.5 text-muted" aria-hidden>
            ·
          </span>
          <DayButton label={t.players.playerPage.rangeStart} onClick={() => setPicking("from")}>
            {dayName(from ?? earliest)}
          </DayButton>
          <span className="mx-1.5 text-muted">{t.players.playerPage.to}</span>
          <DayButton label={t.players.playerPage.rangeEnd} onClick={() => setPicking("to")}>
            {to ? dayName(to) : t.players.playerPage.now}
          </DayButton>
        </div>
        <IncomeFilter
          applied={{ currency, ratio, blinds }}
          currencies={currencies.length > 0 ? currencies : [currency]}
          games={summaries}
          onApply={(filter) => setView(filter)}
        />
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span
            className={cn("text-2xl font-semibold tracking-tight tabular-nums", toneOf(result))}
          >
            {money(
              resultShown === result ? result : cents(Math.round(resultShown / 100) * 100),
              true,
            )}
          </span>
          <span className="text-xs text-muted">{t.players.playerPage.games(shown.length)}</span>
        </p>
        {/* Always there. Its tick draws it as a second line */}
        <button
          type="button"
          aria-pressed={withCharges}
          aria-label={t.players.playerPage.showAfterCharges}
          onClick={() => setWithCharges(!withCharges)}
          className="flex min-h-11 shrink-0 items-center gap-2 text-sm"
        >
          <span className="text-xs text-muted">{t.players.playerPage.afterCharges}</span>
          <span className="text-highlight tabular-nums">
            {money(afterShown === after ? after : cents(Math.round(afterShown / 100) * 100), true)}
          </span>
          <span
            className={cn(
              "grid size-5 place-items-center rounded-md border transition-colors",
              withCharges ? "border-highlight bg-highlight text-accent-text" : "border-muted",
            )}
          >
            {withCharges && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
          </span>
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="grid h-36 place-items-center text-sm text-muted">
          {t.players.playerPage.noGames}
        </p>
      ) : (
        <div className="grid grid-cols-[3rem_1fr] grid-rows-[8rem_1.25rem] gap-x-1.5">
          {/* A few round amounts up the side */}
          <div className="relative text-[11px] text-muted tabular-nums" aria-hidden>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                style={{ top: `${y(tick)}%` }}
              >
                {money(cents(tick))}
              </span>
            ))}
          </div>
          <div className="relative">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              aria-hidden
            >
              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1="0"
                  x2="100"
                  y1={y(tick)}
                  y2={y(tick)}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1"
                  // The line of nothing won or lost stands out from the rest
                  className={tick === 0 ? "stroke-muted/70" : "stroke-line"}
                  strokeDasharray={tick === 0 ? undefined : "2 4"}
                />
              ))}
            </svg>
            {/* Made again for other days or games, so it is drawn from the left each time */}
            <div
              key={drawKey}
              className={cn("absolute inset-0 duration-1000", revealClass, drawn && revealed)}
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={t.players.playerPage.curve}
                className={cn("size-full overflow-visible", tone)}
              >
                <defs>
                  <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Shaded between the line and nothing won or lost */}
                <path d={`${line(totals)} L100 ${y(0)} L0 ${y(0)} Z`} fill={`url(#${fill})`} />
                <path
                  d={line(totals)}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="2"
                  strokeLinecap="round"
                  stroke="currentColor"
                />
              </svg>
              {/* Where the player stands at the end of the stretch */}
              <span
                className={cn(
                  "absolute right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-current",
                  tone,
                )}
                style={{ top: `${y(result)}%` }}
                aria-hidden
              />
            </div>
            {/* The line after charges is drawn in from the left when ticked, and back out again */}
            <div
              key={`${drawKey}charges`}
              className={cn(
                "absolute inset-0 duration-700",
                revealClass,
                withCharges && drawn && revealed,
              )}
              aria-hidden
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="size-full overflow-visible"
                aria-hidden
              >
                <path
                  d={line(afters)}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  className="stroke-highlight"
                />
              </svg>
              <span
                className="absolute right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-highlight"
                style={{ top: `${y(after)}%` }}
              />
            </div>
          </div>
          <span />
          {/* A few days along the foot: the first game, one in the middle and the last */}
          <div
            className="flex items-end justify-between text-[11px] text-muted tabular-nums"
            aria-hidden
          >
            <span>{shown[0] && shortDay(shown[0].summary.day)}</span>
            {shown.length > 2 && middle && <span>{shortDay(middle.summary.day)}</span>}
            {shown.length > 1 && end && <span>{shortDay(end.summary.day)}</span>}
          </div>
        </div>
      )}

      {picking && (
        <DayDialog
          title={
            picking === "from" ? t.players.playerPage.rangeStart : t.players.playerPage.rangeEnd
          }
          day={(picking === "from" ? from : to) ?? (picking === "from" ? earliest : today)}
          years={[parts(earliest)[0], parts(today)[0]]}
          // The stretch cannot end before it starts
          {...(picking === "from" ? { notAfter: to ?? today } : { notBefore: from ?? earliest })}
          reset={picking === "from" ? t.players.playerPage.earliest : t.players.playerPage.now}
          onPick={(day) => {
            if (picking === "from") setFrom(day);
            else setTo(day);
            setPicking(undefined);
          }}
          onClose={() => setPicking(undefined)}
        />
      )}
    </section>
  );
}

/** A day shown as text with a chevron, which opens the days to pick from. */
function DayButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${label}${t.common.colon}${children}`}
      onClick={onClick}
      className="flex min-h-11 items-center gap-1 font-medium"
    >
      {children}
      <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

const fieldClass =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-text outline-none focus:border-highlight";

/**
 * Picks a day: by year, month and day from lists, or typed as `2026-11-18`. The two follow each
 * other. A day that is not on the calendar, or on the wrong side of the other end of the stretch,
 * says so and cannot be confirmed.
 */
function DayDialog({
  title,
  day,
  years,
  notBefore,
  notAfter,
  reset,
  onPick,
  onClose,
}: {
  title: string;
  day: string;
  /** The first and the last year on offer */
  years: readonly [number, number];
  notBefore?: string;
  notAfter?: string;
  /** What the button that goes back to the day picked by itself says */
  reset: string;
  /** Called with nothing for the day picked by itself */
  onPick: (day: string | undefined) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState(day);
  const picked = parseTypedDay(typed);
  const [year, month, date] = parts(picked ?? day);
  const issue =
    picked === undefined
      ? t.players.playerPage.dayInvalid
      : notBefore !== undefined && picked < notBefore
        ? t.players.playerPage.dayBeforeStart
        : notAfter !== undefined && picked > notAfter
          ? t.players.playerPage.dayAfterEnd
          : undefined;
  // A list keeps the other two parts, with the day brought back inside a shorter month
  const choose = (y: number, m: number, d: number) =>
    setTyped(toDay(y, m, Math.min(d, daysIn(y, m))));
  const range = (first: number, last: number) =>
    Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label={t.players.playerPage.year}
          value={year}
          onChange={(event) => choose(Number(event.target.value), month, date)}
          className={fieldClass}
        >
          {range(Math.min(years[0], year), Math.max(years[1], year)).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label={t.players.playerPage.month}
          value={month}
          onChange={(event) => choose(year, Number(event.target.value), date)}
          className={fieldClass}
        >
          {range(1, 12).map((value) => (
            <option key={value} value={value}>
              {t.me.income.monthShort(value)}
            </option>
          ))}
        </select>
        <select
          aria-label={t.players.playerPage.date}
          value={date}
          onChange={(event) => choose(year, month, Number(event.target.value))}
          className={fieldClass}
        >
          {range(1, daysIn(year, month)).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={t.players.playerPage.typeDay}
        placeholder="2026-11-18"
        value={typed}
        aria-invalid={issue ? true : undefined}
        onFocus={(event) => event.target.select()}
        onChange={(event) => setTyped(event.target.value)}
        className={cn(fieldClass, "mt-2 tabular-nums aria-invalid:border-loss")}
      />
      {/* Its room is kept, so the buttons do not move as it comes and goes */}
      <p role="alert" className="min-h-6 pt-1 text-xs text-loss">
        {issue}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPick(undefined)}
          className="min-h-11 rounded-xl border border-line px-2 text-sm font-medium"
        >
          {reset}
        </button>
        <button
          type="button"
          disabled={issue !== undefined}
          onClick={() => onPick(picked)}
          className="min-h-11 rounded-xl bg-accent px-2 text-sm font-medium text-accent-text disabled:opacity-50"
        >
          {t.common.confirm}
        </button>
      </div>
    </Modal>
  );
}
