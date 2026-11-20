import {
  chipsToCents,
  chooseImbalanceHandling,
  DEFAULT_RAKE_RULE,
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
  RAKE_PLAYER_ID,
  rakeChips,
  rakeRecords,
  resumeGame,
  soleBuyIn,
  startSettling,
  summarizeByPlayer,
  toggleTimer,
  waiveCharge,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AddPlayerToGame } from "@/components/game/AddPlayerToGame";
import { ChipAmountDialog } from "@/components/game/ChipAmountDialog";
import { GameBlindsCash, GameOptionLine, GameTitle } from "@/components/game/GameOptions";
import { GameRakeSettings } from "@/components/game/GameRakeSettings";
import {
  BalanceTile,
  BuyInTile,
  GameHostLine,
  GameTiles,
  TableActionsTile,
} from "@/components/game/GameTiles";
import { GameTimer } from "@/components/game/GameTimer";
import { HandsDialog } from "@/components/game/HandsDialog";
import { LedgerLog } from "@/components/game/LedgerLog";
import { LedgerPlayers } from "@/components/game/LedgerPlayers";
import { useLiveCharges } from "@/components/game/liveCharges";
import { RakeDialog } from "@/components/game/RakeDialog";
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
import { formatGameAmount } from "@/lib/currency";
import { gameInitialsOf, gameNameOf } from "@/lib/player-name";

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
 * `buy` takes chips, and the others take hands:
 * `join` is a first buy-in and `edit` sets a target.
 */
type PendingEntry = {
  kind: "buy" | "join" | "edit";
  playerId: string;
  name: string;
  /** Hands changed from a Buy-in on the page, which shows the change before it is applied */
  review?: boolean;
};

const settleClass =
  "inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-accent-text";

const HANDS_TITLE = { join: "Buy-in", edit: "调整 Buy-in" } as const;

function GameLedger({ game }: { game: Game }) {
  const { id: gameId, currency, chipRatio, handChips, status } = game;
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
  const [raking, setRaking] = useState(false);
  // Off to begin with: folded cards already show what each player owes, behind 含费
  const [detailMode, setDetailMode] = useState(false);

  const editable = status !== "settled";
  // Set while the settle step saves and leaves, so the game is not taken straight back to the table
  const leavingToSettle = useRef(false);
  const resume = saveGame.mutate;
  // A game being settled goes back to the table by coming back to this page, however it got here
  useEffect(() => {
    if (game.status === "settling" && !leavingToSettle.current) resume(resumeGame(game));
  }, [game, resume]);

  const ledger = summarizeByPlayer(events);
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  // The insurance and rake seats are not players: the rake seat never sits, and leaves with no one
  const people = ledger.filter(
    (p) => p.playerId !== INSURANCE_PLAYER_ID && p.playerId !== RAKE_PLAYER_ID,
  );
  const balanceChips = ledgerTotals(ledger).balanceChips;
  const live = useLiveCharges(game, events);
  const totals = ledgerTotals(people);
  const nameOf = gameNameOf(players, game);
  const initialsOf = gameInitialsOf(players);

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
    const { playerId } = pending;
    appendEvent.mutate(
      {
        ...newEventMeta(gameId),
        type: nextBuyType(events, playerId),
        playerId,
        chips,
      },
      { onSuccess: closeDialog },
    );
  }

  /** The player leaves now, with the chips on the page, which the organizer has just confirmed. */
  function handleLeave(playerId: string) {
    leaveTable.mutate({ playerId, chips: playerTotals(playerId).stackChips });
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

  /** Everyone who left comes back at once, the organizer and the insurance seat included. */
  function handleReturnAll() {
    const gone = ledger.filter((p) => !p.seated && p.playerId !== RAKE_PLAYER_ID);
    returnAll.mutate(gone.map((p) => p.playerId));
  }

  /** A stack typed over on a card, saved as it is left. */
  function handleSetStack(playerId: string, chips: number) {
    appendEvent.mutate({ ...newEventMeta(gameId), type: "stack_set", playerId, chips });
  }

  const rakeTotal = rakeChips(events);
  const latestRake = rakeRecords(events).at(-1);

  /** A new rake total, saved as the change from the one before, with the pot it came from. */
  async function saveRake(totalChips: number, potChips: number | undefined, typedOver: boolean) {
    const chips = totalChips - rakeTotal;
    if (chips === 0) return;
    await appendEvent.mutateAsync({
      ...newEventMeta(gameId),
      type: "rake",
      playerId: RAKE_PLAYER_ID,
      chips,
      ...(potChips !== undefined && { potChips }),
      ...(typedOver && { typedOver: true }),
    });
  }

  /** Takes back the latest rake, back to the total saved before it. */
  async function undoRake() {
    if (!latestRake) return;
    await appendEvent.mutateAsync({
      ...newEventMeta(gameId),
      type: "reversal",
      reversedEventId: latestRake.id,
    });
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
    leavingToSettle.current = true;
    try {
      if (anyoneSeated) await leaveAll.mutateAsync();
      // Going to settle stops the clock, so no more time is charged while the results are read
      const running = game.timer?.runningSince !== undefined;
      const paused =
        running && game.timer ? { ...game, timer: pauseTimer(game.timer, Date.now()) } : game;
      const next = handling ? chooseImbalanceHandling(paused, handling) : paused;
      await saveGame.mutateAsync(startSettling(next));
      goToSettlement();
    } catch {
      // The dialog stays open and shows the failure from the mutation state
      leavingToSettle.current = false;
    }
  }

  return (
    <Page
      title={<GameTitle game={game} />}
      titleNote={<GameBlindsCash game={game} />}
      subtitle={<GameOptionLine game={game} settings={editable ? { kind: "edit" } : undefined} />}
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
      <GameHostLine game={game} />
      <GameTiles>
        <BuyInTile game={game} boughtChips={totals.boughtChips} />
        <TableActionsTile gameId={gameId} insuranceOn={game.insurance !== undefined} />
        <BalanceTile game={game} balanceChips={balanceChips} />
      </GameTiles>

      <LedgerPlayers
        game={game}
        events={events}
        organizerName={nameOf(ORGANIZER_PLAYER_ID)}
        live={live}
        onWaive={(key, waived) => saveGame.mutate(waiveCharge(game, key, waived))}
        waiving={saveGame.isPending}
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
        initialsOf={initialsOf}
        editable={editable}
        onEditHands={(playerId) =>
          setPending({ kind: "edit", playerId, name: nameOf(playerId), review: true })
        }
        onSetStack={handleSetStack}
        onRebuy={(playerId) => setPending({ kind: "buy", playerId, name: nameOf(playerId) })}
        onReturn={handleReturn}
        onLeave={handleLeave}
        onRake={() => setRaking(true)}
        detailMode={detailMode}
        onDetailModeChange={setDetailMode}
        addPlayer={
          editable
            ? (variant) => (
                <AddPlayerToGame
                  variant={variant}
                  excludedIds={new Set(people.map(({ playerId }) => playerId))}
                  onPick={({ id, name }: Player) =>
                    setPending({
                      kind: handChips === undefined ? "buy" : "join",
                      playerId: id,
                      name,
                    })
                  }
                />
              )
            : undefined
        }
      />

      {(appendEvent.isError ||
        adjustHands.isError ||
        leaveTable.isError ||
        returnAll.isError ||
        (saveGame.isError && !settling)) &&
        !pending &&
        !raking && (
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
          cash={formatGameAmount(chipsToCents(Math.abs(balanceChips), chipRatio), currency)}
          organizerName={nameOf(ORGANIZER_PLAYER_ID)}
          initialHandling={game.imbalanceHandling}
          saving={leaveAll.isPending || saveGame.isPending}
          saveFailed={leaveAll.isError || saveGame.isError}
          onSubmit={confirmSettle}
          onClose={() => setSettling(false)}
        />
      )}

      {raking && (
        <RakeDialog
          currentChips={rakeTotal}
          rule={game.rake ?? DEFAULT_RAKE_RULE}
          blinds={{ smallBlindChips: game.smallBlindChips, bigBlindChips: game.bigBlindChips }}
          settings={<GameRakeSettings game={game} />}
          entries={rakeRecords(events)}
          undoTo={latestRake && rakeTotal - latestRake.chips}
          saving={appendEvent.isPending}
          saveFailed={appendEvent.isError}
          onSave={saveRake}
          onUndo={undoRake}
          onClose={() => {
            setRaking(false);
            appendEvent.reset();
          }}
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

      {pending?.kind === "buy" && (
        <ChipAmountDialog
          key={pending.playerId}
          title={`${nextBuyType(events, pending.playerId) === "buy_in" ? "Buy-in" : "补码"} · ${pending.name}`}
          submitLabel="确定"
          initialChips={lastBuyChips(events)}
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
