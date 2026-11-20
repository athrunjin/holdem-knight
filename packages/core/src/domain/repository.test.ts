import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { type BackupData, backupForOrganizer } from "./repository";

const data: BackupData = {
  games: [
    {
      id: "g",
      organizerId: "guest",
      currency: "CNY",
      smallBlindChips: 5,
      bigBlindChips: 10,
      chipRatio: { chips: 1, amount: cents(100) },
      status: "open",
      createdAt: 1,
    },
  ],
  players: [{ id: "p", organizerId: "guest", name: "张三", initials: "zs", createdAt: 1 }],
  ledgerEvents: [
    {
      id: "e",
      organizerId: "guest",
      gameId: "g",
      occurredAt: 2,
      type: "buy_in",
      playerId: "p",
      chips: 1000,
    },
  ],
  insuranceRules: [],
  insuranceHands: [],
  gameConfigs: [],
  oddsTables: [
    { id: "t", organizerId: "guest", name: "赔率表", oddsHundredths: [3000], createdAt: 1 },
  ],
  chargeRules: [],
};

describe("backupForOrganizer", () => {
  it("gives every record the organizer and changes nothing else", () => {
    const own = backupForOrganizer(data, "space-1");
    expect(own.games[0]).toEqual({ ...data.games[0], organizerId: "space-1" });
    expect(own.players[0]).toEqual({ ...data.players[0], organizerId: "space-1" });
    expect(own.ledgerEvents[0]).toEqual({ ...data.ledgerEvents[0], organizerId: "space-1" });
    expect(own.oddsTables[0]).toEqual({ ...data.oddsTables[0], organizerId: "space-1" });
    expect(own.insuranceRules).toEqual([]);
  });

  it("leaves the backup it was given as it was", () => {
    backupForOrganizer(data, "space-1");
    expect(data.games[0]?.organizerId).toBe("guest");
  });
});
