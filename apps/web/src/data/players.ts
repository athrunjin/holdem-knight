import { numberPlayers, type Player, recentPlayers } from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toInitials } from "@/lib/pinyin";
import { currentOrganizerId, repository } from ".";

const PLAYERS_KEY = ["players"] as const;

export function newPlayer(name: string): Player {
  return {
    id: crypto.randomUUID(),
    organizerId: currentOrganizerId(),
    name,
    initials: toInitials(name),
    createdAt: Date.now(),
  };
}

/**
 * The player library, every record with its number (ADR 0043). A record made since the last read,
 * or brought in with a number another already holds, is numbered here and kept. One that cannot
 * be kept this time still reads with its number, and is numbered again on the next read.
 */
async function numberedPlayers(): Promise<Player[]> {
  const players = await repository.players.list();
  const numbered = numberPlayers(players);
  if (numbered.length === 0) return players;
  await Promise.all(
    numbered.map((player) => repository.players.save(player).catch(() => undefined)),
  );
  const changed = new Map(numbered.map((player) => [player.id, player]));
  return players.map((player) => changed.get(player.id) ?? player);
}

export function usePlayers() {
  return useQuery({ queryKey: PLAYERS_KEY, queryFn: numberedPlayers });
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

/** Players from the latest games, newest game first. Kept under the ledger key, so new events refresh it. */
export function useRecentPlayers(limit: number) {
  return useQuery({
    queryKey: ["ledger", "recent-players", limit],
    queryFn: async () => {
      const games = (await repository.games.list()).slice(0, RECENT_GAMES);
      const [players, events] = await Promise.all([
        repository.players.list(),
        Promise.all(games.map(({ id }) => repository.ledger.listByGame(id))),
      ]);
      return recentPlayers(events, players, limit);
    },
  });
}
