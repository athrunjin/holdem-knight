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

const summary = (space: string, id = "g1") =>
  row(space, id, { day: "2026-11-21", currency: "CNY", income: { rake: 100 } });

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
    await insert("game_summaries", summary(host.space));
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

describe("the name an account shows", () => {
  const valid = (name: string) =>
    db
      .query<{ ok: boolean | null }>("select public.valid_display_name($1) as ok", [name])
      .then((result) => result.rows[0]?.ok);

  it("may be letters of any script, digits, emoji, single spaces and - . _", async () => {
    for (const name of [
      "老王",
      "Old Wang",
      "a_b-c.d",
      "王😀",
      "ＡＢＣ",
      "José",
      "김철수",
      "王".repeat(30),
    ]) {
      expect(await valid(name), name).toBe(true);
    }
  });

  it("may not be empty, padded, doubly spaced or too long", async () => {
    for (const name of ["", " ", " 老王", "老王 ", "a  b", "王".repeat(31)]) {
      expect(await valid(name), JSON.stringify(name)).toBe(false);
    }
  });

  it("may not hold what shows nothing or steers the text", async () => {
    const unseen = [
      "\u200b",
      "老\u200b王",
      "\u3164",
      "a\u202eb",
      "x\ue000",
      "老\ufeff王",
      "a\u0007b",
      "老\u3000王",
    ];
    for (const name of unseen) {
      expect(await valid(name), JSON.stringify(name)).toBe(false);
    }
  });

  it("may not hold the marks that code and markup are written with", async () => {
    for (const name of [
      "<b>",
      "a'b",
      'a"b',
      "a;b",
      "a\\b",
      "a/b",
      "a&b",
      "{x}",
      "a=b",
      "$a",
      "a`b",
    ]) {
      expect(await valid(name), name).toBe(false);
    }
  });

  it("may not be what a seat or the host is called in a game", async () => {
    for (const name of ["保险", "抽水", "组织者", "抽 水"]) {
      expect(await valid(name), name).toBe(false);
    }
    expect(await valid("保险箱")).toBe(true);
  });

  it("is held to that when the account changes it", async () => {
    await asAccount(db, host, async () => {
      await expect(
        db.query("update public.profiles set display_name = '<script>' where id = $1", [host.id]),
      ).rejects.toThrow(/check constraint/);
      await db.query("update public.profiles set display_name = '王老板' where id = $1", [host.id]);
    });
  });

  it("falls back on the address, then on 玩家, when the one given at sign-up is refused", async () => {
    const shown = async (email: string, given: string) => {
      const account = await signUp(db, email, given);
      const profile = await db.query<{ display_name: string }>(
        "select display_name from public.profiles where id = $1",
        [account.id],
      );
      return profile.rows[0]?.display_name;
    };
    expect(await shown("first.last+tag@example.com", "<img src=x>")).toBe("first.lasttag");
    expect(await shown("+++@example.com", "保险")).toBe("玩家");
  });
});

describe("agreeing to the terms", () => {
  it("is kept with its time and the text's version when an account signs up through the app", async () => {
    const account = await signUp(db, "agreed@example.com", "同意的人", "2026-12_1.0");
    const profile = await db.query<{ agreed_at: Date | null; agreed_version: string | null }>(
      "select agreed_at, agreed_version from public.profiles where id = $1",
      [account.id],
    );
    expect(profile.rows[0]?.agreed_version).toBe("2026-12_1.0");
    expect(profile.rows[0]?.agreed_at).toBeInstanceOf(Date);
  });

  it("is missing on an account made another way, and cannot be written by the account", async () => {
    const profile = await db.query<{ agreed_at: Date | null }>(
      "select agreed_at from public.profiles where id = $1",
      [other.id],
    );
    expect(profile.rows[0]?.agreed_at).toBeNull();
    await asAccount(db, other, async () => {
      await expect(
        db.query("update public.profiles set agreed_at = now() where id = $1", [other.id]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("an account made through Google", () => {
  const shown = async (email: string, meta: Record<string, string>) => {
    const account = await signUp(db, email, meta);
    const profile = await db.query<{ display_name: string; agreed_at: Date | null }>(
      "select display_name, agreed_at from public.profiles where id = $1",
      [account.id],
    );
    return profile.rows[0];
  };

  it("shows Google's full name, then its name, where it gave no name of its own", async () => {
    expect(
      (await shown("g1@example.com", { full_name: "Lin Wei", name: "Wei" }))?.display_name,
    ).toBe("Lin Wei");
    expect((await shown("g2@example.com", { name: "Wei" }))?.display_name).toBe("Wei");
  });

  it("shows its own name over both", async () => {
    const profile = await shown("g3@example.com", {
      display_name: "小林",
      full_name: "Lin Wei",
      name: "Wei",
    });
    expect(profile?.display_name).toBe("小林");
  });

  it("passes over a name it may not show, to the next one and then the address", async () => {
    expect(
      (await shown("g4@example.com", { full_name: "O'Brien", name: "Pat" }))?.display_name,
    ).toBe("Pat");
    expect(
      (await shown("g5@example.com", { full_name: "O'Brien", name: "<b>" }))?.display_name,
    ).toBe("g5");
  });

  it("has not agreed to the terms", async () => {
    expect((await shown("g6@example.com", { full_name: "Lin Wei" }))?.agreed_at).toBeNull();
  });
});

describe("agreeing to the terms after signing in", () => {
  let lin: TestAccount;
  let bystander: TestAccount;

  interface Agreement {
    display_name: string;
    agreed_at: Date | null;
    agreed_version: string | null;
    name: string;
  }

  const agreement = async (account: TestAccount) =>
    (
      await db.query<Agreement>(
        `select p.display_name, p.agreed_at, p.agreed_version, o.name
         from public.profiles p join public.organizers o on o.owner_id = p.id where p.id = $1`,
        [account.id],
      )
    ).rows[0];

  const agree = (account: TestAccount | null, name: string, version: string) =>
    asAccount(db, account, () => db.query("select public.agree_to_terms($1, $2)", [name, version]));

  beforeAll(async () => {
    lin = await signUp(db, "lin@example.com", { full_name: "Lin Wei" });
    bystander = await signUp(db, "bystander@example.com", { full_name: "Bystander" });
  });

  it("records the time, the version and the name on the profile and the space", async () => {
    await agree(lin, "小林", "2026-12_1.0");
    const after = await agreement(lin);
    expect(after?.agreed_at).toBeInstanceOf(Date);
    expect(after?.agreed_version).toBe("2026-12_1.0");
    expect(after?.display_name).toBe("小林");
    expect(after?.name).toBe("小林");
  });

  it("keeps the first time and version at a second call", async () => {
    const before = await agreement(lin);
    await agree(lin, "林伟", "2027-01");
    const after = await agreement(lin);
    expect(after?.agreed_at).toEqual(before?.agreed_at);
    expect(after?.agreed_version).toBe("2026-12_1.0");
  });

  it("changes no other account", async () => {
    expect(await agreement(bystander)).toEqual({
      display_name: "Bystander",
      agreed_at: null,
      agreed_version: null,
      name: "Bystander",
    });
  });

  it("is refused to a visitor who has not signed in", async () => {
    await expect(agree(null, "访客", "0")).rejects.toThrow(/permission denied/);
  });

  it("refuses a name an account may not show, or a version out of bounds, and changes nothing", async () => {
    const before = await agreement(bystander);
    for (const name of ["", "保险", "<b>", "王".repeat(31)]) {
      await expect(agree(bystander, name, "0"), JSON.stringify(name)).rejects.toThrow(
        /may not show/,
      );
    }
    for (const version of ["", "v".repeat(21)]) {
      await expect(agree(bystander, "旁人", version), version).rejects.toThrow(/1 to 20/);
    }
    expect(await agreement(bystander)).toEqual(before);
  });

  it("is the only way to the agreement: it still cannot be written or cleared by hand", async () => {
    await asAccount(db, lin, async () => {
      await expect(
        db.query("update public.profiles set agreed_at = null where id = $1", [lin.id]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("update public.profiles set agreed_version = 'x' where id = $1", [lin.id]),
      ).rejects.toThrow(/permission denied/);
    });
    await asAccount(db, bystander, async () => {
      await expect(
        db.query("update public.profiles set agreed_at = now() where id = $1", [bystander.id]),
      ).rejects.toThrow(/permission denied/);
    });
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
        "game_summaries",
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
        "game_summaries",
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
      await expect(insert("game_summaries", summary(host.space, "g1"))).rejects.toThrow(
        /row-level security/,
      );
      await db.query("delete from public.game_summaries");
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

describe("a game's summary", () => {
  it("is replaced by the owner, and only for a game of the space", async () => {
    await asAccount(db, host, async () => {
      await db.query(
        `update public.game_summaries set data = data || '{"day":"2026-11-22"}' where id = 'g1'`,
      );
      const kept = await db.query<{ day: string }>("select day from public.game_summaries");
      expect(kept.rows).toEqual([{ day: "2026-11-22" }]);
      await expect(insert("game_summaries", summary(host.space, "none"))).rejects.toThrow(
        /foreign key/,
      );
    });
  });

  it("is not open to a visitor", async () => {
    await asAccount(db, null, async () => {
      await expect(count("game_summaries")).rejects.toThrow(/permission denied/);
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

describe("the host's own record", () => {
  const own = (space: string, name = "老王") =>
    row(space, "organizer", { name, initials: "lw", createdAt: 1 });
  const linkOf = async (space: string) =>
    (
      await db.query<{ linked_user_id: string | null }>(
        "select linked_user_id from public.players where organizer_id = $1 and id = 'organizer'",
        [space],
      )
    ).rows;

  it("is one a space, linked to the space's owner whatever the app sends", async () => {
    const mine = await signUp(db, "own@example.com", "阿杰");
    await asAccount(db, mine, async () => {
      await insert("players", own(mine.space));
      await expect(insert("players", own(mine.space, "again"))).rejects.toThrow(/duplicate key/);
    });
    expect(await linkOf(mine.space)).toEqual([{ linked_user_id: mine.id }]);
  });

  it("is brought in through a restore and linked the same way, once", async () => {
    const brought = await signUp(db, "brought@example.com");
    await asAccount(db, brought, async () => {
      const books = JSON.stringify({ players: [JSON.parse(own(brought.space, "我").data)] });
      await db.query("select * from public.restore_books($1, $2)", [brought.space, books]);
      const again = await db.query<{ added: number; skipped: number }>(
        "select * from public.restore_books($1, $2)",
        [brought.space, books],
      );
      expect(again.rows[0]).toEqual({ added: 0, skipped: 1 });
    });
    expect(await linkOf(brought.space)).toEqual([{ linked_user_id: brought.id }]);
  });

  it("stays linked to the owner through a rename, and cannot be unlinked by the app", async () => {
    const kept = await signUp(db, "kept@example.com");
    await asAccount(db, kept, async () => {
      await insert("players", own(kept.space));
      await db.query(
        `update public.players set data = data || '{"name":"老板"}' where id = 'organizer'`,
      );
      await expect(
        db.query("update public.players set linked_user_id = null where id = 'organizer'"),
      ).rejects.toThrow(/permission denied/);
    });
    expect(await linkOf(kept.space)).toEqual([{ linked_user_id: kept.id }]);
  });

  it("cannot be deleted by the owner, or moved to another ID", async () => {
    const fixed = await signUp(db, "fixed@example.com");
    await asAccount(db, fixed, async () => {
      await insert("players", own(fixed.space));
      await insert(
        "players",
        row(fixed.space, "p9", { name: "李四", initials: "ls", createdAt: 2 }),
      );
      await db.query("delete from public.players where organizer_id = $1", [fixed.space]);
      const left = await db.query<{ id: string }>("select id from public.players");
      expect(left.rows).toEqual([{ id: "organizer" }]);
      await expect(
        db.query(
          `update public.players set id = 'p10', data = data || '{"id":"p10"}' where id = 'organizer'`,
        ),
      ).rejects.toThrow(/own record/);
    });
  });

  it("is not written into another account's space", async () => {
    await asAccount(db, other, async () => {
      await expect(insert("players", own(host.space))).rejects.toThrow(/row-level security/);
    });
  });

  it("goes with its space when the space is deleted", async () => {
    const gone = await signUp(db, "own-gone@example.com");
    await asAccount(db, gone, async () => {
      await insert("players", own(gone.space));
    });
    await db.query("delete from auth.users where id = $1", [gone.id]);
    expect(await linkOf(gone.space)).toEqual([]);
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
