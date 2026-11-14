import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { type GameSettings, OPTIMAL_PLAN } from "../domain";
import { cents } from "../money";
import {
  archiveGame,
  chooseCollector,
  chooseImbalanceHandling,
  createGame,
  DEFAULT_GAME_SETTINGS,
  type GameSettingsForm,
  gameStage,
  handChipsFor,
  parseGameSettings,
  refileGame,
  resumeGame,
  reviseGame,
  settleGame,
  startSettling,
  toGameSettingsForm,
  unarchiveGame,
  updateGameSettings,
  upgradeLegacyGame,
} from "./game";

const form: GameSettingsForm = {
  currency: "CNY",
  smallBlindChips: "5",
  bigBlindChips: "10",
  ratioChips: "1,000",
  ratioAmount: "10",
  buyInBigBlinds: "100",
};

const meta = { id: "g1", organizerId: "me", createdAt: 1 };

describe("parseGameSettings", () => {
  it("converts form strings to integers", () => {
    expect(parseGameSettings(form)).toEqual({
      ok: true,
      settings: {
        currency: "CNY",
        smallBlindChips: 5,
        bigBlindChips: 10,
        chipRatio: { chips: 1000, amount: cents(1000) },
        buyInBigBlinds: 100,
      },
    });
  });

  it("reports every field that is unparseable or not positive", () => {
    const result = parseGameSettings({
      ...form,
      smallBlindChips: "abc",
      bigBlindChips: "0",
      ratioChips: "1.5",
      ratioAmount: "-1",
      buyInBigBlinds: "0",
    });
    expect(result).toEqual({
      ok: false,
      issues: {
        smallBlindChips: "invalid",
        bigBlindChips: "not-positive",
        ratioChips: "invalid",
        ratioAmount: "not-positive",
        buyInBigBlinds: "not-positive",
      },
    });
  });

  it("requires the big blind to be at least the small blind", () => {
    expect(parseGameSettings({ ...form, smallBlindChips: "11", bigBlindChips: "10" })).toEqual({
      ok: false,
      issues: { bigBlindChips: "below-small-blind" },
    });
    expect(parseGameSettings({ ...form, smallBlindChips: "10", bigBlindChips: "10" }).ok).toBe(
      true,
    );
  });

  it("treats chip counts beyond the safe integer range as invalid", () => {
    expect(parseGameSettings({ ...form, ratioChips: "99999999999999999" })).toEqual({
      ok: false,
      issues: { ratioChips: "invalid" },
    });
  });

  it("requires whole chip blinds", () => {
    expect(parseGameSettings({ ...form, smallBlindChips: "0.5" })).toEqual({
      ok: false,
      issues: { smallBlindChips: "invalid" },
    });
  });

  it("rejects a hand too large to count exactly", () => {
    const huge = { ...form, bigBlindChips: "9007199254740991", buyInBigBlinds: "2" };
    expect(parseGameSettings(huge)).toEqual({ ok: false, issues: { buyInBigBlinds: "invalid" } });
  });

  it("keeps any valid settings unchanged through a form round trip", () => {
    const settings = fc
      .record({
        currency: fc.constantFrom("AUD" as const, "CNY" as const),
        smallBlindChips: fc.integer({ min: 1, max: 100_000 }),
        extra: fc.integer({ min: 0, max: 100_000 }),
        chips: fc.integer({ min: 1, max: 1_000_000 }),
        amount: fc.integer({ min: 1, max: 100_000 }).map(cents),
        buyInBigBlinds: fc.integer({ min: 1, max: 1_000 }),
      })
      .map(
        ({ currency, smallBlindChips, extra, chips, amount, buyInBigBlinds }): GameSettings => ({
          currency,
          smallBlindChips,
          bigBlindChips: smallBlindChips + extra,
          chipRatio: { chips, amount },
          buyInBigBlinds,
        }),
      );
    fc.assert(
      fc.property(settings, (value) => {
        expect(parseGameSettings(toGameSettingsForm(value))).toEqual({ ok: true, settings: value });
      }),
    );
  });
});

describe("DEFAULT_GAME_SETTINGS", () => {
  it("defaults to CNY, 1 chip = 1 yuan and 100 big blinds per buy-in", () => {
    expect(DEFAULT_GAME_SETTINGS).toMatchObject({
      currency: "CNY",
      chipRatio: { chips: 1, amount: cents(100) },
      buyInBigBlinds: 100,
    });
  });
});

describe("toGameSettingsForm", () => {
  it("uses the default for older games with no buy-in setting", () => {
    const { buyInBigBlinds: _, ...old } = DEFAULT_GAME_SETTINGS;
    expect(toGameSettingsForm(old).buyInBigBlinds).toBe("100");
  });
});

describe("handChipsFor", () => {
  it("multiplies the big blind", () => {
    expect(handChipsFor({ bigBlindChips: 200, buyInBigBlinds: 100 })).toBe(20_000);
  });
});

describe("createGame", () => {
  it("starts open with chips per hand fixed", () => {
    expect(createGame(meta, DEFAULT_GAME_SETTINGS)).toEqual({
      ...meta,
      ...DEFAULT_GAME_SETTINGS,
      handChips: 200,
      status: "open",
    });
  });
});

describe("upgradeLegacyGame", () => {
  const legacy = {
    ...meta,
    currency: "AUD" as const,
    smallBlind: cents(150),
    bigBlind: cents(300),
    chipRatio: { chips: 100, amount: cents(100) },
    status: "open" as const,
  };

  it("converts money blinds to chips at the game's ratio", () => {
    expect(upgradeLegacyGame(legacy)).toEqual({
      ...meta,
      currency: "AUD",
      smallBlindChips: 150,
      bigBlindChips: 300,
      chipRatio: legacy.chipRatio,
      status: "open",
    });
  });

  it("rounds to whole chips and keeps blinds at 1 or more", () => {
    const coarse = { ...legacy, chipRatio: { chips: 1, amount: cents(1000) } };
    expect(upgradeLegacyGame(coarse)).toMatchObject({ smallBlindChips: 1, bigBlindChips: 1 });
  });
});

describe("chooseCollector", () => {
  const game = createGame(meta, DEFAULT_GAME_SETTINGS);

  it("saves a collector, and the optimal plan as a choice of its own", () => {
    const chosen = chooseCollector(game, "p1");
    expect(chosen.collectorId).toBe("p1");
    expect(chooseCollector(chosen, undefined)).toEqual({ ...game, collectorId: OPTIMAL_PLAN });
  });
});

describe("chooseImbalanceHandling", () => {
  it("saves the choice on the game", () => {
    const game = createGame(meta, DEFAULT_GAME_SETTINGS);
    expect(chooseImbalanceHandling(game, "split").imbalanceHandling).toBe("split");
  });
});

describe("archiveGame", () => {
  const game = createGame(meta, DEFAULT_GAME_SETTINGS);
  const settled = settleGame(game, 2);

  it("files a settled game as complete or pending and takes it back out", () => {
    expect(archiveGame(settled, true)).toEqual({ ...settled, archive: "complete" });
    const pending = archiveGame(settled, false);
    expect(pending).toEqual({ ...settled, archive: "pending" });
    expect(unarchiveGame(pending)).toEqual(settled);
  });

  it("moves an archived game with its transfers and leaves others alone", () => {
    const pending = archiveGame(settled, false);
    expect(refileGame(pending, true).archive).toBe("complete");
    expect(refileGame(refileGame(pending, true), false).archive).toBe("pending");
    expect(refileGame(settled, true)).toEqual(settled);
  });
});

describe("the stages of a game", () => {
  const game = createGame(meta, DEFAULT_GAME_SETTINGS);
  const settling = startSettling(game);
  const transfer = { from: "a", to: "b", amount: cents(100) };

  it("goes from the table to settling, and back to the table", () => {
    expect(settling).toEqual({ ...game, status: "settling" });
    expect(resumeGame(settling)).toEqual(game);
  });

  it("leaves a game alone that is not settling when the table resumes", () => {
    const settled = settleGame(settling, 2);
    expect(resumeGame(game)).toBe(game);
    expect(resumeGame(settled)).toBe(settled);
  });

  it("records the time on confirming and takes it away on revising", () => {
    const settled = settleGame(settling, 2);
    expect(settled).toEqual({ ...game, status: "settled", settledAt: 2 });
    expect(reviseGame(settled)).toEqual(settling);
  });

  it("stops a running clock at settlement and leaves it paused on revising", () => {
    const settled = settleGame({ ...settling, timer: { elapsedMs: 10, runningSince: 2 } }, 7);
    expect(settled.timer).toEqual({ elapsedMs: 15 });
    expect(reviseGame(settled).timer).toEqual({ elapsedMs: 15 });
  });

  it("drops the marks on transfers and the archive when the results are revised", () => {
    const marked = { ...settleGame(settling, 2), doneTransfers: [transfer] };
    expect(reviseGame(archiveGame(marked, true))).toEqual(settling);
  });

  it("starts settling without marks left from before", () => {
    expect(startSettling({ ...game, doneTransfers: [transfer] })).toEqual(settling);
  });

  it("names the stage: pending once settled, complete once archived with everything in", () => {
    const settled = settleGame(settling, 2);
    expect(gameStage(game)).toBe("open");
    expect(gameStage(settling)).toBe("settling");
    expect(gameStage(settled)).toBe("pending");
    expect(gameStage(archiveGame(settled, false))).toBe("pending");
    expect(gameStage(archiveGame(settled, true))).toBe("complete");
  });
});

describe("updateGameSettings", () => {
  const game = createGame(meta, DEFAULT_GAME_SETTINGS);
  const next: GameSettings = {
    currency: "CNY",
    smallBlindChips: 500,
    bigBlindChips: 1000,
    chipRatio: { chips: 10, amount: cents(100) },
    buyInBigBlinds: 50,
  };

  it("can change every setting when the ledger has no events", () => {
    expect(updateGameSettings(game, next, { hasLedgerEvents: false })).toEqual({
      ...game,
      ...next,
      handChips: 50_000,
    });
  });

  it("changes only blinds once the ledger has events", () => {
    expect(updateGameSettings(game, next, { hasLedgerEvents: true })).toEqual({
      ...game,
      smallBlindChips: next.smallBlindChips,
      bigBlindChips: next.bigBlindChips,
    });
  });

  it("turns the table fee and wages on and off at any time", () => {
    const tableFee = { amount: cents(10_000), minMinutes: 30 };
    const wage = { hourly: cents(2500) };
    const charged = updateGameSettings(
      game,
      { ...next, tableFee, wage },
      { hasLedgerEvents: true },
    );
    expect(charged).toMatchObject({ tableFee, wage });
    const cleared = updateGameSettings(charged, next, { hasLedgerEvents: true });
    expect(cleared).not.toHaveProperty("tableFee");
    expect(cleared).not.toHaveProperty("wage");
  });
});
