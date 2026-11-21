import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * The Supabase project the app was built for, or null where none is set: the app then runs as a
 * guest only (ADR 0005). The address comes from configuration, never from the code (ADR 0003).
 * The session is kept in this browser and renewed by the client, so an account stays signed in.
 *
 * A request to the books that fails is not tried again by the client: what reads them tries
 * twice more itself, and a write says at once that nothing was saved. Counting both, a page with
 * no network would wait most of half a minute before saying so. One that gets no answer is given
 * up after 20 seconds (ADR 0046).
 */
export const supabase: SupabaseClient | null =
  url && publicKey ? createClient(url, publicKey, { db: { retry: false, timeout: 20_000 } }) : null;
