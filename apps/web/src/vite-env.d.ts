/// <reference types="vite/client" />

/** Version injected at build time (see vite.config.ts) */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Where the Supabase project is. Missing where there is none, and the app then runs as a guest only. */
  readonly VITE_SUPABASE_URL?: string;
  /** The project's public key: row-level security decides what it may read and write. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
