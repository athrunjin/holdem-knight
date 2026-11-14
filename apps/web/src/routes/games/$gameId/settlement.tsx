import {
  applyCharges,
  attributeInsurance,
  type Charge,
  type ChargeWaiver,
  cents,
  chargeStatuses,
  chargesFrom,
  chipDifference,
  chooseCollector,
  collectorTransfers,
  type Game,
  INSURANCE_PLAYER_ID,
  isTransferDone,
  type LedgerEvent,
  markReceived,
  ORGANIZER_COLLECTOR,
  type PlayerChargeStatus,
  type PlayerLedger,
  type PlayerNet,
  reviseGame,
  type SettlementOutcome,
  settleGame,
  settlementOutcome,
  settleTransfers,
  summarizeByPlayer,
  transferCollector,
  waiveCharge,
  ZERO,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Share2, Undo2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { BuyInRecord } from "@/components/game/BuyInRecord";
import { chargeLines, organizerIncomeLines } from "@/components/game/chargeLines";
import { GameBlindsCash, GameOptionLine, GameTitle } from "@/components/game/GameOptions";
import { GameRules, hasGameRules } from "@/components/game/GameRules";
import {
  InsuranceRow,
  type ResultCard,
  ResultCards,
  type ResultLine,
} from "@/components/game/ResultCards";
import { SettlementSummary } from "@/components/game/SettlementSummary";
import type { TransferPlan } from "@/components/game/TransferPlanPicker";
import { Transfers } from "@/components/game/Transfers";
import { InfoButton } from "@/components/InfoButton";
import { Modal } from "@/components/insurance/Modal";
import { Page } from "@/components/Page";
import { useGame, useSaveGame } from "@/data/games";
import { useLedger } from "@/data/ledger";
import { usePlayers } from "@/data/players";
import { CHARGE_CLOCK_RULE, chargeClock, chargeRuleNotes, chargeRuleSections } from "@/lib/charges";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameAmount, formatGameMoney } from "@/lib/currency";
import { gameNameOf } from "@/lib/player-name";
import { renderSettlementImage } from "@/lib/settlement-image";
import { shareFile } from "@/lib/share";

export const Route = createFileRoute("/games/$gameId/settlement")({
  component: SettlementPage,
});

/**
 * The button the page points at when a tap cannot do what it asks: 确认结算 while the results are
 * still open, 修改对局结果 once they are confirmed. A new one each time, so a second tap points again.
 */
interface Nudge {
  readonly target: "confirm" | "revise";
  readonly at: number;
}

/** How long the ring stays around the button. */
const NUDGE_MS = 2400;

function NudgeRing({ at }: { at: number }) {
  return (
    <span
      key={at}
      aria-hidden
      className="pointer-events-none absolute -inset-1 animate-nudge rounded-2xl ring-2 ring-highlight"
    />
  );
}

function SettlementPage() {
  const { gameId } = Route.useParams();
  const { data: game } = useGame(gameId);
  const { data: events } = useLedger(gameId);
  const { data: players } = usePlayers();

  const [rulesOpen, setRulesOpen] = useState(false);
  const [nudge, setNudge] = useState<Nudge>();

  if (!game || !events || !players) return null;

  const ledger = summarizeByPlayer(events);
  // Table fees and wages come last, in cash, so they never touch the chip results
  const statuses =
    game.tableFee || game.wage ? chargeStatuses(game, events, chargeClock(game)) : [];
  const charges = chargesFrom(game, statuses);
  const ruleSections = chargeRuleSections(game, game.currency);
  const nameOf = gameNameOf(players, game);
  const seated = ledger
    .filter((p) => p.seated && p.playerId !== INSURANCE_PLAYER_ID)
    .map((p) => nameOf(p.playerId));
  const difference = chipDifference(ledger);

  return (
    <Page
      title={<GameTitle game={game} />}
      titleNote={<GameBlindsCash game={game} />}
      subtitle={
        <GameOptionLine
          game={game}
          settings={{ kind: "view", open: rulesOpen, onToggle: () => setRulesOpen(!rulesOpen) }}
        />
      }
      actions={
        // The emblem, no taller than the title and the line under it
        <picture className="shrink-0">
          <source srcSet="/emblem-on-dark.svg" media="(prefers-color-scheme: dark)" />
          <img src="/emblem-on-light.svg" alt="" className="h-12 w-auto" />
        </picture>
      }
    >
      {/* The game's settings, to read only: they are changed from the game page */}
      {rulesOpen && (
        <section
          aria-label="设置"
          className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-line bg-surface px-3 pt-2 pb-1"
        >
          {hasGameRules(game) ? (
            <GameRules game={game} charges={charges} />
          ) : (
            <p className="pb-1 text-xs text-muted">这局没有开启保险、工资或台费。</p>
          )}
          {ruleSections.length > 0 && (
            <InfoButton title="计费规则" small>
              <div className="flex flex-col gap-2 text-sm">
                {ruleSections.map(({ title, lines }) => (
                  <section key={title}>
                    <h4 className="font-medium">{title}</h4>
                    {lines.map((line) => (
                      <p key={line} className="text-muted">
                        {line}
                      </p>
                    ))}
                  </section>
                ))}
                <p className="text-xs text-muted">{CHARGE_CLOCK_RULE}</p>
              </div>
            </InfoButton>
          )}
        </section>
      )}
      {seated.length > 0 ? (
        <Notice gameId={gameId}>
          还有 {seated.length} 人在桌：{seated.join("、")}。全部离桌后才能结算。
        </Notice>
      ) : (
        <>
          <SettlementSummary
            game={game}
            ledger={ledger}
            difference={difference}
            onLocked={() => setNudge({ target: "revise", at: Date.now() })}
          />
          {difference === 0 || game.imbalanceHandling ? (
            <SettlementResult
              game={game}
              outcome={settlementOutcome(ledger, game.chipRatio, game.imbalanceHandling)}
              ledger={ledger}
              events={events}
              statuses={statuses}
              charges={charges}
              nameOf={nameOf}
              nudge={nudge}
              onNudge={setNudge}
            />
          ) : (
            <p className="mt-3 text-sm text-muted">在上方选择差额的处理方案后显示结果。</p>
          )}
        </>
      )}
    </Page>
  );
}

function Notice({ gameId, children }: { gameId: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-highlight bg-surface p-4">
      <p>{children}</p>
      <Link
        to="/games/$gameId"
        params={{ gameId }}
        className="mt-2 inline-flex min-h-11 items-center text-highlight"
      >
        回到账本
      </Link>
    </div>
  );
}

interface SettlementResultProps {
  game: Game;
  outcome: SettlementOutcome;
  ledger: readonly PlayerLedger[];
  events: readonly LedgerEvent[];
  statuses: readonly PlayerChargeStatus[];
  charges: readonly Charge[];
  nameOf: (playerId: string) => string;
  nudge: Nudge | undefined;
  onNudge: (nudge: Nudge | undefined) => void;
}

function SettlementResult({
  game,
  outcome,
  ledger,
  events,
  statuses,
  charges,
  nameOf,
  nudge,
  onNudge,
}: SettlementResultProps) {
  const { difference, unresolved } = outcome;
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const insured = attributeInsurance(outcome.nets, game.insuranceOwner);
  const { insuranceNet, ownerId } = insured;
  const ruleNotes = chargeRuleNotes(game, game.currency);
  const charged = applyCharges(insured.nets, charges);
  const { nets } = charged;
  const { currency, status, smallBlindChips, bigBlindChips, handChips, createdAt } = game;
  // An organizer who plays has chips under the organizer's own ID, and stays on the organizer's card
  const host = ledger.find((p) => p.playerId === ORGANIZER_COLLECTOR);
  const saveGame = useSaveGame();
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  // A game with insurance or charges opens on its transfers, which then go through the organizer
  const [transfersOpen, setTransfersOpen] = useState(() => hasGameRules(game));
  const [revising, setRevising] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const manageRef = useRef<HTMLButtonElement>(null);
  // Anything not yet confirmed is still being settled, however the page was reached
  const settled = status === "settled";

  useEffect(() => {
    if (!nudge) return;
    // 确认结算 only has to come into view. 修改对局结果 sits over 积分管理, which goes to the bottom
    if (nudge.target === "confirm") {
      confirmRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      manageRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
    const timer = window.setTimeout(() => onNudge(undefined), NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge, onNudge]);

  const point = (target: Nudge["target"]) => onNudge({ target, at: Date.now() });

  const insuranceText = formatGameMoney(insuranceNet, currency, "exceptZero");
  const chargesText = formatGameMoney(charged.total, currency);
  const separateInsurance = ownerId === INSURANCE_PLAYER_ID;

  /** The transfers of the plan a game has, which may be this game with another plan chosen. */
  function transfersOf(of: Game) {
    const id = transferCollector(of, nets);
    return id ? collectorTransfers(nets, id) : settleTransfers(nets);
  }
  /** A settled game is complete while every transfer of its plan is in: none at all counts too. */
  const filed = (of: Game) =>
    markReceived(
      of,
      transfersOf(of).every((transfer) => isTransferDone(of, transfer)),
    );

  const collectorId = transferCollector(game, nets);
  const transfers = transfersOf(game);
  const planName = collectorId ? `代收人 ${nameOf(collectorId)}` : "最优方案";

  const organizerNet = nets.find((p) => p.playerId === ORGANIZER_COLLECTOR)?.net;
  const netOf = (list: readonly PlayerNet[], id: string) =>
    list.find((p) => p.playerId === id)?.net ?? ZERO;
  // Each person's result from the chips alone, before a difference is split
  const chipNets = settlementOutcome(ledger, game.chipRatio, undefined).nets;

  function insuranceLine(id: string): ResultLine[] {
    if (insuranceNet === 0 || id !== ownerId) return [];
    return [
      { key: "insurance", label: "保险", amount: insuranceNet, tone: "adjustment", group: "保险" },
    ];
  }

  // Once settled a charge cannot change: the tap points at the button that opens the results again
  const waiving = {
    disabled: saveGame.isPending,
    locked: settled,
    onWaive: (key: ChargeWaiver, waived: boolean) =>
      settled ? point("revise") : saveGame.mutate(waiveCharge(game, key, waived)),
  };
  const record = (playerId: string) => (
    <BuyInRecord game={game} events={events} playerId={playerId} />
  );

  const playerCards = ledger
    .filter((p) => p.playerId !== INSURANCE_PLAYER_ID || separateInsurance)
    .filter((p) => p.playerId !== ORGANIZER_COLLECTOR)
    .map((player): ResultCard => {
      const { playerId } = player;
      const base = netOf(chipNets, playerId);
      const share = netOf(outcome.nets, playerId) - base;
      const split: ResultLine[] =
        share === 0
          ? []
          : [
              {
                key: "split",
                label: "差额分摊",
                amount: cents(share),
                tone: "adjustment",
                group: "分摊",
              },
            ];
      return {
        id: playerId,
        name: nameOf(playerId),
        hands: handChips === undefined ? "—" : String(player.boughtChips / handChips),
        chips: player.cashedOutChips.toLocaleString("zh-CN"),
        netChips: player.cashedOutChips - player.boughtChips,
        base,
        record: record(playerId),
        // What the chips come to first, then the charges, then what changes the result after them
        lines: [
          ...chargeLines(game, statuses, charges, playerId, waiving),
          ...split,
          ...insuranceLine(playerId),
        ],
        total: netOf(nets, playerId),
        collapsible: true,
      };
    })
    .toSorted((a, b) => b.total - a.total);

  // What handling the difference adds to the organizer, beyond their own chips if they play
  const covered =
    netOf(outcome.nets, ORGANIZER_COLLECTOR) - (host ? netOf(chipNets, ORGANIZER_COLLECTOR) : 0);
  const coveredLine: ResultLine =
    game.imbalanceHandling === "organizer"
      ? {
          key: "difference",
          label: covered < 0 ? "补齐差额" : "收取差额",
          amount: cents(covered),
          tone: "adjustment",
          group: "差额",
        }
      : {
          key: "split",
          label: "差额分摊",
          amount: cents(covered),
          tone: "adjustment",
          group: "分摊",
        };
  const receivesCharges = charged.recipientId === ORGANIZER_COLLECTOR;
  // The insurance seat sits on the organizer's card as on the game page, when its result is theirs
  const insuranceRow = seat && ownerId === ORGANIZER_COLLECTOR && (
    <InsuranceRow
      hands={handChips === undefined ? "—" : String(seat.boughtChips / handChips)}
      chips={seat.cashedOutChips.toLocaleString("zh-CN")}
      netChips={seat.cashedOutChips - seat.boughtChips}
      amount={insuranceNet}
      currency={currency}
    />
  );
  // What an organizer can receive besides insurance, always in this order
  const organizerLines: ResultLine[] = [
    ...organizerIncomeLines(game, charges, receivesCharges),
    ...(covered === 0 ? [] : [coveredLine]),
  ];
  const organizerCard: ResultCard[] =
    organizerNet === undefined
      ? []
      : [
          {
            id: ORGANIZER_COLLECTOR,
            // The organizer's ID stands in until organizers have names (M6)
            name: game.organizerId,
            hands: !host || handChips === undefined ? "—" : String(host.boughtChips / handChips),
            chips: host ? host.cashedOutChips.toLocaleString("zh-CN") : "—",
            ...(host && {
              netChips: host.cashedOutChips - host.boughtChips,
              base: netOf(chipNets, ORGANIZER_COLLECTOR),
              record: record(ORGANIZER_COLLECTOR),
            }),
            ...(insuranceRow && { pinned: insuranceRow }),
            lines: organizerLines,
            total: organizerNet,
            collapsible: true,
          },
        ];

  function imbalanceNote() {
    if (difference === 0) return undefined;
    const size = formatGameMoney(cents(Math.abs(difference)), currency);
    if (unresolved !== 0) {
      const holder = collectorId ? "，差额留在代收人手上" : "";
      return `未处理差额 ${size}${holder}`;
    }
    if (game.imbalanceHandling === "organizer") {
      return `${nameOf(ORGANIZER_COLLECTOR)} ${difference > 0 ? "补齐" : "收取"} ${size}`;
    }
    const count = [...playerCards, ...organizerCard].filter(
      (r) => (r.netChips ?? 0) * difference > 0,
    ).length;
    return difference > 0
      ? `水上多 ${size}，由 ${count} 位赢家按水上比例扣减`
      : `水下多 ${size}，由 ${count} 位输家按水下比例少付`;
  }
  function insuranceNote() {
    if (!seat || insuranceNet === 0) return undefined;
    if (separateInsurance) return `保险 ${insuranceText}，单独列出`;
    return `保险 ${insuranceText}，计入 ${nameOf(ownerId)}`;
  }
  function chargesNote() {
    if (charged.total === 0) return undefined;
    const kinds = [game.tableFee && "台费", game.wage && "工资"].filter(Boolean).join("和");
    return `${kinds} ${chargesText}，计入 ${nameOf(charged.recipientId)}`;
  }
  const notes = [imbalanceNote(), insuranceNote(), chargesNote()].filter(
    (text) => text !== undefined,
  );

  // The plans in the order they are listed: the optimal one, the organizer, then the players
  const plans: TransferPlan[] = [
    { collectorId: undefined, label: "最优方案" },
    ...[ORGANIZER_COLLECTOR, ...playerCards.map(({ id }) => id)]
      .filter((id) => id !== INSURANCE_PLAYER_ID)
      .map((id) => ({ collectorId: id, label: `代收人：${nameOf(id)}` })),
  ];

  async function handleShare() {
    setSharing(true);
    setShareFailed(false);
    try {
      const date = new Date(createdAt);
      const image = await renderSettlementImage({
        title: "Hold’em Knight · 结算",
        subtitle: `${date.toLocaleDateString("zh-CN")} · 盲注 ${smallBlindChips} / ${bigBlindChips}`,
        transferTitle: `转账方案 · ${planName}`,
        transfers: transfers.map(({ from, to, amount }) => ({
          from: nameOf(from),
          to: nameOf(to),
          amount: formatGameMoney(amount, currency),
        })),
        notes: [...notes, ...ruleNotes],
        results: [...playerCards, ...organizerCard].map(
          ({ name, hands, chips, netChips, total }) => ({
            name,
            hands,
            chips,
            net: netChips === undefined ? "—" : formatSignedChips(netChips),
            amount: formatGameAmount(total, currency, "exceptZero"),
            outcome: Math.sign(total),
          }),
        ),
      });
      const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
      await shareFile(image, `结算-${day}.png`);
    } catch {
      setShareFailed(true);
    } finally {
      setSharing(false);
    }
  }

  function revise() {
    setRevising(false);
    onNudge(undefined);
    saveGame.mutate(reviseGame(game));
  }

  /** Transfers already marked as received would no longer match, so they go, once the organizer agrees. */
  function handleRevise() {
    if (transfers.some((transfer) => isTransferDone(game, transfer))) setRevising(true);
    else revise();
  }

  function handleConfirm() {
    onNudge(undefined);
    saveGame.mutate(filed(settleGame(game, Date.now())));
  }

  return (
    <>
      <ResultCards organizer={organizerCard[0]} cards={playerCards} currency={currency} />

      {/* The step that closes the game comes first, set apart from the cards by a rule */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex gap-2">
          {settled ? (
            <button
              type="button"
              disabled={saveGame.isPending}
              onClick={handleRevise}
              className="relative min-h-12 min-w-0 flex-1 rounded-xl border border-line px-4 font-medium disabled:opacity-60"
            >
              修改对局结果
              {nudge?.target === "revise" && <NudgeRing at={nudge.at} />}
            </button>
          ) : (
            <button
              ref={confirmRef}
              type="button"
              disabled={saveGame.isPending}
              onClick={handleConfirm}
              className="relative min-h-12 min-w-0 flex-1 scroll-mt-4 scroll-mb-24 rounded-xl bg-accent px-4 font-semibold text-accent-text disabled:opacity-60"
            >
              确认结算
              {nudge?.target === "confirm" && <NudgeRing at={nudge.at} />}
            </button>
          )}
          <Link
            to="/games/$gameId"
            params={{ gameId: game.id }}
            className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl border border-line px-3 text-sm font-medium"
          >
            <Undo2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            返回牌桌
          </Link>
        </div>
        {saveGame.isError && (
          <p role="alert" className="mt-2 text-sm text-highlight">
            保存失败，请重试。
          </p>
        )}
      </div>

      {/* Then what is shared with the players: the image, and the transfers, which open under the row */}
      <section className="mt-2 pb-8">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={sharing}
            onClick={handleShare}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-2 font-medium disabled:opacity-60"
          >
            <Share2 className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            生成图片
          </button>
          {/* Clear of the bar at the bottom of a phone when the page scrolls it to the bottom */}
          <button
            ref={manageRef}
            type="button"
            aria-expanded={transfersOpen}
            onClick={() => setTransfersOpen(!transfersOpen)}
            className="flex min-h-12 scroll-mb-24 items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 font-medium whitespace-nowrap"
          >
            积分管理
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted transition-transform",
                transfersOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
        {shareFailed && (
          <p role="alert" className="mt-2 text-sm text-highlight">
            图片生成失败，请重试。
          </p>
        )}
        {transfersOpen && (
          // The plan can change at any stage, and the ticks once the results are confirmed
          <Transfers
            game={game}
            transfers={transfers}
            plans={plans}
            collectorId={collectorId}
            nameOf={nameOf}
            disabled={saveGame.isPending}
            onChoosePlan={(next) => saveGame.mutate(filed(chooseCollector(game, next)))}
            onSave={(next) => saveGame.mutate(next)}
            onUnsettled={() => point("confirm")}
          />
        )}
      </section>

      {revising && (
        <Modal title="修改对局结果" onClose={() => setRevising(false)}>
          <p className="text-sm">已有积分转移被记录，是否删除并修改对局结果？</p>
          <button
            type="button"
            onClick={revise}
            className="mt-3 min-h-11 w-full rounded-xl bg-accent font-semibold text-accent-text"
          >
            确定
          </button>
          <button
            type="button"
            onClick={() => setRevising(false)}
            className="mt-2 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            取消
          </button>
        </Modal>
      )}
    </>
  );
}
