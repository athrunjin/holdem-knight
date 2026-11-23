/**
 * Domain model. Types only; repository implementations handle storage.
 *
 * Every record carries an organizer ID, leaving room for multiple organizers or clubs (ADR 0005).
 */
import type { Cents } from "../money";

/** Timestamp in milliseconds. Timing data stores timestamps and computes differences (ADR 0001). */
export type Timestamp = number;

export type OrganizerId = string;

/** ISO 4217 currency code. */
export type Currency = "AUD" | "CNY";

/** Chip-to-cash ratio: `chips` chips are worth `amount`. A pair of integers avoids decimals. */
export interface ChipRatio {
  readonly chips: number;
  readonly amount: Cents;
}

/** How to settle a chip difference: split it, have the organizer cover it, or leave it. */
export type ImbalanceHandling = "split" | "organizer" | "ignore";

/**
 * `open` while the table plays, `settling` from the settle step on the game page until the results
 * are confirmed, and `settled` after that (ADR 0031).
 */
export type GameStatus = "open" | "settling" | "settled";

/**
 * The four stages an organizer sees a game go through: at the table, results being checked,
 * settled with transfers still to come in, and done.
 */
export type GameStage = "open" | "settling" | "pending" | "complete";

/** Whether cards that split the pot count as outs. */
export type TieOuts = "exclude" | "include";

/**
 * The most a hit may leave the buyer on a street: what they put in, or a percentage (1–99) of their
 * pot share. The street's limit is missing for the whole share.
 */
export type CoverLimit = "stake" | number;

/** Insurance terms. Copied onto each game, so editing a saved rule never changes past games. */
export interface InsuranceRule {
  /** Payout multiples in hundredths, indexed by outs − 1: 350 means 3.5. More outs than entries cannot be insured. */
  readonly oddsHundredths: readonly number[];
  readonly tieOuts: TieOuts;
  /** Whether a hit also hands back the premium. */
  readonly refundPremium: boolean;
  /** Cover limit for the turn card, bought after a flop all-in. Missing means the full pot share. */
  readonly turnCoverLimit?: CoverLimit;
  /** Cover limit for the river card. Missing means the full pot share. */
  readonly riverCoverLimit?: CoverLimit;
  /**
   * The odds table the odds were taken from, built in or saved. It names the table where another
   * has the same odds, and counts only while that table still has these odds.
   */
  readonly oddsTableId?: string;
  /**
   * How premiums and payouts are rounded to the smallest chip in play (ADR 0037). Missing prices
   * in whole chips as ADR 0032 does: 保本 and 半池 pay at least their target, 满池 at most the pot.
   */
  readonly rounding?: InsuranceRounding;
}

/**
 * Insurance rounding: to a number of small blinds, so a rule follows the blinds of each game. A
 * game or calculator resolves it to `chips` before pricing; a rule is never kept with chips.
 */
export interface InsuranceRounding {
  readonly mode: RakeRounding;
  /** Above 0 with at most two decimals. Missing means 1. */
  readonly smallBlinds?: number;
  /** The smallest chip itself, set where the rule is used. Without it, prices are in whole chips. */
  readonly chips?: number;
}

/** A game's basic settings: the points, the ratio, the blinds and the Buy-in. */
export type BasicSettings = Pick<
  Game,
  "currency" | "smallBlindChips" | "bigBlindChips" | "chipRatio"
> & { readonly buyInBigBlinds: number };

/**
 * The saved configs a game's or a game config's settings are taken from, by section: the ID of a
 * basic settings, insurance, table fee, wage or rake config. One counts only while that config is
 * still there; a section with none holds values of its own (ADR 0038).
 */
export interface SettingsSources {
  readonly basics?: string;
  readonly insurance?: string;
  readonly tableFee?: string;
  readonly wage?: string;
  readonly rake?: string;
}

/** A table fee, wage, rake or basic settings setup kept under a name, to fill a new game's settings quickly. */
export type SavedChargeRule = {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly name: string;
  readonly createdAt: Timestamp;
  /** When it was last saved. Missing on configs from before this was kept. */
  readonly updatedAt?: Timestamp;
} & (
  | {
      readonly kind: "table_fee";
      readonly rule: TableFeeRule;
      /** The currency its amount was set in. Missing on configs from before this was kept. */
      readonly currency?: Currency;
    }
  | {
      readonly kind: "wage";
      readonly rule: WageRule;
      /** The currency its rates were set in. Missing on configs from before this was kept. */
      readonly currency?: Currency;
    }
  | { readonly kind: "rake"; readonly rule: RakeRule }
  | { readonly kind: "basics"; readonly rule: BasicSettings }
);

/** Odds by outs kept under a name, to fill a rule's table quickly. */
export interface SavedOddsTable {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly name: string;
  readonly oddsHundredths: readonly number[];
  readonly createdAt: Timestamp;
  /** When it was last saved. Missing on tables from before this was kept. */
  readonly updatedAt?: Timestamp;
}

/** A named rule kept for quick use in later games. */
export interface SavedInsuranceRule {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly name: string;
  readonly rule: InsuranceRule;
  readonly createdAt: Timestamp;
  /** When it was last saved. Missing on rules from before this was kept. */
  readonly updatedAt?: Timestamp;
}

/**
 * A game's whole setup kept under a name. Using one only fills the form, so games never point to
 * it. A section in `settings.sources` follows its saved config: using the game config takes that
 * config's values as they are then, and the values kept here only once it is gone (ADR 0038).
 */
export interface SavedGameConfig {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly name: string;
  readonly settings: GameSettings;
  readonly createdAt: Timestamp;
  /** When it was last saved. Missing on configs from before this was kept. */
  readonly updatedAt?: Timestamp;
}

export interface InsuranceHandPlayer {
  readonly playerId: string;
  /** What they put in. Ignored for a cover player, who matches the next deepest. */
  readonly chips: number;
  /** The deepest stack among these players. At most one per hand. */
  readonly cover: boolean;
  readonly cards: readonly number[];
}

/** Bought during a hand. Reaches the ledger only when the hand is finished. */
export interface InsuranceHandPurchase {
  readonly id: string;
  readonly offerKey: string;
  readonly playerId: string;
  readonly street: "turn" | "river";
  /** The cards sold, which decide the result. Empty where the hand is worked from counts of outs. */
  readonly outs: readonly number[];
  /** How many cards were sold, where which ones they are is not known. */
  readonly outsCount?: number;
  /** The cards sold split the pot. Missing for cards that take it from the buyer. */
  readonly tie?: boolean;
  readonly oddsHundredths: number;
  readonly premiumChips: number;
  readonly payoutChips: number;
  /** Set once the card is dealt. */
  readonly hit?: boolean;
}

/**
 * What a hand worked from counts of outs knows in place of cards: who was ahead before each
 * street's card, for the streets it was worked on, and who took the pots once the river came.
 * Without the river, nobody is known to have won.
 */
export interface QuickHand {
  readonly leaders: { readonly turn?: string; readonly river?: string };
  readonly winnerIds?: readonly string[];
}

export type InsuranceHandStep = "players" | "start" | "buy" | "deal" | "settle" | "summary";

/** One all-in worked through card by card. It is a draft until the organizer finishes it (ADR 0016). */
export interface InsuranceHand {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly gameId: string;
  readonly status: "open" | "done";
  readonly step: InsuranceHandStep;
  readonly players: readonly InsuranceHandPlayer[];
  /** Dead money, one amount per pool. */
  readonly pools: readonly number[];
  /** True while the dead money is the amount a hand starts with, which the organizer has not set. */
  readonly presetPools?: boolean;
  readonly board: readonly number[];
  /**
   * How many cards the board had when the hand's insurance began. A street whose card was among
   * them was entered with the board, and never had insurance.
   */
  readonly enteredBoardCards?: number;
  /** Set for a hand worked from counts of outs, which has no cards and no board. */
  readonly quick?: QuickHand;
  readonly purchases: readonly InsuranceHandPurchase[];
  /** Offers the organizer turned down. */
  readonly declined: readonly string[];
  /** Cards of an offer the buyer gives up, by the offer's key: they are left out of what is sold. */
  readonly skippedOuts?: Readonly<Record<string, readonly number[]>>;
  /** Cards of an offer sold as a second cover apart from the rest, by the offer's key. */
  readonly splitOuts?: Readonly<Record<string, readonly number[]>>;
  readonly createdAt: Timestamp;
}

/** The insurance seat in a game. It has chips like a player but no record in the player list (ADR 0014). */
export const INSURANCE_PLAYER_ID = "insurance";

/** Reserved: no player can take this name. */
export const INSURANCE_PLAYER_NAME = "保险";

/**
 * The rake seat in a game. It has no Buy-in: its chips are the rake taken from pots, which leave the
 * table, and at settlement they go to the organizer.
 */
export const RAKE_PLAYER_ID = "rake";

/** Reserved: no player can take this name. */
export const RAKE_PLAYER_NAME = "抽水";

/** How a pot's rake is rounded to the smallest chip in play. */
export type RakeRounding = "nearest" | "down" | "up";

/** An amount for rake in chips, or in small or big blinds of the game. */
export interface RakeAmount {
  readonly unit: "chips" | "smallBlinds" | "bigBlinds";
  /** Above 0: whole for chips, with at most two decimals for blinds. */
  readonly amount: number;
}

/** How rake is taken from a pot (ADR 0036). */
export interface RakeRule {
  /** Above 0 and below 100, with at most two decimals. */
  readonly percent: number;
  /**
   * How the rake is rounded to `roundTo`. Missing on rules from before rake had settings, which
   * round down to whole chips and have no cap.
   */
  readonly rounding?: RakeRounding;
  /** The smallest chip in play, which the rake is rounded to. Missing rounds down to whole chips. */
  readonly roundTo?: RakeAmount;
  /** The most rake one pot gives up. Missing means no cap. */
  readonly cap?: RakeAmount;
  /** Whether insurance quotes take the rake out of the pot first. Kept, not in effect yet. */
  readonly insuranceAfterRake?: boolean;
}

/** 5% of the pot, rounded to the nearest small blind, with no cap. */
export const DEFAULT_RAKE_RULE: RakeRule = {
  percent: 5,
  rounding: "nearest",
  roundTo: { unit: "smallBlinds", amount: 1 },
};

/**
 * The organizer in a game. Playing, they have chips under this ID like the insurance seat, with no
 * record in the player list, and at settlement everything else they receive lands on the same row
 * (ADR 0028).
 */
export const ORGANIZER_PLAYER_ID = "organizer";

/** One payment at settlement: who pays whom, and how much. */
export interface Transfer {
  readonly from: string;
  readonly to: string;
  readonly amount: Cents;
}

/**
 * The optimal transfer plan, chosen outright. It is saved where a collector's ID would be, so the
 * choice holds in a game whose own default is a collector.
 */
export const OPTIMAL_PLAN = "optimal";

/** A flat fee each player pays once per game, if they sat long enough. */
export interface TableFeeRule {
  readonly amount: Cents;
  /** Minutes at the table before the fee applies. 0 charges everyone. */
  readonly minMinutes: number;
}

/**
 * A different hourly wage for part of the game, on rules from before segments. One kind at a time:
 * a time of day, or a time since the first player sat down.
 */
export type WageAdjustment =
  | {
      readonly kind: "time_of_day";
      /** Local hour the rate starts, 0–23. */
      readonly fromHour: number;
      /** Local hour the rate ends, 0–23. Earlier than `fromHour` runs past midnight. */
      readonly toHour: number;
      readonly hourly: Cents;
    }
  | {
      readonly kind: "after_start";
      /** Whole hours after the first player sat down. */
      readonly afterHours: number;
      readonly hourly: Cents;
    };

export type ChargeKind = "table_fee" | "wage";

/**
 * Which rate a wage was charged at: the rule's own, an older rule's adjustment, or a numbered
 * segment by local time (`time-1`) or by game time (`after-1`).
 */
export type WagePart = "base" | "adjusted" | `time-${number}` | `after-${number}`;

/**
 * A rate from a local hour on the game's timeline: from the first time the clock shows `fromHour`
 * once the game has started, until `toHour` next comes round.
 */
export interface WageTimeSegment {
  /** Local hour, 0–23. */
  readonly fromHour: number;
  /** Local hour, 0–23 and not `fromHour`. Missing runs to the end of the game. */
  readonly toHour?: number;
  readonly hourly: Cents;
}

/** A rate from some whole hours of game clock time on, until the next segment's. */
export interface WageAfterStartSegment {
  readonly afterHours: number;
  readonly hourly: Cents;
}

/** Wages are charged in whole units of these minutes. */
export type WageUnitMinutes = 1 | 15 | 30 | 60;

/** What happens to a part unit at the end of a player's time: half or more counts, any counts, or none. */
export type WageRounding = "nearest" | "up" | "down";

/** One charge the organizer let a player off at settlement (ADR 0024). */
export interface ChargeWaiver {
  readonly playerId: string;
  readonly kind: ChargeKind;
  /** Wages only: the rate waived. */
  readonly part?: WagePart;
}

/** What each player pays per hour at the table (ADR 0025). */
export interface WageRule {
  /** The rate at all times no segment applies. */
  readonly hourly: Cents;
  /**
   * Missing on rules from before segments, which are charged by each rate's whole minutes rounded
   * down and may have one `adjustment` instead.
   */
  readonly unitMinutes?: WageUnitMinutes;
  /**
   * Set on rules charged unit by unit, each unit at the rate that covers more of it (ADR 0027).
   * Missing on earlier rules, which keep their own charging.
   */
  readonly rounding?: WageRounding;
  /**
   * Rules with `unitMinutes` from before `rounding` (ADR 0025): whether a part unit counts as a
   * whole one. They round the total time and give the difference to the last rate.
   */
  readonly roundUp?: boolean;
  readonly adjustment?: WageAdjustment;
  /** Up to 3, each starting where the last ended. Only the last may run to the end. */
  readonly timeSegments?: readonly WageTimeSegment[];
  /** Up to 3, in rising order of hours. With time segments too, at most 4 in all. */
  readonly afterStartSegments?: readonly WageAfterStartSegment[];
}

/** What the organizer chooses when starting a game. */
export type GameSettings = Pick<
  Game,
  "currency" | "smallBlindChips" | "bigBlindChips" | "chipRatio"
> & {
  readonly buyInBigBlinds: number;
  /** Missing means insurance is off. Not part of the form values: it has its own editor. */
  readonly insurance?: InsuranceRule;
  /** Missing means no table fee. Has its own editor, like insurance. */
  readonly tableFee?: TableFeeRule;
  /** Missing means no wages. Has its own editor, like insurance. */
  readonly wage?: WageRule;
  /** Missing means no rake. */
  readonly rake?: RakeRule;
  /** The saved configs these were taken from. Missing means none. */
  readonly sources?: SettingsSources;
};

/** One stretch of the game clock running, from start to pause. */
export interface TimerRun {
  readonly from: Timestamp;
  readonly to: Timestamp;
}

/** The game clock. Timing data stores timestamps and computes differences (ADR 0001). */
export interface GameTimer {
  /** Time counted up to the current run. */
  readonly elapsedMs: number;
  /** When the current run started. Missing while paused. */
  readonly runningSince?: Timestamp;
  /**
   * Finished runs, oldest first, so time at the table counts only while the clock runs (ADR 0022).
   * Missing on clocks started before runs were kept, whose history is unknown.
   */
  readonly runs?: readonly TimerRun[];
}

export interface Game {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly currency: Currency;
  /** Small blind in chips. */
  readonly smallBlindChips: number;
  /** Big blind in chips. */
  readonly bigBlindChips: number;
  readonly chipRatio: ChipRatio;
  /** Big blinds in one buy-in. Games from before this feature lack it and keep recording chips. */
  readonly buyInBigBlinds?: number;
  /** Chips per hand. Fixed once the ledger has events, even if blinds change (ADR 0010). */
  readonly handChips?: number;
  readonly status: GameStatus;
  readonly createdAt: Timestamp;
  /**
   * Who collects and pays out at settlement: a player ID, `ORGANIZER_COLLECTOR`, or `OPTIMAL_PLAN`
   * for no collector. Missing means the game's own default (`transferCollector`).
   */
  readonly collectorId?: string;
  /** How a chip difference is settled. Only used when the books do not balance. */
  readonly imbalanceHandling?: ImbalanceHandling;
  /** When settlement was confirmed. Cleared when the results are revised. */
  readonly settledAt?: Timestamp;
  /**
   * Set while every transfer of a settled game is marked as made, which makes the game complete.
   * Saved so the games list need not settle each game again. Cleared when the results are revised.
   */
  readonly allReceived?: true;
  /** Missing until the organizer starts the clock. */
  readonly timer?: GameTimer;
  /** This game's insurance terms. Missing means insurance is off. */
  readonly insurance?: InsuranceRule;
  /**
   * Who takes the insurance result at settlement: a player ID, `ORGANIZER_COLLECTOR`, or
   * `INSURANCE_PLAYER_ID` to list it on its own. Missing means the organizer.
   */
  readonly insuranceOwner?: string;
  /** This game's table fee. Missing means none. Charged at settlement, outside the chips. */
  readonly tableFee?: TableFeeRule;
  /** This game's wages. Missing means none. Charged at settlement, outside the chips. */
  readonly wage?: WageRule;
  /** This game's rake. Missing means none. Recorded in chips on the rake seat. */
  readonly rake?: RakeRule;
  /** Set when the rake takes its share of a difference split by win or loss. Missing leaves it out. */
  readonly rakeInSplit?: true;
  /** Set when the insurance seat takes its share of such a split. Missing leaves it out. */
  readonly insuranceInSplit?: true;
  /** Charges let off at settlement. Missing means none. */
  readonly waivedCharges?: readonly ChargeWaiver[];
  /**
   * Transfers marked as made. Each is the payment itself, so a mark holds in every plan that has
   * the same payment and no longer applies once its amount changes. Missing means none.
   */
  readonly doneTransfers?: readonly Transfer[];
  /**
   * IANA time zone the game was started in, such as `Asia/Shanghai`. Wage rates by time of day
   * follow it on every device. Missing on earlier games, which use the viewing device's zone.
   */
  readonly timeZone?: string;
  /**
   * The saved configs the settings were taken from, which name them at the next game's setup. The
   * game keeps its own copy of every value, so a config changed later changes nothing here.
   */
  readonly sources?: SettingsSources;
}

export interface Player {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly name: string;
  /** Lowercase pinyin initials of the name, for search. Generated in the app layer, so `core` needs no pinyin library. */
  readonly initials: string;
  readonly createdAt: Timestamp;
}

interface LedgerEventBase {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly gameId: string;
  readonly occurredAt: Timestamp;
}

/** A buy-in, rebuy or cash-out. Amounts are derived from chips and the game's chip ratio. */
export interface ChipEvent extends LedgerEventBase {
  readonly type: "buy_in" | "rebuy" | "cash_out";
  readonly playerId: string;
  /** Whole number of chips. */
  readonly chips: number;
  /** The insurance hand that needed this buy-in, so undoing the hand takes it back. */
  readonly handId?: string;
}

/** A stack typed in by the organizer, replacing the player's current chips. */
export interface StackSetEvent extends LedgerEventBase {
  readonly type: "stack_set";
  readonly playerId: string;
  /** Whole number of chips. */
  readonly chips: number;
  /** The insurance hand that set this, so undoing the hand restores it. */
  readonly handId?: string;
}

/** Reversal: undoes the event `reversedEventId` points to, leaving the old record unchanged. */
export interface ReversalEvent extends LedgerEventBase {
  readonly type: "reversal";
  readonly reversedEventId: string;
}

/** Insurance bought on one pot: the premium moves from the player to the insurance seat. */
export interface InsuranceBuyEvent extends LedgerEventBase {
  readonly type: "insurance_buy";
  readonly playerId: string;
  /** Premium in whole chips. */
  readonly chips: number;
  /** Paid to the player on a hit, including any refunded premium. */
  readonly payoutChips: number;
  readonly outs: number;
  /** The cards sold split the pot. Missing for cards that take it from the buyer. */
  readonly tie?: boolean;
  readonly oddsHundredths: number;
  readonly street: "turn" | "river";
  /** The insurance hand this came from. Missing for one bought from an outs count. */
  readonly handId?: string;
}

/** The card came: a hit moves the payout from the insurance seat to the player, a miss moves nothing. */
export interface InsuranceSettleEvent extends LedgerEventBase {
  readonly type: "insurance_settle";
  readonly purchaseId: string;
  readonly playerId: string;
  readonly hit: boolean;
  /** Chips paid out, 0 on a miss. */
  readonly chips: number;
  readonly handId?: string;
}

/**
 * Rake taken from the pots, added to the rake seat. Its chips leave the table, so the players' stacks
 * already show them gone. A total typed in over the old one is recorded as the change, which can be
 * below 0, though the total never is. Undoing it is a reversal, like any other event.
 */
export interface RakeEvent extends LedgerEventBase {
  readonly type: "rake";
  readonly playerId: typeof RAKE_PLAYER_ID;
  /** The change in chips, never 0. */
  readonly chips: number;
  /** The pot it was worked out from, when one was typed. Missing for a rake typed in by hand. */
  readonly potChips?: number;
  /** When the total so far was typed over to correct it, rather than added to. */
  readonly typedOver?: true;
}

/** Ledger event. Append-only, never changed (ADR 0005). */
export type LedgerEvent =
  | ChipEvent
  | StackSetEvent
  | ReversalEvent
  | InsuranceBuyEvent
  | InsuranceSettleEvent
  | RakeEvent;
