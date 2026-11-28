import type { OrganizerId } from "@holdem-knight/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Change } from "./account-database";
import { createSupabaseRepository } from "./supabase-repository";
import type { Remote } from "./sync";

/**
 * A space in Supabase as the device sends to it and reads it (ADR 0054). Every change can be sent
 * again with nothing doubled: a save replaces the record under its ID, the own record is made
 * only if missing, ledger events already there are left as they are, and a delete of what is
 * gone deletes nothing.
 */
export function createSupabaseRemote(client: SupabaseClient, space: OrganizerId): Remote {
  const account = createSupabaseRepository(client, space);

  async function send(change: Change): Promise<void> {
    switch (change.kind) {
      case "append":
        return account.ledger.appendMissing(change.events);
      case "ensure":
        // Never replaces the one the account has, which another device may have made first
        await account.players.ensure(change.record);
        return;
      case "remove":
        return account[change.list].remove(change.id);
      case "save":
        switch (change.list) {
          case "games":
            return account.games.save(change.record);
          case "players":
            return account.players.save(change.record);
          case "insuranceHands":
            return account.insuranceHands.save(change.record);
          case "insuranceRules":
            return account.insuranceRules.save(change.record);
          case "gameConfigs":
            return account.gameConfigs.save(change.record);
          case "oddsTables":
            return account.oddsTables.save(change.record);
          case "chargeRules":
            return account.chargeRules.save(change.record);
          case "gameSummaries":
            return account.gameSummaries.save(change.record);
        }
    }
  }

  return {
    send,
    async pull() {
      const [books, summaries] = await Promise.all([
        account.backup.exportAll(),
        account.gameSummaries.list(),
      ]);
      return { books, summaries };
    },
    restore: (data) => account.backup.restore(data),
  };
}
