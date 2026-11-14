import {
  type BackupData,
  cents,
  INSURANCE_PLAYER_ID,
  type LedgerEvent,
  OPTIMAL_PLAN,
  ORGANIZER_PLAYER_ID,
  RULE_30,
} from "@holdem-knight/core";
import { describe, expect, it } from "vitest";

import { parseBackup, serializeBackup } from "./backup";

const data: BackupData = {
  games: [
    {
      id: "g",
      organizerId: "guest",
      currency: "CNY",
      smallBlindChips: 500,
      bigBlindChips: 1000,
      chipRatio: { chips: 100, amount: cents(100) },
      status: "settled",
      createdAt: 1,
      settledAt: 2,
    },
  ],
  players: [{ id: "p", organizerId: "guest", name: "张三", initials: "zs", createdAt: 1 }],
  ledgerEvents: [
    {
      id: "e1",
      organizerId: "guest",
      gameId: "g",
      occurredAt: 1,
      type: "buy_in",
      playerId: "p",
      chips: 1000,
    },
    {
      id: "e2",
      organizerId: "guest",
      gameId: "g",
      occurredAt: 2,
      type: "reversal",
      reversedEventId: "e1",
    },
  ],
  insuranceRules: [],
  insuranceHands: [],
  gameConfigs: [],
  oddsTables: [],
  chargeRules: [],
};

const edit = (change: (backup: Record<string, unknown>) => void) => {
  const backup = JSON.parse(serializeBackup(data, 1));
  change(backup);
  return JSON.stringify(backup);
};

describe("backup file", () => {
  it("rejects a hand from a game outside the backup", () => {
    const hand = {
      id: "h",
      organizerId: "guest",
      gameId: "missing",
      status: "open",
      step: "players",
      players: [],
      pools: [],
      board: [],
      purchases: [],
      declined: [],
      createdAt: 1,
    } as const;
    const text = serializeBackup({ ...data, insuranceHands: [hand] }, 1);
    expect(parseBackup(text)).toEqual({ ok: false, issue: "invalid" });
  });

  it("keeps the game clock", () => {
    const game = data.games[0];
    if (!game) throw new Error("expected a game");
    const timer = { elapsedMs: 5, runningSince: 9, runs: [{ from: 1, to: 6 }] };
    const timed = { ...data, games: [{ ...game, timer }] };
    expect(parseBackup(serializeBackup(timed, 1))).toEqual({ ok: true, data: timed });
  });

  it("keeps the table fee, wages and waived charges on games and saved configs", () => {
    const game = data.games[0];
    if (!game) throw new Error("expected a game");
    const tableFee = { amount: cents(10_000), minMinutes: 30 };
    const wage = {
      hourly: cents(2500),
      adjustment: { kind: "time_of_day", fromHour: 22, toHour: 2, hourly: cents(4000) },
    } as const;
    const settings = {
      currency: "CNY",
      smallBlindChips: 1,
      bigBlindChips: 2,
      chipRatio: { chips: 1, amount: cents(100) },
      buyInBigBlinds: 100,
      tableFee,
      wage,
    } as const;
    const charged = {
      ...data,
      games: [
        {
          ...game,
          tableFee,
          wage,
          waivedCharges: [
            { playerId: "p", kind: "table_fee" },
            { playerId: "p", kind: "wage", part: "adjusted" },
          ] as const,
        },
      ],
      gameConfigs: [{ id: "c", organizerId: "guest", name: "周五局", settings, createdAt: 1 }],
    };
    expect(parseBackup(serializeBackup(charged, 1))).toEqual({ ok: true, data: charged });
  });

  it("reads version 2 backups, which have no saved rules", () => {
    const older = edit((backup) => {
      backup.version = 2;
      delete backup.insuranceRules;
    });
    expect(parseBackup(older)).toEqual({ ok: true, data });
  });

  it("reads version 4 backups, which have no saved configs", () => {
    const older = edit((backup) => {
      backup.version = 4;
      delete backup.gameConfigs;
    });
    expect(parseBackup(older)).toEqual({ ok: true, data });
  });

  it("reads version 8 backups, dropping premium caps and the turn switch from rules", () => {
    const rule = { ...RULE_30, coverTurn: false, turnCapPercent: 25 };
    const older = edit((backup) => {
      backup.version = 8;
      delete backup.oddsTables;
      delete backup.chargeRules;
      backup.insuranceRules = [{ id: "r", organizerId: "guest", name: "旧", rule, createdAt: 1 }];
    });
    expect(parseBackup(older)).toEqual({
      ok: true,
      data: {
        ...data,
        insuranceRules: [
          { id: "r", organizerId: "guest", name: "旧", rule: RULE_30, createdAt: 1 },
        ],
      },
    });
  });

  it("round-trips wage segments and the waivers of their rates", () => {
    const [game] = data.games;
    if (!game) throw new Error("Missing sample game");
    const wage = {
      hourly: cents(2500),
      unitMinutes: 60,
      roundUp: true,
      timeSegments: [
        { fromHour: 22, toHour: 2, hourly: cents(4000) },
        { fromHour: 2, hourly: cents(3000) },
      ],
      afterStartSegments: [{ afterHours: 6, hourly: cents(3500) }],
    } as const;
    const full: BackupData = {
      ...data,
      games: [{ ...game, wage, waivedCharges: [{ playerId: "p", kind: "wage", part: "time-2" }] }],
    };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("round-trips a game's plan, its archive and the transfers marked as made", () => {
    const [game] = data.games;
    if (!game) throw new Error("Missing sample game");
    const full: BackupData = {
      ...data,
      games: [
        {
          ...game,
          collectorId: OPTIMAL_PLAN,
          archive: "pending",
          doneTransfers: [{ from: "p", to: ORGANIZER_PLAYER_ID, amount: cents(1250) }],
        },
      ],
    };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("round-trips a game's time zone and a wage's rounding", () => {
    const [game] = data.games;
    if (!game) throw new Error("Missing sample game");
    const wage = { hourly: cents(2500), unitMinutes: 30, rounding: "nearest" } as const;
    const full: BackupData = {
      ...data,
      games: [{ ...game, wage, timeZone: "Asia/Shanghai" }],
    };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("round-trips saved table fee and wage configs", () => {
    const saved = { organizerId: "guest", createdAt: 1 };
    const full: BackupData = {
      ...data,
      chargeRules: [
        {
          ...saved,
          id: "f",
          name: "台费配置_11-11",
          kind: "table_fee",
          rule: { amount: cents(5000), minMinutes: 10 },
        },
        {
          ...saved,
          id: "w",
          name: "工资配置_11-11",
          kind: "wage",
          rule: { hourly: cents(2500), unitMinutes: 15, roundUp: true },
        },
      ],
    };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("round-trips saved odds tables and cover limits", () => {
    const rule = { ...RULE_30, turnCoverLimit: "stake", riverCoverLimit: 75 } as const;
    const full: BackupData = {
      ...data,
      insuranceRules: [{ id: "r", organizerId: "guest", name: "周五局", rule, createdAt: 1 }],
      oddsTables: [
        {
          id: "t",
          organizerId: "guest",
          name: "赔率表_11-11",
          oddsHundredths: [3000, 1500],
          createdAt: 2,
        },
      ],
    };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("round-trips saved game configs", () => {
    const settings = {
      currency: "CNY",
      smallBlindChips: 5,
      bigBlindChips: 10,
      chipRatio: { chips: 1, amount: cents(100) },
      buyInBigBlinds: 100,
      insurance: RULE_30,
    } as const;
    const full: BackupData = {
      ...data,
      gameConfigs: [{ id: "c", organizerId: "guest", name: "周五局", settings, createdAt: 1 }],
    };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("accepts an organizer who plays, with no player record", () => {
    const meta = { organizerId: "guest", gameId: "g", occurredAt: 3 };
    const buyIn: LedgerEvent = {
      ...meta,
      id: "o",
      type: "buy_in",
      playerId: ORGANIZER_PLAYER_ID,
      chips: 1000,
    };
    const full = { ...data, ledgerEvents: [...data.ledgerEvents, buyIn] };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("round-trips insurance rules, purchases and the insurance seat", () => {
    const rule = { ...RULE_30, riverCoverLimit: 50 };
    const [game] = data.games;
    if (!game) throw new Error("Missing sample game");
    const meta = { organizerId: "guest", gameId: "g", occurredAt: 3 };
    const events: LedgerEvent[] = [
      { ...meta, id: "s", type: "buy_in", playerId: INSURANCE_PLAYER_ID, chips: 1000 },
      {
        ...meta,
        id: "b",
        type: "insurance_buy",
        playerId: "p",
        chips: 286,
        payoutChips: 1001,
        outs: 8,
        oddsHundredths: 350,
        street: "river",
      },
      {
        ...meta,
        id: "h",
        type: "insurance_settle",
        purchaseId: "b",
        playerId: "p",
        hit: true,
        chips: 1001,
      },
    ];
    const full: BackupData = {
      ...data,
      games: [{ ...game, insurance: rule, insuranceOwner: "p" }],
      ledgerEvents: [...data.ledgerEvents, ...events],
      insuranceRules: [{ id: "r", organizerId: "guest", name: "周五局", rule, createdAt: 1 }],
    };
    expect(parseBackup(serializeBackup(full, 1))).toEqual({ ok: true, data: full });
  });

  it("rejects a result pointing at a purchase that is not in the backup", () => {
    const orphan = {
      ...data,
      ledgerEvents: [
        ...data.ledgerEvents,
        {
          organizerId: "guest",
          gameId: "g",
          occurredAt: 3,
          id: "h",
          type: "insurance_settle",
          purchaseId: "nope",
          playerId: "p",
          hit: false,
          chips: 0,
        } satisfies LedgerEvent,
      ],
    };
    expect(parseBackup(serializeBackup(orphan, 1))).toEqual({ ok: false, issue: "invalid" });
  });

  it("upgrades version 1 backups with money blinds", () => {
    const legacy = edit((backup) => {
      backup.version = 1;
      const [game] = backup.games as Record<string, unknown>[];
      if (!game) throw new Error("missing game");
      delete game.smallBlindChips;
      delete game.bigBlindChips;
      game.smallBlind = 500;
      game.bigBlind = 1000;
    });
    expect(parseBackup(legacy)).toEqual({ ok: true, data });
  });

  it("keeps stack events", () => {
    const stack: LedgerEvent = {
      id: "s",
      organizerId: "guest",
      gameId: "g",
      occurredAt: 3,
      type: "stack_set",
      playerId: "p",
      chips: 700,
    };
    const withStack = { ...data, ledgerEvents: [...data.ledgerEvents, stack] };
    expect(parseBackup(serializeBackup(withStack, 1))).toEqual({ ok: true, data: withStack });
  });

  it("keeps a game's buy-in settings", () => {
    const [game] = data.games;
    if (!game) throw new Error("missing game");
    const withBuyIn = {
      ...data,
      games: [
        {
          ...game,
          buyInBigBlinds: 100,
          handChips: 200,
          collectorId: "p",
          imbalanceHandling: "split" as const,
        },
      ],
    };
    expect(parseBackup(serializeBackup(withBuyIn, 1))).toEqual({ ok: true, data: withBuyIn });
  });

  it("parses back to identical data after serializing", () => {
    expect(parseBackup(serializeBackup(data, 1))).toEqual({ ok: true, data });
  });

  it("rejects files that are not JSON or not backups", () => {
    expect(parseBackup("not json")).toEqual({ ok: false, issue: "invalid" });
    expect(parseBackup("{}")).toEqual({ ok: false, issue: "invalid" });
  });

  it("rejects backups from a newer version", () => {
    const text = edit((backup) => {
      backup.version = 13;
    });
    expect(parseBackup(text)).toEqual({ ok: false, issue: "newer-version" });
  });

  it("rejects non-integer chips", () => {
    const text = edit((backup) => {
      (backup.games as [{ smallBlindChips: number }])[0].smallBlindChips = 1.5;
    });
    expect(parseBackup(text)).toEqual({ ok: false, issue: "invalid" });
  });

  it("rejects references to missing players or events", () => {
    const missingPlayer = edit((backup) => {
      backup.players = [];
    });
    expect(parseBackup(missingPlayer)).toEqual({ ok: false, issue: "invalid" });
    const missingEvent = edit((backup) => {
      (backup.ledgerEvents as [unknown, { reversedEventId: string }])[1].reversedEventId = "nope";
    });
    expect(parseBackup(missingEvent)).toEqual({ ok: false, issue: "invalid" });
  });
});
