import "fake-indexeddb/auto";

import {
  cents,
  type Game,
  type LedgerEvent,
  markTransfers,
  ORGANIZER_COLLECTOR,
  type Repository,
  reviseGame,
} from "@holdem-knight/core";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDexieRepository, createGuestDatabase } from "./dexie-repository";

// The books in use are not what is under test here
vi.mock(".", () => ({ repository: {} }));

const { currentSummaries } = await import("./summaries");

const game: Game = {
  id: "g",
  organizerId: "me",
  currency: "CNY",
  smallBlindChips: 5,
  bigBlindChips: 10,
  chipRatio: { chips: 1, amount: cents(100) },
  status: "settled",
  createdAt: Date.UTC(2026, 10, 21, 15, 30),
  settledAt: Date.UTC(2026, 10, 21, 20),
  timeZone: "Asia/Shanghai",
  tableFee: { amount: cents(5000), minMinutes: 0 },
  timer: {
    elapsedMs: 4 * 3_600_000,
    runs: [{ from: Date.UTC(2026, 10, 21, 16), to: Date.UTC(2026, 10, 21, 20) }],
  },
};

const event = (id: string, type: "buy_in" | "cash_out", playerId: string, chips: number) =>
  ({
    id,
    organizerId: "me",
    gameId: "g",
    occurredAt: game.createdAt + (type === "buy_in" ? 3_600_000 : 7_200_000),
    type,
    playerId,
    chips,
  }) as LedgerEvent;

const events = [
  event("e1", "buy_in", "a", 1000),
  event("e2", "buy_in", "b", 1000),
  event("e3", "cash_out", "a", 1500),
  event("e4", "cash_out", "b", 500),
];

describe("currentSummaries", () => {
  let db: ReturnType<typeof createGuestDatabase>;
  let books: Repository;

  beforeEach(async () => {
    db = createGuestDatabase(`summaries-${crypto.randomUUID()}`);
    books = createDexieRepository(db, "me");
    await books.games.save(game);
    await books.ledger.appendAll(events);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  it("makes and keeps the summary of a settled game that has none", async () => {
    const [summary] = await currentSummaries(books);
    expect(summary).toMatchObject({
      id: "g",
      // 23:30 in Shanghai, the day before it is there in UTC+11 and the same day in UTC
      day: "2026-11-21",
      income: { rake: 0, insurance: 0, wage: 0, tableFee: 10000 },
      playerCount: 2,
    });
    expect(await books.gameSummaries.list()).toEqual([summary]);
  });

  it("reads the ledger only for a game whose summary is missing or out of date", async () => {
    await currentSummaries(books);
    const listByGame = vi.spyOn(books.ledger, "listByGame");
    await currentSummaries(books);
    expect(listByGame).not.toHaveBeenCalled();

    const paid = { from: "b", to: ORGANIZER_COLLECTOR, amount: cents(55000) };
    await books.games.save(markTransfers(game, [paid], true));
    const [summary] = await currentSummaries(books);
    expect(listByGame).toHaveBeenCalledTimes(1);
    expect(summary?.transfers).toContainEqual({ ...paid, done: true });
  });

  it("drops the summary of a game whose results were opened again", async () => {
    await currentSummaries(books);
    await books.games.save(reviseGame(game));
    expect(await currentSummaries(books)).toEqual([]);
    expect(await books.gameSummaries.list()).toEqual([]);
  });
});
