import {
  type Cents,
  type ChipRatio,
  type Currency,
  cents,
  chipsToCents,
  INSURANCE_PLAYER_ID,
  type PlayerLedger,
} from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { Calculator, ChevronRight, LogOut } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { formatClock, type PlayerDetail } from "./PlayerDetails";
import { ColumnTitles, columnsClass, labelClass, TotalChip } from "./ResultCards";

const actionClass = "min-h-11 shrink-0 rounded-lg border border-line px-2 text-sm font-medium";
const listClass = "divide-y divide-line rounded-xl border border-line bg-surface px-2";
const rowClass = "flex min-h-13 items-center gap-1.5 py-1";
/** A card as on the settlement page: a tinted row of figures, then any lines under it. */
const cardClass = "overflow-hidden rounded-xl border border-line bg-surface text-sm";
const headClass = cn(columnsClass, "min-h-11 w-full bg-accent/15 px-2 text-left");
/** Tappable figures keep a 44px target, wider than the Buy-in column they sit in. */
const cellButtonClass = "min-h-11 tabular-nums";

interface LedgerPlayersProps {
  gameId: string;
  /** Named as on the settlement page */
  organizerName: string;
  players: readonly PlayerLedger[];
  nameOf: (playerId: string) => string;
  /** Chips per hand. Missing on older games, which record chips. */
  handChips: number | undefined;
  ratio: ChipRatio;
  currency: Currency;
  /** Actions are hidden once the game is settled */
  editable: boolean;
  onEditHands: (playerId: string) => void;
  onEditStack: (playerId: string) => void;
  onRebuy: (playerId: string) => void;
  onReturn: (playerId: string) => void;
  onLeave: (playerId: string) => void;
  /** Shown at the foot of the seated players */
  addPlayer: ReactNode;
  /** Whether the seated players' cards are open on their time and charges */
  detailMode: boolean;
  onDetailModeChange: (on: boolean) => void;
  /** Each player's time and charges so far. Missing when the game charges nothing. */
  details: ReadonlyMap<string, PlayerDetail> | undefined;
}

/** A line under a card's row: a label across four columns and an amount. */
function Line({ label, amount, tone }: { label: string; amount?: ReactNode; tone?: string }) {
  return (
    <div className={cn(columnsClass, "min-h-7 text-xs")}>
      <span className={labelClass}>
        <span className="size-4 shrink-0" aria-hidden />
        <span className={cn("truncate", tone ?? "text-muted")}>{label}</span>
      </span>
      {amount !== undefined && (
        <span className={cn("text-right whitespace-nowrap", tone ?? "text-muted")}>{amount}</span>
      )}
    </div>
  );
}

function TotalLine({ total, currency }: { total: Cents; currency: Currency }) {
  return (
    <div className={cn(columnsClass, "min-h-11 border-t border-accent")}>
      <span className={cn(labelClass, "font-semibold")}>合计</span>
      <span className="text-right whitespace-nowrap">
        <TotalChip total={total} currency={currency} />
      </span>
    </div>
  );
}

export function LedgerPlayers({
  gameId,
  organizerName,
  players,
  nameOf,
  handChips,
  ratio,
  currency,
  editable,
  onEditHands,
  onEditStack,
  onRebuy,
  onReturn,
  onLeave,
  addPlayer,
  detailMode,
  onDetailModeChange,
  details,
}: LedgerPlayersProps) {
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const seat = players.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const people = players.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const seated = people.filter((p) => p.seated);
  const left = people.filter((p) => !p.seated);
  const money = (chips: number) => formatGameMoney(chipsToCents(chips, ratio), currency);
  const amount = (value: Cents) =>
    formatGameAmount(value, currency, value === 0 ? "auto" : "exceptZero");

  const allDetails = details ? [...details.values()] : [];
  const charges = allDetails[0];
  const tableFees = cents(allDetails.reduce((total, d) => total + (d.tableFee ?? 0), 0));
  const wages = cents(allDetails.reduce((total, d) => total + (d.wage ?? 0), 0));
  const insurance = seat && chipsToCents(seat.netChips, ratio);
  const organizerTotal = cents((insurance ?? 0) + tableFees + wages);
  const showOrganizer =
    seat !== undefined || charges?.tableFee !== undefined || charges?.wage !== undefined;

  function hands(player: PlayerLedger) {
    const { playerId, boughtChips } = player;
    if (handChips === undefined) {
      return editable ? (
        <button
          type="button"
          onClick={() => onRebuy(playerId)}
          className={cn(cellButtonClass, "-mx-0.5 text-xs text-highlight")}
        >
          补码
        </button>
      ) : (
        <span className="text-center text-muted">—</span>
      );
    }
    const count = boughtChips / handChips;
    if (!editable) return <span className="text-center">{count}</span>;
    return (
      <button
        type="button"
        aria-label={`输入${nameOf(playerId)}的手数，现在 ${count} 手`}
        onClick={() => onEditHands(playerId)}
        className={cn(cellButtonClass, "-mx-0.5")}
      >
        {count}
      </button>
    );
  }

  function stack({ playerId, stackChips }: PlayerLedger) {
    const chips = stackChips.toLocaleString("zh-CN");
    if (!editable) return <span className="text-right">{chips}</span>;
    return (
      <button
        type="button"
        aria-label={`输入${nameOf(playerId)}的筹码，现在 ${stackChips}`}
        onClick={() => onEditStack(playerId)}
        className={cn(cellButtonClass, "text-right")}
      >
        {chips}
      </button>
    );
  }

  function net(netChips: number) {
    return (
      <span className={cn("text-right", netColor(netChips))}>{formatSignedChips(netChips)}</span>
    );
  }

  function playerCard(player: PlayerLedger) {
    const { playerId, netChips } = player;
    const name = nameOf(playerId);
    const cash = chipsToCents(netChips, ratio);
    const detail = details?.get(playerId);
    const total = detail?.net ?? cash;
    const open = detailMode && detail !== undefined;

    return (
      <section key={playerId} aria-label={name} className={cardClass}>
        <div className={headClass}>
          {editable ? (
            <button
              type="button"
              aria-label={`${name}离桌`}
              onClick={() => onLeave(playerId)}
              className="flex min-h-11 min-w-0 items-center text-left font-medium"
            >
              <LogOut className="-ml-1 mr-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <span className="truncate">{name}</span>
            </button>
          ) : (
            <span className="truncate font-medium">{name}</span>
          )}
          {hands(player)}
          {stack(player)}
          {net(netChips)}
          <span className="text-right whitespace-nowrap">
            {open ? (
              <span className={netColor(cash)}>{amount(cash)}</span>
            ) : (
              <TotalChip total={total} currency={currency} />
            )}
          </span>
        </div>
        {open && (
          <div className="px-2">
            <Line label={`在局 ${formatClock(detail.seatedMs)}`} />
            {detail.tableFee !== undefined &&
              (detail.tableFeeShortMs > 0 ? (
                <Line
                  label={`台费 未满 差 ${Math.ceil(detail.tableFeeShortMs / 60_000)} 分`}
                  amount="—"
                />
              ) : (
                <Line label="台费" amount={amount(cents(-detail.tableFee))} />
              ))}
            {detail.wage !== undefined && (
              <Line label="工资" amount={amount(cents(-detail.wage))} />
            )}
            <TotalLine total={total} currency={currency} />
          </div>
        )}
      </section>
    );
  }

  /**
   * What the organizer has so far, folded to one row and a summary like the settlement page:
   * the insurance seat with its chips, and the table fees and wages charged so far.
   */
  function organizerCard() {
    const summary = [
      insurance !== undefined && ["保险", insurance, "text-highlight"],
      charges?.wage !== undefined && ["工资", wages, "text-muted"],
      charges?.tableFee !== undefined && ["台费", tableFees, "text-muted"],
    ].filter((item): item is [string, Cents, string] => item !== false);

    return (
      <section aria-label="组织者" className={cardClass}>
        <button
          type="button"
          aria-expanded={organizerOpen}
          onClick={() => setOrganizerOpen(!organizerOpen)}
          className={headClass}
        >
          <span className="flex min-w-0 items-center font-medium">
            <ChevronRight
              className={cn(
                "-ml-1 size-4 shrink-0 text-muted transition-transform",
                organizerOpen && "rotate-90",
              )}
              aria-hidden
            />
            <span className="truncate">{organizerName}</span>
          </span>
          <span className="text-center text-muted">—</span>
          <span className="text-right text-muted">—</span>
          <span className="text-right text-muted">—</span>
          <span className="text-right whitespace-nowrap">
            <TotalChip total={organizerTotal} currency={currency} />
          </span>
        </button>
        {!organizerOpen && (
          <p className="flex flex-wrap justify-end gap-x-3 px-2 pt-0.5 pb-1.5 text-xs whitespace-nowrap tabular-nums">
            {summary.map(([label, value, tone]) => (
              <span key={label} className={tone}>
                {label} {amount(value)}
              </span>
            ))}
          </p>
        )}
        {organizerOpen && (
          <div className="px-2">
            {seat && insurance !== undefined && (
              <div className={cn(columnsClass, "min-h-11 text-xs")}>
                <Link
                  to="/games/$gameId/insurance"
                  params={{ gameId }}
                  aria-label="算保险"
                  className="flex min-h-11 min-w-0 items-center gap-0.5 text-highlight"
                >
                  <Calculator className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">保险</span>
                </Link>
                {seat.seated ? hands(seat) : <span className="text-center text-muted">—</span>}
                {seat.seated ? stack(seat) : <span className="text-right text-muted">—</span>}
                {net(seat.netChips)}
                <span className="text-right whitespace-nowrap text-highlight">
                  {amount(insurance)}
                </span>
              </div>
            )}
            {charges?.wage !== undefined && <Line label="工资（至今）" amount={amount(wages)} />}
            {charges?.tableFee !== undefined && (
              <Line label="台费（至今）" amount={amount(tableFees)} />
            )}
            <TotalLine total={organizerTotal} currency={currency} />
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {showOrganizer && (
        <div className="mt-3 flex flex-col gap-2">
          <ColumnTitles first="组织者" />
          {organizerCard()}
        </div>
      )}

      {(seated.length > 0 || addPlayer) && (
        <section aria-label="桌上玩家" className="mt-3 flex flex-col gap-2">
          <div className="-mb-2 flex min-h-11 items-center justify-between gap-2">
            <h2 className="font-semibold">桌上玩家（{seated.length}）</h2>
            {seated.length > 0 && details && (
              <MiniSwitch label="明细" checked={detailMode} onChange={onDetailModeChange} />
            )}
          </div>
          {seated.length > 0 && <ColumnTitles first="玩家" />}
          {seated.map(playerCard)}
          {addPlayer && (
            <div className="rounded-xl border border-dashed border-line">{addPlayer}</div>
          )}
        </section>
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
