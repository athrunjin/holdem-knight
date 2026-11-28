/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "sb-127-auth-token";

/** The module as built for the local project, with no key, so no client is made. */
async function load() {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  return import("./supabase");
}

const kept = (session: Record<string, unknown>) =>
  localStorage.setItem(KEY, JSON.stringify(session));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllEnvs());

describe("the session kept in this browser", () => {
  it("is read under the client's own key", async () => {
    const { AUTH_STORAGE_KEY } = await load();
    expect(AUTH_STORAGE_KEY).toBe(KEY);
  });

  it("names the account it is for, while it can be renewed", async () => {
    const { storedUser } = await load();
    expect(storedUser()).toBeUndefined();

    const user = { id: "user-1", email: "lin@example.com", user_metadata: { name: "Lin" } };
    kept({ access_token: "a", refresh_token: "r", expires_at: 1, user });
    expect(storedUser()).toEqual(user);

    kept({ access_token: "a", refresh_token: "", user });
    expect(storedUser()).toBeUndefined();
    kept({ access_token: "a", refresh_token: "r", user: { id: "" } });
    expect(storedUser()).toBeUndefined();
    localStorage.setItem(KEY, "{not json");
    expect(storedUser()).toBeUndefined();
  });

  it("says when its token has run out", async () => {
    const { storedSessionRunOut } = await load();
    const user = { id: "user-1" };
    const now = Date.UTC(2026, 10, 28, 12);
    expect(storedSessionRunOut(now)).toBe(false);

    kept({ refresh_token: "r", expires_at: now / 1000 - 1, user });
    expect(storedSessionRunOut(now)).toBe(true);
    kept({ refresh_token: "r", expires_at: now / 1000 + 3600, user });
    expect(storedSessionRunOut(now)).toBe(false);
    kept({ refresh_token: "r", user });
    expect(storedSessionRunOut(now)).toBe(false);
  });
});
