import {
  type BackupData,
  type Cents,
  CURRENCIES,
  cents,
  IMBALANCE_HANDLINGS,
  INSURANCE_PLAYER_ID,
  type LegacyGame,
  ORGANIZER_PLAYER_ID,
  RAKE_PLAYER_ID,
  upgradeLegacyGame,
} from "@holdem-knight/core";
import { z } from "zod";

const FORMAT = "holdem-backup";
const VERSION = 15;

const id = z.string().min(1);
const money = z
  .number()
  .refine(Number.isSafeInteger)
  .transform((value): Cents => cents(value));
const chips = z.number().int().nonnegative();
const timestamp = z.number().int();

const owned = { id, organizerId: id };

const street = z.enum(["turn", "river"]);

/** Rules before version 9 had premium caps instead, which are dropped and leave the full pot. */
const coverLimit = z.union([z.literal("stake"), z.number().int().min(1).max(99)]);

/** At most two decimals, allowing for how they are stored. */
const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const insuranceRuleSchema = z.object({
  oddsHundredths: z.array(z.number().int().positive()).min(1),
  tieOuts: z.enum(["exclude", "include"]),
  refundPremium: z.boolean(),
  turnCoverLimit: coverLimit.optional(),
  riverCoverLimit: coverLimit.optional(),
  oddsTableId: id.optional(),
  /** Added in version 14. The smallest chip is kept in small blinds, never in chips. */
  rounding: z
    .object({
      mode: z.enum(["nearest", "down", "up"]),
      smallBlinds: z.number().positive().refine(twoDecimals).optional(),
    })
    .optional(),
});

const tableFeeSchema = z.object({ amount: money, minMinutes: z.number().int().min(0) });

/** Whole for chips, with at most two decimals for blinds. */
const rakeAmountSchema = z
  .object({ unit: z.enum(["chips", "smallBlinds", "bigBlinds"]), amount: z.number().positive() })
  .refine(({ unit, amount }) =>
    unit === "chips" ? Number.isInteger(amount) : twoDecimals(amount),
  );

const rakeSchema = z.object({
  /** Whole percentages until version 14, which allows two decimals. */
  percent: z.number().positive().lt(100).refine(twoDecimals),
  /** Added in version 14, with the smallest chip and the cap. */
  rounding: z.enum(["nearest", "down", "up"]).optional(),
  roundTo: rakeAmountSchema.optional(),
  cap: rakeAmountSchema.optional(),
  insuranceAfterRake: z.boolean().optional(),
});

const hour = z.number().int().min(0).max(23);

const wageSchema = z.object({
  hourly: money,
  /** Added in version 9, with the segments. */
  unitMinutes: z.union([z.literal(1), z.literal(15), z.literal(30), z.literal(60)]).optional(),
  roundUp: z.boolean().optional(),
  /** Added in version 10. */
  rounding: z.enum(["nearest", "up", "down"]).optional(),
  timeSegments: z
    .array(z.object({ fromHour: hour, toHour: hour.optional(), hourly: money }))
    .max(3)
    .optional(),
  afterStartSegments: z
    .array(z.object({ afterHours: chips.positive(), hourly: money }))
    .max(3)
    .optional(),
  adjustment: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("time_of_day"), fromHour: hour, toHour: hour, hourly: money }),
      z.object({ kind: z.literal("after_start"), afterHours: chips.positive(), hourly: money }),
    ])
    .optional(),
});

/** Added in version 15: the saved configs a game's or a game config's settings are taken from. */
const sourcesSchema = z
  .object({
    basics: id.optional(),
    insurance: id.optional(),
    tableFee: id.optional(),
    wage: id.optional(),
    rake: id.optional(),
  })
  .optional();

/** Added in version 15, on everything saved under a name. */
const updatedAt = timestamp.optional();

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
  /** `settling` was added in version 12. */
  status: z.enum(["open", "settling", "settled"]),
  createdAt: timestamp,
  settledAt: timestamp.optional(),
  /** Added in version 6. */
  timer: z
    .object({
      elapsedMs: z.number().int().min(0),
      runningSince: timestamp.optional(),
      /** Added in version 7. */
      runs: z.array(z.object({ from: timestamp, to: timestamp })).optional(),
    })
    .optional(),
  /** Added in version 7. */
  tableFee: tableFeeSchema.optional(),
  /** Added in version 7. */
  wage: wageSchema.optional(),
  /** Added in version 10. */
  timeZone: z.string().min(1).optional(),
  /** Added in version 8. */
  waivedCharges: z
    .array(
      z.object({
        playerId: id,
        kind: z.enum(["table_fee", "wage"]),
        part: z
          .string()
          .regex(/^(base|adjusted|time-[1-3]|after-[1-3])$/)
          .optional(),
      }),
    )
    .optional(),
  /** Added in version 12. */
  allReceived: z.literal(true).optional(),
  /** Added in version 12. */
  doneTransfers: z.array(z.object({ from: id, to: id, amount: money })).optional(),
  /** Added in version 13. */
  rake: rakeSchema.optional(),
  /** Added in version 13. */
  rakeInSplit: z.literal(true).optional(),
  /** Added in version 13. */
  insuranceInSplit: z.literal(true).optional(),
  sources: sourcesSchema,
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
    tie: z.boolean().optional(),
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
  /** Added in version 13. */
  z.object({
    ...eventBase,
    type: z.literal("rake"),
    playerId: z.literal(RAKE_PLAYER_ID),
    chips: z
      .number()
      .int()
      .refine((change) => change !== 0),
    /** Added in version 14. */
    potChips: chips.positive().optional(),
    /** Added in version 14. */
    typedOver: z.literal(true).optional(),
  }),
]);

const savedRuleSchema = z.object({
  ...owned,
  name: z.string().min(1),
  rule: insuranceRuleSchema,
  createdAt: timestamp,
  updatedAt,
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
    /** Added in version 13. */
    rake: rakeSchema.optional(),
    sources: sourcesSchema,
  }),
  createdAt: timestamp,
  updatedAt,
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
  presetPools: z.boolean().optional(),
  board: z.array(card).max(5),
  purchases: z.array(
    z.object({
      id,
      offerKey: id,
      playerId: id,
      street,
      outs: z.array(card),
      tie: z.boolean().optional(),
      oddsHundredths: chips.positive(),
      premiumChips: chips,
      payoutChips: chips,
      hit: z.boolean().optional(),
    }),
  ),
  declined: z.array(id),
  skippedOuts: z.record(id, z.array(card)).optional(),
  splitOuts: z.record(id, z.array(card)).optional(),
  createdAt: timestamp,
});

const oddsTableSchema = z.object({
  ...owned,
  name: z.string().min(1),
  oddsHundredths: insuranceRuleSchema.shape.oddsHundredths,
  createdAt: timestamp,
  updatedAt,
});

const savedFields = { ...owned, name: z.string().min(1), createdAt: timestamp, updatedAt };
/** Added in version 15: the currency a table fee or wage config was set in. */
const setIn = gameFields.currency.optional();
const chargeRuleSchema = z.discriminatedUnion("kind", [
  z.object({ ...savedFields, kind: z.literal("table_fee"), rule: tableFeeSchema, currency: setIn }),
  z.object({ ...savedFields, kind: z.literal("wage"), rule: wageSchema, currency: setIn }),
  /** Added in version 14. */
  z.object({ ...savedFields, kind: z.literal("rake"), rule: rakeSchema }),
  /** Added in version 14. */
  z.object({
    ...savedFields,
    kind: z.literal("basics"),
    rule: z.object({
      currency: gameFields.currency,
      smallBlindChips: chips.positive(),
      bigBlindChips: chips.positive(),
      chipRatio: gameFields.chipRatio,
      buyInBigBlinds: chips.positive(),
    }),
  }),
]);

const collections = {
  players: z.array(playerSchema),
  ledgerEvents: z.array(eventSchema),
  /** Added in version 3. */
  insuranceRules: z.array(savedRuleSchema).default([]),
  /** Added in version 4. */
  insuranceHands: z.array(insuranceHandSchema).default([]),
  /** Added in version 5. */
  gameConfigs: z.array(gameConfigSchema).default([]),
  /** Added in version 9. */
  oddsTables: z.array(oddsTableSchema).default([]),
  /** Added in version 9. */
  chargeRules: z.array(chargeRuleSchema).default([]),
};

/**
 * What one record of each kind may hold. A backup is read with these, and so is every record that
 * goes to or comes from an account's storage (ADR 0044).
 */
export const recordSchemas = {
  games: gameSchema,
  players: playerSchema,
  ledgerEvents: eventSchema,
  insuranceRules: savedRuleSchema,
  insuranceHands: insuranceHandSchema,
  gameConfigs: gameConfigSchema,
  oddsTables: oddsTableSchema,
  chargeRules: chargeRuleSchema,
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
  // Version 11 lets the organizer play under their own ID, with no player record, and version 13
  // adds the rake seat
  const isPlayer = (id: string) =>
    id === INSURANCE_PLAYER_ID ||
    id === ORGANIZER_PLAYER_ID ||
    id === RAKE_PLAYER_ID ||
    playerIds.has(id);
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
