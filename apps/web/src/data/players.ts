import { type Player, recentPlayerIds } from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toInitials } from "@/lib/pinyin";
import { GUEST_ORGANIZER_ID, repository } from ".";

const PLAYERS_KEY = ["players"] as const;

export function newPlayer(name: string): Player {
  return {
    id: crypto.randomUUID(),
    organizerId: GUEST_ORGANIZER_ID,
    name,
    initials: toInitials(name),
    createdAt: Date.now(),
  };
}

export function usePlayers() {
  return useQuery({ queryKey: PLAYERS_KEY, queryFn: () => repository.players.list() });
}

export function useSavePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (player: Player) => repository.players.save(player),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAYERS_KEY }),
  });
}

/** How many of the latest games to look through for recent players. */
const RECENT_GAMES = 20;

/** Players from the latest games, most recent first. Kept under the ledger key, so new events refresh it. */
export function useRecentPlayerIds(limit: number) {
  return useQuery({
    queryKey: ["ledger", "recent-players", limit],
    queryFn: async () => {
      const games = (await repository.games.list()).slice(0, RECENT_GAMES);
      const events = await Promise.all(games.map(({ id }) => repository.ledger.listByGame(id)));
      return recentPlayerIds(events.flat(), limit);
    },
  });
}
