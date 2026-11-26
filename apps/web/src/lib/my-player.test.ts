import { cents, ORGANIZER_COLLECTOR, type TransferLine, transferReport } from "@holdem-knight/core";
import { describe, expect, it, vi } from "vitest";

// The books in use are not what is under test here
vi.mock("@/data", () => ({ currentOrganizerId: () => "guest" }));
vi.mock("@/data/players", () => ({ usePlayers: () => ({ data: [] }) }));

const { counterpartOf, myLines, parseMyPlayers } = await import("./my-player");

describe("parseMyPlayers", () => {
  it("keeps a map of organizer IDs to player IDs", () => {
    expect(parseMyPlayers({ guest: "p1", "space-1": "p2" })).toEqual({
      guest: "p1",
      "space-1": "p2",
    });
    expect(parseMyPlayers({})).toEqual({});
  });

  it("drops anything that is not a map of strings to strings", () => {
    for (const stored of [null, "p1", 3, true, ["p1"], { guest: 1 }, { guest: null }]) {
      expect(parseMyPlayers(stored)).toBeUndefined();
    }
    expect(parseMyPlayers({ guest: "p1", other: { id: "p2" } })).toBeUndefined();
  });
});

const ME = "p-me";

function line(
  from: string,
  to: string,
  amount: number,
  day: string,
  startedAt = Date.parse(`${day}T20:00:00`),
): TransferLine {
  return {
    from,
    to,
    amount: cents(amount),
    done: false,
    gameId: `g-${day}-${startedAt}`,
    day,
    startedAt,
    smallBlindChips: 1,
    bigBlindChips: 2,
  };
}

describe("myLines", () => {
  it("takes the player's lines with the organizer and with other players, oldest first", () => {
    const owe = line(ME, ORGANIZER_COLLECTOR, 2000, "2026-11-20");
    const paid = line(ORGANIZER_COLLECTOR, ME, 600, "2026-11-02");
    const fromOther = line("p-ling", ME, 300, "2026-11-20", Date.parse("2026-11-20T14:00:00"));
    const toOther = line(ME, "p-jie", 100, "2026-11-22");
    const others = line("p-ling", "p-jie", 900, "2026-11-01");
    const report = {
      parties: [
        {
          partyId: ME,
          toOrganizer: cents(2000),
          fromOrganizer: cents(600),
          net: cents(1400),
          games: 2,
          oldestDay: "2026-11-02",
          lines: [owe, paid],
        },
      ],
      between: [toOther, fromOther, others],
    };

    const { party, lines } = myLines(report, ME);
    expect(party?.partyId).toBe(ME);
    // The same day: the game that started earlier first
    expect(lines).toEqual([paid, fromOther, owe, toOther]);
  });

  it("finds nothing for a player with no open line", () => {
    const report = transferReport([], { currency: "CNY", state: "open" });
    expect(myLines(report, ME)).toEqual({ party: undefined, lines: [] });
  });
});

describe("counterpartOf", () => {
  it("says who a line is with, from the player's side", () => {
    expect(counterpartOf(line(ME, ORGANIZER_COLLECTOR, 1, "2026-11-01"), ME)).toEqual({
      kind: "toOrganizer",
    });
    expect(counterpartOf(line(ORGANIZER_COLLECTOR, ME, 1, "2026-11-01"), ME)).toEqual({
      kind: "fromOrganizer",
    });
    expect(counterpartOf(line(ME, "p-jie", 1, "2026-11-01"), ME)).toEqual({
      kind: "toPlayer",
      playerId: "p-jie",
    });
    expect(counterpartOf(line("p-ling", ME, 1, "2026-11-01"), ME)).toEqual({
      kind: "fromPlayer",
      playerId: "p-ling",
    });
  });
});
