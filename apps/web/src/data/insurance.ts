import {
  adjustHands,
  blankInsuranceHand,
  type Game,
  handResult,
  INSURANCE_PLAYER_ID,
  type InsuranceBuyEvent,
  type InsuranceHand,
  type InsuranceRecord,
  type InsuranceUndo,
  insuranceSeatChange,
  insuranceTopUp,
  type LedgerEvent,
  latestCashOut,
  playerHandResults,
  premiumBuyIns,
  type SavedInsuranceRule,
  type SavedOddsTable,
  summarizeByPlayer,
  undoInsurance,
  undoInsuranceHand,
} from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { currentOrganizerId, repository } from ".";
import { GAME_CONFIGS_KEY, releaseGameConfigs } from "./game-configs";
import { newEventMeta } from "./ledger";

const RULES_KEY = ["insurance-rules"] as const;

export function useInsuranceRules() {
  return useQuery({ queryKey: RULES_KEY, queryFn: () => repository.insuranceRules.list() });
}

export function newSavedRule(name: string, rule: SavedInsuranceRule["rule"]): SavedInsuranceRule {
  return {
    id: crypto.randomUUID(),
    organizerId: currentOrganizerId(),
    name,
    rule,
    createdAt: Date.now(),
  };
}

export function useSaveInsuranceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: SavedInsuranceRule) =>
      repository.insuranceRules.save({ ...rule, updatedAt: Date.now() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useRemoveInsuranceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await releaseGameConfigs({ section: "insurance", id });
      await repository.insuranceRules.remove(id);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: RULES_KEY }),
        queryClient.invalidateQueries({ queryKey: GAME_CONFIGS_KEY }),
      ]),
  });
}

const ODDS_TABLES_KEY = ["odds-tables"] as const;

export function useOddsTables() {
  return useQuery({ queryKey: ODDS_TABLES_KEY, queryFn: () => repository.oddsTables.list() });
}

export function newOddsTable(name: string, oddsHundredths: readonly number[]): SavedOddsTable {
  return {
    id: crypto.randomUUID(),
    organizerId: currentOrganizerId(),
    name,
    oddsHundredths,
    createdAt: Date.now(),
  };
}

export function useSaveOddsTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (table: SavedOddsTable) =>
      repository.oddsTables.save({ ...table, updatedAt: Date.now() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ODDS_TABLES_KEY }),
  });
}

export function useRemoveOddsTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await releaseGameConfigs({ oddsTableId: id });
      await repository.oddsTables.remove(id);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ODDS_TABLES_KEY }),
        queryClient.invalidateQueries({ queryKey: GAME_CONFIGS_KEY }),
      ]),
  });
}

/** Events that bring the insurance seat in line with the game's settings. */
export function seatEvents(game: Game, events: readonly LedgerEvent[]): LedgerEvent[] {
  const { reversedEventIds, buyInChips } = insuranceSeatChange(game, events);
  const occurredAt = Date.now();
  return [
    ...reversedEventIds.map(
      (reversedEventId): LedgerEvent => ({
        ...newEventMeta(game.id, occurredAt),
        type: "reversal",
        reversedEventId,
      }),
    ),
    ...(buyInChips === undefined
      ? []
      : [
          {
            ...newEventMeta(game.id, occurredAt),
            type: "buy_in" as const,
            playerId: INSURANCE_PLAYER_ID,
            chips: buyInChips,
          },
        ]),
  ];
}

/** Insurance is sold after a settle attempt seated everyone out, so the seat comes back first. */
function reseat(gameId: string, events: readonly LedgerEvent[], occurredAt: number) {
  const cashOut = latestCashOut(events, INSURANCE_PLAYER_ID);
  if (!cashOut) return [];
  return [
    {
      ...newEventMeta(gameId, occurredAt),
      type: "reversal" as const,
      reversedEventId: cashOut.id,
    },
  ];
}

/** An undo worked out in `core`, as events: the reversals together, then the stacks that stay. */
function undoEvents(gameId: string, undo: InsuranceUndo): LedgerEvent[] {
  const occurredAt = Date.now();
  return [
    ...undo.reversedEventIds.map(
      (reversedEventId): LedgerEvent => ({
        ...newEventMeta(gameId, occurredAt),
        type: "reversal",
        reversedEventId,
      }),
    ),
    ...(undo.seatTopUpChips > 0
      ? [
          {
            ...newEventMeta(gameId, occurredAt),
            type: "rebuy" as const,
            playerId: INSURANCE_PLAYER_ID,
            chips: undo.seatTopUpChips,
          },
        ]
      : []),
    // A moment later, as a stack set in the same change as a hand taken back would move with it
    ...undo.keptStacks.map(
      (stack): LedgerEvent => ({
        ...newEventMeta(gameId, occurredAt + 1),
        type: "stack_set",
        ...stack,
      }),
    ),
  ];
}

function ledgerScope(gameId: string) {
  return { id: `ledger-${gameId}` };
}

export function newInsuranceHand(gameId: string): InsuranceHand {
  return blankInsuranceHand({
    id: crypto.randomUUID(),
    organizerId: currentOrganizerId(),
    gameId,
    createdAt: Date.now(),
  });
}

const handsKey = (gameId: string) => ["insurance-hands", gameId] as const;

export function useInsuranceHands(gameId: string) {
  return useQuery({
    queryKey: handsKey(gameId),
    queryFn: () => repository.insuranceHands.listByGame(gameId),
  });
}

export function useSaveInsuranceHand(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: (hand: InsuranceHand) => repository.insuranceHands.save(hand),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: handsKey(gameId) }),
  });
}

/** The size of a hand in this game, for the whole hands the seat buys to give results back. */
interface HandUndoInput {
  readonly handId: string;
  readonly handChips: number | undefined;
}

interface RecordUndoInput {
  readonly record: InsuranceRecord;
  readonly handChips: number | undefined;
}

/**
 * Drops a hand. One whose money reached the ledger before its own save failed still reads as open,
 * so what it wrote is taken back with it and never left behind with nothing to show it.
 */
export function useDiscardInsuranceHand(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({ handId, handChips }: HandUndoInput) => {
      const id = handId;
      const events = await repository.ledger.listByGame(gameId);
      const written = undoEvents(gameId, undoInsuranceHand(events, id, handChips));
      if (written.length > 0) await repository.ledger.appendAll(written);
      await repository.insuranceHands.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger", gameId] });
      queryClient.invalidateQueries({ queryKey: handsKey(gameId) });
    },
  });
}

function belongsToHand(event: LedgerEvent, handId: string) {
  return "handId" in event && event.handId === handId;
}

interface FinishInput {
  readonly hand: InsuranceHand;
  readonly handChips: number;
  /**
   * The players whose chips after the hand go to the game. For the others only the insurance is
   * written, and the organizer counts their chips at the table.
   */
  readonly syncPlayerIds: readonly string[];
  /** Chips the seat buys beyond what it must to pay, or below 0 the Buy-ins it gives back. */
  readonly seatExtraChips: number;
  /** The seat's chips as counted, where they differ from what the hand works out. */
  readonly seatStackChips?: number;
  /**
   * Whether the seat's Buy-ins change with the hand, those it needs to pay included, and whether
   * its chips do. Chips left alone stay what they were before the hand, to be counted at the table.
   */
  readonly syncSeatBuyIns: boolean;
  readonly syncSeatChips: boolean;
}

/** The hand's money reaches the ledger in one write, and only here. */
export function useFinishInsuranceHand(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({
      hand,
      handChips,
      syncPlayerIds,
      seatExtraChips,
      seatStackChips,
      syncSeatBuyIns,
      syncSeatChips,
    }: FinishInput) => {
      const events = await repository.ledger.listByGame(gameId);
      const written = events.some((e) => belongsToHand(e, hand.id));
      if (!written) {
        const ledger = summarizeByPlayer(events);
        // A player not synced has no stack set, and so no premium found short against one
        const results = playerHandResults(hand).filter(
          ({ playerId }) =>
            syncPlayerIds.includes(playerId) &&
            ledger.some((p) => p.playerId === playerId && p.seated),
        );
        const buyIns = premiumBuyIns(results, handChips);
        const stackEvents = results.flatMap(({ playerId, stackChips }) => {
          const chips = buyIns.find((b) => b.playerId === playerId)?.stackChips ?? stackChips;
          return chips === null ? [] : [{ playerId, chips }];
        });
        const seat = ledger.find((p) => p.playerId === INSURANCE_PLAYER_ID);
        const cashOut = latestCashOut(events, INSURANCE_PLAYER_ID);
        const stack = (seat?.stackChips ?? 0) + (cashOut?.chips ?? 0);
        const { premiumChips, payoutChips } = handResult(hand);
        const topUp = syncSeatBuyIns
          ? insuranceTopUp(stack + premiumChips, payoutChips, handChips) + seatExtraChips
          : 0;
        const occurredAt = Date.now();
        const handId = hand.id;
        // Buy-ins given back are taken from the seat's own, latest first, as on the game's page
        const given =
          topUp < 0
            ? adjustHands(events, INSURANCE_PLAYER_ID, handChips, { by: topUp / handChips })
            : undefined;
        const givenChips = given
          ? given.reversedEventIds.reduce(
              (total, id) => total + (chipsOf(events.find((e) => e.id === id)) ?? 0),
              0,
            ) - (given.buy?.chips ?? 0)
          : 0;
        const seatBuy = given
          ? given.buy
          : topUp > 0
            ? { type: "rebuy" as const, chips: topUp }
            : undefined;
        const seatAfter = stack + premiumChips - payoutChips + (given ? -givenChips : topUp);
        // Never below nothing, should fewer Buy-ins be left than the hand pays out
        const seatTarget = syncSeatChips ? (seatStackChips ?? Math.max(0, seatAfter)) : stack;
        await repository.ledger.appendAll([
          ...reseat(gameId, events, occurredAt),
          ...(given?.reversedEventIds ?? []).map(
            (reversedEventId): LedgerEvent => ({
              ...newEventMeta(gameId, occurredAt),
              type: "reversal",
              reversedEventId,
            }),
          ),
          ...(seatBuy
            ? [{ ...newEventMeta(gameId, occurredAt), ...seatBuy, playerId: INSURANCE_PLAYER_ID }]
            : []),
          ...buyIns.map(
            ({ playerId, buyInChips }): LedgerEvent => ({
              ...newEventMeta(gameId, occurredAt),
              type: "rebuy",
              handId,
              playerId,
              chips: buyInChips,
            }),
          ),
          // A moment later: a stack typed in the same change as a buy-in would add to it
          ...stackEvents.map(
            (stack): LedgerEvent => ({
              ...newEventMeta(gameId, occurredAt + 1),
              type: "stack_set",
              handId,
              ...stack,
            }),
          ),
          // The seat's chips as the organizer counted them or left them, over what the hand works out
          ...(given || seatTarget !== seatAfter
            ? [
                {
                  ...newEventMeta(gameId, occurredAt + 1),
                  type: "stack_set" as const,
                  handId,
                  playerId: INSURANCE_PLAYER_ID,
                  chips: seatTarget,
                },
              ]
            : []),
          ...hand.purchases.flatMap((purchase): LedgerEvent[] => {
            const { playerId, street, oddsHundredths } = purchase;
            const bought = {
              ...newEventMeta(gameId, occurredAt),
              type: "insurance_buy" as const,
              handId,
              playerId,
              chips: purchase.premiumChips,
              payoutChips: purchase.payoutChips,
              outs: purchase.outsCount ?? purchase.outs.length,
              ...(purchase.tie && { tie: true }),
              oddsHundredths,
              street,
            };
            const hit = purchase.hit === true;
            return [
              bought,
              {
                ...newEventMeta(gameId, occurredAt),
                type: "insurance_settle",
                handId,
                purchaseId: bought.id,
                playerId,
                hit,
                chips: hit ? purchase.payoutChips : 0,
              },
            ];
          }),
        ]);
      }
      await repository.insuranceHands.save({ ...hand, status: "done" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger", gameId] });
      queryClient.invalidateQueries({ queryKey: handsKey(gameId) });
    },
  });
}

/**
 * Takes a finished hand back, by the rules of `undoInsuranceHand`. Hands the seat added to pay it
 * stay bought. Asked again after a failure half way, it takes back only what is still there.
 */
export function useUndoInsuranceHand(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({ handId, handChips }: HandUndoInput) => {
      const events = await repository.ledger.listByGame(gameId);
      const written = undoEvents(gameId, undoInsuranceHand(events, handId, handChips));
      if (written.length > 0) await repository.ledger.appendAll(written);
      await repository.insuranceHands.remove(handId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger", gameId] });
      queryClient.invalidateQueries({ queryKey: handsKey(gameId) });
    },
  });
}

export type InsurancePurchase = Pick<
  InsuranceBuyEvent,
  "playerId" | "chips" | "payoutChips" | "outs" | "tie" | "oddsHundredths" | "street"
>;

interface SettleInput {
  readonly record: InsuranceRecord;
  readonly hit: boolean;
  readonly handChips: number;
}

export function useSettleInsurance(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({ record: { purchase }, hit, handChips }: SettleInput) => {
      const events = await repository.ledger.listByGame(gameId);
      const seat = summarizeByPlayer(events).find((p) => p.playerId === INSURANCE_PLAYER_ID);
      const cashOut = latestCashOut(events, INSURANCE_PLAYER_ID);
      const stack = (seat?.stackChips ?? 0) + (cashOut?.chips ?? 0);
      const chips = hit ? purchase.payoutChips : 0;
      const topUp = insuranceTopUp(stack + purchase.chips, chips, handChips);
      const occurredAt = Date.now();
      const { id: purchaseId, playerId } = purchase;
      await repository.ledger.appendAll([
        ...reseat(gameId, events, occurredAt),
        ...(topUp > 0
          ? [
              {
                ...newEventMeta(gameId, occurredAt),
                type: "rebuy" as const,
                playerId: INSURANCE_PLAYER_ID,
                chips: topUp,
              },
            ]
          : []),
        {
          ...newEventMeta(gameId, occurredAt),
          type: "insurance_settle",
          purchaseId,
          playerId,
          hit,
          chips,
        },
      ]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

/** Takes a purchase back, with its result if it has one. Hands added to pay it stay bought. */
export function useUndoInsurance(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({ record, handChips }: RecordUndoInput) => {
      const events = await repository.ledger.listByGame(gameId);
      const written = undoEvents(gameId, undoInsurance(events, record, handChips));
      if (written.length > 0) await repository.ledger.appendAll(written);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

/** The chips of a buy, for an event that is one. */
function chipsOf(event: LedgerEvent | undefined): number | undefined {
  return event && (event.type === "buy_in" || event.type === "rebuy") ? event.chips : undefined;
}
