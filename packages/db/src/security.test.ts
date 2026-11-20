import { beforeAll, describe, expect, it } from "vitest";

import {
  asAccount,
  createTestDatabase,
  row,
  signUp,
  type TestAccount,
  type TestDatabase,
} from "./testing";

let db: TestDatabase;
let host: TestAccount;
let other: TestAccount;

const game = (space: string, id = "g1") =>
  row(space, id, { status: "open", createdAt: 1, currency: "CNY" });
const event = (space: string, id: string, gameId = "g1") =>
  row(space, id, { gameId, occurredAt: 5, type: "buy_in", playerId: "p1", chips: 1000 });

const insert = (table: string, record: ReturnType<typeof row>, extra = "") =>
  db.query(
    `insert into public.${table} (organizer_id, id, data${extra && ", collection"})
     values ($1, $2, $3${extra && ", $4"})`,
    [record.organizer_id, record.id, record.data, ...(extra ? [extra] : [])],
  );

const count = async (table: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`)).rows[0]?.n;

beforeAll(async () => {
  db = await createTestDatabase();
  host = await signUp(db, "host@example.com", "老王");
  other = await signUp(db, "other@example.com");
  await asAccount(db, host, async () => {
    await insert("games", game(host.space));
    await insert("players", row(host.space, "p1", { name: "张三", initials: "zs", createdAt: 1 }));
    await insert("ledger_events", event(host.space, "e1"));
    await insert("insurance_hands", row(host.space, "h1", { gameId: "g1", createdAt: 2 }));
    await insert(
      "saved_configs",
      row(host.space, "c1", { name: "标准工资", createdAt: 3 }),
      "chargeRules",
    );
  });
});

describe("signing up", () => {
  it("gives an account its profile, one space and its place in it as owner", async () => {
    const profile = await db.query<{ display_name: string; code: string }>(
      "select display_name, code from public.profiles where id = $1",
      [host.id],
    );
    expect(profile.rows[0]?.display_name).toBe("老王");
    expect(profile.rows[0]?.code).toMatch(/^[0-9A-F]{8}$/);
    const member = await db.query<{ role: string }>(
      "select role from public.organizer_members where organizer_id = $1 and user_id = $2",
      [host.space, host.id],
    );
    expect(member.rows).toEqual([{ role: "owner" }]);
  });

  it("names an account after its address when it gave no name", async () => {
    const profile = await db.query<{ display_name: string }>(
      "select display_name from public.profiles where id = $1",
      [other.id],
    );
    expect(profile.rows[0]?.display_name).toBe("other");
  });

  it("keeps an account to one space for now", async () => {
    await expect(
      db.query("insert into public.organizers (owner_id, name) values ($1, '第二个')", [host.id]),
    ).rejects.toThrow(/organizers_one_per_owner/);
  });
});

describe("the owner of a space", () => {
  it("reads and keeps its books", async () => {
    await asAccount(db, host, async () => {
      for (const table of [
        "games",
        "players",
        "ledger_events",
        "insurance_hands",
        "saved_configs",
      ]) {
        expect(await count(table), table).toBe(1);
      }
      await db.query(
        `update public.games set data = data || '{"status":"settled"}' where id = 'g1'`,
      );
      const settled = await db.query<{ status: string }>("select status from public.games");
      expect(settled.rows[0]?.status).toBe("settled");
    });
  });

  it("reads its own profile, space and membership, and no one else's", async () => {
    await asAccount(db, host, async () => {
      expect(await count("profiles")).toBe(1);
      expect(await count("organizers")).toBe(1);
      expect(await count("organizer_members")).toBe(1);
    });
  });

  it("renames its space, and changes nothing else of it", async () => {
    await asAccount(db, host, async () => {
      await db.query("update public.organizers set name = '周五局' where id = $1", [host.space]);
      await expect(
        db.query("update public.organizers set owner_id = $1 where id = $2", [
          other.id,
          host.space,
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("insert into public.organizers (owner_id, name) values ($1, 'x')", [host.id]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("cannot make itself a member of another space, or link a player by hand", async () => {
    await asAccount(db, host, async () => {
      await expect(
        db.query(
          "insert into public.organizer_members (organizer_id, user_id, role) values ($1, $2, 'owner')",
          [other.space, host.id],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("update public.players set linked_user_id = $1", [other.id]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("another account", () => {
  it("reads none of a space's books", async () => {
    await asAccount(db, other, async () => {
      for (const table of [
        "games",
        "players",
        "ledger_events",
        "insurance_hands",
        "saved_configs",
      ]) {
        expect(await count(table), table).toBe(0);
      }
    });
  });

  it("cannot write into a space that is not its own", async () => {
    await asAccount(db, other, async () => {
      await expect(insert("games", game(host.space, "g2"))).rejects.toThrow(/row-level security/);
      await expect(insert("ledger_events", event(host.space, "e2"))).rejects.toThrow(
        /row-level security/,
      );
      // An update or a delete finds no row it may touch, and changes nothing
      await db.query(`update public.games set data = data || '{"status":"open"}'`);
      await db.query("delete from public.players");
    });
    expect(await count("players")).toBe(1);
    const status = await db.query<{ status: string }>("select status from public.games");
    expect(status.rows[0]?.status).toBe("settled");
  });

  it("keeps records under the same IDs in its own space", async () => {
    await asAccount(db, other, async () => {
      await insert("games", game(other.space));
      await insert("ledger_events", event(other.space, "e1"));
      expect(await count("ledger_events")).toBe(1);
    });
  });
});

describe("a visitor who has not signed in", () => {
  it("reads and writes nothing", async () => {
    await asAccount(db, null, async () => {
      for (const table of ["profiles", "organizers", "games", "players", "ledger_events"]) {
        await expect(count(table), table).rejects.toThrow(/permission denied/);
      }
      await expect(insert("games", game(host.space, "g3"))).rejects.toThrow(/permission denied/);
    });
  });
});

describe("the ledger", () => {
  it("is added to and read, and never changed or deleted, even by the owner", async () => {
    await asAccount(db, host, async () => {
      await insert("ledger_events", event(host.space, "e3"));
      await expect(
        db.query(`update public.ledger_events set data = data || '{"chips":1}'`),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.ledger_events")).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it("takes an event's ID once", async () => {
    await asAccount(db, host, async () => {
      await expect(insert("ledger_events", event(host.space, "e1"))).rejects.toThrow(
        /duplicate key/,
      );
    });
  });

  it("takes events only for a game of the same space", async () => {
    await asAccount(db, host, async () => {
      await expect(insert("ledger_events", event(host.space, "e9", "nope"))).rejects.toThrow(
        /foreign key/,
      );
    });
  });
});

describe("restoring a backup", () => {
  const books = (space: string) =>
    JSON.stringify({
      games: [JSON.parse(game(space, "r1").data), JSON.parse(game(space, "g1").data)],
      ledgerEvents: [JSON.parse(event(space, "r-e1", "r1").data)],
      oddsTables: [{ id: "r-t1", organizerId: space, name: "赔率表", createdAt: 1 }],
    });
  const restore = (space: string, payload: string) =>
    db.query<{ added: number; skipped: number }>(
      "select * from public.restore_books($1, $2::jsonb)",
      [space, payload],
    );

  it("adds what the space lacks, leaves what it has, and says how many of each", async () => {
    await asAccount(db, host, async () => {
      const first = await restore(host.space, books(host.space));
      expect(first.rows[0]).toEqual({ added: 3, skipped: 1 });
      const again = await restore(host.space, books(host.space));
      expect(again.rows[0]).toEqual({ added: 0, skipped: 4 });
      const kept = await db.query<{ status: string }>(
        "select status from public.games where id = 'g1'",
      );
      // The game that was there is as it was, not as the backup has it
      expect(kept.rows[0]?.status).toBe("settled");
    });
  });

  it("cannot be used to write into another account's space", async () => {
    await asAccount(db, other, async () => {
      await expect(restore(host.space, books(host.space))).rejects.toThrow(/row-level security/);
    });
  });

  it("writes nothing when one record is not the space's own", async () => {
    const mixed = JSON.stringify({
      games: [JSON.parse(game(host.space, "r9").data), JSON.parse(game(other.space, "x").data)],
    });
    await asAccount(db, host, async () => {
      await expect(restore(host.space, mixed)).rejects.toThrow(/check constraint/);
      const made = await db.query("select 1 from public.games where id = 'r9'");
      expect(made.rows).toEqual([]);
    });
  });

  it("is not open to a visitor", async () => {
    await asAccount(db, null, async () => {
      await expect(restore(host.space, books(host.space))).rejects.toThrow(/permission denied/);
    });
  });
});

describe("a record", () => {
  it("has to carry the ID and the space it is kept under", async () => {
    await asAccount(db, host, async () => {
      const wrongId = { ...game(host.space, "g5"), id: "g6" };
      await expect(insert("games", wrongId)).rejects.toThrow(/check constraint/);
      const wrongSpace = { ...game(other.space, "g7"), organizer_id: host.space };
      await expect(insert("games", wrongSpace)).rejects.toThrow(/check constraint/);
    });
  });

  it("goes with its space when the space is deleted", async () => {
    const gone = await signUp(db, "gone@example.com");
    await asAccount(db, gone, async () => {
      await insert("games", game(gone.space));
      await insert("ledger_events", event(gone.space, "e1"));
    });
    await db.query("delete from auth.users where id = $1", [gone.id]);
    const left = await db.query<{ n: number }>(
      "select count(*)::int as n from public.ledger_events where organizer_id = $1",
      [gone.space],
    );
    expect(left.rows[0]?.n).toBe(0);
  });
});
