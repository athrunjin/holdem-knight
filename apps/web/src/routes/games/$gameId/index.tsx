import {
  chipsToCents,
  chooseImbalanceHandling,
  type Game,
  type HandChange,
  type ImbalanceHandling,
  INSURANCE_PLAYER_ID,
  insuranceRecords,
  lastBuyChips,
  latestCashOut,
  ledgerTotals,
  nextBuyType,
  ORGANIZER_PLAYER_ID,
  type Player,
  pauseTimer,
  soleBuyIn,
  summarizeByPlayer,
  toggleTimer,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AddPlayerToGame } from "@/components/game/AddPlayerToGame";
import { ChipAmountDialog } from "@/components/game/ChipAmountDialog";
import { GameOptionLine, GameTitle } from "@/components/game/GameOptions";
import { GameTimer } from "@/components/game/GameTimer";
import { HandsDialog } from "@/components/game/HandsDialog";
import { LeaveDialog } from "@/components/game/LeaveDialog";
import { LedgerLog } from "@/components/game/LedgerLog";
import { LedgerPlayers } from "@/components/game/LedgerPlayers";
import { usePlayerDetails } from "@/components/game/PlayerDetails";
import { SettleDialog } from "@/components/game/SettleDialog";
import { Page } from "@/components/Page";
import { useGame, useSaveGame } from "@/data/games";
import { useInsuranceHands } from "@/data/insurance";
import {
  newEventMeta,
  useAdjustHands,
  useAppendEvent,
  useLeaveAll,
  useLeaveTable,
  useLedger,
  useReturnAll,
} from "@/data/ledger";
import { usePlayers } from "@/data/players";
import { formatSignedChips } from "@/lib/chips";
import { cn } from "@/lib/cn";
import { formatGameMoney } from "@/lib/currency";
import { gameNameOf } from "@/lib/player-name";

export const Route = createFileRoute("/games/$gameId/")({
  component: GamePage,
});

function GamePage() {
  const { gameId } = Route.useParams();
  const { data: game, isPending } = useGame(gameId);

  if (isPending) return null;
  if (!game) {
    return (
      <Page title="牌局">
        <p className="text-muted">找不到这局牌。</p>
        <Link to="/" className="mt-2 inline-flex min-h-11 items-center text-highlight">
          回到牌局列表
        </Link>
      </Page>
    );
  }
  return <GameLedger game={game} />;
}

/**
 * The record being entered.
 * `buy` and `stack` take chips, `leave` confirms both, and the others take hands:
 * `join` is a first buy-in and `edit` sets a target.
 */
type PendingEntry = {
  kind: "buy" | "stack" | "leave" | "join" | "edit";
  playerId: string;
  name: string;
  /** Hands changed from a Buy-in on the page, which shows the change before it is applied */
  review?: boolean;
};

const settleClass =
  "inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-accent-text";

const HANDS_TITLE = { join: "Buy-in", edit: "调整 Buy-in" } as const;

/** Display only, so a hand that is not a whole number of big blinds rounds to one decimal. */
function handBigBlinds(handChips: number, bigBlindChips: number) {
  return (handChips / bigBlindChips).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function GameLedger({ game }: { game: Game }) {
  const { id: gameId, currency, bigBlindChips, chipRatio, handChips, status } = game;
  const { data: events = [] } = useLedger(gameId);
  const { data: hands = [] } = useInsuranceHands(gameId);
  const { data: players = [] } = usePlayers();
  const appendEvent = useAppendEvent(gameId);
  const adjustHands = useAdjustHands(gameId);
  const leaveTable = useLeaveTable(gameId);
  const leaveAll = useLeaveAll(gameId);
  const returnAll = useReturnAll(gameId);
  const saveGame = useSaveGame();
  const navigate = Route.useNavigate();
  const [settling, setSettling] = useState(false);
  const [pending, setPending] = useState<PendingEntry>();
  // On by default in games that charge for time, where the figures matter during play
  const [detailMode, setDetailMode] = useState(
    game.tableFee !== undefined || game.wage !== undefined,
  );

  const editable = status === "open";
  const ledger = summarizeByPlayer(events);
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const people = ledger.filter((p) => p.playerId !== INSURANCE_PLAYER_ID);
  const balanceChips = ledgerTotals(ledger).balanceChips;
  // Games that charge for time always count, since the organizer's figures show the charges
  const details = usePlayerDetails(
    game,
    events,
    people,
    game.tableFee !== undefined || game.wage !== undefined,
  );
  const totals = ledgerTotals(people);
  const nameOf = gameNameOf(players, game);
  const money = (chips: number) => formatGameMoney(chipsToCents(chips, chipRatio), currency);

  function playerTotals(playerId: string) {
    const player = ledger.find((p) => p.playerId === playerId);
    return {
      boughtChips: player?.boughtChips ?? 0,
      cashedOutChips: player?.cashedOutChips ?? 0,
      stackChips: player?.stackChips ?? 0,
    };
  }

  function boughtHands(playerId: string) {
    return handChips === undefined ? 0 : playerTotals(playerId).boughtChips / handChips;
  }

  function closeDialog() {
    setPending(undefined);
    appendEvent.reset();
    adjustHands.reset();
    leaveTable.reset();
  }

  function handleChips(chips: number) {
    if (!pending) return;
    const { kind, playerId } = pending;
    appendEvent.mutate(
      {
        ...newEventMeta(gameId),
        type: kind === "stack" ? "stack_set" : nextBuyType(events, playerId),
        playerId,
        chips,
      },
      { onSuccess: closeDialog },
    );
  }

  function handleLeave(playerId: string, chips: number, hands: number | undefined, at: number) {
    leaveTable.mutate(
      {
        playerId,
        chips,
        at,
        ...(handChips !== undefined && hands !== undefined
          ? { hands: { handChips, count: hands } }
          : {}),
      },
      { onSuccess: closeDialog },
    );
  }

  function handleHands(playerId: string, change: HandChange, onSuccess?: () => void) {
    if (handChips === undefined) return;
    adjustHands.mutate({ playerId, handChips, change }, { onSuccess: () => onSuccess?.() });
  }

  function appendReversal(reversedEventId: string) {
    appendEvent.mutate({ ...newEventMeta(gameId), type: "reversal", reversedEventId });
  }

  function handleReturn(playerId: string) {
    const cashOut = latestCashOut(events, playerId);
    if (cashOut) appendReversal(cashOut.id);
  }

  function handleRemove(playerId: string) {
    const buyIn = soleBuyIn(events, playerId);
    if (buyIn && window.confirm(`把 ${nameOf(playerId)} 移出这局？`)) {
      appendReversal(buyIn.id);
      closeDialog();
    }
  }

  /** Only a player at one hand who has done nothing else, so they were added by mistake. */
  function removable(playerId: string) {
    return boughtHands(playerId) === 1 && soleBuyIn(events, playerId) !== undefined;
  }

  /** Everyone who left comes back, the organizer and the insurance seat included. */
  function handleReturnAll() {
    const gone = ledger.filter((p) => !p.seated);
    const count = gone.filter((p) => p.playerId !== INSURANCE_PLAYER_ID).length;
    if (window.confirm(`让已离桌的 ${count} 人全部回桌？`)) {
      returnAll.mutate(gone.map((p) => p.playerId));
    }
  }

  function handleToggleTimer() {
    saveGame.mutate({ ...game, timer: toggleTimer(game.timer, Date.now()) });
  }

  const seatedCount = people.filter((p) => p.seated).length;

  function goToSettlement() {
    navigate({ to: "/games/$gameId/settlement", params: { gameId } });
  }

  /** The insurance seat cannot leave by hand, so it always goes with the last players. */
  const anyoneSeated = seatedCount > 0 || seat?.seated === true;
  const pendingInsurance =
    insuranceRecords(events).filter((r) => r.status === "pending").length +
    hands.filter((hand) => hand.status === "open").length;

  function handleSettle() {
    if (seatedCount === 0 && balanceChips === 0 && pendingInsurance === 0) {
      confirmSettle(undefined);
    } else {
      setSettling(true);
    }
  }

  async function confirmSettle(handling: ImbalanceHandling | undefined) {
    try {
      if (anyoneSeated) await leaveAll.mutateAsync();
      // Going to settle stops the clock, so no more time is charged while the results are read
      const running = game.timer?.runningSince !== undefined;
      const paused =
        running && game.timer ? { ...game, timer: pauseTimer(game.timer, Date.now()) } : game;
      const next = handling ? chooseImbalanceHandling(paused, handling) : paused;
      if (next !== game) await saveGame.mutateAsync(next);
      goToSettlement();
    } catch {
      // The dialog stays open and shows the failure from the mutation state
    }
  }

  return (
    <Page
      title={<GameTitle game={game} />}
      subtitle={<GameOptionLine game={game} />}
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <GameTimer
            timer={game.timer}
            editable={editable}
            saving={saveGame.isPending}
            onToggle={handleToggleTimer}
          />
          {people.length > 0 &&
            (editable ? (
              <button type="button" onClick={handleSettle} className={settleClass}>
                结算
              </button>
            ) : (
              <Link to="/games/$gameId/settlement" params={{ gameId }} className={settleClass}>
                查看结算
              </Link>
            ))}
        </div>
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted">
          {chipRatio.chips.toLocaleString("zh-CN")} 筹码 ={" "}
          {formatGameMoney(chipRatio.amount, currency)}
          {handChips !== undefined &&
            ` · 1 手 ${handBigBlinds(handChips, bigBlindChips)} BB（${handChips.toLocaleString("zh-CN")} 筹码 / ${money(handChips)}）`}
        </p>
        {editable && (
          <Link
            to="/games/$gameId/settings"
            params={{ gameId }}
            className="inline-flex min-h-11 shrink-0 items-center text-sm text-highlight"
          >
            设置
          </Link>
        )}
      </div>

      {editable && (game.tableFee || game.wage) && game.timer?.runningSince === undefined && (
        <p role="status" className="text-sm text-highlight">
          对局计时器{game.timer ? "已暂停" : "未开始"}，台费和工资暂不计时。
        </p>
      )}

      <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          ["总 Buy-in", formatGameMoney(chipsToCents(totals.boughtChips, chipRatio), currency)],
          ["已离桌", formatGameMoney(chipsToCents(totals.cashedOutChips, chipRatio), currency)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-2 py-1.5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
        <div className="rounded-xl border border-line bg-surface px-2 py-1.5">
          <dt className="text-xs text-muted">牌桌平衡</dt>
          <dd className={cn("font-semibold", balanceChips !== 0 && "text-highlight")}>
            {formatSignedChips(balanceChips)}
          </dd>
        </div>
      </dl>

      <LedgerPlayers
        gameId={gameId}
        organizerName={nameOf(ORGANIZER_PLAYER_ID)}
        insuranceOn={game.insurance !== undefined}
        charged={{ tableFee: game.tableFee !== undefined, wage: game.wage !== undefined }}
        onJoin={(playerId) =>
          setPending({
            kind: handChips === undefined ? "buy" : "join",
            playerId,
            name: nameOf(playerId),
            review: true,
          })
        }
        onReturnAll={handleReturnAll}
        players={ledger}
        nameOf={nameOf}
        handChips={handChips}
        ratio={chipRatio}
        currency={currency}
        editable={editable}
        onEditHands={(playerId) =>
          setPending({ kind: "edit", playerId, name: nameOf(playerId), review: true })
        }
        onEditStack={(playerId) => setPending({ kind: "stack", playerId, name: nameOf(playerId) })}
        onRebuy={(playerId) => setPending({ kind: "buy", playerId, name: nameOf(playerId) })}
        onReturn={handleReturn}
        onLeave={(playerId) => setPending({ kind: "leave", playerId, name: nameOf(playerId) })}
        detailMode={detailMode}
        onDetailModeChange={setDetailMode}
        details={details}
        addPlayer={
          editable && (
            <AddPlayerToGame
              excludedIds={new Set(people.map(({ playerId }) => playerId))}
              onPick={({ id, name }: Player) =>
                setPending({ kind: handChips === undefined ? "buy" : "join", playerId: id, name })
              }
            />
          )
        }
      />

      {(appendEvent.isError ||
        adjustHands.isError ||
        leaveTable.isError ||
        returnAll.isError ||
        (saveGame.isError && !settling)) &&
        !pending && (
          <p role="alert" className="mt-2 text-sm text-highlight">
            保存失败，请重试。
          </p>
        )}

      {events.length > 0 && <LedgerLog events={events} nameOf={nameOf} />}

      {settling && (
        <SettleDialog
          seatedCount={seatedCount}
          pendingInsurance={pendingInsurance}
          balanceChips={balanceChips}
          cash={formatGameMoney(chipsToCents(Math.abs(balanceChips), chipRatio), currency)}
          initialHandling={game.imbalanceHandling}
          saving={leaveAll.isPending || saveGame.isPending}
          saveFailed={leaveAll.isError || saveGame.isError}
          onSubmit={confirmSettle}
          onClose={() => setSettling(false)}
        />
      )}

      {pending?.kind === "leave" && (
        <LeaveDialog
          key={pending.playerId}
          game={game}
          events={events}
          playerId={pending.playerId}
          name={pending.name}
          saving={leaveTable.isPending}
          saveFailed={leaveTable.isError}
          onSubmit={(chips, hands, at) => handleLeave(pending.playerId, chips, hands, at)}
          onClose={closeDialog}
        />
      )}

      {pending &&
        (pending.kind === "join" || pending.kind === "edit") &&
        handChips !== undefined && (
          <HandsDialog
            key={pending.playerId}
            title={`${HANDS_TITLE[pending.kind]} · ${pending.name}`}
            initialHands={pending.kind === "edit" ? boughtHands(pending.playerId) : 1}
            review={
              pending.review
                ? {
                    name: pending.name,
                    currentHands: pending.kind === "edit" ? boughtHands(pending.playerId) : 0,
                  }
                : undefined
            }
            handChips={handChips}
            ratio={chipRatio}
            currency={currency}
            saving={adjustHands.isPending}
            saveFailed={adjustHands.isError}
            onSubmit={(hands) => handleHands(pending.playerId, { to: hands }, closeDialog)}
            onRemove={
              pending.kind === "edit" && removable(pending.playerId)
                ? () => handleRemove(pending.playerId)
                : undefined
            }
            onClose={closeDialog}
          />
        )}

      {pending && (pending.kind === "buy" || pending.kind === "stack") && (
        <ChipAmountDialog
          key={pending.playerId}
          title={`${pending.kind === "stack" ? "筹码" : nextBuyType(events, pending.playerId) === "buy_in" ? "Buy-in" : "补码"} · ${pending.name}`}
          submitLabel="确定"
          initialChips={
            pending.kind === "stack"
              ? playerTotals(pending.playerId).stackChips
              : lastBuyChips(events)
          }
          allowZero={pending.kind === "stack"}
          selectInput={pending.kind === "stack"}
          ratio={chipRatio}
          currency={currency}
          saving={appendEvent.isPending}
          saveFailed={appendEvent.isError}
          onSubmit={handleChips}
          onClose={closeDialog}
        />
      )}
    </Page>
  );
}
