/** Transfers across settled games, read from their summaries (ADR 0049). */
import type { Currency, GameSummary, SummaryTransfer } from "../domain";
import { type Cents, cents, sum } from "../money";
import { ORGANIZER_COLLECTOR } from "../settlement";
import { inPeriod, type Period } from "./income";

/** One transfer of a game's plan, with enough of the game to list it by. */
export interface TransferLine extends SummaryTransfer {
  readonly gameId: string;
  /** The day the game started, as `2026-11-21`. */
  readonly day: string;
  readonly startedAt: number;
  readonly smallBlindChips: number;
  readonly bigBlindChips: number;
}

/** Everything between the organizer and one other party, over the lines counted. */
export interface PartyTransfers {
  /** A player's ID, or a seat's. Never the organizer's. */
  readonly partyId: string;
  /** What they pay the organizer, and what the organizer pays them. */
  readonly toOrganizer: Cents;
  readonly fromOrganizer: Cents;
  /** What they pay less what they are paid: more than 0 when the organizer is owed on balance. */
  readonly net: Cents;
  /** How many games the lines are from. */
  readonly games: number;
  /** The day of the oldest game among them. */
  readonly oldestDay: string;
  /** Newest game first. */
  readonly lines: readonly TransferLine[];
}

export interface TransferReport {
  readonly toOrganizer: Cents;
  readonly fromOrganizer: Cents;
  /** Whoever the organizer is owed most by first, then whoever has waited longest. */
  readonly parties: readonly PartyTransfers[];
  /** Transfers the organizer is no part of, newest game first. In neither total. */
  readonly between: readonly TransferLine[];
}

/** Where a transfer stands: still to make, made, or set down as a bad debt. */
export type TransferState = "open" | "done" | "bad";

export const transferState = ({ done, bad }: SummaryTransfer): TransferState =>
  done ? "done" : bad ? "bad" : "open";

export interface TransferView {
  /** Amounts in different currencies are never added together. */
  readonly currency: Currency;
  readonly state: TransferState;
}

const newestFirst = (a: TransferLine, b: TransferLine) => b.startedAt - a.startedAt;

/**
 * The transfers of settled games in one currency and one state, by who they are with.
 * A period counts the games that started in it; without one every game counts, as a transfer
 * still to make does not lapse.
 */
export function transferReport(
  summaries: readonly GameSummary[],
  { currency, state }: TransferView,
  period: Period = {},
): TransferReport {
  const lines: TransferLine[] = summaries
    .filter((summary) => summary.currency === currency && inPeriod(period, summary.day))
    .flatMap(({ id, day, startedAt, smallBlindChips, bigBlindChips, transfers }) =>
      transfers
        .filter((transfer) => transferState(transfer) === state)
        .map((transfer) => ({
          ...transfer,
          gameId: id,
          day,
          startedAt,
          smallBlindChips,
          bigBlindChips,
        })),
    )
    .toSorted(newestFirst);

  const withOrganizer = (line: TransferLine) =>
    line.from === ORGANIZER_COLLECTOR || line.to === ORGANIZER_COLLECTOR;
  const byParty = new Map<string, TransferLine[]>();
  for (const line of lines.filter(withOrganizer)) {
    const partyId = line.from === ORGANIZER_COLLECTOR ? line.to : line.from;
    byParty.set(partyId, [...(byParty.get(partyId) ?? []), line]);
  }

  const parties = [...byParty].map(([partyId, own]): PartyTransfers => {
    const toOrganizer = sum(own.filter((l) => l.to === ORGANIZER_COLLECTOR).map((l) => l.amount));
    const fromOrganizer = sum(
      own.filter((l) => l.from === ORGANIZER_COLLECTOR).map((l) => l.amount),
    );
    return {
      partyId,
      toOrganizer,
      fromOrganizer,
      net: cents(toOrganizer - fromOrganizer),
      games: new Set(own.map((l) => l.gameId)).size,
      oldestDay: own.map((l) => l.day).toSorted()[0] ?? "",
      lines: own,
    };
  });

  return {
    toOrganizer: sum(parties.map((party) => party.toOrganizer)),
    fromOrganizer: sum(parties.map((party) => party.fromOrganizer)),
    parties: parties.toSorted(
      (a, b) =>
        b.net - a.net ||
        a.oldestDay.localeCompare(b.oldestDay) ||
        a.partyId.localeCompare(b.partyId),
    ),
    between: lines.filter((line) => !withOrganizer(line)),
  };
}

/** Whole days from one day to a later one, by the calendar alone. */
export function daysBetween(from: string, to: string): number {
  const at = (day: string) => {
    const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}
