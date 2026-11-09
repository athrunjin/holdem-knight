import {
  type ChipRatio,
  type Currency,
  chipsToCents,
  INSURANCE_PLAYER_ID,
  type PlayerLedger,
} from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { type PlayerDetail, PlayerDetailGrid } from "./PlayerDetails";

const actionClass = "min-h-11 shrink-0 rounded-lg border border-line px-2 text-sm font-medium";
/** The tap target stays 44px; the small circle drawn inside it sits against the count. */
const stepClass = "flex size-11 shrink-0 items-center disabled:opacity-40";
const stepIconClass = "grid size-6 place-items-center rounded-full border border-line text-muted";
const listClass = "divide-y divide-line rounded-xl border border-line bg-surface px-2";
const rowClass = "flex min-h-13 items-center gap-1.5 py-1";
/** Shared by the column titles and the rows under them, so they line up. */
const columnsClass = "grid grid-cols-[minmax(0,1fr)_4.5rem_8.25rem_3rem] items-center";
const tableRowClass = `${columnsClass} min-h-13 py-1`;
const tableActionClass = "min-h-11 rounded-lg border border-line text-sm font-medium";

interface LedgerPlayersProps {
  gameId: string;
  players: readonly PlayerLedger[];
  nameOf: (playerId: string) => string;
  /** Chips per hand. Missing on older games, which record chips. */
  handChips: number | undefined;
  ratio: ChipRatio;
  currency: Currency;
  /** Actions are hidden once the game is settled */
  editable: boolean;
  onStepHands: (playerId: string, by: number) => void;
  onEditHands: (playerId: string) => void;
  onEditStack: (playerId: string) => void;
  onRebuy: (playerId: string) => void;
  /** Players who can be removed at 1 hand, because they were added by mistake */
  removableIds: ReadonlySet<string>;
  onRemove: (playerId: string) => void;
  onReturn: (playerId: string) => void;
  onLeave: (playerId: string) => void;
  /** Shown at the foot of the seated players */
  addPlayer: ReactNode;
  /** Whether detail mode is on, which shows `details` under each seated player */
  detailMode: boolean;
  onDetailModeChange: (on: boolean) => void;
  details: ReadonlyMap<string, PlayerDetail> | undefined;
}

export function LedgerPlayers({
  gameId,
  players,
  nameOf,
  handChips,
  ratio,
  currency,
  editable,
  onStepHands,
  onEditHands,
  onEditStack,
  onRebuy,
  removableIds,
  onRemove,
  onReturn,
  onLeave,
  addPlayer,
  detailMode,
  onDetailModeChange,
  details,
}: LedgerPlayersProps) {
  const seat = players.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const people = players.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const seated = people.filter((p) => p.seated);
  const left = people.filter((p) => !p.seated);
  const money = (chips: number) => formatGameMoney(chipsToCents(chips, ratio), currency);

  function stack({ playerId, stackChips }: PlayerLedger) {
    const chips = stackChips.toLocaleString("zh-CN");
    // Seven digits at the full size would overflow the column
    const size = stackChips < 1_000_000 ? "text-lg" : "text-sm";
    return editable ? (
      <button
        type="button"
        aria-label={`输入${nameOf(playerId)}的筹码，现在 ${stackChips}`}
        onClick={() => onEditStack(playerId)}
        className={`min-h-11 rounded-lg font-semibold tabular-nums ${size}`}
      >
        {chips}
      </button>
    ) : (
      <span className={`text-center font-semibold tabular-nums ${size}`}>{chips}</span>
    );
  }

  function hands({ playerId, boughtChips }: PlayerLedger) {
    if (handChips === undefined) {
      return (
        editable && (
          <button type="button" onClick={() => onRebuy(playerId)} className={actionClass}>
            补码
          </button>
        )
      );
    }
    const count = boughtChips / handChips;
    if (!editable) return <span className="text-center font-semibold">{count} 手</span>;
    const name = nameOf(playerId);
    const removable = count <= 1 && removableIds.has(playerId);
    return (
      <div className="flex items-center justify-center">
        <button
          type="button"
          aria-label={removable ? `${name}移出这局` : `${name}减 1 手`}
          disabled={count <= 1 && !removable}
          onClick={() => (removable ? onRemove(playerId) : onStepHands(playerId, -1))}
          className={`${stepClass} justify-end`}
        >
          <span className={stepIconClass}>
            <Minus className="size-3" aria-hidden />
          </span>
        </button>
        <button
          type="button"
          aria-label={`输入${name}的手数，现在 ${count} 手`}
          onClick={() => onEditHands(playerId)}
          className="min-h-11 min-w-11 font-semibold tabular-nums"
        >
          {count}
        </button>
        <button
          type="button"
          aria-label={`${name}加 1 手`}
          onClick={() => onStepHands(playerId, 1)}
          className={`${stepClass} justify-start`}
        >
          <span className={stepIconClass}>
            <Plus className="size-3" aria-hidden />
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {(seated.length > 0 || addPlayer) && (
        <section aria-label="桌上玩家" className="mt-3 rounded-xl border border-line bg-surface">
          <div className="rounded-t-xl bg-accent/10 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">桌上玩家（{seated.length}）</h2>
              {seated.length > 0 && (
                <MiniSwitch
                  label="详细模式"
                  checked={detailMode}
                  onChange={onDetailModeChange}
                  className="-my-3"
                />
              )}
            </div>
            {seated.length > 0 && (
              <div className={`${columnsClass} mt-1 text-xs text-muted`}>
                <span>玩家</span>
                <span className="text-center">筹码</span>
                <span className="text-center">{handChips !== undefined && "手数"}</span>
              </div>
            )}
          </div>
          {seated.length > 0 && (
            <ul className="divide-y divide-line px-2">
              {seated.map((player) => (
                <li key={player.playerId} className={tableRowClass}>
                  <div className="min-w-0 pr-1">
                    <p className="truncate font-medium">{nameOf(player.playerId)}</p>
                    <p className={`truncate text-xs tabular-nums ${netColor(player.netChips)}`}>
                      {formatSignedChips(player.netChips)}
                    </p>
                  </div>
                  {stack(player)}
                  {hands(player)}
                  {editable && (
                    <button
                      type="button"
                      aria-label={`${nameOf(player.playerId)}离桌`}
                      onClick={() => onLeave(player.playerId)}
                      className={tableActionClass}
                    >
                      离桌
                    </button>
                  )}
                  {details && (
                    <PlayerDetailGrid detail={details.get(player.playerId)} currency={currency} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {addPlayer && (
            <div className={cn(seated.length > 0 && "border-t border-line")}>{addPlayer}</div>
          )}
        </section>
      )}

      {seat && (
        <ul aria-label="保险" className={`mt-2 ${listClass} border-highlight`}>
          <li className={tableRowClass}>
            <div className="min-w-0 pr-1">
              <p className="truncate font-medium text-highlight">{nameOf(seat.playerId)}</p>
              <p className={`truncate text-xs tabular-nums ${netColor(seat.netChips)}`}>
                {formatSignedChips(seat.netChips)}
              </p>
            </div>
            {seat.seated && stack(seat)}
            {seat.seated && hands(seat)}
            <Link
              to="/games/$gameId/insurance"
              params={{ gameId }}
              className={`${tableActionClass} col-start-4 inline-flex items-center justify-center`}
            >
              算保险
            </Link>
          </li>
        </ul>
      )}

      {left.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-1 text-sm font-medium text-muted">已离桌（{left.length}）</h2>
          <ul className={`${listClass} border-dashed bg-transparent`}>
            {left.map(({ playerId, boughtChips, cashedOutChips, netChips }) => (
              <li key={playerId} className={`${rowClass} text-muted`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{nameOf(playerId)}</p>
                  <p className="truncate text-xs">
                    买入 {money(boughtChips)} · 离桌 {money(cashedOutChips)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${netColor(netChips)}`}
                >
                  {formatSignedChips(netChips)}
                </span>
                {editable && (
                  <button
                    type="button"
                    aria-label={`${nameOf(playerId)}返回牌桌`}
                    onClick={() => onReturn(playerId)}
                    className={actionClass}
                  >
                    返回
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
