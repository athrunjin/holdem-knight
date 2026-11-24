import {
  type Cents,
  CURRENCIES,
  type Currency,
  cents,
  daysBetween,
  type Game,
  type GameSummary,
  ORGANIZER_COLLECTOR,
  type PartyTransfers,
  PERIOD_CHOICES,
  type PeriodChoice,
  type Player,
  periodOf,
  type TransferLine,
  type TransferReport,
  type TransferState,
  transferReport,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ReceiptText } from "lucide-react";
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

/** How long a line takes to leave once what is to become of it is confirmed, in milliseconds */
const LEAVE_MS = 350;

const keyOf = (line: TransferLine) => `${line.gameId}|${line.from}|${line.to}`;

/**
 * Ticks that are not saved yet. A tick only picks a line out; the buttons that come out under it
 * say what becomes of the ticked lines, which then leave before they are saved.
 */
interface Draft {
  readonly ticked: ReadonlySet<string>;
  /** Confirmed and on their way out */
  readonly leaving: ReadonlySet<string>;
  readonly onToggle: (line: TransferLine) => void;
  /** Moves the ticked ones among these lines to another state */
  readonly onConfirm: (lines: readonly TransferLine[], to: TransferState) => void;
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
  const [badOpen, setBadOpen] = useState(false);
  const markTransfers = useMarkTransfers();

  // The currencies there are games in, in the app's own order. The newest game's comes up first
  const currencies = CURRENCIES.filter((c) => summaries.some((s) => s.currency === c));
  const newest = summaries.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
  const currency =
    view.currency && currencies.includes(view.currency) ? view.currency : newest.currency;
  const { done, period } = view;
  const state: TransferState = done ? "done" : "open";

  const open = transferReport(summaries, { currency, state: "open" });
  const madeIn = (choice: PeriodChoice) =>
    transferReport(summaries, { currency, state: "done" }, periodOf(choice, today));
  const made = madeIn(period);
  const report = done ? made : open;
  // Set down as not coming in for now: under everything else, folded, and in no total above
  const bad = transferReport(summaries, { currency, state: "bad" });

  const money: Money = (value) => formatGameMoney(value, currency);
  const nameOf = gameNameOf(players, newest);
  const playKey = [done, period, currency].join();

  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const without = (keys: readonly string[]) => (all: ReadonlySet<string>) =>
    new Set([...all].filter((key) => !keys.includes(key)));

  // Saved to each game the lines belong to, as that game's settlement page would save it
  const save = (lines: readonly TransferLine[], to: TransferState) => {
    for (const gameId of new Set(lines.map((line) => line.gameId))) {
      const game = games.find(({ id }) => id === gameId);
      const summary = summaries.find(({ id }) => id === gameId);
      const own = lines.filter((line) => line.gameId === gameId);
      // Whether saved or not, the lines are read again by then and stand where they belong
      const settle = () => setLeaving(without(own.map(keyOf)));
      if (!game || !summary) settle();
      else markTransfers.mutate({ game, summary, transfers: own, to }, { onSettled: settle });
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
    onConfirm: (lines, to) => {
      const chosen = lines.filter((line) => ticked.has(keyOf(line)));
      if (chosen.length === 0) return;
      const keys = chosen.map(keyOf);
      setLeaving((all) => new Set([...all, ...keys]));
      // Saved once they have left, so nothing jumps under a finger
      window.setTimeout(() => {
        setTicked(without(keys));
        save(chosen, to);
      }, LEAVE_MS);
    },
  };
  const disabled = markTransfers.isPending;

  const partyRows = (parties: readonly PartyTransfers[], of: TransferState) =>
    parties.map((party, index) => (
      <PartyRow
        key={party.partyId + of + playKey}
        party={party}
        name={nameOf(party.partyId)}
        state={of}
        today={today}
        index={index}
        playKey={playKey}
        money={money}
        draft={draft}
        disabled={disabled}
      />
    ));

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
          <ul className="mt-3">{partyRows(report.parties, state)}</ul>
        )}

        {/* The organizer is no part of these, so they are kept out of the way and of the totals */}
        {report.between.length > 0 && (
          <FoldedSection
            title={t.me.transfers.between}
            note={t.me.transfers.betweenCount(report.between.length)}
            open={betweenOpen}
            onToggle={() => setBetweenOpen(!betweenOpen)}
          >
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
                    disabled={disabled}
                  />
                ))}
              </ul>
              <Confirm lines={report.between} state={state} draft={draft} />
            </div>
          </FoldedSection>
        )}

        {/* Last on the page, under the transfers still to make */}
        {!done && bad.parties.length > 0 && (
          <FoldedSection
            title={t.common.badDebt}
            note={`${t.me.transfers.betweenCount(linesOf(bad))} · ${money(bad.toOrganizer)}`}
            tone="loss"
            open={badOpen}
            onToggle={() => setBadOpen(!badOpen)}
          >
            <ul>{partyRows(bad.parties, "bad")}</ul>
          </FoldedSection>
        )}
      </div>
    </QuietMotion>
  );
}

/** A group kept folded under the list: its name and what is in it, and a chevron that opens it. */
function FoldedSection({
  title,
  note,
  tone,
  open,
  onToggle,
  children,
}: {
  title: string;
  note: string;
  tone?: "loss";
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-2 pl-1 font-medium"
      >
        <span className={cn(tone === "loss" && "text-loss")}>
          {title}
          <span className="ml-2 text-sm font-normal text-muted tabular-nums">{note}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 text-muted transition-transform duration-300",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <Fold open={open}>{children}</Fold>
    </section>
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

const confirmButton = "min-h-11 rounded-xl px-2 text-sm font-medium";

/**
 * Comes out from under the lines once one of them is ticked: at the right, in green, what the
 * ticked lines are confirmed as; at the left, the other thing that can become of them. Among
 * transfers still to make that is a bad debt, in red, and only while every ticked one is owed to
 * the organizer: a payment of the organizer's own is never one.
 */
function Confirm({
  lines,
  state,
  draft,
}: {
  lines: readonly TransferLine[];
  state: TransferState;
  draft: Draft;
}) {
  const chosen = lines.filter(
    (line) => draft.ticked.has(keyOf(line)) && !draft.leaving.has(keyOf(line)),
  );
  // What it showed stays while it goes back in, with nothing ticked any more
  const now = {
    count: chosen.length,
    owed: chosen.every((line) => line.to === ORGANIZER_COLLECTOR),
  };
  const [shown, setShown] = useState(now);
  if (now.count > 0 && (now.count !== shown.count || now.owed !== shown.owed)) setShown(now);
  const { count: last, owed } = now.count > 0 ? now : shown;

  return (
    <Fold open={chosen.length > 0}>
      <div className="grid grid-cols-2 gap-2 border-t border-line p-2">
        {state === "open" && owed && (
          <button
            type="button"
            onClick={() => draft.onConfirm(lines, "bad")}
            className={cn(confirmButton, "bg-loss/15 text-loss")}
          >
            {t.me.transfers.markBad(last)}
          </button>
        )}
        {state === "bad" && (
          <button
            type="button"
            onClick={() => draft.onConfirm(lines, "open")}
            className={cn(confirmButton, "border border-line")}
          >
            {t.me.transfers.confirmUndone(last)}
          </button>
        )}
        <button
          type="button"
          onClick={() => draft.onConfirm(lines, state === "done" ? "open" : "done")}
          className={cn(
            confirmButton,
            "col-start-2",
            state === "done" ? "border border-line" : "bg-accent text-accent-text",
          )}
        >
          {state === "done" ? t.me.transfers.confirmUndone(last) : t.me.transfers.confirmDone(last)}
        </button>
      </div>
    </Fold>
  );
}

/** After a game's blinds: leads to its settlement page, opened on its transfers. */
function RecordLink({ line }: { line: TransferLine }) {
  return (
    <Link
      to="/games/$gameId/settlement"
      params={{ gameId: line.gameId }}
      search={{ from: "transfers" }}
      aria-label={t.me.transfers.openSettlement(dayName(line.day))}
      // The page is come back to where it was left
      onClick={leaveList}
      // The icon takes its own small room in the line, and the tap target reaching past it is 44px
      className="relative ml-2 size-4 shrink-0 text-muted after:absolute after:-inset-3.5"
    >
      <ReceiptText className="size-4" strokeWidth={1.75} aria-hidden />
    </Link>
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
  state,
  today,
  index,
  playKey,
  money,
  draft,
  disabled,
}: {
  party: PartyTransfers;
  name: string;
  state: TransferState;
  today: string;
  /** Where it is in the list, for the order rows arrive in */
  index: number;
  playKey: string;
  money: Money;
  draft: Draft;
  disabled: boolean;
}) {
  const openKey = `${state}|${party.partyId}`;
  const [open, setOpen] = useState(() => opened.has(openKey));
  const toggle = () => {
    if (open) opened.delete(openKey);
    else opened.add(openKey);
    setOpen(!open);
  };
  const playsIn = usePlaysIn(playKey);
  const { net, games, oldestDay, lines } = party;
  const late = state === "open" && daysBetween(oldestDay, today) > LATE_DAYS;
  const only = lines.length === 1 ? lines[0] : undefined;
  const gone = lines.every((line) => draft.leaving.has(keyOf(line)));

  const who = (
    <>
      <span className="block truncate font-medium">{name}</span>
      {/* Not clipped: the icon's tap target reaches past the line */}
      <span className="flex items-center text-xs whitespace-nowrap text-muted tabular-nums">
        {only ? (
          <>
            <span className={cn(late && "text-loss")}>{dayName(only.day)}</span>
            {` · ${only.smallBlindChips} / ${only.bigBlindChips}`}
            <RecordLink line={only} />
            {only.doneAt !== undefined && (
              <span className="ml-2">{t.me.transfers.markedOn(dayName(dayOf(only.doneAt)))}</span>
            )}
            {only.badAt !== undefined && (
              <span className="ml-2">{t.me.transfers.markedBadOn(dayName(dayOf(only.badAt)))}</span>
            )}
          </>
        ) : (
          <>
            {t.me.transfers.partyGames(games)}
            {state === "open" && (
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
  // The balance: gold while it is still to come in, red once it is a bad debt
  const balance = (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-xs text-muted">
        {state === "bad"
          ? t.common.badDebt
          : net === 0
            ? t.me.transfers.even
            : net > 0
              ? state === "done"
                ? t.me.transfers.received
                : t.me.transfers.toCome
              : state === "done"
                ? t.me.transfers.paid
                : t.me.transfers.toPay}
      </span>
      {net !== 0 && (
        <span
          className={cn(
            "font-medium tabular-nums",
            state === "bad" ? "text-loss" : net > 0 && state === "open" && "text-highlight",
          )}
        >
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
                <span className="min-w-0 flex-1">{who}</span>
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
              <Confirm lines={lines} state={state} draft={draft} />
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
                <Confirm lines={lines} state={state} draft={draft} />
              </Fold>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * One transfer: its game's day and blinds, with an icon after them that leads to the settlement
 * page, then the amount and the tick. Nothing else on the line leads anywhere. One made or set
 * down as a bad debt says when, where that was kept. Confirmed, it leaves.
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
  const late = !line.done && !line.bad && daysBetween(line.day, today) > LATE_DAYS;
  const when =
    line.doneAt !== undefined
      ? t.me.transfers.markedOn(dayName(dayOf(line.doneAt)))
      : line.badAt !== undefined
        ? t.me.transfers.markedBadOn(dayName(dayOf(line.badAt)))
        : undefined;

  return (
    <li className={leaveClass(draft.leaving.has(keyOf(line)))} style={leaveStyle}>
      <div className="min-h-0 overflow-hidden">
        <div className="flex min-h-11 items-center gap-2 text-sm">
          <span className="flex min-w-0 flex-1 flex-col justify-center">
            {/* Not clipped: the icon's tap target reaches past the line */}
            <span className="flex items-center whitespace-nowrap tabular-nums">
              <span className={cn(late && "text-loss")}>{dayName(line.day)}</span>
              <span className="ml-2 text-muted">
                {line.smallBlindChips} / {line.bigBlindChips}
              </span>
              <RecordLink line={line} />
            </span>
            {(between || when !== undefined) && (
              <span className="truncate text-xs text-muted">
                {between && who}
                {between && when !== undefined && " · "}
                {when}
              </span>
            )}
          </span>
          {note && <span className="shrink-0 text-xs text-muted">{note}</span>}
          <span
            className={cn(
              "shrink-0 tabular-nums",
              line.bad
                ? "text-loss"
                : !line.done && note === undefined && !between && "text-highlight",
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
