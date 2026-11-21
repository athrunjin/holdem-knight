import {
  formatOdds,
  handResult,
  type InsuranceHand,
  type InsuranceRecord,
  type InsuranceStatus,
} from "@holdem-knight/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { t } from "@/i18n";
import { formatCardText } from "@/lib/cards";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";

const STATUS_TEXT: Record<InsuranceStatus, string> = {
  pending: t.insurance.insuranceRecords.pending,
  hit: t.insurance.insuranceRecords.hit,
  miss: t.insurance.insuranceRecords.missed,
};

const STREET_TEXT = { turn: t.common.turn, river: t.common.river } as const;

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

/** The cards a purchase was on: how many overtake, or how many split the pot. */
const outsText = (count: number, tie: boolean | undefined) =>
  tie ? t.insurance.insuranceRecords.tieOn(count) : `${count} outs`;

/** Changing the records. Missing once the game is closed. */
export interface RecordActions {
  readonly busy: boolean;
  onSettle: (record: InsuranceRecord, hit: boolean) => void;
  onUndo: (record: InsuranceRecord) => void;
  onUndoHand: (hand: InsuranceHand) => void;
}

interface InsuranceRecordsProps {
  /** Finished hands, oldest first. */
  hands: readonly InsuranceHand[];
  /** Purchases sold on their own, newest first. */
  records: readonly InsuranceRecord[];
  nameOf: (playerId: string) => string;
  actions: RecordActions | undefined;
}

function HandRecord({
  hand,
  number,
  nameOf,
  actions,
}: {
  hand: InsuranceHand;
  number: number;
  nameOf: (playerId: string) => string;
  actions: RecordActions | undefined;
}) {
  const { seatChips } = handResult(hand);
  return (
    <li>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate font-medium">
            {t.insurance.insuranceRecords.hand(
              number,
              hand.players.map((p) => nameOf(p.playerId)).join(" / "),
            )}
          </span>
          <span className="shrink-0 text-highlight tabular-nums">
            {hand.purchases.length === 0
              ? t.insurance.insuranceRecords.notInsured
              : formatSignedChips(seatChips)}
          </span>
        </summary>
        <p className="text-sm text-muted">
          {t.insurance.insuranceRecords.board(hand.board.map(formatCardText).join(" "))}
        </p>
        <ul className="pb-2">
          {hand.purchases.map((purchase) => (
            <li key={purchase.id} className="mt-1 text-sm tabular-nums">
              <span className="font-medium">
                {nameOf(purchase.playerId)} · {STREET_TEXT[purchase.street]} ·{" "}
                {purchase.hit
                  ? t.insurance.insuranceRecords.hit
                  : t.insurance.insuranceRecords.missed}
              </span>
              <span className="block text-muted">
                {t.insurance.insuranceRecords.paysPremiumPayout(
                  outsText(purchase.outs.length, purchase.tie),
                  " ",
                  formatOdds(purchase.oddsHundredths),
                  chipText(purchase.premiumChips),
                  chipText(purchase.payoutChips),
                )}
              </span>
            </li>
          ))}
        </ul>
        {actions && (
          <button
            type="button"
            disabled={actions.busy}
            onClick={() => actions.onUndoHand(hand)}
            className="mb-2 min-h-11 rounded-lg px-3 text-sm text-muted disabled:opacity-60"
          >
            {t.insurance.insuranceRecords.undoThisHand}
          </button>
        )}
      </details>
    </li>
  );
}

function PurchaseRecord({
  record,
  nameOf,
  actions,
}: {
  record: InsuranceRecord;
  nameOf: (playerId: string) => string;
  actions: RecordActions | undefined;
}) {
  const { purchase, status } = record;
  return (
    <li className="py-2 text-sm">
      <p className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">
          {nameOf(purchase.playerId)} · {STREET_TEXT[purchase.street]}
        </span>
        <span className="shrink-0 text-highlight">{STATUS_TEXT[status]}</span>
      </p>
      <p className="text-muted tabular-nums">
        {t.insurance.insuranceRecords.paysPremiumPayout2(
          outsText(purchase.outs, purchase.tie),
          formatOdds(purchase.oddsHundredths),
          " ",
          chipText(purchase.chips),
          chipText(purchase.payoutChips),
        )}
      </p>
      {actions && (
        <div className="mt-1 flex gap-2">
          {status === "pending" && (
            <>
              <button
                type="button"
                disabled={actions.busy}
                onClick={() => actions.onSettle(record, true)}
                className="min-h-11 flex-1 rounded-lg border border-accent font-medium disabled:opacity-60"
              >
                {t.insurance.insuranceRecords.hit}
              </button>
              <button
                type="button"
                disabled={actions.busy}
                onClick={() => actions.onSettle(record, false)}
                className="min-h-11 flex-1 rounded-lg border border-line font-medium disabled:opacity-60"
              >
                {t.insurance.insuranceRecords.missed}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={actions.busy}
            onClick={() => actions.onUndo(record)}
            className="min-h-11 rounded-lg px-3 text-sm text-muted disabled:opacity-60"
          >
            {t.insurance.insuranceRecords.undo}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * The game's insurance so far, folded into one line pinned to the foot of the screen. It opens
 * upwards over the page, which keeps the line's height clear at its end.
 */
export function InsuranceRecords({ hands, records, nameOf, actions }: InsuranceRecordsProps) {
  const [open, setOpen] = useState(false);
  const count = hands.length + records.length;
  // The line stays folded, so it says when a result is still owed
  const pending = records.filter(({ status }) => status === "pending").length;

  return (
    <section className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] border-t border-line bg-bg/95 backdrop-blur md:bottom-0 md:left-24">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <h2>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex min-h-11 w-full items-center gap-1 text-sm text-muted"
          >
            {t.insurance.insuranceRecords.insuranceLog}
            {count}
            {t.common.closeParen}
            {pending > 0 && (
              <span className="text-highlight">
                {t.insurance.insuranceRecords.pending2(pending)}
              </span>
            )}
            <ChevronDown
              className={cn("size-4 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        </h2>
        {open && count === 0 && (
          <p className="pb-3 text-sm text-muted">
            {t.insurance.insuranceRecords.noInsuranceRecordedInThisGame}
          </p>
        )}
        {open && count > 0 && (
          <ul className="max-h-[40dvh] divide-y divide-line overflow-y-auto overscroll-contain pb-2">
            {hands.toReversed().map((hand) => (
              <HandRecord
                key={hand.id}
                hand={hand}
                number={hands.indexOf(hand) + 1}
                nameOf={nameOf}
                actions={actions}
              />
            ))}
            {records.map((record) => (
              <PurchaseRecord
                key={record.purchase.id}
                record={record}
                nameOf={nameOf}
                actions={actions}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
