import {
  adjustHands,
  type HandChange,
  type LedgerEvent,
  latestCashOut,
  summarizeByPlayer,
} from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GUEST_ORGANIZER_ID, repository } from ".";

export function newEventMeta(gameId: string, occurredAt = Date.now()) {
  return {
    id: crypto.randomUUID(),
    organizerId: GUEST_ORGANIZER_ID,
    gameId,
    occurredAt,
  };
}

/** Writes for one game run in a queue, so each rapid tap builds on the previous result. */
function ledgerScope(gameId: string) {
  return { id: `ledger-${gameId}` };
}

export function useLedger(gameId: string) {
  return useQuery({
    queryKey: ["ledger", gameId, "events"],
    queryFn: () => repository.ledger.listByGame(gameId),
  });
}

export function useAppendEvent(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: (event: LedgerEvent) => repository.ledger.append(event),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

/** Events that bring a player to the new hand count. They share a timestamp so they count as one change. */
function handEvents(
  gameId: string,
  events: readonly LedgerEvent[],
  input: HandsInput,
  occurredAt = Date.now(),
) {
  const { playerId, handChips, change } = input;
  const { reversedEventIds, buy } = adjustHands(events, playerId, handChips, change);
  return [
    ...reversedEventIds.map(
      (reversedEventId): LedgerEvent => ({
        ...newEventMeta(gameId, occurredAt),
        type: "reversal",
        reversedEventId,
      }),
    ),
    ...(buy ? [{ ...newEventMeta(gameId, occurredAt), ...buy, playerId }] : []),
  ];
}

interface HandsInput {
  readonly playerId: string;
  readonly handChips: number;
  readonly change: HandChange;
}

export function useAdjustHands(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async (input: HandsInput) => {
      const events = await repository.ledger.listByGame(gameId);
      await repository.ledger.appendAll(handEvents(gameId, events, input));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

interface LeaveInput {
  readonly playerId: string;
  readonly chips: number;
  /** Final hands, for games that record them. */
  readonly hands?: { readonly handChips: number; readonly count: number };
  /**
   * When the player left, if not now: the moment their leave dialog opened, so the charges it
   * showed are the charges made. Nothing else is written while the dialog is open.
   */
  readonly at?: number;
}

export function useLeaveTable(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async ({ playerId, chips, hands, at = Date.now() }: LeaveInput) => {
      const events = await repository.ledger.listByGame(gameId);
      const adjustment = hands
        ? handEvents(
            gameId,
            events,
            { playerId, handChips: hands.handChips, change: { to: hands.count } },
            at,
          )
        : [];
      // One millisecond later, so the cash-out always sorts after the hand change
      const leftAt = at + 1;
      await repository.ledger.appendAll([
        ...adjustment,
        { ...newEventMeta(gameId, leftAt), type: "cash_out", playerId, chips },
      ]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

/** Every seated player leaves with their current stack, in one write. */
export function useLeaveAll(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async () => {
      const events = await repository.ledger.listByGame(gameId);
      const leftAt = Date.now();
      await repository.ledger.appendAll(
        summarizeByPlayer(events)
          .filter((player) => player.seated)
          .map(
            ({ playerId, stackChips }): LedgerEvent => ({
              ...newEventMeta(gameId, leftAt),
              type: "cash_out",
              playerId,
              chips: stackChips,
            }),
          ),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}

/** Brings the given players back to the table in one write, by taking back each one's cash-out. */
export function useReturnAll(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ledgerScope(gameId),
    mutationFn: async (playerIds: readonly string[]) => {
      const events = await repository.ledger.listByGame(gameId);
      const returnedAt = Date.now();
      await repository.ledger.appendAll(
        playerIds.flatMap((playerId): LedgerEvent[] => {
          const cashOut = latestCashOut(events, playerId);
          if (!cashOut) return [];
          return [
            { ...newEventMeta(gameId, returnedAt), type: "reversal", reversedEventId: cashOut.id },
          ];
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger", gameId] }),
  });
}
