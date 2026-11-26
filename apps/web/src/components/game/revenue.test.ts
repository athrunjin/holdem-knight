import {
  cents,
  type GameSummary,
  ORGANIZER_PLAYER_ID,
  type SummaryPlayer,
} from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import { revenueOf } from "./revenue";

const seat = (playerId: string, chipNet: number, share = 0): SummaryPlayer => ({
  playerId,
  boughtChips: 0,
  cashedOutChips: 0,
  chipNet: cents(chipNet),
  share: cents(share),
  insurance: cents(0),
  wage: cents(0),
  tableFee: cents(0),
  total: cents(chipNet + share),
});

/** A game in a signed-in space, so the space's ID is not the organizer's seat */
const summary = (players: SummaryPlayer[], absorbed = 0): GameSummary => ({
  id: "g1",
  organizerId: "3f2a6c1e-0000-4000-8000-000000000001",
  basis: "[1,5,null,[]]",
  startedAt: 1,
  day: "2026-11-21",
  settledAt: 5,
  currency: "CNY",
  chipRatio: { chips: 1, amount: cents(100) },
  smallBlindChips: 5,
  bigBlindChips: 10,
  playerCount: players.length,
  income: { rake: cents(0), insurance: cents(0), wage: cents(132500), tableFee: cents(80000) },
  difference: cents(0),
  absorbed: cents(absorbed),
  players,
  transfers: [],
});

const amounts = (revenue: ReturnType<typeof revenueOf>) =>
  Object.fromEntries(revenue.parts.map(({ key, amount }) => [key, amount]));

describe("revenueOf", () => {
  it("takes off what the organizer lost at the table", () => {
    const revenue = revenueOf(summary([seat(ORGANIZER_PLAYER_ID, -200000), seat("p1", 200000)]));
    expect(amounts(revenue)).toEqual({ asPlayer: -200000, wage: 132500, tableFee: 80000 });
    expect(revenue.total).toBe(12500);
    expect(revenue.parts[0]?.label).toBe("下场");
  });

  it("adds what the organizer won at the table", () => {
    const revenue = revenueOf(summary([seat(ORGANIZER_PLAYER_ID, 39500), seat("p1", -39500)]));
    expect(amounts(revenue).asPlayer).toBe(39500);
    expect(revenue.total).toBe(252000);
  });

  it("keeps the organizer's share of a split difference apart from their play", () => {
    const revenue = revenueOf(
      summary([seat(ORGANIZER_PLAYER_ID, 10000, -300), seat("p1", -9000, -200)]),
    );
    expect(amounts(revenue)).toEqual({
      asPlayer: 10000,
      wage: 132500,
      tableFee: 80000,
      shared: -300,
    });
    expect(revenue.total).toBe(222200);
  });

  it("has no own play for an organizer who did not play", () => {
    const revenue = revenueOf(summary([seat("p1", 500), seat("p2", -500)], -1000));
    expect(amounts(revenue)).toEqual({ wage: 132500, tableFee: 80000, shared: -1000 });
    expect(revenue.total).toBe(211500);
  });
});
