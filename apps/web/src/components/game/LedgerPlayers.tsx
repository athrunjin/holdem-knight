import {
  type Cents,
  type Charge,
  type ChargeWaiver,
  type Currency,
  cents,
  chipsToCents,
  type Game,
  INSURANCE_PLAYER_ID,
  type LedgerEvent,
  ORGANIZER_PLAYER_ID,
  type PlayerLedger,
} from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { Calculator, ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { MiniSwitch } from "@/components/MiniSwitch";
import { breakable, formatSignedChips, netColor } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { BuyInRecord } from "./BuyInRecord";
import { chargeLines } from "./chargeLines";
import type { LiveCharges } from "./liveCharges";
import {
  ColumnTitles,
  columnsClass,
  figureClass,
  Line,
  labelClass,
  nameClass,
  TotalChip,
} from "./ResultCards";

const actionClass = "min-h-11 shrink-0 rounded-lg border border-line px-2 text-sm font-medium";
const listClass = "divide-y divide-line rounded-xl border border-line bg-surface px-2";
const rowClass = "flex min-h-13 items-center gap-1.5 py-1";
/** How long 结算并下桌 stays lit, waiting for the tap that confirms it. */
const ARMED_MS = 5000;
/** A second tap this soon after the first is the same tap twice, not a confirmation. */
const DOUBLE_TAP_MS = 350;

/** A card as on the settlement page: a tinted row of figures, then any lines under it. */
const cardClass = "overflow-hidden rounded-xl border border-line bg-surface text-sm";
const headClass = cn(columnsClass, "min-h-11 w-full bg-accent/15 px-2 text-left");

/** Tappable figures keep a 44px target, wider than the Buy-in column they sit in. */
const cellButtonClass = "min-h-11 tabular-nums";

interface LedgerPlayersProps {
  game: Game;
  events: readonly LedgerEvent[];
  /** Named as on the settlement page */
  organizerName: string;
  players: readonly PlayerLedger[];
  nameOf: (playerId: string) => string;
  /** Actions are hidden once the game is settled */
  editable: boolean;
  /** Everyone's time and charges so far, as of the moment the cards show */
  live: LiveCharges;
  /** Lets a player off a charge, or charges it again, as on the settlement page */
  onWaive: (key: ChargeWaiver, waived: boolean) => void;
  /** While a waiver is being saved */
  waiving: boolean;
  onEditHands: (playerId: string) => void;
  onEditStack: (playerId: string) => void;
  onRebuy: (playerId: string) => void;
  /** A first buy-in for the organizer, or for an insurance seat the game is missing */
  onJoin: (playerId: string) => void;
  onReturn: (playerId: string) => void;
  /** Everyone who left comes back, after the organizer confirms */
  onReturnAll: () => void;
  /** The player leaves with the chips on the page, at once */
  onLeave: (playerId: string) => void;
  /** Shown at the foot of the seated players */
  addPlayer: ReactNode;
  /** Whether the seated players' cards start open, on their record, charges and total */
  detailMode: boolean;
  onDetailModeChange: (on: boolean) => void;
}

/** The outline of a small button on a 合计 line. The tap target around it is 44px tall. */
const pillClass = "rounded-lg border px-2 py-1 text-xs font-medium";

/**
 * 结算并下桌, which takes two taps. The first lights it: it lifts and grows a little, reads 确认结算
 * and fills with green that runs out from the right while it stays lit. The fill is a second copy
 * of the label, dark on green, cut back from the right, so the text changes color where the green
 * ends. The longer label holds the width, so lighting the button moves nothing beside it.
 */
function SettleButton({ armed, onClick }: { armed: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 items-center">
      <span
        className={cn(
          pillClass,
          "relative grid transition-transform duration-200 motion-reduce:transition-none",
          armed ? "-translate-y-0.5 scale-110 border-accent text-win" : "border-line",
        )}
      >
        <span className="invisible col-start-1 row-start-1" aria-hidden>
          结算并下桌
        </span>
        <span className="col-start-1 row-start-1 text-center">
          {armed ? "确认结算" : "结算并下桌"}
        </span>
        {armed && (
          <span
            aria-hidden
            style={{ animationDuration: `${ARMED_MS}ms` }}
            className="absolute -inset-px grid animate-drain place-items-center rounded-[inherit] bg-accent text-accent-text"
          >
            确认结算
          </span>
        )}
      </span>
    </button>
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
  action?: ReactNode;
}) {
  return (
    <div className={cn(columnsClass, "min-h-11 border-t border-accent")}>
      <span className={cn(labelClass, "justify-between font-semibold")}>
        合计
        {action}
      </span>
      <span className="text-right whitespace-nowrap">
        <TotalChip total={total} currency={currency} />
      </span>
    </div>
  );
}

export function LedgerPlayers({
  game,
  events,
  organizerName,
  players,
  nameOf,
  editable,
  live,
  onWaive,
  waiving,
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
}: LedgerPlayersProps) {
  const { id: gameId, handChips, chipRatio: ratio, currency } = game;
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  // Cards opened or closed one by one, against the 详细模式 switch
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  // The player whose 结算并下桌 is lit, waiting for the tap that confirms it
  const [armedId, setArmedId] = useState<string>();
  const armedAt = useRef(0);
  const armTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  /**
   * Settling reads the Buy-ins and chips on the page, so it always takes two taps. The first
   * lights the button for a few seconds and blinks the figures to check. A tap while it is lit
   * settles the player at once, and once it goes out the next tap only lights it again.
   */
  function settle(playerId: string) {
    const now = Date.now();
    if (playerId === armedId) {
      if (now - armedAt.current < DOUBLE_TAP_MS) return;
      window.clearTimeout(armTimer.current);
      setArmedId(undefined);
      onLeave(playerId);
      return;
    }
    armedAt.current = now;
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

  /** What is still charged, waived charges left out. */
  const owed = (match: (charge: Charge) => boolean) =>
    cents(
      live.charges
        .filter((charge) => !charge.waived && match(charge))
        .reduce((total, charge) => total + charge.amount, 0),
    );
  const tableFees = owed((c) => c.kind === "table_fee");
  const wages = owed((c) => c.kind === "wage");
  const charged = { tableFee: game.tableFee !== undefined, wage: game.wage !== undefined };
  const insurance = seat && chipsToCents(seat.netChips, ratio);
  const ownCash = host && chipsToCents(host.netChips, ratio);
  const organizerTotal = cents((ownCash ?? 0) + (insurance ?? 0) + tableFees + wages);
  // A game with insurance always shows its seat
  const showInsurance = seat !== undefined || game.insurance !== undefined;
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
      return (
        <span className={cn(figureClass, "text-center")}>
          {breakable(chips.toLocaleString("zh-CN"))}
        </span>
      );
    }
    return (
      <button
        type="button"
        aria-label={`输入${nameOf(playerId)}的筹码，现在 ${stackChips}`}
        onClick={() => onEditStack(playerId)}
        className={cn(cellButtonClass, figureClass, flash(playerId))}
      >
        {breakable(stackChips.toLocaleString("zh-CN"))}
      </button>
    );
  }

  function net(netChips: number) {
    return (
      <span className={cn(figureClass, "text-right", netColor(netChips))}>
        {breakable(formatSignedChips(netChips))}
      </span>
    );
  }

  const isOpen = (playerId: string) => detailMode !== toggled.has(playerId);

  function toggle(playerId: string) {
    const next = new Set(toggled);
    if (!next.delete(playerId)) next.add(playerId);
    setToggled(next);
  }

  /**
   * A seated player's card. Open, it is their card on the settlement page as it would be if they
   * left now: their Buy-in record, what they would take out, the time sat and the charges so far.
   */
  function playerCard(player: PlayerLedger) {
    const { playerId, netChips, stackChips } = player;
    const name = nameOf(playerId);
    const cash = chipsToCents(netChips, ratio);
    const total = cents(cash - owed((c) => c.playerId === playerId));
    const open = isOpen(playerId);
    const lines = open
      ? chargeLines(game, live.statuses, live.charges, playerId, {
          disabled: waiving || !editable,
          onWaive,
          live: true,
        })
      : [];

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
            <span className={nameClass}>{name}</span>
          </button>
          {hands(player)}
          {stack(player)}
          {net(netChips)}
          {/* Folded or open, this is what the chips come to. Charges only count in 合计 */}
          <span className={cn(figureClass, "text-right")}>
            {open ? (
              <span className={netColor(cash)}>{breakable(amount(cash))}</span>
            ) : (
              <TotalChip total={cash} currency={currency} />
            )}
          </span>
        </div>
        {open && (
          <div className="@container px-2">
            <BuyInRecord
              game={game}
              events={events}
              playerId={playerId}
              leaving={{ chips: stackChips, at: live.now }}
            />
            <div className={cn(lines.length > 0 && "border-t border-line")}>
              {lines.map((line) => (
                <Line key={line.key} line={line} currency={currency} />
              ))}
            </div>
            <TotalLine
              total={total}
              currency={currency}
              action={
                editable && (
                  <SettleButton armed={playerId === armedId} onClick={() => settle(playerId)} />
                )
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
            {dash("text-center")}
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
            <span className={nameClass}>{organizerName}</span>
          </button>
          {host ? hands(host) : join(ORGANIZER_PLAYER_ID, "组织者加入牌局")}
          {host ? stack(host) : dash("text-center")}
          {host ? net(host.netChips) : dash("text-right")}
          <span className={cn(figureClass, "text-right")}>
            {/* As on a player's card: what the organizer's own chips come to */}
            {ownCash === undefined ? (
              dash("")
            ) : organizerOpen ? (
              <span className={netColor(ownCash)}>{breakable(amount(ownCash))}</span>
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
              {charged.wage && (
                <Line
                  line={{ key: "wage", label: "工资（至今）", amount: wages, tone: "charge" }}
                  currency={currency}
                />
              )}
              {charged.tableFee && (
                <Line
                  line={{ key: "fee", label: "台费（至今）", amount: tableFees, tone: "charge" }}
                  currency={currency}
                />
              )}
              <TotalLine
                total={organizerTotal}
                currency={currency}
                action={
                  host &&
                  editable &&
                  (host.seated ? (
                    <SettleButton
                      armed={armedId === ORGANIZER_PLAYER_ID}
                      onClick={() => settle(ORGANIZER_PLAYER_ID)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReturn(ORGANIZER_PLAYER_ID)}
                      className="flex min-h-11 items-center"
                    >
                      <span className={cn(pillClass, "border-line")}>回桌</span>
                    </button>
                  ))
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
