import {
  type ChipEvent,
  INSURANCE_PLAYER_ID,
  type LedgerEvent,
  type Player,
  RAKE_PLAYER_ID,
} from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import { t } from "@/i18n";
import {
  gameNameOf,
  libraryNameOf,
  libraryNameText,
  namesakeHint,
  namesakesOf,
} from "./player-name";

const named = (id: string, name: string, number?: number): Player => ({
  id,
  organizerId: "me",
  name,
  initials: id,
  createdAt: 1,
  ...(number !== undefined && { number }),
});

const buyIn = (id: string, playerId: string): ChipEvent => ({
  id,
  organizerId: "me",
  gameId: "g1",
  occurredAt: 1,
  type: "buy_in",
  playerId,
  chips: 100,
});

const game = { organizerId: "me" };

describe("gameNameOf", () => {
  it("reads namesakes with a suffix in the order they bought in", () => {
    const players = [named("a", "小王", 1), named("b", "小王", 2), named("c", "老张", 3)];
    const events: LedgerEvent[] = [buyIn("1", "b"), buyIn("2", "a"), buyIn("3", "c")];
    const nameOf = gameNameOf(players, game, events);

    expect(["a", "b", "c"].map(nameOf)).toEqual(["小王_1", "小王", "老张"]);
  });

  it("reads the plain name for a player not in the game, and the seats by their names", () => {
    const players = [named("a", "小王", 1), named("b", "小王", 2)];
    const nameOf = gameNameOf(players, game, []);

    expect(nameOf("a")).toBe("小王");
    expect(nameOf("b")).toBe("小王");
    expect(nameOf(INSURANCE_PLAYER_ID)).toBe(t.common.insurance);
    expect(nameOf(RAKE_PLAYER_ID)).toBe(t.common.rake);
    expect(nameOf("nobody")).toBe(t.common.unknownPlayer);
  });
});

describe("libraryNameOf", () => {
  it("gives the number only where more than one record carries the name", () => {
    const players = [named("a", "小王", 1), named("b", " 小 王", 3), named("c", "老张", 6)];
    const nameOf = libraryNameOf(players, game);

    expect(nameOf("a")).toEqual({ name: "小王", number: "#0001" });
    expect(nameOf("b")).toEqual({ name: " 小 王", number: "#0003" });
    expect(nameOf("c")).toEqual({ name: "老张", number: undefined });
    expect(libraryNameText(nameOf("a"))).toBe("小王 #0001");
    expect(libraryNameText(nameOf("c"))).toBe("老张");
  });

  it("gives no number to a record not yet numbered, nor to the seats", () => {
    const nameOf = libraryNameOf([named("a", "小王"), named("b", "小王", 2)], game);

    expect(nameOf("a")).toEqual({ name: "小王", number: undefined });
    expect(nameOf(INSURANCE_PLAYER_ID)).toEqual({ name: t.common.insurance, number: undefined });
    expect(nameOf("nobody")).toEqual({ name: t.common.unknownPlayer, number: undefined });
  });
});

describe("the namesake hint", () => {
  const players = [named("a", "小王", 7), named("b", "Bob", 2), named("c", "小王", 3)];

  it("finds the players of a name, spaces and case aside, and none for an empty one", () => {
    expect(namesakesOf(players, " 小 王 ").map(({ id }) => id)).toEqual(["a", "c"]);
    expect(namesakesOf(players, "bOB").map(({ id }) => id)).toEqual(["b"]);
    expect(namesakesOf(players, "  ")).toEqual([]);
  });

  it("lists their numbers in order, or says nothing when there are none", () => {
    expect(namesakeHint(namesakesOf(players, "小王"))).toBe("已有同名玩家 #0003、#0007");
    expect(namesakeHint(namesakesOf(players, "bob"))).toBe("已有同名玩家 #0002");
    expect(namesakeHint([])).toBeUndefined();
  });
});
