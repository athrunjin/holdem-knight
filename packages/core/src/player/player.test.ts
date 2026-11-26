import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Player } from "../domain";
import {
  groupByInitial,
  initialLetter,
  MAX_PLAYER_NAME_LENGTH,
  numberPlayers,
  parsePlayerName,
  playerNameKey,
  playerNumberText,
  searchPlayers,
} from "./player";

const player = (name: string, initials: string): Player => ({
  id: name,
  organizerId: "me",
  name,
  initials,
  createdAt: 1,
});

describe("parsePlayerName", () => {
  it("trims the ends and collapses inner whitespace", () => {
    expect(parsePlayerName("  老  王 ")).toEqual({ ok: true, name: "老 王" });
  });

  it("requires a name", () => {
    expect(parsePlayerName("   ")).toEqual({ ok: false, issue: "empty" });
  });

  it("limits length by characters, counting rare characters as one", () => {
    const longest = "𠮷".repeat(MAX_PLAYER_NAME_LENGTH);
    expect(parsePlayerName(longest).ok).toBe(true);
    expect(parsePlayerName(`${longest}x`)).toEqual({ ok: false, issue: "too-long" });
  });

  it("accepts a name another player has", () => {
    expect(parsePlayerName("小王")).toEqual({ ok: true, name: "小王" });
  });
});

describe("reserved names", () => {
  it.each(["保险", " 保险 ", "保 险", "抽水", " 抽水 ", "抽 水"])("keeps %j for a seat", (name) => {
    expect(parsePlayerName(name)).toEqual({ ok: false, issue: "reserved" });
  });

  it("still allows names that only contain the word", () => {
    expect(parsePlayerName("保险哥").ok).toBe(true);
  });
});

describe("playerNameKey", () => {
  it("removes whitespace and ignores case", () => {
    expect(playerNameKey(" Bo b ")).toBe("bob");
  });
});

describe("searchPlayers", () => {
  const players = [player("张三", "zs"), player("李四", "ls"), player("Alice", "alice")];
  const names = (query: string) => searchPlayers(players, query).map((p) => p.name);

  it("returns everyone for an empty query", () => {
    expect(names("  ")).toEqual(["张三", "李四", "Alice"]);
  });

  it("searches by name, ignoring case", () => {
    expect(names("李")).toEqual(["李四"]);
    expect(names("ALI")).toEqual(["Alice"]);
  });

  it("searches by pinyin initials", () => {
    expect(names("ZS")).toEqual(["张三"]);
    expect(names("s")).toEqual(["张三", "李四"]);
  });

  it("returns nothing when no one matches", () => {
    expect(names("王")).toEqual([]);
  });

  it("finds every player by their own name or initials", () => {
    const anyPlayer = fc
      .record({
        name: fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
        initials: fc.stringMatching(/^[a-z]{1,8}$/),
      })
      .map(({ name, initials }) => player(name, initials));
    fc.assert(
      fc.property(fc.array(anyPlayer), anyPlayer, (others, target) => {
        const all = [...others, target];
        expect(searchPlayers(all, target.name)).toContain(target);
        expect(searchPlayers(all, target.initials)).toContain(target);
      }),
    );
  });
});

describe("initialLetter", () => {
  it.each([
    ["zs", "Z"],
    ["Ace", "A"],
    ["2pang", "#"],
    ["", "#"],
  ])("gives %j the letter %j", (initials, letter) => {
    expect(initialLetter({ initials })).toBe(letter);
  });
});

describe("groupByInitial", () => {
  const groups = (players: Player[]) =>
    groupByInitial(players).map(({ letter, players: members }) => [
      letter,
      members.map((p) => p.name),
    ]);

  it("only gives letters that have someone, in order, with # last", () => {
    const players = [
      player("张三", "zs"),
      player("8号", "8h"),
      player("Alex", "alex"),
      player("阿杰", "aj"),
      player("包子", "bz"),
    ];
    expect(groups(players)).toEqual([
      ["A", ["阿杰", "Alex"]],
      ["B", ["包子"]],
      ["Z", ["张三"]],
      ["#", ["8号"]],
    ]);
  });

  it("sorts players with the same initials by name", () => {
    expect(groups([player("王总", "wz"), player("王子", "wz")])).toEqual([["W", ["王子", "王总"]]]);
  });

  it("keeps every player exactly once", () => {
    const anyPlayer = fc
      .tuple(fc.uuid(), fc.stringMatching(/^[a-z0-9]{0,4}$/))
      .map(([name, initials]) => player(name, initials));
    fc.assert(
      fc.property(fc.array(anyPlayer), (players) => {
        const flat = groupByInitial(players).flatMap((group) => group.players);
        expect(flat).toHaveLength(players.length);
        expect(new Set(flat)).toEqual(new Set(players));
      }),
    );
  });
});

describe("numberPlayers", () => {
  const record = (id: string, createdAt: number, number?: number): Player => ({
    id,
    organizerId: "me",
    name: id,
    initials: id,
    createdAt,
    ...(number !== undefined && { number }),
  });

  it("numbers records without one from the oldest, past the highest in use", () => {
    const changed = numberPlayers([record("c", 30), record("a", 10, 7), record("b", 20)]);
    expect(changed.map(({ id, number }) => [id, number])).toEqual([
      ["b", 8],
      ["c", 9],
    ]);
  });

  it("starts at 1, and changes nothing once every record has its own number", () => {
    expect(numberPlayers([record("a", 10)]).map(({ number }) => number)).toEqual([1]);
    expect(numberPlayers([record("a", 10, 1), record("b", 20, 2)])).toEqual([]);
  });

  it("gives a new number to a newer record that holds one already taken", () => {
    const changed = numberPlayers([record("old", 10, 1), record("brought-in", 20, 1)]);
    expect(changed.map(({ id, number }) => [id, number])).toEqual([["brought-in", 2]]);
  });

  it("reads a number as four digits", () => {
    expect(playerNumberText(42)).toBe("#0042");
    expect(playerNumberText(12345)).toBe("#12345");
  });
});
