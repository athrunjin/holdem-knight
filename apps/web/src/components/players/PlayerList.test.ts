import type { Player } from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import { matchPlayers } from "./PlayerList";

const named = (id: string, name: string, initials: string): Player => ({
  id,
  organizerId: "me",
  name,
  initials,
  createdAt: 1,
});

describe("matchPlayers", () => {
  const players = [named("a", "小王", "xw"), named("b", "小王", "xw"), named("c", "小王八", "xwb")];

  it("returns the namesakes of the query beside what it finds", () => {
    const { groups, newName, namesakes } = matchPlayers(players, "小王");

    expect(groups.flatMap((group) => group.players.map(({ id }) => id)).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(newName).toBeUndefined();
    expect(namesakes.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("finds no namesakes for a query that only begins a name, and offers a new name that finds nobody", () => {
    expect(matchPlayers(players, "xw").namesakes).toEqual([]);
    expect(matchPlayers(players, "老张")).toMatchObject({ newName: "老张", namesakes: [] });
  });
});
