import {
  type BackupData,
  ForeignOrganizerError,
  type GameSummary,
  type OrganizerId,
  type Repository,
  type RestoreResult,
} from "@holdem-knight/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { gameSummarySchema, recordSchemas } from "./backup";

/** The app's lists of records, by the names a backup has for them. */
type Collection = keyof typeof recordSchemas;
type RecordOf<C extends Collection> = BackupData[C][number];

/** The table each list is kept in. Everything saved under a name shares one (ADR 0044). */
const TABLES = {
  games: "games",
  players: "players",
  ledgerEvents: "ledger_events",
  insuranceHands: "insurance_hands",
  insuranceRules: "saved_configs",
  gameConfigs: "saved_configs",
  oddsTables: "saved_configs",
  chargeRules: "saved_configs",
} as const satisfies Record<Collection, string>;

const COLLECTIONS = Object.keys(TABLES) as Collection[];

/** The API returns at most this many rows a request, so longer lists are read in pages. */
const PAGE = 1000;

export class StorageError extends Error {
  override readonly name = "StorageError";

  constructor(
    message: string,
    /**
     * The HTTP status the API answered with: 0 when no answer came (no connection, or given up
     * after the timeout). Missing where the record was refused here, before anything was sent.
     */
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * Account mode repository: the books of one host space in Supabase (ADR 0040). Each record is kept
 * as the document the app has, checked with the backup's schemas on the way in and on the way out,
 * under its space and its ID (ADR 0044). Row-level security holds the space apart from the others;
 * the checks here only say so earlier and more clearly.
 */
export function createSupabaseRepository(
  client: SupabaseClient,
  organizerId: OrganizerId,
): Repository {
  function assertOwned(entity: { readonly organizerId: OrganizerId }) {
    if (entity.organizerId !== organizerId) {
      throw new ForeignOrganizerError(
        `Cannot write data belonging to another organizer: ${entity.organizerId}`,
      );
    }
  }

  /** A record as its list's schema allows it, or an error naming what does not fit. */
  function checked<C extends Collection>(collection: C, record: unknown): RecordOf<C> {
    const parsed = (recordSchemas[collection] as z.ZodType).safeParse(record);
    if (!parsed.success) {
      throw new StorageError(`A record of ${collection} is not valid: ${parsed.error.message}`);
    }
    return parsed.data as RecordOf<C>;
  }

  /** The row a record is kept as. */
  function row<C extends Collection>(collection: C, record: RecordOf<C>) {
    assertOwned(record);
    const data = checked(collection, record);
    return {
      organizer_id: organizerId,
      id: record.id,
      data,
      ...(TABLES[collection] === "saved_configs" && { collection }),
    };
  }

  /** This space's rows of a list, with whatever else narrows them. */
  function rows(collection: Collection) {
    const query = client.from(TABLES[collection]).select("data").eq("organizer_id", organizerId);
    return TABLES[collection] === "saved_configs" ? query.eq("collection", collection) : query;
  }

  type Query = ReturnType<typeof rows>;

  /** Every record a query matches, in its order, read a page at a time. */
  async function all<C extends Collection>(
    collection: C,
    refine: (query: Query) => Query,
  ): Promise<RecordOf<C>[]> {
    const records: RecordOf<C>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error, status } = await refine(rows(collection)).range(from, from + PAGE - 1);
      if (error) throw new StorageError(error.message, status);
      for (const found of data) records.push(checked(collection, found.data));
      if (data.length < PAGE) return records;
    }
  }

  async function one<C extends Collection>(
    collection: C,
    id: string,
  ): Promise<RecordOf<C> | undefined> {
    const { data, error, status } = await rows(collection).eq("id", id).maybeSingle();
    if (error) throw new StorageError(error.message, status);
    return data ? checked(collection, data.data) : undefined;
  }

  /** Adds the record, or replaces the one kept under its ID. */
  async function save<C extends Collection>(collection: C, record: RecordOf<C>) {
    const conflict =
      TABLES[collection] === "saved_configs" ? "organizer_id,collection,id" : "organizer_id,id";
    const { error, status } = await client
      .from(TABLES[collection])
      .upsert(row(collection, record), { onConflict: conflict });
    if (error) throw new StorageError(error.message, status);
  }

  /** Adds records that must all be new: one already there fails the lot. */
  async function add<C extends Collection>(collection: C, records: readonly RecordOf<C>[]) {
    if (records.length === 0) return;
    const { error, status } = await client
      .from(TABLES[collection])
      .insert(records.map((record) => row(collection, record)));
    if (error) throw new StorageError(error.message, status);
  }

  async function remove(collection: Collection, id: string) {
    let query = client
      .from(TABLES[collection])
      .delete()
      .eq("organizer_id", organizerId)
      .eq("id", id);
    if (TABLES[collection] === "saved_configs") query = query.eq("collection", collection);
    const { error, status } = await query;
    if (error) throw new StorageError(error.message, status);
  }

  /** A summary as its schema allows it. It is kept apart from the lists, as no backup has it. */
  function checkedSummary(record: unknown): GameSummary {
    const parsed = gameSummarySchema.safeParse(record);
    if (!parsed.success) {
      throw new StorageError(`A game summary is not valid: ${parsed.error.message}`);
    }
    return parsed.data as GameSummary;
  }

  const gameSummaries: Repository["gameSummaries"] = {
    list: async () => {
      const summaries: GameSummary[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error, status } = await client
          .from("game_summaries")
          .select("data")
          .eq("organizer_id", organizerId)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw new StorageError(error.message, status);
        for (const found of data) summaries.push(checkedSummary(found.data));
        if (data.length < PAGE) return summaries;
      }
    },
    save: async (summary) => {
      assertOwned(summary);
      const { error, status } = await client
        .from("game_summaries")
        .upsert(
          { organizer_id: organizerId, id: summary.id, data: checkedSummary(summary) },
          { onConflict: "organizer_id,id" },
        );
      if (error) throw new StorageError(error.message, status);
    },
    remove: async (gameId) => {
      const { error, status } = await client
        .from("game_summaries")
        .delete()
        .eq("organizer_id", organizerId)
        .eq("id", gameId);
      if (error) throw new StorageError(error.message, status);
    },
  };

  // Ties go by ID, as the device's own storage orders them, so both read a list the same way
  const oldestFirst = (query: Query) => query.order("created_at").order("id");
  const byTime = (query: Query) => query.order("occurred_at").order("id");

  /** A list of things saved under a name: oldest first, saved by ID, and deleted. */
  const saved = <C extends "insuranceRules" | "gameConfigs" | "oddsTables" | "chargeRules">(
    collection: C,
  ) => ({
    list: () => all(collection, oldestFirst),
    save: (record: RecordOf<C>) => save(collection, record),
    remove: (id: string) => remove(collection, id),
  });

  return {
    games: {
      list: () =>
        all("games", (query) => query.order("created_at", { ascending: false }).order("id")),
      get: (id) => one("games", id),
      save: (game) => save("games", game),
    },
    players: {
      list: () => all("players", (query) => query.order("name").order("id")),
      get: (id) => one("players", id),
      save: (player) => save("players", player),
      ensure: async (player) => {
        // Never replaces the record there. Two devices making it at once keep one: the one that
        // loses may trip the record's other key, its link to the owner, and reads the one kept
        const { error, status } = await client.from(TABLES.players).upsert(row("players", player), {
          onConflict: "organizer_id,id",
          ignoreDuplicates: true,
        });
        const kept = await one("players", player.id);
        if (kept) return kept;
        throw new StorageError(error?.message ?? `Record ${player.id} was not kept`, status);
      },
    },
    ledger: {
      listByGame: (gameId) => all("ledgerEvents", (query) => byTime(query.eq("game_id", gameId))),
      append: (event) => add("ledgerEvents", [event]),
      appendAll: (events) => add("ledgerEvents", events),
    },
    insuranceRules: saved("insuranceRules"),
    insuranceHands: {
      listByGame: (gameId) =>
        all("insuranceHands", (query) => oldestFirst(query.eq("game_id", gameId))),
      save: (hand) => save("insuranceHands", hand),
      remove: (id) => remove("insuranceHands", id),
    },
    gameConfigs: saved("gameConfigs"),
    oddsTables: saved("oddsTables"),
    chargeRules: saved("chargeRules"),
    gameSummaries,
    backup: {
      exportAll: async () => {
        const lists = await Promise.all(
          COLLECTIONS.map(async (collection) => [
            collection,
            await all(collection, (query) => query.order("id")),
          ]),
        );
        return Object.fromEntries(lists) as BackupData;
      },
      restore: async (data): Promise<RestoreResult> => {
        // Checked here first, so a backup that is not this space's writes nothing at all
        const books = Object.fromEntries(
          COLLECTIONS.map((collection) => [
            collection,
            data[collection].map((record) => row(collection, record).data),
          ]),
        );
        const {
          data: result,
          error,
          status,
        } = await client
          .rpc("restore_books", { space: organizerId, books })
          .single<RestoreResult>();
        if (error) throw new StorageError(error.message, status);
        return { added: result.added, skipped: result.skipped };
      },
    },
  };
}
