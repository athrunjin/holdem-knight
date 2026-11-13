import { type Charge, cents } from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import { organizerIncomeLines } from "./chargeLines";

const game = { currency: "CNY", tableFee: { amount: cents(10000), minMinutes: 0 } } as const;
const fee = (playerId: string, waived = false): Charge => ({
  playerId,
  kind: "table_fee",
  amount: cents(10000),
  waived,
});
const wage: Charge = { playerId: "a", kind: "wage", amount: cents(2500), waived: false };

describe("organizerIncomeLines", () => {
  it("writes the table fee as its price times how many pay it", () => {
    const [wages, fees] = organizerIncomeLines(game, [wage, fee("a"), fee("b"), fee("c", true)]);
    expect(wages).toMatchObject({ label: "工资", amount: 2500 });
    expect(fees?.label).toMatch(/^台费 .*100.*\/人 × 2$/);
    expect(fees?.amount).toBe(20000);
  });

  it("shows a dash for what the organizer does not receive", () => {
    const lines = organizerIncomeLines(game, [wage, fee("a")], false);
    expect(lines.map((line) => line.amount)).toEqual([undefined, undefined]);
    expect(organizerIncomeLines({ currency: "CNY" }, [])[1]?.label).toBe("台费");
  });
});
