/**
 * Game settings: defaults, form parsing and validation, creating and updating.
 *
 * Form values are strings typed by the user, converted here to integers (cents, chips).
 */
import {
  type Currency,
  type Game,
  type GameSettings,
  type ImbalanceHandling,
  OPTIMAL_PLAN,
  type OrganizerId,
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

type GameOptions = Pick<GameSettings, "insurance" | "tableFee" | "wage">;

/** Only the options that are on, so a game never stores a key set to undefined. */
function optionsOf({ insurance, tableFee, wage }: GameOptions) {
  return {
    ...(insurance && { insurance }),
    ...(tableFee && { tableFee }),
    ...(wage && { wage }),
  };
}

function withHandChips(settings: GameSettings) {
  const { insurance: _, tableFee: _fee, wage: _wage, ...basics } = settings;
  return { ...basics, handChips: handChipsFor(settings), ...optionsOf(settings) };
}

export function createGame(meta: NewGameMeta, settings: GameSettings): Game {
  return { ...meta, ...withHandChips(settings), status: "open" };
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
 * Saves who collects at settlement. `undefined` is the optimal plan, saved as a choice of its own
 * so it holds in a game that would otherwise go through the organizer.
 */
export function chooseCollector(game: Game, collectorId: string | undefined): Game {
  return { ...game, collectorId: collectorId ?? OPTIMAL_PLAN };
}

/** Saves who takes the insurance result. `undefined` goes back to the organizer. */
export function chooseInsuranceOwner(game: Game, insuranceOwner: string | undefined): Game {
  const { insuranceOwner: _, ...rest } = game;
  return insuranceOwner === undefined ? rest : { ...rest, insuranceOwner };
}

export function chooseImbalanceHandling(game: Game, imbalanceHandling: ImbalanceHandling): Game {
  return { ...game, imbalanceHandling };
}

/** Reopens a settled game when a mistake turns up, so recording can continue. */
export function reopenGame(game: Game): Game {
  const { settledAt: _, archive: __, ...rest } = game;
  return { ...rest, status: "open" };
}

/**
 * Files a game away in history, as complete when every transfer has been made and as pending
 * otherwise. A game still open is settled first: only a settled game is history.
 */
export function archiveGame(game: Game, complete: boolean, at: Timestamp): Game {
  const settled = game.status === "settled" ? game : settleGame(game, at);
  return { ...settled, archive: complete ? "complete" : "pending" };
}

/** Takes a game back out of the archive. It stays settled. */
export function unarchiveGame(game: Game): Game {
  const { archive: _, ...rest } = game;
  return rest;
}

/** Moves an archived game to where its transfers now put it. A game not archived is left alone. */
export function refileGame(game: Game, complete: boolean): Game {
  return game.archive ? { ...game, archive: complete ? "complete" : "pending" } : game;
}

/**
 * Updates game settings. Ledger events record chips and amounts come from the ratio,
 * so the currency and chip ratio cannot change once events exist, or existing amounts would change too.
 * Chips per hand are fixed too, or "3 hands" would mean different things within a game.
 * Options can always change: table fees and wages are only worked out at settlement.
 */
export function updateGameSettings(
  game: Game,
  settings: GameSettings,
  { hasLedgerEvents }: { readonly hasLedgerEvents: boolean },
): Game {
  const { insurance: _, tableFee: _fee, wage: _wage, ...rest } = game;
  const { smallBlindChips, bigBlindChips } = settings;
  const updated = hasLedgerEvents
    ? { ...rest, smallBlindChips, bigBlindChips }
    : { ...rest, ...withHandChips(settings) };
  return { ...updated, ...optionsOf(settings) };
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
