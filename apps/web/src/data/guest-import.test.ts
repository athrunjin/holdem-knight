import "fake-indexeddb/auto";

import {
  type BackupData,
  cents,
  ForeignOrganizerError,
  type Game,
  type LedgerEvent,
  numberPlayers,
  ORGANIZER_PLAYER_ID,
  type Player,
  type Repository,
  RULE_30,
} from "@holdem-knight/core";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { me as enMe } from "@/i18n/en/me";
import { me as zhMe } from "@/i18n/zh/me";
import { createDexieRepository, createGuestDatabase } from "./dexie-repository";
import type { ImportMarks } from "./guest-import";
import { StorageError } from "./supabase-repository";

// The books in use are not what is under test here
vi.mock(".", () => ({ repository: {} }));

const { bringGuestBooks, failureOf, fingerprintOf, guestOffer, holdingsOf } = await import(
  "./guest-import"
);
const { currentSummaries } = await import("./summaries");

const GUEST = "guest";
const SPACE = "space-1";

const settled: Game = {
  id: "g-settled",
  organizerId: GUEST,
  currency: "CNY",
  smallBlindChips: 5,
  bigBlindChips: 10,
  chipRatio: { chips: 1, amount: cents(100) },
  status: "settled",
  createdAt: Date.UTC(2026, 10, 21, 12),
  settledAt: Date.UTC(2026, 10, 21, 16),
  timeZone: "Asia/Shanghai",
};
/** Still being played, as the guest left it. */
const { settledAt: _, ...unsettled } = settled;
const open: Game = { ...unsettled, id: "g-open", status: "open" };

const event = (
  id: string,
  gameId: string,
  type: "buy_in" | "cash_out",
  playerId: string,
  chips: number,
): LedgerEvent => ({
  id,
  organizerId: GUEST,
  gameId,
  occurredAt: settled.createdAt + (type === "buy_in" ? 60_000 : 3_600_000),
  type,
  playerId,
  chips,
});

const player = (id: string, name: string, organizerId = GUEST): Player => ({
  id,
  organizerId,
  name,
  initials: name,
  createdAt: 1,
});

/** The host played under the organizer seat, and won 500 off 老王. */
const hostPlayed = [
  event("e1", settled.id, "buy_in", ORGANIZER_PLAYER_ID, 1000),
  event("e2", settled.id, "buy_in", "wang", 1000),
  event("e3", settled.id, "cash_out", ORGANIZER_PLAYER_ID, 1500),
  event("e4", settled.id, "cash_out", "wang", 500),
];

/** Remembered in memory, as the device would in its storage. */
function memoryMarks(): ImportMarks & { kept: Map<string, string> } {
  const kept = new Map<string, string>();
  return { kept, get: (space) => kept.get(space), set: (space, mark) => kept.set(space, mark) };
}

describe("bringing a guest's books into an account", () => {
  let guestDb: ReturnType<typeof createGuestDatabase>;
  let spaceDb: ReturnType<typeof createGuestDatabase>;
  let guest: Repository;
  let account: Repository;
  let marks: ReturnType<typeof memoryMarks>;
  const destination = () => ({ repository: account, organizerId: SPACE, ownerName: "小林" });

  beforeEach(async () => {
    guestDb = createGuestDatabase(`guest-${crypto.randomUUID()}`);
    spaceDb = createGuestDatabase(`space-${crypto.randomUUID()}`);
    guest = createDexieRepository(guestDb, GUEST);
    account = createDexieRepository(spaceDb, SPACE);
    marks = memoryMarks();

    await guest.players.ensure(player(ORGANIZER_PLAYER_ID, "我"));
    await guest.players.save(player("wang", "老王"));
    await guest.games.save(settled);
    await guest.ledger.appendAll(hostPlayed);
    await guest.games.save(open);
    await guest.ledger.append(event("e5", open.id, "buy_in", "wang", 1000));
    await guest.insuranceRules.save({
      id: "rule",
      organizerId: GUEST,
      name: "常用",
      rule: RULE_30,
      createdAt: 1,
    });
    // The guest's settled game keeps its summary, as the settlement page leaves it
    await currentSummaries(guest);
  });

  afterEach(async () => {
    guestDb.close();
    spaceDb.close();
    await Dexie.delete(guestDb.name);
    await Dexie.delete(spaceDb.name);
  });

  const bring = (letGo = vi.fn()) =>
    bringGuestBooks({ guest, destination: destination(), marks, letGo });

  it("counts what is worth bringing, leaving out the guest's own record", async () => {
    expect(holdingsOf(await guest.backup.exportAll())).toEqual({
      games: 2,
      players: 1,
      settings: 1,
    });
  });

  it("offers nothing for books with only the guest's own record", async () => {
    const emptyDb = createGuestDatabase(`empty-${crypto.randomUUID()}`);
    const empty = createDexieRepository(emptyDb, GUEST);
    await empty.players.ensure(player(ORGANIZER_PLAYER_ID, "我"));
    expect(await guestOffer(empty, SPACE, marks)).toBeNull();
    emptyDb.close();
    await Dexie.delete(emptyDb.name);
  });

  it("copies every record into the space and leaves the guest's books as they were", async () => {
    const before = await guest.backup.exportAll();
    const summariesBefore = await guest.gameSummaries.list();
    const letGo = vi.fn();

    const result = await bring(letGo);

    // 2 games, 2 players, 5 events, 1 rule
    expect(result).toMatchObject({ added: 10, skipped: 0 });
    expect(result.holdings).toEqual({ games: 2, players: 1, settings: 1 });
    expect(await guest.backup.exportAll()).toEqual(before);
    expect(await guest.gameSummaries.list()).toEqual(summariesBefore);
    const brought = await account.backup.exportAll();
    expect(brought.games.map(({ id }) => id).sort()).toEqual(["g-open", "g-settled"]);
    expect(brought.games.find(({ id }) => id === "g-open")?.status).toBe("open");
    expect(brought.ledgerEvents).toHaveLength(5);
    expect(letGo).toHaveBeenCalledOnce();
  });

  it("never makes a second copy when brought in twice", async () => {
    await bring();
    const once = await account.backup.exportAll();
    const summariesOnce = await account.gameSummaries.list();

    const again = await bring();

    expect(again).toMatchObject({ added: 0, skipped: 10 });
    expect(await account.backup.exportAll()).toEqual(once);
    expect(await account.gameSummaries.list()).toEqual(summariesOnce);
  });

  it("keeps the account's own record, name and all, under the one ID", async () => {
    const theirs = player(ORGANIZER_PLAYER_ID, "林老板", SPACE);
    await account.players.ensure(theirs);

    await bring();

    const own = (await account.players.list()).filter(({ id }) => id === ORGANIZER_PLAYER_ID);
    expect(own).toEqual([theirs]);
  });

  it("makes the account's own record under its own name where it has none yet", async () => {
    await bring();

    const own = await account.players.get(ORGANIZER_PLAYER_ID);
    expect(own).toMatchObject({ organizerId: SPACE, name: "小林", initials: "xl" });
  });

  it("shows the host's play as a guest in the account's own record's games", async () => {
    const kept = await guest.gameSummaries.list();

    await bring();

    // The summary came as it was kept, not worked out again
    expect(await account.gameSummaries.list()).toEqual(
      kept.map((summary) => ({ ...summary, organizerId: SPACE })),
    );
    const summaries = await currentSummaries(account);
    const own = summaries.filter((s) => s.players.some((p) => p.playerId === ORGANIZER_PLAYER_ID));
    expect(own.map(({ id }) => id)).toEqual(["g-settled"]);
    expect(own[0]?.players.find((p) => p.playerId === ORGANIZER_PLAYER_ID)?.chipNet).toBe(
      cents(50000),
    );
  });

  it("brings a settled game with no summary, which the reports work out as for a backup", async () => {
    await guest.gameSummaries.remove(settled.id);

    await bring();

    expect(await account.gameSummaries.list()).toEqual([]);
    const [summary] = await currentSummaries(account);
    expect(summary).toMatchObject({ id: settled.id, organizerId: SPACE, playerCount: 2 });
  });

  it("is not offered again for what was brought, and is for what was added since", async () => {
    expect(await guestOffer(guest, SPACE, marks)).toMatchObject({ holdings: { games: 2 } });
    await bring();
    expect(await guestOffer(guest, SPACE, marks)).toBeNull();

    // A change to a record already brought is not new
    await guest.players.save({ ...player("wang", "王哥") });
    expect(await guestOffer(guest, SPACE, marks)).toBeNull();

    // Another account on this device is offered them on its own terms
    expect(await guestOffer(guest, "space-2", marks)).not.toBeNull();

    // Played as a guest again after a sign-out
    await guest.games.save({ ...open, id: "g-later" });
    expect(await guestOffer(guest, SPACE, marks)).toMatchObject({ holdings: { games: 3 } });
  });

  describe("a game the account already has", () => {
    /** The guest's copy of the game in progress goes on, on the device, after it was brought. */
    async function playOnAsGuest(settle: boolean) {
      await guest.ledger.append(event("e6", open.id, "cash_out", "wang", 800));
      if (settle) {
        await guest.games.save({ ...open, status: "settled", settledAt: settled.settledAt ?? 0 });
        await currentSummaries(guest);
      }
    }

    it("takes nothing more when the account has settled it", async () => {
      await bring();
      // The host carries the game on in the account and settles it there
      await account.ledger.append({
        ...event("a1", open.id, "cash_out", "wang", 1200),
        organizerId: SPACE,
      });
      await account.games.save({
        ...open,
        organizerId: SPACE,
        status: "settled",
        settledAt: settled.settledAt ?? 0,
      });
      await currentSummaries(account);
      const ledger = await account.ledger.listByGame(open.id);
      const summary = (await account.gameSummaries.list()).find(({ id }) => id === open.id);
      expect(summary).toBeDefined();

      await playOnAsGuest(true);
      const again = await bring();

      expect(await account.ledger.listByGame(open.id)).toEqual(ledger);
      expect((await account.gameSummaries.list()).find(({ id }) => id === open.id)).toEqual(
        summary,
      );
      expect((await account.games.get(open.id))?.status).toBe("settled");
      // The guest's new event is counted among what the account already has
      expect(again).toMatchObject({ added: 0, skipped: 11 });
    });

    it("takes nothing more, and no summary, while it is still open in the account", async () => {
      await bring();
      const ledger = await account.ledger.listByGame(open.id);

      await playOnAsGuest(true);
      await bring();

      expect(await account.ledger.listByGame(open.id)).toEqual(ledger);
      expect((await account.games.get(open.id))?.status).toBe("open");
      expect((await account.gameSummaries.list()).map(({ id }) => id)).toEqual([settled.id]);
    });
  });

  it("brings no player's number, so the account's records keep theirs", async () => {
    const mine = { ...player("mine", "阿强", SPACE), createdAt: 100, number: 2 };
    await account.players.save(mine);
    // Older than the account's, with the same number in the guest's books
    await guest.players.save({ ...player("wang", "老王"), number: 2 });

    await bring();

    const brought = await account.players.list();
    expect(brought.every((p) => p.id === "mine" || p.number === undefined)).toBe(true);
    const numbered = new Map(numberPlayers(brought).map((p) => [p.id, p.number]));
    expect(numbered.has("mine")).toBe(false);
    expect(numbered.get("wang")).toBeGreaterThan(2);
  });

  describe("what done counts", () => {
    const none = { games: 0, players: 0, settings: 0 };

    it("counts a first import by the confirmation's kinds, the own record on neither side", async () => {
      const result = await bring();

      expect(result.brought).toEqual(result.holdings);
      expect(result.brought).toEqual({ games: 2, players: 1, settings: 1 });
      expect(result.there).toEqual(none);
    });

    it("counts everything as already there on a second import", async () => {
      await bring();

      const again = await bring();

      expect(again.brought).toEqual(none);
      expect(again.there).toEqual({ games: 2, players: 1, settings: 1 });
    });

    it("counts what the account had of the games, players and settings apart from what it lacked", async () => {
      // The account has its own record, the game in progress, 老王 and a rule of its own
      await account.players.ensure(player(ORGANIZER_PLAYER_ID, "林老板", SPACE));
      await account.games.save({ ...open, organizerId: SPACE });
      await account.players.save(player("wang", "老王", SPACE));
      await account.insuranceRules.save({
        id: "theirs",
        organizerId: SPACE,
        name: "账户的",
        rule: RULE_30,
        createdAt: 2,
      });
      // The guest has one more player, and a game and a setting the account lacks
      await guest.players.save(player("zhao", "老赵"));
      await guest.oddsTables.save({
        id: "odds",
        organizerId: GUEST,
        name: "赔率",
        oddsHundredths: RULE_30.oddsHundredths,
        createdAt: 1,
      });

      const result = await bring();

      expect(result.brought).toEqual({ games: 1, players: 1, settings: 2 });
      expect(result.there).toEqual({ games: 1, players: 1, settings: 0 });
      // What the restore added of records agrees: the settled game, its 4 events, 老赵, 2 settings
      expect(result.added).toBe(8);
    });

    it("counts only what was added since, after the guest played on", async () => {
      await bring();
      await guest.games.save({ ...open, id: "g-later" });
      await guest.players.save(player("zhao", "老赵"));

      const result = await bring();

      expect(result.brought).toEqual({ games: 1, players: 1, settings: 0 });
      expect(result.there).toEqual({ games: 2, players: 1, settings: 1 });
    });
  });

  it("writes nothing and marks nothing when the restore fails", async () => {
    await account.players.save(player("mine", "阿强", SPACE));
    const before = await account.backup.exportAll();
    const letGo = vi.fn();
    vi.spyOn(account.backup, "restore").mockRejectedValueOnce(new Error("No connection"));

    await expect(bring(letGo)).rejects.toThrow("No connection");

    expect(await account.backup.exportAll()).toEqual(before);
    expect(await account.gameSummaries.list()).toEqual([]);
    expect(marks.kept.size).toBe(0);
    expect(letGo).not.toHaveBeenCalled();
  });
});

describe("the done text", () => {
  const counts = { games: 9, players: 6, settings: 1 };

  it("names the kinds in the confirmation's words and order", () => {
    expect(zhMe.guestImport.doneAdded(counts)).toBe("新增牌局 9 局、玩家 6 人、设置 1 个。");
    expect(enMe.guestImport.doneAdded(counts)).toBe("Added: 9 games, 6 players, 1 setting.");
  });

  it("leaves out a kind there is none of", () => {
    const some = { games: 2, players: 0, settings: 0 };
    expect(zhMe.guestImport.doneThere(some)).toBe("账户里已有牌局 2 局，保持不变。");
    expect(enMe.guestImport.doneThere(some)).toBe(
      "Already in the account, left as they were: 2 games.",
    );
  });
});

describe("fingerprintOf", () => {
  const books = (players: readonly Player[]): BackupData => ({
    games: [],
    players,
    ledgerEvents: [],
    insuranceRules: [],
    insuranceHands: [],
    gameConfigs: [],
    oddsTables: [],
    chargeRules: [],
  });

  it("goes by which records there are, in any order, not by what they hold", () => {
    const a = player("a", "A");
    const b = player("b", "B");
    expect(fingerprintOf(books([a, b]))).toBe(fingerprintOf(books([b, { ...a, name: "AA" }])));
    expect(fingerprintOf(books([a]))).not.toBe(fingerprintOf(books([a, b])));
  });

  it("leaves out the guest's own record", () => {
    const a = player("a", "A");
    expect(fingerprintOf(books([a, player(ORGANIZER_PLAYER_ID, "我")]))).toBe(
      fingerprintOf(books([a])),
    );
  });
});

describe("failureOf", () => {
  it("knows nothing was written when the account answered and turned the records down", () => {
    expect(failureOf(new StorageError("insert or update violates foreign key", 409))).toBe(
      "refused",
    );
    expect(failureOf(new StorageError("A record of games is not valid"))).toBe("refused");
    expect(failureOf(new ForeignOrganizerError("Another organizer's"))).toBe("refused");
  });

  it("does not know when no answer came, or a server error stood in for one", () => {
    expect(failureOf(new StorageError("TypeError: Failed to fetch", 0))).toBe("unknown");
    expect(failureOf(new StorageError("Gateway Timeout", 504))).toBe("unknown");
    expect(failureOf(new TypeError("Failed to fetch"))).toBe("unknown");
  });
});
