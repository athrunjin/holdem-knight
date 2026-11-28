/** @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The account's two rows as the project answers for them, which each test sets. */
const answers = vi.hoisted(() => ({
  profiles: { data: null as unknown, error: null as unknown, status: 200 },
  organizers: { data: null as unknown, error: null as unknown, status: 200 },
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: "profiles" | "organizers") => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => answers[table] }) }),
    }),
    auth: { onAuthStateChange: () => {}, signOut: answers.signOut },
  },
  storedUser: () => undefined,
  storedSessionRunOut: () => false,
}));

const { accountQuery, forgetAccount, keptAccount } = await import("./session");

const USER = "user-1";
const read = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(accountQuery(USER));

const found = () => {
  answers.profiles = {
    data: { display_name: "小林", code: "AB12CD34", agreed_at: "2026-11-28T00:00:00Z" },
    error: null,
    status: 200,
  };
  answers.organizers = { data: { id: "space-1", name: "小林" }, error: null, status: 200 };
};

const failing = (status: number) => {
  answers.profiles = { data: null, error: { message: "failed" }, status };
};

const account = {
  displayName: "小林",
  code: "AB12CD34",
  spaceId: "space-1",
  spaceName: "小林",
  agreed: true,
};

beforeEach(() => {
  localStorage.clear();
  answers.signOut.mockClear();
  answers.profiles = { data: null, error: null, status: 200 };
  answers.organizers = { data: null, error: null, status: 200 };
});

describe("what the device keeps of an account", () => {
  it("is what was read of it last, kept per account, and forgotten at a sign-out", async () => {
    expect(keptAccount(USER)).toBeUndefined();
    found();
    expect(await read()).toEqual(account);

    expect(keptAccount(USER)).toEqual(account);
    expect(keptAccount("someone-else")).toBeUndefined();
    forgetAccount(USER);
    expect(keptAccount(USER)).toBeUndefined();
  });

  it("is nothing where what was kept cannot be read", () => {
    localStorage.setItem(`holdem-account.${USER}`, "{not json");
    expect(keptAccount(USER)).toBeUndefined();
    localStorage.setItem(`holdem-account.${USER}`, JSON.stringify({ spaceName: "小林" }));
    expect(keptAccount(USER)).toBeUndefined();
  });
});

describe("reading an account", () => {
  it("opens from what was kept where no answer came, or one that says nothing of it", async () => {
    found();
    await read();
    for (const status of [0, 401, 408, 429, 500, 503]) {
      failing(status);
      expect(await read()).toEqual(account);
    }
    expect(answers.signOut).not.toHaveBeenCalled();
  });

  it("fails as before for an account never read on this device", async () => {
    failing(0);
    await expect(read()).rejects.toThrow();
  });

  it("fails as before where the project turned the read down", async () => {
    found();
    await read();
    failing(403);
    await expect(read()).rejects.toThrow();
  });

  it("signs this browser out only where the project answered that the account is gone", async () => {
    found();
    await read();
    answers.profiles = { data: null, error: null, status: 200 };

    await expect(read()).rejects.toThrow(/gone/);
    expect(answers.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
