import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { supabase } from "./supabase";

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

// The client reports the session it kept from last time first, then every sign-in and sign-out
supabase?.auth.onAuthStateChange((_event, current) => {
  const given = current ? givenName(current.user.user_metadata) : undefined;
  const next: Session = current
    ? {
        status: "signed-in",
        userId: current.user.id,
        email: current.user.email ?? "",
        ...(given !== undefined && { givenName: given }),
      }
    : { status: "signed-out" };
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

/**
 * An account's profile and space. Row-level security returns only its own. The books are opened
 * from the same answer the account card shows.
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
      if (profile.error) throw profile.error;
      if (space.error) throw space.error;
      if (!profile.data || !space.data) {
        // The session outlived its account, such as one deleted from another device: this
        // browser is signed out, and the app goes back to being a guest's
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("The account is gone");
      }
      return {
        displayName: profile.data.display_name,
        code: profile.data.code,
        spaceId: space.data.id,
        spaceName: space.data.name,
        agreed: profile.data.agreed_at !== null,
      };
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
