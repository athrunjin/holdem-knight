import { describe, expect, it } from "vitest";

import type {
  GameSettings,
  InsuranceRule,
  SavedChargeRule,
  SavedGameConfig,
  SavedInsuranceRule,
} from "../domain";
import { DEFAULT_GAME_SETTINGS } from "../game";
import { RULE_30, RULE_32 } from "../insurance";
import { cents } from "../money";
import {
  type ConfigLibrary,
  configInUse,
  gameConfigsUsing,
  gameConfigWithout,
  resolveSettings,
  sameGameSettings,
  withSettingsSources,
} from "./presets";

const saved = { organizerId: "me", createdAt: 1 };

const wage25: SavedChargeRule = {
  ...saved,
  id: "w1",
  name: "标准工资",
  kind: "wage",
  rule: { hourly: cents(2500), unitMinutes: 1, rounding: "nearest" },
};
/** The same values under another name */
const wage25Again: SavedChargeRule = { ...wage25, id: "w2", name: "周五工资" };
const fee: SavedChargeRule = {
  ...saved,
  id: "f1",
  name: "袋鼠台费",
  kind: "table_fee",
  rule: { amount: cents(1000), minMinutes: 5 },
};
const rake: SavedChargeRule = {
  ...saved,
  id: "r1",
  name: "标准抽水",
  kind: "rake",
  rule: { percent: 5, rounding: "nearest", roundTo: { unit: "smallBlinds", amount: 1 } },
};
const basics: SavedChargeRule = {
  ...saved,
  id: "b1",
  name: "熊猫 5/10",
  kind: "basics",
  rule: { ...DEFAULT_GAME_SETTINGS, smallBlindChips: 5, bigBlindChips: 10 },
};
const refunding: InsuranceRule = { ...RULE_30, refundPremium: !RULE_30.refundPremium };
const insurance: SavedInsuranceRule = { ...saved, id: "i1", name: "退保费", rule: refunding };
const ownOdds = [3100, 1500, 1000];

const library: ConfigLibrary = {
  chargeRules: [wage25, wage25Again, fee, rake, basics],
  insuranceRules: [insurance],
  oddsTables: [{ id: "t1", oddsHundredths: ownOdds }],
};

const settings: GameSettings = {
  ...DEFAULT_GAME_SETTINGS,
  smallBlindChips: 5,
  bigBlindChips: 10,
  wage: wage25.rule,
  rake: rake.rule,
};

const config = (of: GameSettings): SavedGameConfig => ({
  ...saved,
  id: "g1",
  name: "周五熊猫局",
  settings: of,
});

describe("configInUse", () => {
  const holds = (c: SavedChargeRule) => c.kind === "wage";

  it("names the config the values were taken from among those that hold them", () => {
    expect(configInUse(library.chargeRules, holds, "w2")).toBe(wage25Again);
  });

  it("names the first that holds them when they were taken from none of those", () => {
    expect(configInUse(library.chargeRules, holds, undefined)).toBe(wage25);
    expect(configInUse(library.chargeRules, holds, "r1")).toBe(wage25);
  });

  it("names none when none holds them", () => {
    expect(configInUse(library.chargeRules, () => false, "w1")).toBeUndefined();
  });
});

describe("withSettingsSources", () => {
  it("keeps the config each section was taken from while it holds the section's values", () => {
    expect(withSettingsSources(settings, { wage: "w2", rake: "r1" }, library).sources).toEqual({
      basics: "b1",
      wage: "w2",
      rake: "r1",
    });
  });

  it("drops a config whose values the section no longer has", () => {
    const raised = { ...settings, wage: { ...wage25.rule, hourly: cents(3000) } };
    expect(withSettingsSources(raised, { wage: "w1", rake: "r1" }, library).sources).toEqual({
      basics: "b1",
      rake: "r1",
    });
  });

  it("names no config for a section that is switched off", () => {
    const { wage: _, ...noWage } = settings;
    expect(withSettingsSources(noWage, { wage: "w1" }, library).sources).toEqual({
      basics: "b1",
      rake: "r1",
    });
  });

  it("stores no sources when no section belongs to a config", () => {
    const result = withSettingsSources(DEFAULT_GAME_SETTINGS, { basics: "b1" }, library);
    expect(result).toEqual(DEFAULT_GAME_SETTINGS);
    expect("sources" in result).toBe(false);
  });

  it("replaces sources the settings came with", () => {
    const stale = { ...DEFAULT_GAME_SETTINGS, sources: { wage: "w1" } };
    expect("sources" in withSettingsSources(stale, {}, library)).toBe(false);
  });

  it("matches insurance by its settings, whatever its odds", () => {
    const rule = { ...refunding, oddsHundredths: RULE_32.oddsHundredths };
    const result = withSettingsSources({ ...settings, insurance: rule }, {}, library);
    expect(result.sources?.insurance).toBe("i1");
  });

  it("sets the odds table the odds belong to, and drops one that no longer holds them", () => {
    const typed = { ...RULE_30, oddsHundredths: [2900, 1400], oddsTableId: "t1" };
    const from = (rule: InsuranceRule) =>
      withSettingsSources({ ...settings, insurance: rule }, {}, library).insurance;
    expect(from({ ...RULE_30, oddsHundredths: ownOdds })?.oddsTableId).toBe("t1");
    expect(from(RULE_32)?.oddsTableId).toBe("builtin-32");
    expect(from(typed)).toEqual({ ...RULE_30, oddsHundredths: [2900, 1400] });
  });
});

describe("resolveSettings", () => {
  const raisedWage: SavedChargeRule = {
    ...wage25,
    rule: { hourly: cents(3000), unitMinutes: 15, rounding: "up" },
  };
  const raised: ConfigLibrary = { ...library, chargeRules: [raisedWage, fee, rake, basics] };
  const kept = withSettingsSources(settings, { wage: "w1", rake: "r1" }, library);

  it("takes a section's values from the saved config it names", () => {
    expect(resolveSettings(kept, raised)).toEqual({ ...kept, wage: raisedWage.rule });
  });

  it("keeps the section's own values once that config is gone, and names it no more", () => {
    const gone: ConfigLibrary = { ...library, chargeRules: [fee, rake, basics] };
    expect(resolveSettings(kept, gone)).toEqual({
      ...kept,
      sources: { basics: "b1", rake: "r1" },
    });
  });

  it("leaves a section with no config as it is", () => {
    const { sources: _, ...own } = kept;
    expect(resolveSettings(own, raised)).toEqual(own);
  });

  it("keeps a section switched off, whatever config it names", () => {
    const { wage: _, ...noWage } = kept;
    const resolved = resolveSettings({ ...noWage, sources: { wage: "w1" } }, raised);
    expect(resolved.wage).toBeUndefined();
    expect(resolved.sources).toBeUndefined();
  });

  it("takes the basic settings from their config", () => {
    const bigger: SavedChargeRule = {
      ...basics,
      rule: { ...DEFAULT_GAME_SETTINGS, currency: "AUD", smallBlindChips: 10, bigBlindChips: 20 },
    } as SavedChargeRule;
    const resolved = resolveSettings(kept, { ...library, chargeRules: [bigger, wage25, rake] });
    expect(resolved).toMatchObject({ currency: "AUD", smallBlindChips: 10, bigBlindChips: 20 });
    expect(resolved.wage).toEqual(wage25.rule);
  });

  it("takes insurance settings from their config and keeps the odds kept here", () => {
    const rule: InsuranceRule = { ...refunding, oddsHundredths: [2900, 1400] };
    const withRule = withSettingsSources({ ...settings, insurance: rule }, {}, library);
    const changed: SavedInsuranceRule = {
      ...insurance,
      rule: { ...refunding, tieOuts: "include", turnCoverLimit: "stake", oddsTableId: "t1" },
    };
    const resolved = resolveSettings(withRule, { ...library, insuranceRules: [changed] });
    expect(resolved.insurance).toEqual({
      ...refunding,
      tieOuts: "include",
      turnCoverLimit: "stake",
      oddsHundredths: [2900, 1400],
    });
  });

  it("never brings a smallest chip in chips from an insurance config", () => {
    const withChips: SavedInsuranceRule = {
      ...insurance,
      rule: { ...refunding, rounding: { mode: "up", smallBlinds: 2, chips: 10 } },
    };
    const withRule = { ...settings, insurance: refunding, sources: { insurance: "i1" } };
    const resolved = resolveSettings(withRule, { ...library, insuranceRules: [withChips] });
    expect(resolved.insurance?.rounding).toEqual({ mode: "up", smallBlinds: 2 });
  });

  it("takes the odds from their saved table as it is now", () => {
    const rule: InsuranceRule = { ...RULE_30, oddsHundredths: ownOdds, oddsTableId: "t1" };
    const newOdds = [3300, 1600, 1100];
    const resolved = resolveSettings(
      { ...settings, insurance: rule },
      { ...library, oddsTables: [{ id: "t1", oddsHundredths: newOdds }] },
    );
    expect(resolved.insurance).toEqual({ ...rule, oddsHundredths: newOdds });
  });

  it("keeps the odds kept here once their table is gone", () => {
    const rule: InsuranceRule = { ...RULE_30, oddsHundredths: ownOdds, oddsTableId: "t1" };
    const resolved = resolveSettings(
      { ...settings, insurance: rule },
      { ...library, oddsTables: [] },
    );
    expect(resolved.insurance).toEqual(rule);
  });
});

describe("gameConfigsUsing", () => {
  const friday = config(withSettingsSources(settings, {}, library));
  const { wage: _, ...noWage } = settings;
  const off = { ...config({ ...noWage, sources: { wage: "w1" } }), id: "g2" };
  const insured = {
    ...config({
      ...settings,
      insurance: { ...RULE_30, oddsHundredths: ownOdds, oddsTableId: "t1" },
    }),
    id: "g3",
  };

  it("lists the game configs that follow a saved config", () => {
    expect(gameConfigsUsing([friday, off, insured], { section: "wage", id: "w1" })).toEqual([
      friday,
    ]);
    expect(gameConfigsUsing([friday, off], { section: "basics", id: "b1" })).toEqual([friday]);
    expect(gameConfigsUsing([friday, off], { section: "wage", id: "w2" })).toEqual([]);
  });

  it("lists the game configs whose odds follow a saved table", () => {
    expect(gameConfigsUsing([friday, off, insured], { oddsTableId: "t1" })).toEqual([insured]);
  });
});

describe("gameConfigWithout", () => {
  const friday = config(withSettingsSources(settings, {}, library));

  it("keeps the values a deleted config had last, and names it no more", () => {
    const raisedWage = { ...wage25, rule: { ...wage25.rule, hourly: cents(3000) } };
    const raised = { ...library, chargeRules: [raisedWage, rake, basics] } as ConfigLibrary;
    expect(gameConfigWithout(friday, { section: "wage", id: "w1" }, raised)).toEqual({
      ...friday,
      settings: { ...settings, wage: raisedWage.rule, sources: { basics: "b1", rake: "r1" } },
    });
  });

  it("stores no sources once the last one is gone", () => {
    const only = config({ ...DEFAULT_GAME_SETTINGS, wage: wage25.rule, sources: { wage: "w1" } });
    const result = gameConfigWithout(only, { section: "wage", id: "w1" }, library);
    expect("sources" in result.settings).toBe(false);
  });

  it("keeps the odds a deleted table had last", () => {
    const rule: InsuranceRule = { ...RULE_30, oddsHundredths: [1], oddsTableId: "t1" };
    const insured = config({ ...settings, insurance: rule });
    const result = gameConfigWithout(insured, { oddsTableId: "t1" }, library);
    expect(result.settings.insurance?.oddsHundredths).toEqual(ownOdds);
  });
});

describe("sameGameSettings", () => {
  const insured: GameSettings = { ...settings, insurance: RULE_30 };

  it("holds for the same basic settings and options, whatever configs they name", () => {
    const named: GameSettings = { ...settings, sources: { wage: "w1" } };
    const fromTable: GameSettings = { ...insured, insurance: { ...RULE_30, oddsTableId: "t1" } };
    expect(sameGameSettings(settings, named)).toBe(true);
    expect(sameGameSettings(insured, fromTable)).toBe(true);
  });

  it("fails when an option is on in one only, or has other values", () => {
    const { wage: _, ...noWage } = settings;
    expect(sameGameSettings(settings, noWage)).toBe(false);
    expect(sameGameSettings(settings, { ...settings, wage: { hourly: cents(3000) } })).toBe(false);
    expect(sameGameSettings(insured, { ...insured, insurance: RULE_32 })).toBe(false);
    expect(sameGameSettings(insured, { ...insured, insurance: refunding })).toBe(false);
  });

  it("fails when the basic settings differ", () => {
    expect(sameGameSettings(settings, { ...settings, bigBlindChips: 20 })).toBe(false);
    expect(sameGameSettings(settings, { ...settings, currency: "AUD" })).toBe(false);
  });

  it("takes a game with no Buy-in as having the default one", () => {
    const { buyInBigBlinds: _, ...older } = settings;
    expect(sameGameSettings(older, settings)).toBe(true);
    expect(sameGameSettings(older, { ...settings, buyInBigBlinds: 50 })).toBe(false);
  });
});
