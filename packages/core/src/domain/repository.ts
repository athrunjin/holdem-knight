/**
 * Repository interfaces. UI and business logic depend on these, not on specific storage (ADR 0005).
 *
 * One repository instance is bound to one organizer: reads return only that organizer's data,
 * and writing another organizer's data throws `ForeignOrganizerError`.
 */
import type {
  Game,
  InsuranceHand,
  LedgerEvent,
  Player,
  SavedChargeRule,
  SavedGameConfig,
  SavedInsuranceRule,
  SavedOddsTable,
} from "./types";

export class ForeignOrganizerError extends Error {
  override readonly name = "ForeignOrganizerError";
}

export interface GameRepository {
  /** Newest games first. */
  list(): Promise<Game[]>;
  get(id: string): Promise<Game | undefined>;
  save(game: Game): Promise<void>;
}

export interface PlayerRepository {
  /** Sorted by name. */
  list(): Promise<Player[]>;
  get(id: string): Promise<Player | undefined>;
  save(player: Player): Promise<void>;
}

export interface InsuranceRuleRepository {
  /** Oldest first. */
  list(): Promise<SavedInsuranceRule[]>;
  save(rule: SavedInsuranceRule): Promise<void>;
  /** Games keep their own copy of the rule, so deleting one changes no game. */
  remove(id: string): Promise<void>;
}

export interface GameConfigRepository {
  /** Oldest first. */
  list(): Promise<SavedGameConfig[]>;
  save(config: SavedGameConfig): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface OddsTableRepository {
  /** Oldest first. */
  list(): Promise<SavedOddsTable[]>;
  save(table: SavedOddsTable): Promise<void>;
  /** Rules keep their own copy of the odds, so deleting one changes no game or rule. */
  remove(id: string): Promise<void>;
}

export interface ChargeRuleRepository {
  /** Oldest first, both kinds together. */
  list(): Promise<SavedChargeRule[]>;
  save(rule: SavedChargeRule): Promise<void>;
  /** Games keep their own copy of the rule, so deleting one changes no game. */
  remove(id: string): Promise<void>;
}

/** Hands are drafts until finished, so unlike the ledger they can be changed and discarded. */
export interface InsuranceHandRepository {
  /** Oldest first. */
  listByGame(gameId: string): Promise<InsuranceHand[]>;
  save(hand: InsuranceHand): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The ledger is append-only: there is deliberately no update or delete, and undoing means appending a reversal event. */
export interface LedgerRepository {
  /** Sorted by time of occurrence. */
  listByGame(gameId: string): Promise<LedgerEvent[]>;
  /** Fails if the event ID exists, so existing records are never overwritten. */
  append(event: LedgerEvent): Promise<void>;
  /** Appends several events at once: all are written or none are. */
  appendAll(events: readonly LedgerEvent[]): Promise<void>;
}

/** All of this organizer's data. */
export interface BackupData {
  readonly games: readonly Game[];
  readonly players: readonly Player[];
  readonly ledgerEvents: readonly LedgerEvent[];
  readonly insuranceRules: readonly SavedInsuranceRule[];
  readonly insuranceHands: readonly InsuranceHand[];
  readonly gameConfigs: readonly SavedGameConfig[];
  readonly oddsTables: readonly SavedOddsTable[];
  readonly chargeRules: readonly SavedChargeRule[];
}

export interface RestoreResult {
  /** Number of records added. */
  readonly added: number;
  /** Number of records skipped because their ID exists. */
  readonly skipped: number;
}

export interface BackupRepository {
  exportAll(): Promise<BackupData>;
  /** Merging restore: only adds records, leaving existing IDs as they are. All are written or none are. */
  restore(data: BackupData): Promise<RestoreResult>;
}

export interface Repository {
  readonly games: GameRepository;
  readonly players: PlayerRepository;
  readonly ledger: LedgerRepository;
  readonly insuranceRules: InsuranceRuleRepository;
  readonly insuranceHands: InsuranceHandRepository;
  readonly gameConfigs: GameConfigRepository;
  readonly oddsTables: OddsTableRepository;
  readonly chargeRules: ChargeRuleRepository;
  readonly backup: BackupRepository;
}
