import { gameRecord, type LedgerEvent, type RecordKind } from "@holdem-knight/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

const RECORD_LABEL: Record<RecordKind, string> = {
  buy_in: "Buy-in",
  rebuy: "补码",
  reduce: "退回 Buy-in",
  remove: "移出",
  cash_out: "离桌",
  return: "回桌",
  stack_set: "改筹码",
  stack_undo: "撤销改筹码",
  insurance_buy: "买保险",
  insurance_hit: "保险命中",
  insurance_miss: "保险未中",
  insurance_undo: "撤销保险",
};

/** Long lists get a second collapse button at the bottom, so nobody has to scroll back up. */
const BOTTOM_CLOSE_FROM = 6;

const TIME = new Intl.DateTimeFormat("zh-CN", {
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
          牌局记录（{entries.length}）
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>
      {open && (
        <>
          <label className="block">
            <span className="sr-only">查看玩家</span>
            <select
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-sm"
            >
              <option value="">全部玩家</option>
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
              收起牌局记录
            </button>
          )}
        </>
      )}
    </section>
  );
}
