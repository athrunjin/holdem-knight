import {
  type BackupData,
  type Cents,
  CURRENCIES,
  cents,
  IMBALANCE_HANDLINGS,
  INSURANCE_PLAYER_ID,
  type LegacyGame,
  upgradeLegacyGame,
} from "@holdem-knight/core";
import { z } from "zod";

const FORMAT = "holdem-backup";
const VERSION = 7;

const id = z.string().min(1);
const money = z
  .number()
  .refine(Number.isSafeInteger)
  .transform((value): Cents => cents(value));
const chips = z.number().int().nonnegative();
const timestamp = z.number().int();

const owned = { id, organizerId: id };

const percent = z.number().int().positive();
const street = z.enum(["turn", "river"]);

const insuranceRuleSchema = z.object({
  oddsHundredths: z.array(z.number().int().positive()).min(1),
  tieOuts: z.enum(["exclude", "include"]),
  refundPremium: z.boolean(),
  coverTurn: z.boolean(),
  turnCapPercent: percent.optional(),
  riverCapPercent: percent.optional(),
});

const tableFeeSchema = z.object({ amount: money, minMinutes: z.number().int().min(0) });

const hour = z.number().int().min(0).max(23);

const wageSchema = z.object({
  hourly: money,
  adjustment: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("time_of_day"), fromHour: hour, toHour: hour, hourly: money }),
      z.object({ kind: z.literal("after_start"), afterHours: chips.positive(), hourly: money }),
    ])
    .optional(),
});

const gameFields = {
  ...owned,
  currency: z.enum(CURRENCIES as ["AUD", "CNY"]),
  chipRatio: z.object({ chips: chips.positive(), amount: money }),
  buyInBigBlinds: chips.positive().optional(),
  handChips: chips.positive().optional(),
  collectorId: id.optional(),
  imbalanceHandling: z.enum(IMBALANCE_HANDLINGS as ["split", "organizer", "ignore"]).optional(),
  insurance: insuranceRuleSchema.optional(),
  insuranceOwner: id.optional(),
  status: z.enum(["open", "settled"]),
  createdAt: timestamp,
  settledAt: timestamp.optional(),
  /** Added in version 6. */
  timer: z
    .object({ elapsedMs: z.number().int().min(0), runningSince: timestamp.optional() })
    .optional(),
  /** Added in version 7. */
  tableFee: tableFeeSchema.optional(),
  /** Added in version 7. */
  wage: wageSchema.optional(),
};

const gameSchema = z.object({
  ...gameFields,
  smallBlindChips: chips.positive(),
  bigBlindChips: chips.positive(),
});

/** Version 1 stored blinds as money. */
const legacyGameSchema = z.object({ ...gameFields, smallBlind: money, bigBlind: money });

const playerSchema = z.object({
  ...owned,
  name: z.string().min(1),
  initials: z.string(),
  createdAt: timestamp,
});

const eventBase = { ...owned, gameId: id, occurredAt: timestamp };

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    ...eventBase,
    type: z.enum(["buy_in", "rebuy", "cash_out"]),
    playerId: id,
    chips,
    handId: id.optional(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("stack_set"),
    playerId: id,
    chips,
    handId: id.optional(),
  }),
  z.object({ ...eventBase, type: z.literal("reversal"), reversedEventId: id }),
  z.object({
    ...eventBase,
    type: z.literal("insurance_buy"),
    playerId: id,
    chips,
    payoutChips: chips,
    outs: chips,
    oddsHundredths: chips.positive(),
    street,
    handId: id.optional(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("insurance_settle"),
    purchaseId: id,
    playerId: id,
    hit: z.boolean(),
    chips,
    handId: id.optional(),
  }),
]);

const savedRuleSchema = z.object({
  ...owned,
  name: z.string().min(1),
  rule: insuranceRuleSchema,
  createdAt: timestamp,
});

const card = z.number().int().min(0).max(51);

const gameConfigSchema = z.object({
  ...owned,
  name: z.string().min(1),
  settings: z.object({
    currency: gameFields.currency,
    smallBlindChips: chips.positive(),
    bigBlindChips: chips.positive(),
    chipRatio: gameFields.chipRatio,
    buyInBigBlinds: chips.positive(),
    insurance: insuranceRuleSchema.optional(),
    tableFee: tableFeeSchema.optional(),
    wage: wageSchema.optional(),
  }),
  createdAt: timestamp,
});

const insuranceHandSchema = z.object({
  ...owned,
  gameId: id,
  status: z.enum(["open", "done"]),
  step: z.enum(["players", "start", "buy", "deal", "settle", "summary"]),
  players: z.array(
    z.object({ playerId: id, chips, cover: z.boolean(), cards: z.array(card).max(2) }),
  ),
  pools: z.array(chips),
  board: z.array(card).max(5),
  purchases: z.array(
    z.object({
      id,
      offerKey: id,
      playerId: id,
      street,
      outs: z.array(card),
      oddsHundredths: chips.positive(),
      premiumChips: chips,
      payoutChips: chips,
      hit: z.boolean().optional(),
    }),
  ),
  declined: z.array(id),
  createdAt: timestamp,
});

const collections = {
  players: z.array(playerSchema),
  ledgerEvents: z.array(eventSchema),
  /** Added in version 3. */
  insuranceRules: z.array(savedRuleSchema).default([]),
  /** Added in version 4. */
  insuranceHands: z.array(insuranceHandSchema).default([]),
  /** Added in version 5. */
  gameConfigs: z.array(gameConfigSchema).default([]),
};

const backupSchema = z.object({ games: z.array(gameSchema), ...collections });
const legacyBackupSchema = z.object({ games: z.array(legacyGameSchema), ...collections });

const envelopeSchema = z.looseObject({ format: z.literal(FORMAT), version: z.number() });

export function serializeBackup(data: BackupData, exportedAt: number): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt, ...data });
}

export type BackupIssue = "invalid" | "newer-version";

export type ParsedBackup =
  | { readonly ok: true; readonly data: BackupData }
  | { readonly ok: false; readonly issue: BackupIssue };

/** Ledger events must point to games and players in the backup, or the books will not balance after a restore. */
function linksAreValid({ games, players, ledgerEvents, insuranceHands }: BackupData): boolean {
  const gameIds = new Set(games.map((g) => g.id));
  const playerIds = new Set(players.map((p) => p.id));
  const eventIds = new Set(ledgerEvents.map((e) => e.id));
  const isPlayer = (id: string) => id === INSURANCE_PLAYER_ID || playerIds.has(id);
  if (!insuranceHands.every((hand) => gameIds.has(hand.gameId))) return false;
  return ledgerEvents.every(
    (e) =>
      gameIds.has(e.gameId) &&
      (e.type === "reversal" ? eventIds.has(e.reversedEventId) : isPlayer(e.playerId)) &&
      (e.type !== "insurance_settle" || eventIds.has(e.purchaseId)),
  );
}

function parseCurrent(json: unknown): BackupData | null {
  const parsed = backupSchema.safeParse(json);
  return parsed.success ? (parsed.data as BackupData) : null;
}

function parseLegacy(json: unknown): BackupData | null {
  const parsed = legacyBackupSchema.safeParse(json);
  if (!parsed.success) return null;
  const { games, ...rest } = parsed.data as Omit<BackupData, "games"> & {
    games: readonly LegacyGame[];
  };
  return { ...rest, games: games.map(upgradeLegacyGame) };
}

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, issue: "invalid" };
  }
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) return { ok: false, issue: "invalid" };
  if (envelope.data.version > VERSION) return { ok: false, issue: "newer-version" };

  const data = envelope.data.version < 2 ? parseLegacy(json) : parseCurrent(json);
  if (!data) return { ok: false, issue: "invalid" };
  return linksAreValid(data) ? { ok: true, data } : { ok: false, issue: "invalid" };
}
