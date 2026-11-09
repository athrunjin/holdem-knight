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

export type GameStatus = "open" | "settled";

/** Whether cards that split the pot count as outs. */
export type TieOuts = "exclude" | "include";

/** Insurance terms. Copied onto each game, so editing a saved rule never changes past games. */
export interface InsuranceRule {
  /** Payout multiples in hundredths, indexed by outs − 1: 350 means 3.5. More outs than entries cannot be insured. */
  readonly oddsHundredths: readonly number[];
  readonly tieOuts: TieOuts;
  /** Whether a hit also hands back the premium. */
  readonly refundPremium: boolean;
  /** Whether a flop all-in can insure the turn card. The river can always be insured. */
  readonly coverTurn: boolean;
  /** Highest premium on the turn card, as a percentage of the pot. Missing means no limit. */
  readonly turnCapPercent?: number;
  /** Highest premium on the river card, as a percentage of the pot. Missing means no limit. */
  readonly riverCapPercent?: number;
}

/** A named rule kept for quick use in later games. */
export interface SavedInsuranceRule {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly name: string;
  readonly rule: InsuranceRule;
  readonly createdAt: Timestamp;
}

/** A game's setup kept under a name. Using one only fills the form, so games never point to it. */
export interface SavedGameConfig {
  readonly id: string;
  readonly organizerId: OrganizerId;
  readonly name: string;
  readonly settings: GameSettings;
  readonly createdAt: Timestamp;
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
  /** The cards sold, which decide the result. */
  readonly outs: readonly number[];
  readonly oddsHundredths: number;
  readonly premiumChips: number;
  readonly payoutChips: number;
  /** Set once the card is dealt. */
  readonly hit?: boolean;
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
  readonly board: readonly number[];
  readonly purchases: readonly InsuranceHandPurchase[];
  /** Offers the organizer turned down. */
  readonly declined: readonly string[];
  readonly createdAt: Timestamp;
}

/** The insurance seat in a game. It has chips like a player but no record in the player list (ADR 0014). */
export const INSURANCE_PLAYER_ID = "insurance";

/** Reserved: no player can take this name. */
export const INSURANCE_PLAYER_NAME = "保险";

/** A flat fee each player pays once per game, if they sat long enough. */
export interface TableFeeRule {
  readonly amount: Cents;
  /** Minutes at the table before the fee applies. 0 charges everyone. */
  readonly minMinutes: number;
}

/**
 * A different hourly wage for part of the game. One kind at a time: a time of day, or a time since
 * the first player sat down.
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

/** What each player pays per hour at the table, counted by the minute. */
export interface WageRule {
  /** The rate at all times, unless the adjustment applies. */
  readonly hourly: Cents;
  readonly adjustment?: WageAdjustment;
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
};

/** The game clock. Timing data stores timestamps and computes differences (ADR 0001). */
export interface GameTimer {
  /** Time counted up to the current run. */
  readonly elapsedMs: number;
  /** When the current run started. Missing while paused. */
  readonly runningSince?: Timestamp;
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
  /** Who collects and pays out at settlement: a player ID or `ORGANIZER_COLLECTOR`. Missing means the optimal plan. */
  readonly collectorId?: string;
  /** How a chip difference is settled. Only used when the books do not balance. */
  readonly imbalanceHandling?: ImbalanceHandling;
  /** When settlement was confirmed. Cleared on reopening. */
  readonly settledAt?: Timestamp;
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

/** Ledger event. Append-only, never changed (ADR 0005). */
export type LedgerEvent =
  | ChipEvent
  | StackSetEvent
  | ReversalEvent
  | InsuranceBuyEvent
  | InsuranceSettleEvent;
