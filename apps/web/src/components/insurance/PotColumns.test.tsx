/** @vitest-environment jsdom */
import {
  handPotBreakdown,
  type InsuranceHand,
  type InsuranceHandPlayer,
  parseCard,
} from "@holdem-knight/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PotColumns } from "./PotColumns";

afterEach(cleanup);

const cards = (codes: string) => codes.split(" ").map((code) => parseCard(code) ?? -1);
const player = (playerId: string, chips: number, hole: string): InsuranceHandPlayer => ({
  playerId,
  chips,
  cover: false,
  cards: cards(hole),
});

/** Three players all-in for different amounts on a flop of three tens, with dead money. */
function hand(chips: readonly [number, number, number], pools: readonly number[]): InsuranceHand {
  return {
    id: "hand",
    organizerId: "organizer",
    gameId: "game",
    status: "open",
    step: "players",
    players: [
      player("king", chips[0], "As Kd"),
      player("nines", chips[1], "9d 9c"),
      player("sevens", chips[2], "7s 7h"),
    ],
    pools,
    board: cards("Ts Th Td"),
    purchases: [],
    declined: [],
    createdAt: 0,
  };
}

const chipsOf = (text: string | null) => Number((text ?? "").replace(/\D/g, ""));

/** Every pot as the page draws it: its chips, and each part's name and chips from the top down. */
function drawn(pots: ReturnType<typeof handPotBreakdown>) {
  render(<PotColumns pots={pots} nameOf={(id) => id} tiesSold cardsToCome />);
  return screen.getAllByRole("list").map((column) => ({
    name: column.getAttribute("aria-label"),
    amount: chipsOf(column.previousElementSibling?.textContent ?? null),
    height: column.style.height,
    minHeight: column.style.minHeight,
    parts: within(column)
      .getAllByRole("listitem")
      .map((part) => {
        const [label, chips] = part.querySelectorAll("span > span");
        return { label: label?.textContent, chips: chipsOf(chips?.textContent ?? null) };
      }),
  }));
}

describe("PotColumns", () => {
  it("draws every part of a main pot smaller than its side pot", () => {
    // A main pot of 1,250 beside a side pot of 3,000 once lost its last parts off the bottom
    const [main, side] = drawn(handPotBreakdown(hand([500, 250, 1000], [500, 2500])));
    expect(main).toMatchObject({
      name: "主池的组成",
      amount: 1250,
      parts: [
        { label: "nines", chips: 250 },
        { label: "king", chips: 250 },
        { label: "sevens", chips: 250 },
        { label: "死钱", chips: 500 },
      ],
    });
    expect(side).toMatchObject({
      name: "边池的组成",
      amount: 3000,
      parts: [
        { label: "sevens", chips: 250 },
        { label: "king", chips: 250 },
        { label: "死钱", chips: 2500 },
      ],
    });
  });

  it("draws both players of a side pot far smaller than the main pot", () => {
    // A side pot of 100 beside a main pot of 21,000 once showed its leader alone
    const [main, side] = drawn(handPotBreakdown(hand([6050, 6000, 6450], [3000])));
    expect(main?.amount).toBe(21000);
    expect(main?.parts.map(({ chips }) => chips)).toEqual([6000, 6000, 6000, 3000]);
    expect(side).toMatchObject({
      amount: 100,
      parts: [
        { label: "sevens", chips: 50 },
        { label: "king", chips: 50 },
      ],
    });
  });

  it("gives a column a least height and never a fixed one, so its parts cannot be cut off", () => {
    for (const pools of [[], [3000], [500, 2500]]) {
      for (const chips of [
        [500, 250, 1000],
        [6050, 6000, 6450],
        [10, 20, 30000],
      ] as const) {
        for (const column of drawn(handPotBreakdown(hand(chips, pools)))) {
          expect(column.height).toBe("");
          expect(column.minHeight).toMatch(/px$/);
          // The parts on show account for every chip of the pot
          expect(column.parts.reduce((sum, part) => sum + part.chips, 0)).toBe(column.amount);
        }
        cleanup();
      }
    }
  });
});
