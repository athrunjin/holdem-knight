/**
 * Game settings: defaults, form parsing and validation, creating and updating.
 *
 * Form values are strings typed by the user, converted here to integers (cents, chips).
 */
import {
  type Currency,
  type Game,
  type GameSettings,
  type GameStage,
  type ImbalanceHandling,
  OPTIMAL_PLAN,
  type OrganizerId,
  type SettingsSources,
  type Timestamp,
} from "../domain";
import { type Cents, cents, toDecimalString, tryParseMoney } from "../money";
import { pauseTimer } from "./timer";

export const CURRENCIES: readonly Currency[] = ["AUD", "CNY"];

type BaseSettings = Pick<Game, "currency" | "smallBlindChips" | "bigBlindChips" | "chipRatio">;

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  currency: "CNY",
  smallBlindChips: 1,
  bigBlindChips: 2,
  chipRatio: { chips: 1, amount: cents(100) },
  buyInBigBlinds: 100,
};

export interface GameSettingsForm {
  readonly currency: Currency;
  readonly smallBlindChips: string;
  readonly bigBlindChips: string;
  readonly ratioChips: string;
  readonly ratioAmount: string;
  readonly buyInBigBlinds: string;
}

export type GameSettingsField = Exclude<keyof GameSettingsForm, "currency">;

/** Issue codes. The UI decides the wording. */
export type GameSettingsIssue = "invalid" | "not-positive" | "below-small-blind";

export type GameSettingsIssues = Partial<Record<GameSettingsField, GameSettingsIssue>>;

export type ParsedGameSettings =
  | { readonly ok: true; readonly settings: GameSettings }
  | { readonly ok: false; readonly issues: GameSettingsIssues };

/** Games from before this feature have no buy-in setting, so the form uses the default. */
export function toGameSettingsForm(
  settings: BaseSettings & Pick<Game, "buyInBigBlinds">,
): GameSettingsForm {
  return {
    currency: settings.currency,
    smallBlindChips: String(settings.smallBlindChips),
    bigBlindChips: String(settings.bigBlindChips),
    ratioChips: String(settings.chipRatio.chips),
    ratioAmount: toDecimalString(settings.chipRatio.amount),
    buyInBigBlinds: String(settings.buyInBigBlinds ?? DEFAULT_GAME_SETTINGS.buyInBigBlinds),
  };
}

/** Parses a chip count: a non-negative integer, thousands separators allowed. Returns null if it cannot be parsed. */
export function parseChips(input: string): number | null {
  const normalized = input.trim().replace(/[,\s]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isSafeInteger(value) ? value : null;
}

function positiveIssue(value: number | null): GameSettingsIssue | undefined {
  if (value === null) return "invalid";
  return value > 0 ? undefined : "not-positive";
}

/** Chips per hand. */
export function handChipsFor({
  bigBlindChips,
  buyInBigBlinds,
}: Pick<GameSettings, "bigBlindChips" | "buyInBigBlinds">): number {
  return bigBlindChips * buyInBigBlinds;
}

export function parseGameSettings(form: GameSettingsForm): ParsedGameSettings {
  const smallBlindChips = parseChips(form.smallBlindChips);
  const bigBlindChips = parseChips(form.bigBlindChips);
  const ratioChips = parseChips(form.ratioChips);
  const ratioAmount = tryParseMoney(form.ratioAmount);
  const buyInBigBlinds = parseChips(form.buyInBigBlinds);

  const issues: GameSettingsIssues = {};
  const smallBlindIssue = positiveIssue(smallBlindChips);
  const bigBlindIssue = positiveIssue(bigBlindChips);
  const ratioChipsIssue = positiveIssue(ratioChips);
  const ratioAmountIssue = positiveIssue(ratioAmount);
  const buyInIssue = positiveIssue(buyInBigBlinds);
  if (smallBlindIssue) issues.smallBlindChips = smallBlindIssue;
  if (bigBlindIssue) issues.bigBlindChips = bigBlindIssue;
  if (ratioChipsIssue) issues.ratioChips = ratioChipsIssue;
  if (ratioAmountIssue) issues.ratioAmount = ratioAmountIssue;
  if (buyInIssue) issues.buyInBigBlinds = buyInIssue;

  if (
    smallBlindChips === null ||
    bigBlindChips === null ||
    ratioChips === null ||
    ratioAmount === null ||
    buyInBigBlinds === null ||
    Object.keys(issues).length > 0
  ) {
    return { ok: false, issues };
  }
  if (bigBlindChips < smallBlindChips) {
    return { ok: false, issues: { bigBlindChips: "below-small-blind" } };
  }
  const settings: GameSettings = {
    currency: form.currency,
    smallBlindChips,
    bigBlindChips,
    chipRatio: { chips: ratioChips, amount: ratioAmount },
    buyInBigBlinds,
  };
  if (!Number.isSafeInteger(handChipsFor(settings))) {
    return { ok: false, issues: { buyInBigBlinds: "invalid" } };
  }
  return { ok: true, settings };
}

export interface NewGameMeta {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly createdAt: Timestamp;
  /** The device's IANA time zone, kept on the game (ADR 0027). */
  readonly timeZone?: string;
}

type GameOptions = {
  readonly [K in "insurance" | "tableFee" | "wage" | "rake"]?: GameSettings[K] | undefined;
};

/** Only the options that are on, so a game never stores a key set to undefined. */
function optionsOf({ insurance, tableFee, wage, rake }: GameOptions) {
  return {
    ...(insurance && { insurance }),
    ...(tableFee && { tableFee }),
    ...(wage && { wage }),
    ...(rake && { rake }),
  };
}

/** Only the sources that are set, or nothing, so a game never stores an empty record of them. */
function sourcesOf({
  sources,
}: {
  readonly sources?: { readonly [K in keyof SettingsSources]?: string | undefined } | undefined;
}) {
  const set = Object.fromEntries(
    Object.entries(sources ?? {}).filter(([, id]) => id !== undefined),
  );
  return Object.keys(set).length > 0 ? { sources: set as SettingsSources } : {};
}

function withHandChips(settings: GameSettings) {
  const {
    insurance: _,
    tableFee: _fee,
    wage: _wage,
    rake: _rake,
    sources: _sources,
    ...basics
  } = settings;
  return {
    ...basics,
    handChips: handChipsFor(settings),
    ...optionsOf(settings),
    ...sourcesOf(settings),
  };
}

export function createGame(meta: NewGameMeta, settings: GameSettings): Game {
  return { ...meta, ...withHandChips(settings), status: "open" };
}

/**
 * Starts settling, from the settle step on the game page: the table is done and the results are
 * being checked. Nothing can be marked as received yet, so marks from an earlier settlement go.
 */
export function startSettling(game: Game): Game {
  const { doneTransfers: _, ...rest } = game;
  return { ...rest, status: "settling" };
}

/** Back to the table from settling, so recording can continue. Any other game is left alone. */
export function resumeGame(game: Game): Game {
  return game.status === "settling" ? { ...game, status: "open" } : game;
}

/**
 * Confirms settlement and stops the clock at the final time.
 * Transfers are not saved because the ledger can always reproduce them.
 */
export function settleGame(game: Game, settledAt: Timestamp): Game {
  const settled: Game = { ...game, status: "settled", settledAt };
  return game.timer ? { ...settled, timer: pauseTimer(game.timer, settledAt) } : settled;
}

/**
 * Takes a settled game back to settling so its results can be changed. The marks on its transfers
 * go, since the transfers follow the results, and with them the game being complete.
 */
export function reviseGame(game: Game): Game {
  const { settledAt: _, allReceived: __, doneTransfers: ___, ...rest } = game;
  return { ...rest, status: "settling" };
}

/**
 * Saves whether every transfer of a settled game has been made. Whoever knows the plan's transfers
 * calls this when the game is settled, when a transfer is ticked and when the plan changes. A game
 * with nothing to transfer has everything in. A game not settled never has.
 */
export function markReceived(game: Game, allReceived: boolean): Game {
  const { allReceived: _, ...rest } = game;
  return game.status === "settled" && allReceived ? { ...rest, allReceived: true } : rest;
}

/** Where a game stands: a settled game is pending until every transfer is in. */
export function gameStage({
  status,
  allReceived,
}: Pick<Game, "status" | "allReceived">): GameStage {
  if (status !== "settled") return status;
  return allReceived ? "complete" : "pending";
}

/**
 * Saves who collects at settlement. `undefined` is the optimal plan, saved as a choice of its own
 * so it holds in a game that would otherwise go through the organizer.
 */
export function chooseCollector(game: Game, collectorId: string | undefined): Game {
  return { ...game, collectorId: collectorId ?? OPTIMAL_PLAN };
}

/** Saves whether the rake takes its share of a difference split by win or loss. */
export function chooseRakeInSplit(game: Game, rakeInSplit: boolean): Game {
  const { rakeInSplit: _, ...rest } = game;
  return rakeInSplit ? { ...rest, rakeInSplit: true } : rest;
}

/** Saves whether the insurance seat takes its share of a difference split by win or loss. */
export function chooseInsuranceInSplit(game: Game, insuranceInSplit: boolean): Game {
  const { insuranceInSplit: _, ...rest } = game;
  return insuranceInSplit ? { ...rest, insuranceInSplit: true } : rest;
}

export function chooseImbalanceHandling(game: Game, imbalanceHandling: ImbalanceHandling): Game {
  return { ...game, imbalanceHandling };
}

/** What a game's ledger already holds, which decides the settings that can still change. */
export interface SettingsLocks {
  readonly hasLedgerEvents: boolean;
  /** Insurance has been bought in this game and not all taken back. */
  readonly insuranceUsed?: boolean;
  /** Rake has been taken in this game. */
  readonly rakeUsed?: boolean;
}

/**
 * Updates game settings. Ledger events record chips and amounts come from the ratio,
 * so the currency and chip ratio cannot change once events exist, or existing amounts would change too.
 * Chips per hand are fixed too, or "3 hands" would mean different things within a game, and so
 * are the blinds: a game is played at one level.
 * Table fees and wages can always change, as they are only worked out at settlement. Insurance and
 * rake that have taken anything in stay on, with whatever rule the settings give them.
 * The saved configs the settings were taken from are replaced with the new settings' own.
 */
export function updateGameSettings(
  game: Game,
  settings: GameSettings,
  { hasLedgerEvents, insuranceUsed = false, rakeUsed = false }: SettingsLocks,
): Game {
  const {
    insurance: _,
    tableFee: _fee,
    wage: _wage,
    rake: _rake,
    sources: _sources,
    ...rest
  } = game;
  if (!hasLedgerEvents) return { ...rest, ...withHandChips(settings) };
  // An option that cannot be turned off keeps the game's own rule, and the config it came from
  const keepInsurance = insuranceUsed && !settings.insurance;
  const keepRake = rakeUsed && !settings.rake;
  // The locked settings stay the game's own, so a basic settings config holds only where they agree
  const basicsHold =
    game.currency === settings.currency &&
    game.smallBlindChips === settings.smallBlindChips &&
    game.bigBlindChips === settings.bigBlindChips &&
    game.chipRatio.chips === settings.chipRatio.chips &&
    game.chipRatio.amount === settings.chipRatio.amount &&
    game.buyInBigBlinds === settings.buyInBigBlinds;
  const { basics, ...otherSources } = settings.sources ?? {};
  const insurance = keepInsurance ? game.insurance : settings.insurance;
  const rake = keepRake ? game.rake : settings.rake;
  return {
    ...rest,
    ...optionsOf({ tableFee: settings.tableFee, wage: settings.wage, insurance, rake }),
    ...sourcesOf({
      sources: {
        ...otherSources,
        ...(basicsHold && basics !== undefined && { basics }),
        ...(keepInsurance && { insurance: game.sources?.insurance }),
        ...(keepRake && { rake: game.sources?.rake }),
      },
    }),
  };
}

/** A game saved before blinds moved to chips (ADR 0011). */
export type LegacyGame = Omit<Game, "smallBlindChips" | "bigBlindChips"> & {
  readonly smallBlind: Cents;
  readonly bigBlind: Cents;
};

/** Converts blinds to chips at the game's ratio. Blinds are display only, so rounding is safe. */
export function upgradeLegacyGame({ smallBlind, bigBlind, ...game }: LegacyGame): Game {
  const toChips = (blind: Cents) =>
    Math.max(1, Math.round((blind * game.chipRatio.chips) / game.chipRatio.amount));
  return { ...game, smallBlindChips: toChips(smallBlind), bigBlindChips: toChips(bigBlind) };
}
