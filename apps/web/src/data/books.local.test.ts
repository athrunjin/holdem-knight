/**
 * The books in use as an account signs in and out, with the device's storage and the local
 * Supabase both real (`pnpm db:start`, then `pnpm test:local`).
 */
import "fake-indexeddb/auto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  booksState,
  currentOrganizerId,
  currentOwnerName,
  GUEST_ORGANIZER_ID,
  openAgreedBooks,
  repository,
} from ".";
import { agreeToTerms, signIn, signOut } from "./auth";
import { newPlayer } from "./players";

const admin = createClient(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const run = crypto.randomUUID().slice(0, 8);
const email = `books-${run}@example.com`;
const password = `first-${crypto.randomUUID()}`;
const made: string[] = [];

const names = async () => (await repository.players.list()).map(({ name }) => name);

/** The players the account's space holds, read past the app. */
async function inTheSpace(space: string) {
  const { data } = await admin.from("players").select("data").eq("organizer_id", space);
  return (data ?? []).map((row) => (row.data as { name: string }).name);
}

afterAll(async () => {
  for (const id of made) await admin.auth.admin.deleteUser(id);
});

describe("the books as an account signs in and out", () => {
  let space: string;

  it("are the device's before anyone signs in", async () => {
    await vi.waitFor(() => expect(currentOrganizerId()).toBe(GUEST_ORGANIZER_ID));
    await repository.players.save(newPlayer("游客老王"));

    expect(await names()).toEqual(["游客老王"]);
  });

  it("are the account's space once it signs in, and start empty", async () => {
    // As the app's sign-up makes one: agreed to the terms
    const { data } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "小林", terms_version: "0" },
    });
    const userId = data.user?.id;
    if (userId) made.push(userId);
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

describe("the books of an account that has not agreed to the terms", () => {
  const google = `google-${run}@example.com`;
  let userId = "";

  it("stay closed when it signs in, and the device's stay in use", async () => {
    // As Google or the dashboard makes one: a full name, and no version of the terms
    const { data } = await admin.auth.admin.createUser({
      email: google,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Lin Wei" },
    });
    userId = data.user?.id ?? "";
    made.push(userId);
    expect(await signIn(google, password)).toBeUndefined();

    await vi.waitFor(() => expect(booksState()).toEqual({ status: "agreeing", userId }), 10_000);
    expect(currentOrganizerId()).toBe(GUEST_ORGANIZER_ID);
    expect(await names()).toEqual(["游客老王"]);
  });

  it("open once it agrees, under the name it confirmed, which its own record takes", async () => {
    expect(await agreeToTerms("林伟")).toBeUndefined();
    await openAgreedBooks(userId);

    expect(booksState().status).toBe("open");
    const space = currentOrganizerId();
    const owned = await admin.from("organizers").select("owner_id, name").eq("id", space).single();
    expect(owned.data).toEqual({ owner_id: userId, name: "林伟" });
    expect(currentOwnerName()).toBe("林伟");
  });

  it("are the device's again at a sign-out", async () => {
    expect(await signOut()).toBeUndefined();
    await vi.waitFor(() => expect(currentOrganizerId()).toBe(GUEST_ORGANIZER_ID));
  });
});
