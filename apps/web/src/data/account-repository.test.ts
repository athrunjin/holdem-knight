import "fake-indexeddb/auto";

import { cents, ForeignOrganizerError, type Game } from "@holdem-knight/core";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";

import { createAccountDatabase } from "./account-database";
import { createAccountRepository } from "./account-repository";
import { createFakeServer } from "./fake-remote";
import { describeRepository } from "./repository-contract";
import { StorageError } from "./supabase-repository";
import { createSync, memoryLock } from "./sync";

/** A space's books on a device, sending to a space held in memory. */
function deviceBooks(space: string) {
  const db = createAccountDatabase(space, `test-account-${crypto.randomUUID()}`);
  const server = createFakeServer(space);
  const sync = createSync({ db, remote: server, lock: memoryLock(), lockName: db.name });
  const repository = createAccountRepository(db, space, {
    changed: () => void sync.flush(),
    restore: (data) => sync.online(() => server.restore(data)),
  });
  sync.start();
  return { db, server, sync, repository, organizerId: space };
}

type DeviceBooks = ReturnType<typeof deviceBooks>;

/** Everything sent, and the account then holds what the device does. */
async function inStep({ db, server, sync, repository }: DeviceBooks) {
  expect(await sync.flush()).toBe("sent");
  expect(await db.outbox.count()).toBe(0);
  const { books, summaries } = server.snapshot();
  const local = await repository.backup.exportAll();
  const byId = (list: readonly { readonly id: string }[]) =>
    [...list].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const list of Object.keys(books) as (keyof typeof books)[]) {
    expect(byId(local[list])).toEqual(byId(books[list]));
  }
  expect(byId(await repository.gameSummaries.list())).toEqual(byId(summaries));
}

describeRepository("Account, written to the device first", async () => {
  const all = [deviceBooks("me"), deviceBooks("other"), deviceBooks("elsewhere")] as const;
  const [me, other, elsewhere] = all;
  return {
    me,
    other,
    elsewhere,
    // Whatever a test did, it all reached the account, which holds what the device does
    dispose: async () => {
      for (const books of all) {
        await inStep(books);
        books.sync.stop();
        books.db.close();
        await Dexie.delete(books.db.name);
      }
    },
  };
});

const game = (organizerId: string): Game => ({
  id: "g",
  organizerId,
  currency: "CNY",
  smallBlindChips: 5,
  bigBlindChips: 10,
  chipRatio: { chips: 1, amount: cents(100) },
  status: "open",
  createdAt: 1,
});

describe("an account's books written to the device first", () => {
  it("refuse a record the account would refuse, there and then, and keep nothing to send", async () => {
    const books = deviceBooks("me");
    books.sync.stop();
    const broken = { id: "p", organizerId: "me", name: "", initials: "", createdAt: 1 };

    await expect(books.repository.players.save(broken)).rejects.toThrow(StorageError);
    await expect(books.repository.games.save(game("other"))).rejects.toThrow(ForeignOrganizerError);
    expect(await books.repository.players.list()).toEqual([]);
    expect(await books.db.outbox.count()).toBe(0);
  });

  it("keep each write and what to send of it together, so a write that fails sends nothing", async () => {
    const books = deviceBooks("me");
    books.sync.stop();
    await books.repository.games.save(game("me"));
    const event = {
      id: "e",
      organizerId: "me",
      gameId: "g",
      occurredAt: 1,
      type: "buy_in" as const,
      playerId: "p",
      chips: 100,
    };
    await books.repository.ledger.append(event);
    await expect(books.repository.ledger.append(event)).rejects.toThrow();

    const waiting = await books.db.outbox.orderBy("seq").toArray();
    expect(waiting.map(({ change }) => change.kind)).toEqual(["save", "append"]);
  });

  it("send nothing for a delete of what they do not have", async () => {
    const books = deviceBooks("me");
    books.sync.stop();
    await books.repository.gameSummaries.remove("none");
    await books.repository.insuranceHands.remove("none");

    expect(await books.db.outbox.count()).toBe(0);
  });

  it("read what is on the device with no network", async () => {
    const books = deviceBooks("me");
    books.server.fate = () => "unanswered";
    await books.repository.games.save(game("me"));
    await books.sync.flush();

    expect(await books.repository.games.list()).toEqual([game("me")]);
    expect(await books.repository.backup.exportAll()).toMatchObject({ games: [game("me")] });
    expect(await books.sync.count()).toBe(1);
  });
});
