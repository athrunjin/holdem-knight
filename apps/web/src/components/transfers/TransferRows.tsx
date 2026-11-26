import {
  type Cents,
  cents,
  daysBetween,
  type Game,
  type GameSummary,
  ORGANIZER_COLLECTOR,
  type PartyTransfers,
  type TransferLine,
  type TransferState,
} from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ReceiptText } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { DoneButton } from "@/components/game/Transfers";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { useMarkTransfers } from "@/data/summaries";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { dayOf } from "@/lib/game-day";
import { leaveList } from "@/lib/list-return";
import { usePlaysIn } from "@/lib/motion";

/**
 * Where a line's icon leads back to from the settlement page: the page of transfers, or the
 * page of the player whose transfers these are.
 */
export const TransferBack = createContext<
  { readonly from: "transfers" } | { readonly from: "player"; readonly player: string }
>({ from: "transfers" });

/** A transfer still to make after this many days has its date in red. */
const LATE_DAYS = 7;

/**
 * The people whose transfers are unfolded, kept while the app is open so the page is as it was
 * left when it is come back to from a game.
 */
const opened = new Set<string>();

export function dayName(day: string) {
  const [, month = 1, date = 1] = day.split("-").map(Number);
  return t.me.income.day(month, date);
}

export type Money = (value: Cents) => string;

/** How long a line takes to leave once what is to become of it is confirmed, in milliseconds */
export const LEAVE_MS = 350;

export const keyOf = (line: TransferLine) => `${line.gameId}|${line.from}|${line.to}`;

/**
 * Ticks that are not saved yet. A tick only picks a line out; the buttons that come out under it
 * say what becomes of the ticked lines, which then leave before they are saved.
 */
export interface Draft {
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

/**
 * The ticks of a page of transfers, and what becomes of them: nothing is saved until a tick is
 * confirmed, and the confirmed lines are given time to leave first. Saved to each game the lines
 * belong to, as that game's settlement page would save it.
 */
export function useTransferDraft(games: readonly Game[], summaries: readonly GameSummary[]) {
  const markTransfers = useMarkTransfers();
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
  return { draft, disabled };
}

/** A group kept folded under the list: its name and what is in it, and a chevron that opens it. */
export function FoldedSection({
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

/** Opens downward from what is over it and closes back up, whatever is inside. */
export function Fold({ open, children }: { open: boolean; children: ReactNode }) {
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
export function Confirm({
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
  const back = useContext(TransferBack);
  return (
    <Link
      to="/games/$gameId/settlement"
      params={{ gameId: line.gameId }}
      // Opened at its transfers, and leading back to the page this line is on
      search={{ ...back, open: "transfers" }}
      aria-label={t.me.transfers.openSettlement(dayName(line.day))}
      // The page is come back to where it was left
      onClick={leaveList}
      // The icon takes its own small room in the line, and the tap target reaching past it is 44px
      className="relative ml-2 size-4 shrink-0 text-highlight after:absolute after:-inset-3.5"
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
export function PartyRow({
  party,
  name,
  number,
  isPlayer,
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
  /** The record's number, where another player of the library has the same name */
  number?: string | undefined;
  /** In the player library, so the avatar leads to their page */
  isPlayer: boolean;
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
  const label = number === undefined ? name : `${name} ${number}`;

  const who = (
    <>
      {/* The name gives way before the number does */}
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate font-medium">{name}</span>
        {number !== undefined && (
          <span className="shrink-0 text-xs text-muted tabular-nums">{number}</span>
        )}
      </span>
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
  // A tap on the avatar opens the player's page (ADR 0043)
  const avatar = isPlayer && (
    <Link
      to="/players/$playerId"
      params={{ playerId: party.partyId }}
      aria-label={label}
      onClick={leaveList}
      // 44px to tap, drawn in at the sides so the row keeps its spacing
      className="-mx-1.5 -my-1.5 grid size-11 shrink-0 place-items-center"
    >
      <PlayerAvatar id={party.partyId} name={name} size="sm" />
    </Link>
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
                {avatar}
                <span className="min-w-0 flex-1">{who}</span>
                {balance}
                <DoneButton
                  label={t.me.transfers.markLine(label, money(only.amount))}
                  done={only.done !== draft.ticked.has(keyOf(only))}
                  disabled={disabled}
                  onClick={() => draft.onToggle(only)}
                />
              </div>
            ) : (
              // The avatar is beside the button, not in it: it leads elsewhere
              <div className="flex items-center gap-3 pl-4">
                {avatar}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={t.me.transfers.showParty(label)}
                  onClick={toggle}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pr-4 text-left"
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
              </div>
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
                      who={label}
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
export function Line({
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
