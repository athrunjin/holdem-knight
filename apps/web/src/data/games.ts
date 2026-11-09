import { type Game, hasPlayerEvents, type LedgerEvent } from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { repository } from ".";
import { seatEvents } from "./insurance";
import { newEventMeta } from "./ledger";

const GAMES_KEY = ["games"] as const;

export function useGames() {
  return useQuery({ queryKey: GAMES_KEY, queryFn: () => repository.games.list() });
}

export function useGame(id: string) {
  return useQuery({
    queryKey: [...GAMES_KEY, id],
    queryFn: async () => (await repository.games.get(id)) ?? null,
  });
}

export function useHasLedgerEvents(gameId: string) {
  return useQuery({
    queryKey: ["ledger", gameId, "has-events"],
    queryFn: async () => hasPlayerEvents(await repository.ledger.listByGame(gameId)),
  });
}

export function useSaveGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (game: Game) => repository.games.save(game),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GAMES_KEY }),
  });
}

/** Saves the game and keeps its insurance seat in step with the settings. */
export function useSaveGameSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (game: Game) => {
      await repository.games.save(game);
      const events = await repository.ledger.listByGame(game.id);
      await repository.ledger.appendAll(seatEvents(game, events));
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: GAMES_KEY }),
        queryClient.invalidateQueries({ queryKey: ["ledger"] }),
      ]),
  });
}

interface StartGameInput {
  readonly game: Game;
  /** Players who sit down at the start, each buying in one hand. */
  readonly playerIds: readonly string[];
}

/** Saves a new game, then seats the insurance seat and the starting players in one write. */
export function useStartGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ game, playerIds }: StartGameInput) => {
      await repository.games.save(game);
      const { id, createdAt, handChips } = game;
      // New games always count in hands
      const buyIns =
        handChips === undefined
          ? []
          : playerIds.map(
              (playerId): LedgerEvent => ({
                ...newEventMeta(id, createdAt),
                type: "buy_in",
                playerId,
                chips: handChips,
              }),
            );
      await repository.ledger.appendAll([...seatEvents(game, []), ...buyIns]);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: GAMES_KEY }),
        queryClient.invalidateQueries({ queryKey: ["ledger"] }),
      ]),
  });
}
