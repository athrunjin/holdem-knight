import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * The Supabase project the app was built for, or null where none is set: the app then runs as a
 * guest only (ADR 0005). The address comes from configuration, never from the code (ADR 0003).
 * The session is kept in this browser and renewed by the client, so an account stays signed in.
 */
export const supabase: SupabaseClient | null =
  url && publicKey ? createClient(url, publicKey) : null;
