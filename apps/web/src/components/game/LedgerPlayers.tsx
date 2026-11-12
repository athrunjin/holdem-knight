import {
  type Cents,
  type ChipRatio,
  type Currency,
  cents,
  chipsToCents,
  INSURANCE_PLAYER_ID,
  ORGANIZER_PLAYER_ID,
  type PlayerLedger,
} from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { Calculator, ChevronDown, ChevronRight, LogOut } from "lucide-react";
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
  /** Whether the game has insurance, which always shows its seat */
  insuranceOn: boolean;
  /** Which charges the game has, so their lines show before anyone has sat down */
  charged: { readonly tableFee: boolean; readonly wage: boolean };
  onEditHands: (playerId: string) => void;
  onEditStack: (playerId: string) => void;
  onRebuy: (playerId: string) => void;
  /** A first buy-in for the organizer, or for an insurance seat the game is missing */
  onJoin: (playerId: string) => void;
  onReturn: (playerId: string) => void;
  /** Everyone who left comes back, after the organizer confirms */
  onReturnAll: () => void;
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
  insuranceOn,
  charged,
  onEditHands,
  onEditStack,
  onRebuy,
  onJoin,
  onReturn,
  onReturnAll,
  onLeave,
  addPlayer,
  detailMode,
  onDetailModeChange,
  details,
}: LedgerPlayersProps) {
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const seat = players.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  // An organizer who plays stays in the organizer's card, never among the players
  const host = players.find((p) => p.playerId === ORGANIZER_PLAYER_ID);
  const people = players.filter(
    (p) => p.playerId !== INSURANCE_PLAYER_ID && p.playerId !== ORGANIZER_PLAYER_ID,
  );
  const seated = people.filter((p) => p.seated);
  const left = people.filter((p) => !p.seated);
  const money = (chips: number) => formatGameMoney(chipsToCents(chips, ratio), currency);
  const amount = (value: Cents) =>
    formatGameAmount(value, currency, value === 0 ? "auto" : "exceptZero");

  const allDetails = details ? [...details.values()] : [];
  const tableFees = cents(allDetails.reduce((total, d) => total + (d.tableFee ?? 0), 0));
  const wages = cents(allDetails.reduce((total, d) => total + (d.wage ?? 0), 0));
  const insurance = seat && chipsToCents(seat.netChips, ratio);
  const ownCash = host && chipsToCents(host.netChips, ratio);
  const organizerTotal = cents((ownCash ?? 0) + (insurance ?? 0) + tableFees + wages);
  const showInsurance = seat !== undefined || insuranceOn;
  const showOrganizer =
    editable || host !== undefined || showInsurance || charged.tableFee || charged.wage;
  const dash = (align: string) => <span className={cn(align, "text-muted")}>—</span>;

  /** A first buy-in, for the organizer or a missing insurance seat. */
  function join(playerId: string, label: string) {
    if (!editable) return dash("text-center");
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => onJoin(playerId)}
        className={cn(cellButtonClass, "-mx-0.5 text-highlight")}
      >
        +
      </button>
    );
  }

  function hands(player: PlayerLedger) {
    const { playerId, boughtChips, seated: atTable } = player;
    if (handChips === undefined) {
      return editable && atTable ? (
        <button
          type="button"
          onClick={() => onRebuy(playerId)}
          className={cn(cellButtonClass, "-mx-0.5 text-xs text-highlight")}
        >
          补码
        </button>
      ) : (
        dash("text-center")
      );
    }
    const count = boughtChips / handChips;
    if (!editable || !atTable) return <span className="text-center">{count}</span>;
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

  /** The stack at the table, or what a player who left cashed out. */
  function stack({ playerId, stackChips, cashedOutChips, seated: atTable }: PlayerLedger) {
    if (!editable || !atTable) {
      const chips = atTable ? stackChips : cashedOutChips;
      return <span className="text-right">{chips.toLocaleString("zh-CN")}</span>;
    }
    return (
      <button
        type="button"
        aria-label={`输入${nameOf(playerId)}的筹码，现在 ${stackChips}`}
        onClick={() => onEditStack(playerId)}
        className={cn(cellButtonClass, "text-right")}
      >
        {stackChips.toLocaleString("zh-CN")}
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
              <LogOut className="mr-0.5 -ml-1 size-4 shrink-0 text-muted" aria-hidden />
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

  /** The insurance seat, which stays in view however the organizer's card is folded. */
  function insuranceRow() {
    return (
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
        {!seat ? (
          <>
            {join(INSURANCE_PLAYER_ID, "保险买入")}
            {dash("text-right")}
            {dash("text-right")}
            {dash("text-right")}
          </>
        ) : (
          <>
            {/* The seat leaves with the last players at a settle attempt, and comes back here */}
            {!seat.seated && editable ? (
              <button
                type="button"
                aria-label="保险回桌"
                onClick={() => onReturn(INSURANCE_PLAYER_ID)}
                className={cn(cellButtonClass, "col-span-2 text-highlight")}
              >
                回桌
              </button>
            ) : (
              <>
                {hands(seat)}
                {stack(seat)}
              </>
            )}
            {net(seat.netChips)}
            <span className="text-right whitespace-nowrap text-highlight">
              {amount(insurance ?? cents(0))}
            </span>
          </>
        )}
      </div>
    );
  }

  /**
   * What the organizer has so far, as on the settlement page: their own chips if they play, the
   * insurance seat, and the table fees and wages charged so far. Folded, the charges become one
   * line and the total moves up to the first row.
   */
  function organizerCard() {
    const summary = [
      charged.wage && (["工资", wages] as const),
      charged.tableFee && (["台费", tableFees] as const),
    ].filter((item) => item !== false);

    return (
      <section aria-label="组织者" className={cardClass}>
        <div className={headClass}>
          <button
            type="button"
            aria-expanded={organizerOpen}
            onClick={() => setOrganizerOpen(!organizerOpen)}
            className="flex min-h-11 min-w-0 items-center text-left font-medium"
          >
            <ChevronRight
              className={cn(
                "-ml-1 size-4 shrink-0 text-muted transition-transform",
                organizerOpen && "rotate-90",
              )}
              aria-hidden
            />
            <span className="truncate">{organizerName}</span>
          </button>
          {host ? hands(host) : join(ORGANIZER_PLAYER_ID, "组织者加入牌局")}
          {host ? stack(host) : dash("text-right")}
          {host ? net(host.netChips) : dash("text-right")}
          <span className="text-right whitespace-nowrap">
            {!organizerOpen ? (
              <TotalChip total={organizerTotal} currency={currency} />
            ) : ownCash === undefined ? (
              dash("")
            ) : (
              <span className={netColor(ownCash)}>{amount(ownCash)}</span>
            )}
          </span>
        </div>
        <div className="px-2">
          {showInsurance && insuranceRow()}
          {!organizerOpen && summary.length > 0 && (
            <p className="flex flex-wrap justify-end gap-x-3 pt-0.5 pb-1.5 text-xs whitespace-nowrap text-muted tabular-nums">
              {summary.map(([label, value]) => (
                <span key={label}>
                  {label} {amount(value)}
                </span>
              ))}
            </p>
          )}
          {organizerOpen && (
            <>
              {charged.wage && <Line label="工资（至今）" amount={amount(wages)} />}
              {charged.tableFee && <Line label="台费（至今）" amount={amount(tableFees)} />}
              {host && editable && (
                <button
                  type="button"
                  onClick={() =>
                    host.seated ? onLeave(ORGANIZER_PLAYER_ID) : onReturn(ORGANIZER_PLAYER_ID)
                  }
                  className="flex min-h-11 items-center gap-1 text-xs text-muted"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  {host.seated ? "组织者离桌" : "组织者回桌"}
                </button>
              )}
              <TotalLine total={organizerTotal} currency={currency} />
            </>
          )}
        </div>
      </section>
    );
  }

  // An organizer at the table counts as one of the seated
  const seatedCount = seated.length + (host?.seated ? 1 : 0);

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
            <h2 className="font-semibold">桌上玩家（{seatedCount}）</h2>
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
        <section className="mt-2">
          <div className="flex min-h-11 items-center justify-between gap-2">
            <h2>
              <button
                type="button"
                aria-expanded={leftOpen}
                onClick={() => setLeftOpen(!leftOpen)}
                className="flex min-h-11 items-center gap-1 text-sm font-medium text-muted"
              >
                已离桌（{left.length}）
                <ChevronDown
                  className={cn("size-4 transition-transform", leftOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
            </h2>
            {leftOpen && editable && (
              <button
                type="button"
                onClick={onReturnAll}
                className="min-h-11 pl-2 text-xs text-highlight"
              >
                一键回桌
              </button>
            )}
          </div>
          {leftOpen && (
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
                      aria-label={`${nameOf(playerId)}回桌`}
                      onClick={() => onReturn(playerId)}
                      className={actionClass}
                    >
                      回桌
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
