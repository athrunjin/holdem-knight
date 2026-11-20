import {
  type Game,
  INSURANCE_PLAYER_ID,
  type InsuranceHand,
  type InsuranceRecord,
  type InsuranceRuleForm,
  insuranceRecords,
  ORGANIZER_PLAYER_ID,
  parseInsuranceRule,
  ruleAtStakes,
  summarizeByPlayer,
  toInsuranceRuleForm,
} from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type BoughtInsurance,
  InsuranceCalculator,
  type InsuranceMode,
} from "@/components/insurance/InsuranceCalculator";
import { InsuranceSetup, ModeTitle } from "@/components/insurance/InsuranceHeader";
import { InsuranceRecords } from "@/components/insurance/InsuranceRecords";
import { configSourceOf, type InsuranceChoice } from "@/components/insurance/InsuranceSettings";
import { Page } from "@/components/Page";
import { useGame, useSaveGame } from "@/data/games";
import {
  newInsuranceHand,
  useBuyInsurance,
  useDiscardInsuranceHand,
  useEnterStack,
  useFinishInsuranceHand,
  useInsuranceHands,
  useInsuranceRules,
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
  const [mode, setMode] = useState<InsuranceMode>("cards");
  const { data: savedRules = [] } = useInsuranceRules();
  // The settings as changed on this page, shown at once while the game is being saved
  const [edited, setEdited] = useState<Pick<InsuranceChoice, "source" | "form">>();
  const choice: InsuranceChoice | undefined = insurance && {
    enabled: true,
    source: edited?.source ?? configSourceOf(insurance, savedRules, game.sources?.insurance),
    form: edited?.form ?? toInsuranceRuleForm(insurance),
  };
  // One rule for as long as the settings read the same, so the hand is not priced again for nothing
  const formKey = JSON.stringify(choice?.form);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the form counts by what it reads, not by which object it is
  const rule = useMemo(() => {
    const parsed = choice && parseInsuranceRule(choice.form);
    const kept = parsed?.ok ? parsed.rule : insurance;
    // Priced to the smallest chip at this game's small blind
    return kept && ruleAtStakes(kept, game.smallBlindChips);
  }, [formKey, insurance, game.smallBlindChips]);

  /**
   * The settings here are the game's own, so a change is a change to the game, and is asked about
   * first. A new name for the same settings changes nothing in the game and goes through.
   */
  function setChoice(next: InsuranceChoice) {
    const parsed = parseInsuranceRule(next.form);
    const changed = JSON.stringify(next.form) !== JSON.stringify(choice?.form);
    // Which of two tables with the same odds is named changes no price, so it is kept unasked
    const terms = ({ oddsTableId: _, ...rest }: InsuranceRuleForm) => JSON.stringify(rest);
    const repriced = choice === undefined || terms(next.form) !== terms(choice.form);
    if (repriced && !window.confirm("这个修改会应用到本局，之后的保险都按新设置计算。继续？")) {
      return false;
    }
    setEdited({ source: next.source, form: next.form });
    if (changed && parsed.ok) saveGame.mutate({ ...game, insurance: parsed.rule });
    return true;
  }

  const nameOf = gameNameOf(players, game);
  const ledger = summarizeByPlayer(events);
  const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
  // In the table's order: an organizer who plays first, then the players as they bought in
  const seated = ledger.filter((p) => p.seated && p.playerId !== INSURANCE_PLAYER_ID);
  const seats = [
    ...seated.filter((p) => p.playerId === ORGANIZER_PLAYER_ID),
    ...seated.filter((p) => p.playerId !== ORGANIZER_PLAYER_ID),
  ].map((p) => ({ id: p.playerId, name: nameOf(p.playerId), chips: p.stackChips }));
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

  async function handleBuy(bought: BoughtInsurance) {
    const { playerId, option, oddsHundredths, outs, street } = bought;
    try {
      return await buyInsurance.mutateAsync({
        playerId,
        chips: option.premiumChips,
        payoutChips: option.payoutChips,
        outs,
        ...(bought.tie && { tie: true }),
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
      // A game being played has the calculator, and so its two ways of working as the title
      title={choice && editable ? <ModeTitle mode={mode} onChange={setMode} /> : "保险"}
      subtitle={
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
          aria-label="返回牌局"
          className="-mr-2 grid size-11 shrink-0 place-items-center text-highlight"
        >
          <X className="size-6" strokeWidth={1.75} aria-hidden />
        </Link>
      }
    >
      {/* Ends clear of the records line pinned below */}
      <div className="pb-11">
        {!insurance && <p className="text-muted">这局没有开启保险，可以在设置里开启。</p>}

        {choice && editable && (
          <InsuranceSetup
            value={choice}
            stakes={{ smallBlindChips: game.smallBlindChips }}
            onChange={setChoice}
            settleTyping
          />
        )}

        {insurance && editable && hands && (
          <InsuranceCalculator
            mode={mode}
            rule={rule ?? insurance}
            seats={seats}
            saving={buyInsurance.isPending}
            recorder={{
              onBuy: handleBuy,
              onRevise: handleRevise,
              boughtIds: new Set(records.map(({ purchase }) => purchase.id)),
              onSettle: (purchaseId, hit) => {
                const record = records.find(({ purchase }) => purchase.id === purchaseId);
                if (record?.status === "pending") handleSettle(record, hit);
              },
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
