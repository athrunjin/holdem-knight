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
