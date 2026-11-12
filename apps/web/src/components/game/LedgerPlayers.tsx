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
import { Calculator, ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { formatClock, type PlayerDetail } from "./PlayerDetails";
import { ColumnTitles, columnsClass, labelClass, TotalChip } from "./ResultCards";

const actionClass = "min-h-11 shrink-0 rounded-lg border border-line px-2 text-sm font-medium";
const listClass = "divide-y divide-line rounded-xl border border-line bg-surface px-2";
const rowClass = "flex min-h-13 items-center gap-1.5 py-1";
/** How long 结算并下桌 stays lit for a second tap. */
const ARMED_MS = 5000;
/** How recent a change or a reminder has to be for settling to go straight ahead. */
const RECENT_MS = 5 * 60_000;

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
  /** When each player's chips or Buy-ins last changed, for the reminder before settling them */
  lastChangeAt: ReadonlyMap<string, number>;
  /** Shown at the foot of the seated players */
  addPlayer: ReactNode;
  /** Whether the seated players' cards start open, on their time, charges and total */
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

/** The total under a card's lines, with an action for whoever the card is about before the amount. */
function TotalLine({
  total,
  currency,
  action,
}: {
  total: Cents;
  currency: Currency;
  action?:
    | { readonly label: string; readonly onClick: () => void; readonly armed?: boolean }
    | undefined;
}) {
  return (
    <div className={cn(columnsClass, "min-h-11 border-t border-accent")}>
      <span className={cn(labelClass, "justify-between font-semibold")}>
        合计
        {action && (
          // The tap target is 44px tall; only the outline drawn inside it is small
          <button type="button" onClick={action.onClick} className="flex min-h-11 items-center">
            <span
              className={cn(
                "rounded-lg border px-2 py-1 text-xs font-medium",
                action.armed ? "border-highlight bg-highlight/15 text-highlight" : "border-line",
              )}
            >
              {action.label}
            </span>
          </button>
        )}
      </span>
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
  lastChangeAt,
  addPlayer,
  detailMode,
  onDetailModeChange,
  details,
}: LedgerPlayersProps) {
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  // Cards opened or closed one by one, against the 详细模式 switch
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  // The player whose 结算并下桌 is lit, waiting for a second tap
  const [armedId, setArmedId] = useState<string>();
  const armedAt = useRef(new Map<string, number>());
  const armTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  /**
   * Settling reads the Buy-ins and chips on the page, so a player whose figures have sat untouched
   * for a while gets a reminder first: the button lights for a few seconds and the figures blink.
   * A second tap while it is lit goes ahead, as does any tap for some minutes after.
   */
  function settle(playerId: string) {
    const now = Date.now();
    const fresh = (at: number | undefined) => at !== undefined && now - at < RECENT_MS;
    if (fresh(lastChangeAt.get(playerId)) || fresh(armedAt.current.get(playerId))) {
      setArmedId(undefined);
      onLeave(playerId);
      return;
    }
    armedAt.current.set(playerId, now);
    setArmedId(playerId);
    window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmedId(undefined), ARMED_MS);
  }

  /** The Buy-ins and chips to check, while their player's button is lit. */
  const flash = (playerId: string) =>
    playerId === armedId && "animate-flash rounded-md text-highlight";

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
        aria-label={`输入${nameOf(playerId)}的 Buy-in，现在 ${count} 个`}
        onClick={() => onEditHands(playerId)}
        className={cn(cellButtonClass, "-mx-0.5", flash(playerId))}
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
        className={cn(cellButtonClass, "text-right", flash(playerId))}
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

  const isOpen = (playerId: string) => detailMode !== toggled.has(playerId);

  function toggle(playerId: string) {
    const next = new Set(toggled);
    if (!next.delete(playerId)) next.add(playerId);
    setToggled(next);
  }

  function playerCard(player: PlayerLedger) {
    const { playerId, netChips } = player;
    const name = nameOf(playerId);
    const cash = chipsToCents(netChips, ratio);
    const detail = details?.get(playerId);
    const total = detail?.net ?? cash;
    const open = isOpen(playerId);

    return (
      <section key={playerId} aria-label={name} className={cardClass}>
        <div className={headClass}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => toggle(playerId)}
            className="flex min-h-11 min-w-0 items-center text-left font-medium"
          >
            <ChevronRight
              className={cn(
                "-ml-1 size-4 shrink-0 text-muted transition-transform",
                open && "rotate-90",
              )}
              aria-hidden
            />
            <span className="truncate">{name}</span>
          </button>
          {hands(player)}
          {stack(player)}
          {net(netChips)}
          {/* Folded or open, this is what the chips come to. Charges only count in 合计 */}
          <span className="text-right whitespace-nowrap">
            {open ? (
              <span className={netColor(cash)}>{amount(cash)}</span>
            ) : (
              <TotalChip total={cash} currency={currency} />
            )}
          </span>
        </div>
        {open && (
          <div className="px-2">
            {detail && <Line label={`在局 ${formatClock(detail.seatedMs)}`} />}
            {detail?.tableFee !== undefined &&
              (detail.tableFeeShortMs > 0 ? (
                <Line
                  label={`台费 未满 差 ${Math.ceil(detail.tableFeeShortMs / 60_000)} 分`}
                  amount="—"
                />
              ) : (
                <Line label="台费" amount={amount(cents(-detail.tableFee))} />
              ))}
            {detail?.wage !== undefined && (
              <Line label="工资" amount={amount(cents(-detail.wage))} />
            )}
            <TotalLine
              total={total}
              currency={currency}
              action={
                editable
                  ? {
                      label: "结算并下桌",
                      onClick: () => settle(playerId),
                      armed: playerId === armedId,
                    }
                  : undefined
              }
            />
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
            {join(INSURANCE_PLAYER_ID, "保险 Buy-in")}
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
            {/* As on a player's card: what the organizer's own chips come to */}
            {ownCash === undefined ? (
              dash("")
            ) : organizerOpen ? (
              <span className={netColor(ownCash)}>{amount(ownCash)}</span>
            ) : (
              <TotalChip total={ownCash} currency={currency} />
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
              <TotalLine
                total={organizerTotal}
                currency={currency}
                action={
                  !host || !editable
                    ? undefined
                    : host.seated
                      ? {
                          label: "结算并下桌",
                          onClick: () => settle(ORGANIZER_PLAYER_ID),
                          armed: armedId === ORGANIZER_PLAYER_ID,
                        }
                      : { label: "回桌", onClick: () => onReturn(ORGANIZER_PLAYER_ID) }
                }
              />
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
            {seated.length > 0 && (
              <MiniSwitch
                label="详细模式"
                checked={seated.every((p) => isOpen(p.playerId))}
                onChange={(on) => {
                  setToggled(new Set());
                  onDetailModeChange(on);
                }}
              />
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
                      Buy-in {money(boughtChips)} · 离桌 {money(cashedOutChips)}
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
