/**
 * The books in use as an account signs in and out, with the device's storage and the local
 * Supabase both real (`pnpm db:start`, then `pnpm test:local`).
 */
import "fake-indexeddb/auto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";

import { currentOrganizerId, GUEST_ORGANIZER_ID, repository } from ".";
import { signIn, signOut } from "./auth";
import { newPlayer } from "./players";

const admin = createClient(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `books-${crypto.randomUUID().slice(0, 8)}@example.com`;
const password = `first-${crypto.randomUUID()}`;
let userId: string | undefined;

const names = async () => (await repository.players.list()).map(({ name }) => name);

/** The players the account's space holds, read past the app. */
async function inTheSpace(space: string) {
  const { data } = await admin.from("players").select("data").eq("organizer_id", space);
  return (data ?? []).map((row) => (row.data as { name: string }).name);
}

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("the books as an account signs in and out", () => {
  let space: string;

  it("are the device's before anyone signs in", async () => {
    await vi.waitFor(() => expect(currentOrganizerId()).toBe(GUEST_ORGANIZER_ID));
    await repository.players.save(newPlayer("游客老王"));

    expect(await names()).toEqual(["游客老王"]);
  });

  it("are the account's space once it signs in, and start empty", async () => {
    const { data } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "小林" },
    });
    userId = data.user?.id;
    expect(await signIn(email, password)).toBeUndefined();

    await vi.waitFor(() => expect(currentOrganizerId()).not.toBe(GUEST_ORGANIZER_ID), 10_000);
    space = currentOrganizerId();
    const owned = await admin.from("organizers").select("owner_id").eq("id", space).single();
    expect(owned.data?.owner_id).toBe(userId);
    expect(await names()).toEqual([]);
  });

  it("take what is recorded while signed in to the account, under its space", async () => {
    const player = newPlayer("账户小陈");
    expect(player.organizerId).toBe(space);
    await repository.players.save(player);

    expect(await names()).toEqual(["账户小陈"]);
    expect(await inTheSpace(space)).toEqual(["账户小陈"]);
  });

  it("are the device's again at a sign-out, as they were left", async () => {
    expect(await signOut()).toBeUndefined();

    await vi.waitFor(() => expect(currentOrganizerId()).toBe(GUEST_ORGANIZER_ID));
    expect(await names()).toEqual(["游客老王"]);
    expect(await inTheSpace(space)).toEqual(["账户小陈"]);
  });
});
