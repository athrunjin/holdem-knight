import {
  type Game,
  INSURANCE_PLAYER_ID,
  type InsuranceHand,
  type InsuranceRecord,
  insuranceRecords,
  summarizeByPlayer,
  type TieOuts,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  type BoughtInsurance,
  InsuranceCalculator,
} from "@/components/insurance/InsuranceCalculator";
import { InsuranceRecords } from "@/components/insurance/InsuranceRecords";
import { Page } from "@/components/Page";
import { useGame, useSaveGame } from "@/data/games";
import {
  newInsuranceHand,
  useBuyInsurance,
  useDiscardInsuranceHand,
  useEnterStack,
  useFinishInsuranceHand,
  useInsuranceHands,
  useSaveInsuranceHand,
  useSettleInsurance,
  useUndoInsurance,
  useUndoInsuranceHand,
} from "@/data/insurance";
import { useLedger } from "@/data/ledger";
import { usePlayers } from "@/data/players";
import { formatSignedChips } from "@/lib/chips";
import { gameNameOf } from "@/lib/player-name";

export const Route = createFileRoute("/games/$gameId/insurance")({
  component: InsurancePage,
});

const chipText = (chips: number) => chips.toLocaleString("zh-CN");

function InsurancePage() {
  const { gameId } = Route.useParams();
  const { data: game } = useGame(gameId);

  if (!game) return null;
  return <GameInsurance game={game} />;
}

function GameInsurance({ game }: { game: Game }) {
  const { id: gameId, handChips, insurance, status } = game;
  const { data: events = [] } = useLedger(gameId);
  const { data: players = [] } = usePlayers();
  const saveGame = useSaveGame();
  const buyInsurance = useBuyInsurance(gameId);
  const settleInsurance = useSettleInsurance(gameId);
  const undoInsurance = useUndoInsurance(gameId);

  const navigate = Route.useNavigate();
  const editable = status !== "settled";
  const nameOf = gameNameOf(players, game);
  const ledger = summarizeByPlayer(events);
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  const seats = ledger
    .filter((p) => p.seated && p.playerId !== INSURANCE_PLAYER_ID)
    .map((p) => ({ id: p.playerId, name: nameOf(p.playerId) }));
  const records = insuranceRecords(events)
    .filter(({ purchase }) => purchase.handId === undefined)
    .toReversed();
  const { data: hands } = useInsuranceHands(gameId);
  const saveHand = useSaveInsuranceHand(gameId);
  const enterStack = useEnterStack(gameId);
  const discardHand = useDiscardInsuranceHand(gameId);
  const finishHand = useFinishInsuranceHand(gameId);
  const undoHand = useUndoInsuranceHand(gameId);
  const finished = hands?.filter((hand) => hand.status === "done") ?? [];
  const openHand = hands?.find((hand) => hand.status === "open");

  async function handleBuy({ playerId, option, oddsHundredths, outs, street }: BoughtInsurance) {
    try {
      return await buyInsurance.mutateAsync({
        playerId,
        chips: option.premiumChips,
        payoutChips: option.payoutChips,
        outs,
        oddsHundredths,
        street,
      });
    } catch {
      return undefined; // The page shows the failure from the mutation
    }
  }

  function handleRevise(purchaseId: string) {
    const record = records.find(({ purchase }) => purchase.id === purchaseId);
    if (!record) return true;
    if (
      record.status !== "pending" &&
      !window.confirm("这笔保险已开奖，修改会撤销它的结果。继续？")
    ) {
      return false;
    }
    undoInsurance.mutate(record);
    return true;
  }

  /** The switch here is the game's own setting, so flipping it changes the rest of the game. */
  function handleTieOuts(tieOuts: TieOuts) {
    if (!insurance) return;
    const message =
      tieOuts === "include"
        ? "这局设置的是平分牌不算 outs。开启后会修改本局设置，之后的保险都把平分牌算作 outs。继续？"
        : "这局设置的是平分牌算 outs。关闭后会修改本局设置，之后的保险不再把平分牌算作 outs。继续？";
    if (window.confirm(message)) saveGame.mutate({ ...game, insurance: { ...insurance, tieOuts } });
  }

  function handleSettle(record: InsuranceRecord, hit: boolean) {
    if (handChips !== undefined) settleInsurance.mutate({ record, hit, handChips });
  }

  function handleUndo(record: InsuranceRecord) {
    if (window.confirm("撤销这笔保险？它的盈亏也会一起撤销。")) undoInsurance.mutate(record);
  }

  function handleUndoHand(hand: InsuranceHand) {
    if (window.confirm("撤销这手保险？它的盈亏会一起撤销。")) undoHand.mutate(hand.id);
  }

  const failed =
    saveGame.isError ||
    buyInsurance.isError ||
    settleInsurance.isError ||
    undoInsurance.isError ||
    saveHand.isError ||
    enterStack.isError ||
    finishHand.isError ||
    undoHand.isError;

  return (
    <Page
      title="保险"
      titleNote={
        seat && (
          <p className="text-sm text-muted">
            保险筹码 {chipText(seat.stackChips)} · 盈亏 {formatSignedChips(seat.netChips)}
          </p>
        )
      }
      actions={
        <Link
          to="/games/$gameId"
          params={{ gameId }}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-highlight"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden />
          返回牌局
        </Link>
      }
    >
      {/* Ends clear of the records line pinned below */}
      <div className="pb-11">
        {!insurance && <p className="text-muted">这局没有开启保险，可以在设置里开启。</p>}

        {insurance && editable && hands && (
          <InsuranceCalculator
            rule={insurance}
            onTieOutsChange={handleTieOuts}
            seats={seats}
            saving={buyInsurance.isPending}
            recorder={{
              onBuy: handleBuy,
              onRevise: handleRevise,
              boughtIds: new Set(records.map(({ purchase }) => purchase.id)),
            }}
            handStore={{
              save: saveHand.mutate,
              enterStack: (playerId, chips) => enterStack.mutate({ playerId, chips }),
              discard: discardHand.mutate,
              finish: async (hand) => {
                if (handChips === undefined) return;
                await finishHand.mutateAsync({ hand, handChips });
                navigate({ to: "/games/$gameId", params: { gameId } });
              },
            }}
            seat={
              handChips === undefined ? undefined : { stackChips: seat?.stackChips ?? 0, handChips }
            }
            openHand={openHand}
            createHand={() => newInsuranceHand(gameId)}
          />
        )}

        {failed && (
          <p role="alert" className="mt-2 text-sm text-highlight">
            保存失败，请重试。
          </p>
        )}
      </div>

      {(insurance || finished.length + records.length > 0) && (
        <InsuranceRecords
          hands={finished}
          records={records}
          nameOf={nameOf}
          actions={
            editable
              ? {
                  busy: settleInsurance.isPending || undoInsurance.isPending || undoHand.isPending,
                  onSettle: handleSettle,
                  onUndo: handleUndo,
                  onUndoHand: handleUndoHand,
                }
              : undefined
          }
        />
      )}
    </Page>
  );
}
