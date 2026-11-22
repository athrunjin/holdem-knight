import { gameRecord, type LedgerEvent, type RecordKind } from "@holdem-knight/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { localeTag, t } from "@/i18n";
import { cn } from "@/lib/cn";

const RECORD_LABEL: Record<RecordKind, string> = {
  buy_in: "Buy-in",
  rebuy: t.common.rebuy,
  reduce: t.game.ledgerLog.buyInReturned,
  remove: t.game.ledgerLog.removed,
  cash_out: t.game.ledgerLog.left,
  return: t.common.rejoined,
  stack_set: t.game.ledgerLog.chipsChanged,
  stack_undo: t.game.ledgerLog.chipChangeUndone,
  insurance_buy: t.game.ledgerLog.insuranceBought,
  insurance_hit: t.game.ledgerLog.insuranceHit,
  insurance_miss: t.game.ledgerLog.insuranceMissed,
  insurance_undo: t.game.ledgerLog.insuranceUndone,
  rake: t.common.rake,
  rake_undo: t.game.ledgerLog.rakeUndone,
};

/** Long lists get a second collapse button at the bottom, so nobody has to scroll back up. */
const BOTTOM_CLOSE_FROM = 6;

const TIME = new Intl.DateTimeFormat(localeTag, {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface LedgerLogProps {
  events: readonly LedgerEvent[];
  nameOf: (playerId: string) => string;
}

/**
 * Read-only game record, oldest first, with a filter for one player. Folded by default into one
 * quiet line, like the insurance records.
 */
export function LedgerLog({ events, nameOf }: LedgerLogProps) {
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const entries = gameRecord(events);
  const playerIds = [...new Set(entries.map((entry) => entry.playerId))];
  const shown = playerId ? entries.filter((entry) => entry.playerId === playerId) : entries;

  return (
    <section className="mt-2 border-t border-line pb-8">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center gap-1 text-sm text-muted"
        >
          {t.game.ledgerLog.gameLog}
          {entries.length})
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>
      {open && (
        <>
          <label className="block">
            <span className="sr-only">{t.game.ledgerLog.showAPlayer}</span>
            <select
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-sm"
            >
              <option value="">{t.game.ledgerLog.allPlayers}</option>
              {playerIds.map((id) => (
                <option key={id} value={id}>
                  {nameOf(id)}
                </option>
              ))}
            </select>
          </label>
          <ul className="mt-1 max-h-[40dvh] divide-y divide-line overflow-y-auto overscroll-contain text-sm">
            {shown.map((entry) => (
              <li key={entry.id} className="flex min-h-8 items-center gap-2 py-0.5">
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {TIME.format(entry.occurredAt)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {!playerId && `${nameOf(entry.playerId)} `}
                  {RECORD_LABEL[entry.kind]}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {entry.chips.toLocaleString("zh-CN")}
                </span>
              </li>
            ))}
          </ul>
          {shown.length >= BOTTOM_CLOSE_FROM && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-11 w-full items-center justify-center text-xs text-highlight"
            >
              {t.game.ledgerLog.collapseTheGameLog}
            </button>
          )}
        </>
      )}
    </section>
  );
}
