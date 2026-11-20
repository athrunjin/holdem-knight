/**
 * A database for tests: Postgres in this process (PGlite), with what a Supabase project already
 * has before any migration runs, then every migration in `supabase/migrations`, oldest first.
 * No Docker, so the row-level security is tested wherever the unit tests run.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = join(import.meta.dirname, "../supabase/migrations");

/**
 * The parts of a Supabase project the migrations build on: its roles, and the `auth` schema with
 * the users and the signed-in account's ID, read from the request as Supabase's own `auth.uid()`
 * reads it.
 */
const SUPABASE_BASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`;

export type TestDatabase = PGlite;

export async function createTestDatabase(): Promise<TestDatabase> {
  const db = new PGlite();
  await db.exec(SUPABASE_BASE);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (file.endsWith(".sql")) await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  return db;
}

export interface TestAccount {
  readonly id: string;
  /** The host space made for the account when it signed up */
  readonly space: string;
}

/** Signs an account up, as Supabase Auth does by adding a user, and finds the space it was given. */
export async function signUp(
  db: TestDatabase,
  email: string,
  displayName?: string,
): Promise<TestAccount> {
  const meta = JSON.stringify(displayName === undefined ? {} : { display_name: displayName });
  const user = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, meta],
  );
  const id = user.rows[0]?.id;
  if (!id) throw new Error("No user was made");
  const space = await db.query<{ id: string }>(
    "select id from public.organizers where owner_id = $1",
    [id],
  );
  const spaceId = space.rows[0]?.id;
  if (!spaceId) throw new Error("No space was made for the user");
  return { id, space: spaceId };
}

/**
 * Runs `work` as a request from a signed-in account would run: with the `authenticated` role and
 * the account's ID in the request's claims. With no account, as a visitor who has not signed in.
 */
export async function asAccount<T>(
  db: TestDatabase,
  account: Pick<TestAccount, "id"> | null,
  work: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify(account ? { sub: account.id, role: "authenticated" } : {});
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(`set role ${account ? "authenticated" : "anon"}`);
  try {
    return await work();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}

/** A record as the app keeps it, with the columns the tables take beside it. */
export function row(space: string, id: string, data: Record<string, unknown> = {}) {
  return { organizer_id: space, id, data: JSON.stringify({ id, organizerId: space, ...data }) };
}
