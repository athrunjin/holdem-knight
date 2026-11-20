/**
 * Saved configs and the settings taken from them (ADR 0038).
 *
 * A game's settings come in sections: the basic settings, insurance, the table fee, wages and rake.
 * Each can be saved on its own as a config, and a game config is a whole setup. A section of a game
 * config that names a saved config follows it: using the game config takes that config's values as
 * they are then.
 */
import { toTableFeeForm, toWageForm } from "../charges";
import type {
  BasicSettings,
  Game,
  GameSettings,
  InsuranceRule,
  RakeRule,
  SavedChargeRule,
  SavedGameConfig,
  SavedInsuranceRule,
  SettingsSources,
  TableFeeRule,
  WageRule,
} from "../domain";
import { toGameSettingsForm } from "../game";
import {
  BUILT_IN_RULES,
  type OddsTableRef,
  oddsTableInUse,
  ruleToKeep,
  sameInsuranceSettings,
} from "../insurance";
import { toRakeForm } from "../rake";

/** A section of a game's settings that has saved configs of its own. */
export type SettingsSection = keyof SettingsSources;

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  "basics",
  "insurance",
  "tableFee",
  "wage",
  "rake",
];

/** Every saved config a game's settings can be taken from. */
export interface ConfigLibrary {
  readonly chargeRules: readonly SavedChargeRule[];
  readonly insuranceRules: readonly SavedInsuranceRule[];
  /** The saved odds tables. The built-in ones are always there. */
  readonly oddsTables: readonly OddsTableRef[];
}

type ChargeKind = SavedChargeRule["kind"];
type ChargeRuleOf<K extends ChargeKind> = Extract<SavedChargeRule, { kind: K }>;

/** The saved configs of one kind, oldest first as they are kept. */
export function chargeRulesOf<K extends ChargeKind>(
  rules: readonly SavedChargeRule[],
  kind: K,
): ChargeRuleOf<K>[] {
  return rules.filter((rule): rule is ChargeRuleOf<K> => rule.kind === kind);
}

/** Only the basic settings of a game's settings. */
export function basicSettingsOf(settings: BasicSettings): BasicSettings {
  const { currency, smallBlindChips, bigBlindChips, chipRatio, buyInBigBlinds } = settings;
  return { currency, smallBlindChips, bigBlindChips, chipRatio, buyInBigBlinds };
}

// Rules are compared as their forms read, so one kept in an older shape equals its newer self
const sameForm = <Rule>(toForm: (rule: Rule) => unknown) => {
  return (a: Rule, b: Rule) => JSON.stringify(toForm(a)) === JSON.stringify(toForm(b));
};

export const sameBasicSettings: (a: BasicSettings, b: BasicSettings) => boolean = sameForm(
  (basics: BasicSettings) => toGameSettingsForm(basicSettingsOf(basics)),
);
export const sameTableFee: (a: TableFeeRule, b: TableFeeRule) => boolean = sameForm(toTableFeeForm);
export const sameWage: (a: WageRule, b: WageRule) => boolean = sameForm(toWageForm);
export const sameRake: (a: RakeRule, b: RakeRule) => boolean = sameForm(toRakeForm);

/** What two setups are compared by: the basic settings, where older games have no Buy-in, and the options. */
type Setup = Pick<
  Game,
  | "currency"
  | "smallBlindChips"
  | "bigBlindChips"
  | "chipRatio"
  | "buyInBigBlinds"
  | "insurance"
  | "tableFee"
  | "wage"
  | "rake"
>;

/**
 * Whether two setups are the same game: the same basic settings, the same options on, and each
 * option with the same values. Insurance counts with its odds, but not with which of two tables
 * holding those odds is named. A setup with no Buy-in has the default one.
 */
export function sameGameSettings(a: Setup, b: Setup): boolean {
  const option = <Rule>(
    one: Rule | undefined,
    other: Rule | undefined,
    same: (x: Rule, y: Rule) => boolean,
  ) => (one === undefined || other === undefined ? one === other : same(one, other));
  const basics = (setup: Setup) => JSON.stringify(toGameSettingsForm(setup));
  return (
    basics(a) === basics(b) &&
    option(a.tableFee, b.tableFee, sameTableFee) &&
    option(a.wage, b.wage, sameWage) &&
    option(a.rake, b.rake, sameRake) &&
    option(
      a.insurance,
      b.insurance,
      (x, y) =>
        sameInsuranceSettings(x, y) &&
        JSON.stringify(x.oddsHundredths) === JSON.stringify(y.oddsHundredths),
    )
  );
}

/**
 * The saved config some values belong to. Two can hold the same values, so the one they were
 * taken from comes first, for as long as it is still there with these values. Values from none,
 * or from one since changed or deleted, go to the first that holds them. Undefined when none does.
 */
export function configInUse<T extends { readonly id: string }>(
  saved: readonly T[],
  holds: (config: T) => boolean,
  takenFromId: string | undefined,
): T | undefined {
  const holding = saved.filter(holds);
  return holding.find((config) => config.id === takenFromId) ?? holding[0];
}

/** Every odds table on offer: the built-in ones, then the saved. */
const allOddsTables = (saved: readonly OddsTableRef[]): OddsTableRef[] => [
  ...BUILT_IN_RULES.map(({ id, rule }) => ({ id, oddsHundredths: rule.oddsHundredths })),
  ...saved,
];

/** The rule with the odds table its odds belong to now, or with none. */
function withOddsTable(rule: InsuranceRule, tables: readonly OddsTableRef[]): InsuranceRule {
  const table = oddsTableInUse(allOddsTables(tables), rule.oddsHundredths, rule.oddsTableId);
  const { oddsTableId: _, ...rest } = rule;
  return table ? { ...rest, oddsTableId: table.id } : rest;
}

/**
 * The settings with the saved configs they belong to, for keeping on a game or in a game config.
 * `takenFrom` names the config each section was taken from, which counts only while that config
 * holds the section's values; a section equal to another saved config belongs to that one, and a
 * section switched off or equal to none belongs to none. The insurance rule's odds table is set
 * the same way.
 */
export function withSettingsSources(
  settings: GameSettings,
  takenFrom: SettingsSources,
  library: ConfigLibrary,
): GameSettings {
  const { sources: _, insurance, ...rest } = settings;
  const { tableFee, wage, rake } = settings;
  const charge = <K extends ChargeKind>(
    kind: K,
    holds: (config: ChargeRuleOf<K>) => boolean,
    takenFromId: string | undefined,
  ) => configInUse(chargeRulesOf(library.chargeRules, kind), holds, takenFromId)?.id;

  const found: { [Section in SettingsSection]: string | undefined } = {
    basics: charge("basics", (c) => sameBasicSettings(c.rule, settings), takenFrom.basics),
    insurance:
      insurance &&
      configInUse(
        library.insuranceRules,
        (c) => sameInsuranceSettings(c.rule, insurance),
        takenFrom.insurance,
      )?.id,
    tableFee:
      tableFee && charge("table_fee", (c) => sameTableFee(c.rule, tableFee), takenFrom.tableFee),
    wage: wage && charge("wage", (c) => sameWage(c.rule, wage), takenFrom.wage),
    rake: rake && charge("rake", (c) => sameRake(c.rule, rake), takenFrom.rake),
  };
  const sources = Object.fromEntries(
    SETTINGS_SECTIONS.flatMap((section) => {
      const id = found[section];
      return id === undefined ? [] : [[section, id]];
    }),
  ) as SettingsSources;

  return {
    ...rest,
    ...(insurance && { insurance: withOddsTable(insurance, library.oddsTables) }),
    ...(Object.keys(sources).length > 0 && { sources }),
  };
}

/**
 * A game config's settings as they are now. Each section takes the values of the saved config it
 * names, and keeps its own once that config is gone, when it names none any more. Insurance takes
 * its config's settings and keeps its own odds, which follow their saved odds table the same way.
 * A section switched off stays off.
 */
export function resolveSettings(settings: GameSettings, library: ConfigLibrary): GameSettings {
  const named = settings.sources ?? {};
  const charge = <K extends ChargeKind>(kind: K, id: string | undefined) =>
    id === undefined
      ? undefined
      : chargeRulesOf(library.chargeRules, kind).find((config) => config.id === id);

  const basics = charge("basics", named.basics);
  const tableFee = settings.tableFee && charge("table_fee", named.tableFee);
  const wage = settings.wage && charge("wage", named.wage);
  const rake = settings.rake && charge("rake", named.rake);
  const insurance =
    settings.insurance && library.insuranceRules.find((config) => config.id === named.insurance);

  let rule = settings.insurance;
  if (rule && insurance) {
    // Its config's settings, with the odds and their table as kept here
    const { oddsTableId: _, ...kept } = ruleToKeep(insurance.rule);
    rule = {
      ...kept,
      oddsHundredths: rule.oddsHundredths,
      ...(rule.oddsTableId !== undefined && { oddsTableId: rule.oddsTableId }),
    };
  }
  const table = rule && library.oddsTables.find((saved) => saved.id === rule?.oddsTableId);
  if (rule && table) rule = { ...rule, oddsHundredths: table.oddsHundredths };

  const sources: SettingsSources = {
    ...(basics && { basics: basics.id }),
    ...(insurance && { insurance: insurance.id }),
    ...(tableFee && { tableFee: tableFee.id }),
    ...(wage && { wage: wage.id }),
    ...(rake && { rake: rake.id }),
  };
  const { sources: _, ...rest } = settings;
  return {
    ...rest,
    ...(basics && basicSettingsOf(basics.rule)),
    ...(rule && { insurance: rule }),
    ...(tableFee && { tableFee: tableFee.rule }),
    ...(wage && { wage: wage.rule }),
    ...(rake && { rake: rake.rule }),
    ...(Object.keys(sources).length > 0 && { sources }),
  };
}

/** What a saved config is to the game configs that use it: a section's config, or an odds table. */
export type ConfigUse =
  | { readonly section: SettingsSection; readonly id: string }
  | { readonly oddsTableId: string };

/** The game configs that follow a saved config or an odds table, in a section that is on. */
export function gameConfigsUsing(
  configs: readonly SavedGameConfig[],
  use: ConfigUse,
): SavedGameConfig[] {
  return configs.filter(({ settings }) => {
    if ("oddsTableId" in use) return settings.insurance?.oddsTableId === use.oddsTableId;
    if (settings.sources?.[use.section] !== use.id) return false;
    return use.section === "basics" || settings[use.section] !== undefined;
  });
}

/**
 * A game config once a saved config or odds table it follows is to be deleted: it keeps the values
 * it would be used with now, and that section names no config any more. Call this while what is
 * being deleted is still in the library.
 */
export function gameConfigWithout(
  config: SavedGameConfig,
  use: ConfigUse,
  library: ConfigLibrary,
): SavedGameConfig {
  const settings = resolveSettings(config.settings, library);
  if ("oddsTableId" in use) return { ...config, settings };
  const { [use.section]: _, ...sources } = settings.sources ?? {};
  const { sources: __, ...rest } = settings;
  return {
    ...config,
    settings: { ...rest, ...(Object.keys(sources).length > 0 && { sources }) },
  };
}
