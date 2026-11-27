/**
 * A guest's books on this device brought into an account's space, with the device's storage and
 * the local Supabase both real (`pnpm db:start`, then `pnpm test:local`).
 */
import "fake-indexeddb/auto";

import {
  cents,
  type Game,
  type LedgerEvent,
  ORGANIZER_PLAYER_ID,
  type Player,
  type Repository,
  RULE_30,
} from "@holdem-knight/core";
import { createClient } from "@supabase/supabase-js";
import Dexie from "dexie";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TERMS_VERSION } from "@/lib/terms";
import { createDexieRepository, createGuestDatabase } from "./dexie-repository";
import { bringGuestBooks, failureOf, guestOffer, type ImportMarks } from "./guest-import";
import { currentSummaries } from "./summaries";
import { createSupabaseRepository } from "./supabase-repository";

const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publicKey } = import.meta.env;
const quiet = { auth: { persistSession: false, autoRefreshToken: false } };
/** For making accounts, reading past the app and clearing them away. Never for what is under test. */
const admin = createClient(url, import.meta.env.SUPABASE_SECRET_KEY, quiet);
const password = `pw-${crypto.randomUUID()}`;
const made: string[] = [];

/** A new account that has agreed, signed in as the app would be, with its space's repository. */
async function account(name: string) {
  const email = `import-${crypto.randomUUID()}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name, terms_version: TERMS_VERSION },
  });
  if (created.error) throw created.error;
  made.push(created.data.user.id);
  const client = createClient(url, publicKey, quiet);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const spaces = await client.from("organizers").select("id");
  const organizerId = spaces.data?.[0]?.id as string;
  const userId = created.data.user.id;
  return { client, userId, organizerId, repository: createSupabaseRepository(client, organizerId) };
}

/** Which account the database links a space's own record to (ADR 0051), read past the app. */
async function linkOf(organizerId: string) {
  const row = await admin
    .from("players")
    .select("linked_user_id")
    .eq("organizer_id", organizerId)
    .eq("id", ORGANIZER_PLAYER_ID)
    .single();
  return row.data?.linked_user_id as string | undefined;
}

const GUEST = "guest";

const settled: Game = {
  id: crypto.randomUUID(),
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
const open: Game = { ...unsettled, id: crypto.randomUUID(), status: "open" };

const event = (gameId: string, type: "buy_in" | "cash_out", playerId: string, chips: number) =>
  ({
    id: crypto.randomUUID(),
    organizerId: GUEST,
    gameId,
    occurredAt: settled.createdAt + (type === "buy_in" ? 60_000 : 3_600_000),
    type,
    playerId,
    chips,
  }) as LedgerEvent;

const player = (id: string, name: string, organizerId = GUEST): Player => ({
  id,
  organizerId,
  name,
  initials: name,
  createdAt: 1,
});

const marks = (): ImportMarks => {
  const kept = new Map<string, string>();
  return { get: (space) => kept.get(space), set: (space, mark) => kept.set(space, mark) };
};

describe("a guest's books brought into an account", () => {
  let guest: Repository;
  const wang = crypto.randomUUID();

  beforeEach(async () => {
    const db = createGuestDatabase(`guest-${crypto.randomUUID()}`);
    guest = createDexieRepository(db, GUEST);
    await guest.players.ensure(player(ORGANIZER_PLAYER_ID, "我"));
    await guest.players.save(player(wang, "老王"));
    await guest.games.save(settled);
    await guest.ledger.appendAll([
      event(settled.id, "buy_in", ORGANIZER_PLAYER_ID, 1000),
      event(settled.id, "buy_in", wang, 1000),
      event(settled.id, "cash_out", ORGANIZER_PLAYER_ID, 1500),
      event(settled.id, "cash_out", wang, 500),
    ]);
    await guest.games.save(open);
    await guest.ledger.append(event(open.id, "buy_in", wang, 1000));
    await guest.insuranceRules.save({
      id: crypto.randomUUID(),
      organizerId: GUEST,
      name: "常用",
      rule: RULE_30,
      createdAt: 1,
    });
    await currentSummaries(guest);
    return async () => {
      db.close();
      await Dexie.delete(db.name);
    };
  });

  it("arrives whole, games in progress and settled, and a second time adds nothing", async () => {
    const { repository, organizerId } = await account("小林");
    const destination = { repository, organizerId, ownerName: "小林" };
    const kept = marks();
    const before = await guest.backup.exportAll();

    const first = await bringGuestBooks({ guest, destination, marks: kept, letGo: () => {} });
    expect(first).toMatchObject({ added: 10, skipped: 0 });
    // In the card's kinds, the account's own record (made by the import) counted on neither side
    expect(first.brought).toEqual({ games: 2, players: 1, settings: 1 });
    expect(first.there).toEqual({ games: 0, players: 0, settings: 0 });
    expect(await guest.backup.exportAll()).toEqual(before);
    const once = await repository.backup.exportAll();
    expect(once.games.map(({ status }) => status).sort()).toEqual(["open", "settled"]);
    expect(once.ledgerEvents).toHaveLength(5);
    expect(await guestOffer(guest, organizerId, kept)).toBeNull();

    const again = await bringGuestBooks({ guest, destination, marks: marks(), letGo: () => {} });
    expect(again).toMatchObject({ added: 0, skipped: 10 });
    expect(again.brought).toEqual({ games: 0, players: 0, settings: 0 });
    expect(again.there).toEqual({ games: 2, players: 1, settings: 1 });
    expect(await repository.backup.exportAll()).toEqual(once);
  });

  it("joins the host's play as a guest to the account's own record, which keeps its name", async () => {
    const { repository, organizerId, userId } = await account("林老板");
    // The account's own record, made on the first read of its players and renamed by the host
    // since, so it differs from both the guest's 我 and the name an import would give it
    const own = await repository.players.ensure(player(ORGANIZER_PLAYER_ID, "林哥", organizerId));
    const kept = await guest.gameSummaries.list();

    await bringGuestBooks({
      guest,
      destination: { repository, organizerId, ownerName: "林老板" },
      marks: marks(),
      letGo: () => {},
    });

    const records = await repository.players.list();
    expect(records.filter(({ id }) => id === ORGANIZER_PLAYER_ID)).toEqual([own]);
    expect(records.map(({ name }) => name).sort()).toEqual(["林哥", "老王"]);
    // The summary arrived as kept, and shows the host's row
    expect(await repository.gameSummaries.list()).toEqual(
      kept.map((summary) => ({ ...summary, organizerId })),
    );
    const summaries = await currentSummaries(repository);
    const hosts = summaries.filter((s) =>
      s.players.some((p) => p.playerId === ORGANIZER_PLAYER_ID),
    );
    expect(hosts.map(({ id }) => id)).toEqual([settled.id]);
    // Linked to the owner by the database, as its own record always is (ADR 0051)
    expect(await linkOf(organizerId)).toBe(userId);
  });

  it("makes the account's own record under its name when it has none yet", async () => {
    const { repository, organizerId, userId } = await account("阿强");
    await bringGuestBooks({
      guest,
      destination: { repository, organizerId, ownerName: "阿强" },
      marks: marks(),
      letGo: () => {},
    });
    expect(await repository.players.get(ORGANIZER_PLAYER_ID)).toMatchObject({ name: "阿强" });
    // Made by the restore, and linked to the owner all the same
    expect(await linkOf(organizerId)).toBe(userId);
  });

  describe("a game the account already has", () => {
    async function broughtThenPlayedOn(settleInAccount: boolean) {
      const { repository, organizerId } = await account("小郑");
      const destination = { repository, organizerId, ownerName: "小郑" };
      await bringGuestBooks({ guest, destination, marks: marks(), letGo: () => {} });
      if (settleInAccount) {
        // The host carries the game on in the account and settles it there
        await repository.ledger.append({ ...event(open.id, "cash_out", wang, 1200), organizerId });
        await repository.games.save({
          ...open,
          organizerId,
          status: "settled",
          settledAt: settled.settledAt ?? 0,
        });
        await currentSummaries(repository);
      }
      const ledger = await repository.ledger.listByGame(open.id);
      const summaries = await repository.gameSummaries.list();
      // After a sign-out the guest's copy goes on too, and is settled on the device
      await guest.ledger.append(event(open.id, "cash_out", wang, 800));
      await guest.games.save({ ...open, status: "settled", settledAt: settled.settledAt ?? 0 });
      await currentSummaries(guest);

      const again = await bringGuestBooks({ guest, destination, marks: marks(), letGo: () => {} });
      return { repository, ledger, summaries, again };
    }

    it("takes nothing more when the account has settled it", async () => {
      const { repository, ledger, summaries, again } = await broughtThenPlayedOn(true);
      expect(await repository.ledger.listByGame(open.id)).toEqual(ledger);
      expect(await repository.gameSummaries.list()).toEqual(summaries);
      expect(summaries.map(({ id }) => id).sort()).toEqual([open.id, settled.id].sort());
      expect(again.added).toBe(0);
    });

    it("takes nothing more, and no summary, while it is still open in the account", async () => {
      const { repository, ledger, summaries, again } = await broughtThenPlayedOn(false);
      expect(await repository.ledger.listByGame(open.id)).toEqual(ledger);
      expect((await repository.games.get(open.id))?.status).toBe("open");
      expect((await repository.gameSummaries.list()).map(({ id }) => id)).toEqual([settled.id]);
      expect(await repository.gameSummaries.list()).toEqual(summaries);
      expect(again.added).toBe(0);
    });
  });

  it("leaves the account as it was when there is no connection", async () => {
    const { repository, organizerId, client } = await account("小周");
    await repository.players.save(player(crypto.randomUUID(), "阿明", organizerId));
    const before = await repository.backup.exportAll();
    // The same account, through a client whose every request fails as with no network
    const offline = createClient(url, publicKey, {
      ...quiet,
      global: { fetch: () => Promise.reject(new TypeError("Failed to fetch")) },
    });
    const session = (await client.auth.getSession()).data.session;
    if (session) await offline.auth.setSession(session).catch(() => undefined);
    const kept = marks();
    const letGo = vi.fn();

    const failed = await bringGuestBooks({
      guest,
      destination: {
        repository: createSupabaseRepository(offline, organizerId),
        organizerId,
        ownerName: "小周",
      },
      marks: kept,
      letGo,
    }).catch((error: unknown) => error);

    // Nothing reached the database: this proves nothing was sent, not a rollback
    expect(failed).toBeInstanceOf(Error);
    expect(failureOf(failed)).toBe("unknown");

    expect(await repository.backup.exportAll()).toEqual(before);
    expect(await repository.gameSummaries.list()).toEqual([]);
    expect(kept.get(organizerId)).toBeUndefined();
    expect(letGo).not.toHaveBeenCalled();
  });

  it("leaves the account as it was when the database refuses the books", async () => {
    const { repository, organizerId } = await account("小吴");
    const before = await repository.backup.exportAll();
    // An event whose game is in neither the guest's books nor the space's: the foreign key refuses
    await guest.ledger.append(event(crypto.randomUUID(), "buy_in", wang, 1000));
    const kept = marks();

    const failed = await bringGuestBooks({
      guest,
      destination: { repository, organizerId, ownerName: "小吴" },
      marks: kept,
      letGo: () => {},
    }).catch((error: unknown) => error);

    // restore_books ran: its games and players went in before the events tripped the foreign
    // key, and were rolled back with them. The account answered, so it is known to be refused
    expect(failed).toBeInstanceOf(Error);
    expect(failureOf(failed)).toBe("refused");

    expect(await repository.backup.exportAll()).toEqual(before);
    expect(kept.get(organizerId)).toBeUndefined();
  });
});

afterAll(async () => {
  await Promise.all(made.map((id) => admin.auth.admin.deleteUser(id)));
});
