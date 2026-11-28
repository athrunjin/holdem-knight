import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { type StoredUser, storedUser, supabase } from "./supabase";
import { StorageError } from "./supabase-repository";
import { classify } from "./sync";

/** Who is using the app: no one can sign in here, not known yet, a guest, or an account. */
export type Session =
  | { readonly status: "unavailable" }
  | { readonly status: "loading" }
  | { readonly status: "signed-out" }
  | {
      readonly status: "signed-in";
      readonly userId: string;
      readonly email: string;
      /** The name Google gave the account, where it was made through Google */
      readonly givenName?: string;
    };

/** The name an account arrived with from Google: its full name, or else its name. */
function givenName(metadata: Record<string, unknown> | undefined): string | undefined {
  for (const key of ["full_name", "name"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

let session: Session = supabase ? { status: "loading" } : { status: "unavailable" };
const listeners = new Set<() => void>();

function signedIn(user: StoredUser): Session {
  const given = givenName(user.user_metadata);
  return {
    status: "signed-in",
    userId: user.id,
    email: user.email ?? "",
    ...(given !== undefined && { givenName: given }),
  };
}

// The client reports the session it kept from last time first, then every sign-in and sign-out.
// With no network and its token run out, it reports none while it keeps the session to renew
// once it can: the account stays signed in, as the one kept in storage (ADR 0054)
supabase?.auth.onAuthStateChange((_event, current) => {
  const user = current?.user ?? storedUser();
  const next: Session = user ? signedIn(user) : { status: "signed-out" };
  // One object for as long as nothing changes, so nothing renders again for a renewed token
  if (JSON.stringify(next) === JSON.stringify(session)) return;
  session = next;
  for (const listener of listeners) listener();
});

/** Calls back at every sign-in and sign-out, and once what was kept from last time is read. */
export function onSessionChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const currentSession = (): Session => session;

export function useSession(): Session {
  return useSyncExternalStore(onSessionChange, currentSession);
}

/**
 * What an account shows of itself: its name, its code, and the name of its space (ADR 0040), and
 * whether it has agreed to the terms, without which its books are not opened (ADR 0052).
 */
export interface Account {
  readonly displayName: string;
  readonly code: string;
  readonly spaceId: string;
  readonly spaceName: string;
  readonly agreed: boolean;
}

export const accountKey = (userId: string) => ["account", userId] as const;

const keptKey = (userId: string) => `holdem-account.${userId}`;

/**
 * What this device last read of an account, so its books open with no network once they have
 * been opened here (ADR 0054). Kept in this browser beside the session.
 */
export function keptAccount(userId: string): Account | undefined {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(keptKey(userId)) ?? "null");
    if (typeof kept !== "object" || kept === null) return undefined;
    const { displayName, code, spaceId, spaceName, agreed } = kept as Record<string, unknown>;
    if (typeof spaceId !== "string" || typeof spaceName !== "string") return undefined;
    return {
      displayName: typeof displayName === "string" ? displayName : spaceName,
      code: typeof code === "string" ? code : "",
      spaceId,
      spaceName,
      agreed: agreed === true,
    };
  } catch {
    return undefined;
  }
}

function keepAccount(userId: string, account: Account) {
  try {
    localStorage.setItem(keptKey(userId), JSON.stringify(account));
  } catch {
    // Without storage the books open only with a network, as before
  }
}

/** Forgets what was read of an account, as its books on the device go at a sign-out. */
export function forgetAccount(userId: string) {
  try {
    localStorage.removeItem(keptKey(userId));
  } catch {
    // Nothing was kept
  }
}

/**
 * An account's profile and space. Row-level security returns only its own. The books are opened
 * from the same answer the account card shows. With no answer, or one that says nothing of the
 * account (a server's error, a session not renewed yet), what was read last time on this device
 * stands in; only an answer that the account is not there signs this browser out.
 */
export const accountQuery = (userId: string) =>
  queryOptions({
    queryKey: accountKey(userId),
    queryFn: async (): Promise<Account> => {
      if (!supabase) throw new Error("Not signed in");
      const [profile, space] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, code, agreed_at")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("organizers").select("id, name").eq("owner_id", userId).maybeSingle(),
      ]);
      const failed = profile.error
        ? new StorageError(profile.error.message, profile.status)
        : space.error
          ? new StorageError(space.error.message, space.status)
          : undefined;
      if (failed) {
        const kept = keptAccount(userId);
        if (kept && classify(failed) !== "refused") return kept;
        throw failed;
      }
      if (!profile.data || !space.data) {
        // The session outlived its account, such as one deleted from another device: this
        // browser is signed out, and the app goes back to being a guest's
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("The account is gone");
      }
      const account: Account = {
        displayName: profile.data.display_name,
        code: profile.data.code,
        spaceId: space.data.id,
        spaceName: space.data.name,
        agreed: profile.data.agreed_at !== null,
      };
      keepAccount(userId, account);
      return account;
    },
  });

/** The signed-in account's profile and space. */
export function useAccount(userId: string | undefined) {
  return useQuery({
    ...accountQuery(userId ?? ""),
    enabled: supabase !== null && userId !== undefined,
  });
}

/** Changes the name the account shows. */
export function useRenameAccount(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      if (!supabase) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKey(userId) }),
  });
}
