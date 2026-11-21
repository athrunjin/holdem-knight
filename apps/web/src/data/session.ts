import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { supabase } from "./supabase";

/** Who is using the app: no one can sign in here, not known yet, a guest, or an account. */
export type Session =
  | { readonly status: "unavailable" }
  | { readonly status: "loading" }
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly userId: string; readonly email: string };

let session: Session = supabase ? { status: "loading" } : { status: "unavailable" };
const listeners = new Set<() => void>();

// The client reports the session it kept from last time first, then every sign-in and sign-out
supabase?.auth.onAuthStateChange((_event, current) => {
  const next: Session = current
    ? { status: "signed-in", userId: current.user.id, email: current.user.email ?? "" }
    : { status: "signed-out" };
  // One object for as long as nothing changes, so nothing renders again for a renewed token
  if (JSON.stringify(next) === JSON.stringify(session)) return;
  session = next;
  for (const listener of listeners) listener();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, () => session);
}

/** What an account shows of itself: its name, its code, and the name of its space (ADR 0040). */
export interface Account {
  readonly displayName: string;
  readonly code: string;
  readonly spaceId: string;
  readonly spaceName: string;
}

const accountKey = (userId: string) => ["account", userId] as const;

/** The signed-in account's profile and space. Row-level security returns only its own. */
export function useAccount(userId: string | undefined) {
  return useQuery({
    queryKey: accountKey(userId ?? ""),
    enabled: supabase !== null && userId !== undefined,
    queryFn: async (): Promise<Account> => {
      if (!supabase || !userId) throw new Error("Not signed in");
      const [profile, space] = await Promise.all([
        supabase.from("profiles").select("display_name, code").eq("id", userId).maybeSingle(),
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
      };
    },
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
