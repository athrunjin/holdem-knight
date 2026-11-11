import {
  blankInsuranceHand,
  type Game,
  handResult,
  INSURANCE_PLAYER_ID,
  type InsuranceBuyEvent,
  type InsuranceHand,
  type InsuranceRecord,
  insuranceSeatChange,
  insuranceTopUp,
  type LedgerEvent,
  latestCashOut,
  playerHandResults,
  premiumBuyIns,
  type SavedInsuranceRule,
  type SavedOddsTable,
  summarizeByPlayer,
} from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GUEST_ORGANIZER_ID, repository } from ".";
import { newEventMeta } from "./ledger";

const RULES_KEY = ["insurance-rules"] as const;

export function useInsuranceRules() {
  return useQuery({ queryKey: RULES_KEY, queryFn: () => repository.insuranceRules.list() });
}

export function newSavedRule(name: string, rule: SavedInsuranceRule["rule"]): SavedInsuranceRule {
  return {
    id: crypto.randomUUID(),
    organizerId: GUEST_ORGANIZER_ID,
    name,
    rule,
    createdAt: Date.now(),
  };
}

export function useSaveInsuranceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: SavedInsuranceRule) => repository.insuranceRules.save(rule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useRemoveInsuranceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.insuranceRules.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

const ODDS_TABLES_KEY = ["odds-tables"] as const;

export function useOddsTables() {
  return useQuery({ queryKey: ODDS_TABLES_KEY, queryFn: () => repository.oddsTables.list() });
}

export function newOddsTable(name: string, oddsHundredths: readonly number[]): SavedOddsTable {
  return {
    id: crypto.randomUUID(),
    organizerId: GUEST_ORGANIZER_ID,
    name,
    oddsHundredths,
    createdAt: Date.now(),
  };
}

export function useSaveOddsTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (table: SavedOddsTable) => repository.oddsTables.save(table),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ODDS_TABLES_KEY }),
  });
}

export function useRemoveOddsTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.oddsTables.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ODDS_TABLES_KEY }),
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

function ledgerScope(gameId: string) {
  return { id: `ledger-${gameId}` };
}

export function newInsuranceHand(gameId: string): InsuranceHand {
  return blankInsuranceHand({
    id: crypto.randomUUID(),
    organizerId: GUEST_ORGANIZER_ID,
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

interface EnteredStack {
  readonly playerId: string;
  readonly chips: number;
}

/**
 * An all-in player's chips are counted at the table, so they are the true stack and go straight to
 * the game. It stays if the hand is discarded or undone, like any typed stack.
 */
export function useEnterStack(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({ playerId, chips }: EnteredStack) => {
      const events = await repository.ledger.listByGame(gameId);
      const player = summarizeByPlayer(events).find((p) => p.playerId === playerId);
      if (player?.stackChips === chips) return;
      await repository.ledger.append({
        ...newEventMeta(gameId, Date.now()),
        type: "stack_set",
        playerId,
        chips,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

export function useDiscardInsuranceHand(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: (id: string) => repository.insuranceHands.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: handsKey(gameId) }),
  });
}

function belongsToHand(event: LedgerEvent, handId: string) {
  return "handId" in event && event.handId === handId;
}

interface FinishInput {
  readonly hand: InsuranceHand;
  readonly handChips: number;
}

/** The hand's money reaches the ledger in one write, and only here. */
export function useFinishInsuranceHand(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({ hand, handChips }: FinishInput) => {
      const events = await repository.ledger.listByGame(gameId);
      const written = events.some((e) => belongsToHand(e, hand.id));
      if (!written) {
        const ledger = summarizeByPlayer(events);
        const results = playerHandResults(hand).filter(({ playerId }) =>
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
        const topUp = insuranceTopUp(stack + premiumChips, payoutChips, handChips);
        const occurredAt = Date.now();
        const handId = hand.id;
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
          ...hand.purchases.flatMap((purchase): LedgerEvent[] => {
            const { playerId, street, oddsHundredths } = purchase;
            const bought = {
              ...newEventMeta(gameId, occurredAt),
              type: "insurance_buy" as const,
              handId,
              playerId,
              chips: purchase.premiumChips,
              payoutChips: purchase.payoutChips,
              outs: purchase.outs.length,
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

/** Takes a finished hand back whole. Hands added to pay it stay bought. */
export function useUndoInsuranceHand(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async (handId: string) => {
      const events = await repository.ledger.listByGame(gameId);
      const occurredAt = Date.now();
      await repository.ledger.appendAll(
        events
          .filter((e) => belongsToHand(e, handId))
          .map(
            ({ id }): LedgerEvent => ({
              ...newEventMeta(gameId, occurredAt),
              type: "reversal",
              reversedEventId: id,
            }),
          ),
      );
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
  "playerId" | "chips" | "payoutChips" | "outs" | "oddsHundredths" | "street"
>;

export function useBuyInsurance(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async (purchase: InsurancePurchase) => {
      const events = await repository.ledger.listByGame(gameId);
      const occurredAt = Date.now();
      const meta = newEventMeta(gameId, occurredAt);
      await repository.ledger.appendAll([
        ...reseat(gameId, events, occurredAt),
        { ...meta, type: "insurance_buy", ...purchase },
      ]);
      return meta.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

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
    mutationFn: async ({ purchase, settleId }: InsuranceRecord) => {
      const occurredAt = Date.now();
      await repository.ledger.appendAll(
        [settleId, purchase.id].flatMap((reversedEventId): LedgerEvent[] =>
          reversedEventId
            ? [{ ...newEventMeta(gameId, occurredAt), type: "reversal", reversedEventId }]
            : [],
        ),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}
