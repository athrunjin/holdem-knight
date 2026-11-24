import {
  type Cents,
  CURRENCIES,
  type Currency,
  cents,
  daysBetween,
  type Game,
  type GameSummary,
  type PartyTransfers,
  PERIOD_CHOICES,
  type PeriodChoice,
  type Player,
  periodOf,
  type TransferLine,
  type TransferReport,
  transferReport,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { DoneButton } from "@/components/game/Transfers";
import { InfoButton } from "@/components/InfoButton";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import { useGames } from "@/data/games";
import { usePlayers } from "@/data/players";
import { useGameSummaries, useMarkTransfers } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { dayOf } from "@/lib/game-day";
import { leaveList, useListReturn } from "@/lib/list-return";
import { QuietMotion, useCountUp, usePlaysIn } from "@/lib/motion";
import { periodName } from "@/lib/period-names";
import { gameNameOf } from "@/lib/player-name";
import { useStoredState } from "@/lib/stored-state";

export const Route = createFileRoute("/me_/transfers")({
  component: TransfersPage,
});

const cardClass = "rounded-2xl border border-line bg-surface";

/** A transfer still to make after this many days has its date in red. */
const LATE_DAYS = 7;

const CURRENCY_NAMES: Record<Currency, string> = {
  CNY: t.gamePages.list.panda,
  AUD: t.gamePages.list.kangaroo,
};

/**
 * The people whose transfers are unfolded, kept while the app is open so the page is as it was
 * left when it is come back to from a game.
 */
const opened = new Set<string>();

/** What the page shows, as it was left. */
interface View {
  /** The transfers made, or the ones still to make */
  readonly done: boolean;
  /** Narrows the transfers made to the games of a period. The ones to make are never narrowed */
  readonly period: PeriodChoice;
  /** Missing for the currency of the newest game */
  readonly currency?: Currency | undefined;
}

function parseView(stored: unknown): View | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { done, period, currency } = stored as Record<string, unknown>;
  const kept = PERIOD_CHOICES.find((choice) => choice === period);
  if (typeof done !== "boolean" || !kept) return undefined;
  return { done, period: kept, currency: CURRENCIES.find((c) => c === currency) };
}

function dayName(day: string) {
  const [, month = 1, date = 1] = day.split("-").map(Number);
  return t.me.income.day(month, date);
}

const linesOf = (report: TransferReport) =>
  report.parties.reduce((all, { lines }) => all + lines.length, 0) + report.between.length;

function TransfersPage() {
  const { data: summaries, isError, refetch } = useGameSummaries();
  const { data: games } = useGames();
  const { data: players } = usePlayers();

  return (
    <Page
      title={t.me.transfers.title}
      titleNote={
        <InfoButton title={t.me.transfers.title} small>
          <p className="text-sm text-muted">{t.me.transfers.explain}</p>
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
          <p className="text-sm">{t.me.transfers.unread}</p>
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
        <section className={cn(cardClass, "min-h-28")} />
      ) : summaries.length === 0 ? (
        <p className={cn(cardClass, "p-5 text-sm text-muted")}>{t.me.transfers.noneYet}</p>
      ) : (
        <Transfers summaries={summaries} games={games ?? []} players={players ?? []} />
      )}
    </Page>
  );
}

type Money = (value: Cents) => string;

/** How long a line takes to leave once its tick is confirmed, in milliseconds */
const LEAVE_MS = 350;

const keyOf = (line: TransferLine) => `${line.gameId}|${line.from}|${line.to}`;

/**
 * Ticks that are not saved yet. A tick only marks a line; the button that comes out under it
 * confirms, and the lines then leave before they are saved.
 */
interface Draft {
  readonly ticked: ReadonlySet<string>;
  /** Confirmed and on their way out */
  readonly leaving: ReadonlySet<string>;
  readonly onToggle: (line: TransferLine) => void;
  /** Confirms the ticked ones among these lines */
  readonly onConfirm: (lines: readonly TransferLine[]) => void;
}

/** What leaves: it closes up and moves off to the right as it fades. */
const leaveClass = (leaving: boolean) =>
  cn(
    "grid transition-[grid-template-rows,opacity,translate] ease-in motion-reduce:transition-none",
    leaving ? "translate-x-8 grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
  );
const leaveStyle = { transitionDuration: `${LEAVE_MS}ms` };

function Transfers({
  summaries,
  games,
  players,
}: {
  summaries: readonly GameSummary[];
  games: readonly Game[];
  players: readonly Player[];
}) {
  const today = dayOf(Date.now());
  // Come back to from a game, the page is where it was left and nothing plays in again
  const returning = useListReturn("/me/transfers");
  const [view, setView] = useStoredState<View>(
    "transfers.view",
    { done: false, period: "thisMonth" },
    parseView,
  );
  const [betweenOpen, setBetweenOpen] = useState(false);
  const markTransfers = useMarkTransfers();

  // The currencies there are games in, in the app's own order. The newest game's comes up first
  const currencies = CURRENCIES.filter((c) => summaries.some((s) => s.currency === c));
  const newest = summaries.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
  const currency =
    view.currency && currencies.includes(view.currency) ? view.currency : newest.currency;
  const { done, period } = view;

  const open = transferReport(summaries, { currency, done: false });
  const madeIn = (choice: PeriodChoice) =>
    transferReport(summaries, { currency, done: true }, periodOf(choice, today));
  const made = madeIn(period);
  const report = done ? made : open;

  const money: Money = (value) => formatGameMoney(value, currency);
  const nameOf = gameNameOf(players, newest);
  const playKey = [done, period, currency].join();

  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const without = (keys: readonly string[]) => (all: ReadonlySet<string>) =>
    new Set([...all].filter((key) => !keys.includes(key)));

  // Saved to each game the lines belong to, as that game's settlement page would save it
  const save = (lines: readonly TransferLine[]) => {
    for (const gameId of new Set(lines.map((line) => line.gameId))) {
      const game = games.find(({ id }) => id === gameId);
      const summary = summaries.find(({ id }) => id === gameId);
      const own = lines.filter((line) => line.gameId === gameId);
      // Whether saved or not, the lines are read again by then and stand where they belong
      const settle = () => setLeaving(without(own.map(keyOf)));
      if (!game || !summary) settle();
      else
        markTransfers.mutate({ game, summary, transfers: own, done: !done }, { onSettled: settle });
    }
  };

  const draft: Draft = {
    ticked,
    leaving,
    onToggle: (line) =>
      setTicked((all) => {
        const next = new Set(all);
        if (!next.delete(keyOf(line))) next.add(keyOf(line));
        return next;
      }),
    onConfirm: (lines) => {
      const chosen = lines.filter((line) => ticked.has(keyOf(line)));
      if (chosen.length === 0) return;
      const keys = chosen.map(keyOf);
      setLeaving((all) => new Set([...all, ...keys]));
      // Saved once they have left, so nothing jumps under a finger
      window.setTimeout(() => {
        setTicked(without(keys));
        save(chosen);
      }, LEAVE_MS);
    },
  };

  return (
    <QuietMotion value={returning}>
      <div className="pb-8">
        <section className={cn(cardClass, "px-4 pt-1 pb-3")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center text-sm">
              {/* Each with the number of transfers behind it */}
              <TextMenu
                label={t.me.transfers.status}
                options={[
                  { value: "open", label: `${t.me.transfers.open} (${linesOf(open)})` },
                  { value: "made", label: `${t.me.transfers.made} (${linesOf(made)})` },
                ]}
                value={done ? "made" : "open"}
                onChange={(value) => setView({ ...view, currency, done: value === "made" })}
                className="font-medium"
              />
              {done && (
                <>
                  <span className="mx-1.5 text-muted" aria-hidden>
                    ·
                  </span>
                  <TextMenu
                    label={t.me.income.period}
                    options={PERIOD_CHOICES.map((choice) => ({
                      value: choice,
                      label: `${periodName(choice, today)} (${
                        choice === period ? linesOf(made) : linesOf(madeIn(choice))
                      })`,
                    }))}
                    value={period}
                    onChange={(choice) => setView({ ...view, currency, period: choice })}
                    className="font-medium"
                  />
                </>
              )}
            </div>
            {currencies.length > 1 && (
              <TextMenu
                label={t.me.income.currency}
                options={currencies.map((c) => ({
                  value: c,
                  name: CURRENCY_NAMES[c],
                  label: <CurrencyIcon currency={c} className="size-5" />,
                }))}
                value={currency}
                onChange={(c) => setView({ ...view, currency: c })}
                align="right"
              />
            )}
          </div>
          <Totals report={report} done={done} money={money} playKey={playKey} />
        </section>

        {report.parties.length === 0 && report.between.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted">
            {done ? t.me.transfers.noneMade : t.me.transfers.noneOpen}
          </p>
        ) : (
          <ul className="mt-3">
            {report.parties.map((party, index) => (
              <PartyRow
                key={party.partyId + playKey}
                party={party}
                name={nameOf(party.partyId)}
                done={done}
                today={today}
                index={index}
                playKey={playKey}
                money={money}
                draft={draft}
                disabled={markTransfers.isPending}
              />
            ))}
          </ul>
        )}

        {/* The organizer is no part of these, so they are kept out of the way and of the totals */}
        {report.between.length > 0 && (
          <section className="mt-5">
            <button
              type="button"
              aria-expanded={betweenOpen}
              onClick={() => setBetweenOpen(!betweenOpen)}
              className="flex min-h-11 w-full items-center justify-between gap-2 pl-1 font-medium"
            >
              <span>
                {t.me.transfers.between}
                <span className="ml-2 text-sm font-normal text-muted tabular-nums">
                  {t.me.transfers.betweenCount(report.between.length)}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-5 text-muted transition-transform duration-300",
                  betweenOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <Fold open={betweenOpen}>
              <div className="rounded-xl border border-line bg-surface">
                <ul className="px-4">
                  {report.between.map((line) => (
                    <Line
                      key={keyOf(line)}
                      line={line}
                      who={t.me.transfers.pays(nameOf(line.from), nameOf(line.to))}
                      between
                      today={today}
                      money={money}
                      draft={draft}
                      disabled={markTransfers.isPending}
                    />
                  ))}
                </ul>
                <Confirm lines={report.between} done={done} draft={draft} />
              </div>
            </Fold>
          </section>
        )}
      </div>
    </QuietMotion>
  );
}

/**
 * What is to come in, as the page's one large figure, and what is to go out under it: or, for the
 * transfers made, what came in and what went out.
 */
function Totals({
  report,
  done,
  money,
  playKey,
}: {
  report: TransferReport;
  done: boolean;
  money: Money;
  playKey: string;
}) {
  const { toOrganizer, fromOrganizer, parties } = report;
  const count = { duration: 800, resetKey: playKey };
  const shown = useCountUp(toOrganizer, count);
  const paying = parties.filter((party) => party.fromOrganizer > 0).length;
  const owing = parties.filter((party) => party.toOrganizer > 0).length;
  // Whole amounts on the way, and the cents only of the amount arrived at
  const figure = shown === toOrganizer ? toOrganizer : cents(Math.round(shown / 100) * 100);

  return (
    <>
      <p className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">{money(figure)}</span>
        <span className="text-sm text-muted">
          {done ? t.me.transfers.received : t.me.transfers.toCome}
          {owing > 0 && ` · ${t.me.transfers.people(owing)}`}
        </span>
      </p>
      <p className="mt-1 flex min-h-8 items-center gap-2 text-sm">
        <span className="text-muted">{done ? t.me.transfers.paid : t.me.transfers.toPay}</span>
        <span className="tabular-nums">{money(fromOrganizer)}</span>
        {paying > 0 && <span className="text-muted">· {t.me.transfers.people(paying)}</span>}
      </p>
    </>
  );
}

/** Opens downward from what is over it and closes back up, whatever is inside. */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** Comes out from under the lines once one of them is ticked, and confirms the ticked ones. */
function Confirm({
  lines,
  done,
  draft,
}: {
  lines: readonly TransferLine[];
  done: boolean;
  draft: Draft;
}) {
  const chosen = lines.filter(
    (line) => draft.ticked.has(keyOf(line)) && !draft.leaving.has(keyOf(line)),
  ).length;
  // The number it had stays while it goes back in
  const [last, setLast] = useState(1);
  if (chosen > 0 && chosen !== last) setLast(chosen);

  return (
    <Fold open={chosen > 0}>
      <button
        type="button"
        onClick={() => draft.onConfirm(lines)}
        className="flex min-h-11 w-full items-center justify-center border-t border-line text-sm font-medium text-highlight"
      >
        {done ? t.me.transfers.confirmUndone(last) : t.me.transfers.confirmDone(last)}
      </button>
    </Fold>
  );
}

/**
 * Everything with one person: who, how many games and since when, and the balance. With one
 * transfer its tick is on the row itself. With more, a tap opens each transfer under it. Once
 * every line of theirs is confirmed, the whole row leaves.
 */
function PartyRow({
  party,
  name,
  done,
  today,
  index,
  playKey,
  money,
  draft,
  disabled,
}: {
  party: PartyTransfers;
  name: string;
  done: boolean;
  today: string;
  /** Where it is in the list, for the order rows arrive in */
  index: number;
  playKey: string;
  money: Money;
  draft: Draft;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(() => opened.has(party.partyId));
  const toggle = () => {
    if (open) opened.delete(party.partyId);
    else opened.add(party.partyId);
    setOpen(!open);
  };
  const playsIn = usePlaysIn(playKey);
  const { net, games, oldestDay, lines } = party;
  const late = !done && daysBetween(oldestDay, today) > LATE_DAYS;
  const only = lines.length === 1 ? lines[0] : undefined;
  const gone = lines.every((line) => draft.leaving.has(keyOf(line)));

  const who = (
    <>
      <span className="block truncate font-medium">{name}</span>
      <span className="block truncate text-xs text-muted tabular-nums">
        {only ? (
          <>
            <span className={cn(late && "text-loss")}>{dayName(only.day)}</span>
            {` · ${only.smallBlindChips} / ${only.bigBlindChips}`}
            {only.doneAt !== undefined &&
              ` · ${t.me.transfers.markedOn(dayName(dayOf(only.doneAt)))}`}
          </>
        ) : (
          <>
            {t.me.transfers.partyGames(games)}
            {!done && (
              <>
                {" · "}
                <span className={cn(late && "text-loss")}>
                  {t.me.transfers.oldest(dayName(oldestDay))}
                </span>
              </>
            )}
          </>
        )}
      </span>
    </>
  );
  // The balance: gold while it is still to come in
  const balance = (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-xs text-muted">
        {net === 0
          ? t.me.transfers.even
          : net > 0
            ? done
              ? t.me.transfers.received
              : t.me.transfers.toCome
            : done
              ? t.me.transfers.paid
              : t.me.transfers.toPay}
      </span>
      {net !== 0 && (
        <span className={cn("font-medium tabular-nums", net > 0 && !done && "text-highlight")}>
          {money(cents(Math.abs(net)))}
        </span>
      )}
    </span>
  );

  return (
    <li
      className={cn(playsIn && "animate-settle")}
      // The first rows come one after another; past them the list is simply there
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* Leaving is on a box of its own: the arrival above would hold the row's opacity */}
      <div className={leaveClass(gone)} style={leaveStyle}>
        <div className="min-h-0 overflow-hidden">
          <div className="mb-2 rounded-xl border border-line bg-surface">
            {only ? (
              <div className="flex min-h-14 items-center gap-3 px-4">
                <Link
                  to="/games/$gameId/settlement"
                  params={{ gameId: only.gameId }}
                  search={{ from: "transfers" }}
                  aria-label={t.me.transfers.openSettlement(dayName(only.day))}
                  // The page is come back to where it was left
                  onClick={leaveList}
                  className="flex min-h-14 min-w-0 flex-1 flex-col justify-center"
                >
                  {who}
                </Link>
                {balance}
                <DoneButton
                  label={t.me.transfers.markLine(name, money(only.amount))}
                  done={only.done !== draft.ticked.has(keyOf(only))}
                  disabled={disabled}
                  onClick={() => draft.onToggle(only)}
                />
              </div>
            ) : (
              <button
                type="button"
                aria-expanded={open}
                aria-label={t.me.transfers.showParty(name)}
                onClick={toggle}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left"
              >
                <span className="min-w-0 flex-1">{who}</span>
                {balance}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted transition-transform duration-300",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            )}
            {only ? (
              <Confirm lines={lines} done={done} draft={draft} />
            ) : (
              <Fold open={open}>
                <ul className="border-t border-line px-4">
                  {lines.map((line) => (
                    <Line
                      key={keyOf(line)}
                      line={line}
                      who={name}
                      // The organizer's own payments are said to be theirs
                      note={line.to === party.partyId ? t.me.transfers.iPay : undefined}
                      today={today}
                      money={money}
                      draft={draft}
                      disabled={disabled}
                    />
                  ))}
                </ul>
                <Confirm lines={lines} done={done} draft={draft} />
              </Fold>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * One transfer: its game's day and blinds, which lead to the settlement page, then the amount and
 * the tick. One made says when it was marked, where that was kept. Confirmed, it leaves.
 */
function Line({
  line,
  who,
  note,
  between = false,
  today,
  money,
  draft,
  disabled,
}: {
  line: TransferLine;
  /** Who it is with, for a reader and for a line between players */
  who: string;
  /** Before the amount, such as that the organizer is the one paying */
  note?: string | undefined;
  /** The organizer is no part of it: who pays whom is written under the day */
  between?: boolean;
  today: string;
  money: Money;
  draft: Draft;
  disabled: boolean;
}) {
  const day = dayName(line.day);
  const late = !line.done && daysBetween(line.day, today) > LATE_DAYS;

  return (
    <li className={leaveClass(draft.leaving.has(keyOf(line)))} style={leaveStyle}>
      <div className="min-h-0 overflow-hidden">
        <div className="flex min-h-11 items-center gap-2 text-sm">
          <Link
            to="/games/$gameId/settlement"
            params={{ gameId: line.gameId }}
            search={{ from: "transfers" }}
            aria-label={t.me.transfers.openSettlement(day)}
            // The page is come back to where it was left
            onClick={leaveList}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
          >
            <span className="truncate tabular-nums">
              <span className={cn(late && "text-loss")}>{day}</span>
              <span className="ml-2 text-muted">
                {line.smallBlindChips} / {line.bigBlindChips}
              </span>
            </span>
            {(between || line.doneAt !== undefined) && (
              <span className="truncate text-xs text-muted">
                {between && who}
                {between && line.doneAt !== undefined && " · "}
                {line.doneAt !== undefined && t.me.transfers.markedOn(dayName(dayOf(line.doneAt)))}
              </span>
            )}
          </Link>
          {note && <span className="shrink-0 text-xs text-muted">{note}</span>}
          <span
            className={cn(
              "shrink-0 tabular-nums",
              !line.done && note === undefined && !between && "text-highlight",
            )}
          >
            {money(line.amount)}
          </span>
          <DoneButton
            label={t.me.transfers.markLine(who, money(line.amount))}
            done={line.done !== draft.ticked.has(keyOf(line))}
            disabled={disabled}
            onClick={() => draft.onToggle(line)}
          />
        </div>
      </div>
    </li>
  );
}
