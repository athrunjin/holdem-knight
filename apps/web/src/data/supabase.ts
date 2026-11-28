import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Where the client keeps the session in this browser: the key it uses unless told otherwise, so
 * a session kept before is found where it was. Named here so the app can read it with no network
 * (ADR 0054).
 */
export const AUTH_STORAGE_KEY = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";

/**
 * The Supabase project the app was built for, or null where none is set: the app then runs as a
 * guest only (ADR 0005). The address comes from configuration, never from the code (ADR 0003).
 * The session is kept in this browser and renewed by the client, so an account stays signed in.
 *
 * A request that fails is not tried again by the client: the device sends what is waiting again
 * itself, and a read of the account tries twice more. One that gets no answer is given up after
 * 20 seconds (ADR 0046, ADR 0054).
 */
export const supabase: SupabaseClient | null =
  url && publicKey
    ? createClient(url, publicKey, {
        auth: { storageKey: AUTH_STORAGE_KEY },
        db: { retry: false, timeout: 20_000 },
      })
    : null;

/** The account a session kept in this browser is for, as the client stored it. */
export interface StoredUser {
  readonly id: string;
  readonly email?: string;
  readonly user_metadata?: Record<string, unknown>;
}

/**
 * The account of the session kept in this browser, read from storage and not from the client.
 * With no network and its token run out, the client reports no session while it keeps the one it
 * has, to renew once it can; signing out, or a renewal the service refuses, removes it.
 */
export function storedUser(): StoredUser | undefined {
  if (!AUTH_STORAGE_KEY) return undefined;
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    if (typeof kept !== "object" || kept === null) return undefined;
    const { user, refresh_token: refresh } = kept as { user?: unknown; refresh_token?: unknown };
    if (typeof refresh !== "string" || refresh === "") return undefined;
    if (typeof user !== "object" || user === null) return undefined;
    const { id } = user as { id?: unknown };
    return typeof id === "string" && id !== "" ? (user as StoredUser) : undefined;
  } catch {
    return undefined;
  }
}
