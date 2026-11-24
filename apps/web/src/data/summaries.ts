import {
  type Game,
  type GameSummary,
  gameSummary,
  isSummaryCurrent,
  isTransferDone,
  type LedgerEvent,
  markReceived,
  markTransfers,
  type Repository,
  type Transfer,
} from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { chargeClock } from "@/lib/charges";
import { gameDay } from "@/lib/game-day";
import { repository } from ".";

const SUMMARIES_KEY = ["game-summaries"] as const;

/** The summary of a settled game, as the settlement page shows its results. */
export function summarize(game: Game, events: readonly LedgerEvent[]): GameSummary {
  return gameSummary(game, events, { clock: chargeClock(game), day: gameDay(game) });
}

/**
 * Keeps a game's summary in step with it: written for a settled game, gone for any other. A
 * summary that could not be written loses nothing, since `currentSummaries` makes it again.
 */
async function followGame(game: Game, events: readonly LedgerEvent[]) {
  try {
    if (game.status === "settled") await repository.gameSummaries.save(summarize(game, events));
    else await repository.gameSummaries.remove(game.id);
  } catch {
    // The game itself is saved. Reports put the summary right the next time they are read
  }
}

/**
 * Saves a game from its settlement page, and its summary with it: when the settlement is
 * confirmed, when a transfer is marked or the plan changes after that, and not at all once the
 * results are opened again (ADR 0049).
 */
export function useSaveSettlement(events: readonly LedgerEvent[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (game: Game) => {
      await repository.games.save(game);
      await followGame(game, events);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: SUMMARIES_KEY }),
      ]),
  });
}

/**
 * Marks transfers of a settled game as made or not from a page that lists them across games. The
 * game is saved as its settlement page would save it: complete while every transfer of its plan
 * is in, with its summary made again.
 */
export function useMarkTransfers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      game,
      summary,
      transfers,
      done,
    }: {
      game: Game;
      /** The game's summary, whose transfers are those of its plan */
      summary: GameSummary;
      transfers: readonly Transfer[];
      done: boolean;
    }) => {
      const marked = markTransfers(game, transfers, done, Date.now());
      const next = markReceived(
        marked,
        summary.transfers.every((transfer) => isTransferDone(marked, transfer)),
      );
      await repository.games.save(next);
      await followGame(next, await repository.ledger.listByGame(game.id));
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: SUMMARIES_KEY }),
      ]),
  });
}

/**
 * The summary of every settled game, each as its game stands now. One that is missing or out of
 * date is worked out from the ledger and kept: a game settled before summaries were, one brought
 * in from a backup, one whose summary could not be written. A summary left behind by a game that
 * is no longer settled goes.
 */
export async function currentSummaries(books: Repository = repository): Promise<GameSummary[]> {
  const [games, kept] = await Promise.all([books.games.list(), books.gameSummaries.list()]);
  const byGame = new Map(kept.map((summary) => [summary.id, summary]));
  const settled = games.filter((game) => game.status === "settled");

  const summaries = await Promise.all(
    settled.map(async (game) => {
      const summary = byGame.get(game.id);
      if (summary && isSummaryCurrent(game, summary)) return summary;
      const made = summarize(game, await books.ledger.listByGame(game.id));
      // Shown even if it cannot be kept this time
      await books.gameSummaries.save(made).catch(() => undefined);
      return made;
    }),
  );

  const settledIds = new Set(settled.map(({ id }) => id));
  await Promise.all(
    kept
      .filter(({ id }) => !settledIds.has(id))
      .map(({ id }) => books.gameSummaries.remove(id).catch(() => undefined)),
  );
  return summaries;
}

/** Read again each time a page that shows them opens, since any game may have been settled since. */
export function useGameSummaries() {
  return useQuery({ queryKey: SUMMARIES_KEY, queryFn: () => currentSummaries(), staleTime: 0 });
}
