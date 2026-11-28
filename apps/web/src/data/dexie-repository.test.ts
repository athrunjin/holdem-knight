import "fake-indexeddb/auto";

import { cents } from "@holdem-knight/core";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";

import { createDexieRepository, createGuestDatabase } from "./dexie-repository";
import { describeRepository } from "./repository-contract";

describeRepository("Dexie", async () => {
  const db = createGuestDatabase(`test-${crypto.randomUUID()}`);
  const target = createGuestDatabase(`test-${crypto.randomUUID()}`);
  const books = (of: typeof db, organizerId: string) => ({
    repository: createDexieRepository(of, organizerId),
    organizerId,
  });
  return {
    me: books(db, "me"),
    other: books(db, "other"),
    elsewhere: books(target, "elsewhere"),
    dispose: async () => {
      await Dexie.delete(db.name);
      await Dexie.delete(target.name);
    },
  };
});

describe("Dexie repository", () => {
  it("keeps the guest's books under their name and version, with the tables and indexes they had", () => {
    const db = createGuestDatabase();
    const tables = Object.fromEntries(
      db.tables.map((table) => [
        table.name,
        [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(", "),
      ]),
    );

    expect(db.name).toBe("holdem-guest");
    expect(db.verno).toBe(8);
    expect(tables).toEqual({
      games: "id, [organizerId+createdAt]",
      players: "id, [organizerId+name]",
      ledgerEvents: "id, [gameId+occurredAt]",
      insuranceRules: "id, [organizerId+createdAt]",
      insuranceHands: "id, [gameId+createdAt]",
      gameConfigs: "id, [organizerId+createdAt]",
      oddsTables: "id, [organizerId+createdAt]",
      chargeRules: "id, [organizerId+createdAt]",
      gameSummaries: "id, organizerId",
    });
  });

  it("upgrades saved games from money blinds to chip blinds", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      games: "id, [organizerId+createdAt]",
      players: "id, [organizerId+name]",
      ledgerEvents: "id, [gameId+occurredAt]",
    });
    await legacy.table("games").put({
      id: "old",
      organizerId: "me",
      currency: "AUD",
      smallBlind: cents(100),
      bigBlind: cents(200),
      chipRatio: { chips: 100, amount: cents(100) },
      status: "open",
      createdAt: 1,
    });
    legacy.close();

    const upgraded = createGuestDatabase(name);
    const saved = await createDexieRepository(upgraded, "me").games.get("old");
    expect(saved).toMatchObject({ smallBlindChips: 100, bigBlindChips: 200 });
    expect(saved).not.toHaveProperty("smallBlind");
    upgraded.close();
    await Dexie.delete(name);
  });
});
