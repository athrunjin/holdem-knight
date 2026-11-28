import type { Repository } from "@holdem-knight/core";
import { describe, expect, it, vi } from "vitest";
import { createBooks, type Reader, type Store, UnreachableError } from "./books";
import type { Sync } from "./sync";

const store = (key: string, mode: Store["mode"]): Store => ({
  key,
  mode,
  organizerId: key,
  organizerName: key,
  // Never read here: the books only hand a repository on
  repository: {} as Repository,
});

const guest = store("guest", "guest");

/** Books with a reader the test moves, and accounts that open when the test says so. */
function setUp(first: Reader = { status: "loading" }) {
  let reader = first;
  const opening = new Map<
    string,
    { resolve(store: Store | "agreeing"): void; reject(): void; fail(error: Error): void }
  >();
  const onSwitch = vi.fn();
  const books = createBooks({
    guest,
    reader: () => reader,
    openAccount: (userId) =>
      new Promise<Store | "agreeing">((resolve, reject) => {
        opening.set(userId, {
          resolve,
          reject: () => reject(new Error("offline")),
          fail: reject,
        });
      }),
    onSwitch,
  });
  const states: string[] = [];
  books.subscribe(() => states.push(books.state().status));

  return {
    books,
    onSwitch,
    states,
    /** Changes who is using the app, as a sign-in or a sign-out does. */
    become(next: Reader) {
      reader = next;
      return books.follow();
    },
    /** Lets the account's books be found, or not. */
    async answer(userId: string, found: Store | "agreeing" | "offline" | Error) {
      const waiting = opening.get(userId);
      if (!waiting) throw new Error(`Nothing asked for ${userId}`);
      if (found === "offline") waiting.reject();
      else if (found instanceof Error) waiting.fail(found);
      else waiting.resolve(found);
      // The books go on after the answer
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

const lin = { status: "account", userId: "lin" } as const;
const linBooks = store("account:lin-space", "account");

describe("the books in use", () => {
  it("are not open until it is known who is using the app", () => {
    const { books } = setUp();
    void books.follow();

    expect(books.state()).toEqual({ status: "opening" });
  });

  it("are the device's for a guest, with nothing to clear", async () => {
    const { books, onSwitch, become } = setUp();
    await become({ status: "guest" });

    expect(books.state()).toEqual({ status: "open", key: "guest", mode: "guest" });
    expect(books.current()).toBe(guest);
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("become the account's once its space is found, and what was read is let go", async () => {
    const { books, onSwitch, become, answer } = setUp({ status: "guest" });
    await books.follow();

    void become(lin);
    expect(books.state()).toEqual({ status: "opening" });
    await answer("lin", linBooks);

    expect(books.state()).toEqual({ status: "open", key: "account:lin-space", mode: "account" });
    expect(books.current()).toBe(linBooks);
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it("go back to the device's at a sign-out", async () => {
    const { books, onSwitch, become, answer } = setUp();
    void become(lin);
    await answer("lin", linBooks);
    await become({ status: "guest" });

    expect(books.current()).toBe(guest);
    expect(books.state()).toEqual({ status: "open", key: "guest", mode: "guest" });
    expect(onSwitch).toHaveBeenCalledTimes(2);
  });

  it("stay open when the same account is reported again", async () => {
    const { books, onSwitch, states, become, answer } = setUp();
    void become(lin);
    await answer("lin", linBooks);
    states.length = 0;
    await become(lin);

    expect(books.state().status).toBe("open");
    expect(states).toEqual([]);
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it("say so when the account's books cannot be reached, and never show the device's instead", async () => {
    const { books, onSwitch, become, answer } = setUp();
    void become(lin);
    await answer("lin", "offline");

    expect(books.state()).toEqual({ status: "unreachable", reason: "first-open" });
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("say why they cannot be reached, as the opening tells it", async () => {
    const { books, become, answer } = setUp();
    void become(lin);
    await answer("lin", new UnreachableError("refused"));
    expect(books.state()).toEqual({ status: "unreachable", reason: "refused" });

    void books.follow();
    await answer("lin", new UnreachableError("first-open"));
    expect(books.state()).toEqual({ status: "unreachable", reason: "first-open" });
  });

  it("open at another try", async () => {
    const { books, become, answer } = setUp();
    void become(lin);
    await answer("lin", "offline");

    void books.follow();
    expect(books.state()).toEqual({ status: "opening" });
    await answer("lin", linBooks);

    expect(books.current()).toBe(linBooks);
    expect(books.state().status).toBe("open");
  });

  it("let go of an account's books that arrive after it signed out", async () => {
    const { books, onSwitch, become, answer } = setUp();
    void become(lin);
    await become({ status: "guest" });
    await answer("lin", linBooks);

    expect(books.current()).toBe(guest);
    expect(books.state()).toEqual({ status: "open", key: "guest", mode: "guest" });
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("do not report a failure that arrives after a sign-out", async () => {
    const { books, become, answer } = setUp();
    void become(lin);
    await become({ status: "guest" });
    await answer("lin", "offline");

    expect(books.state().status).toBe("open");
  });

  it("stay closed for an account that has not agreed to the terms, and nothing is let go", async () => {
    const { books, onSwitch, become, answer } = setUp({ status: "guest" });
    await books.follow();
    void become(lin);
    await answer("lin", "agreeing");

    expect(books.state()).toEqual({ status: "agreeing", userId: "lin" });
    expect(books.current()).toBe(guest);
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("open once the account has agreed and is followed again, with its step kept until then", async () => {
    const { books, onSwitch, states, become, answer } = setUp();
    void become(lin);
    await answer("lin", "agreeing");
    states.length = 0;

    void books.follow();
    expect(books.state()).toEqual({ status: "agreeing", userId: "lin" });
    await answer("lin", linBooks);

    expect(states).toEqual(["open"]);
    expect(books.current()).toBe(linBooks);
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it("stay closed while the account has still not agreed when followed again", async () => {
    const { books, become, answer } = setUp();
    void become(lin);
    await answer("lin", "agreeing");
    void books.follow();
    await answer("lin", "agreeing");

    expect(books.state()).toEqual({ status: "agreeing", userId: "lin" });
    expect(books.current()).toBe(guest);
  });

  it("go back to the device's when the account signs out from its step", async () => {
    const { books, onSwitch, become, answer } = setUp();
    void become(lin);
    await answer("lin", "agreeing");
    await become({ status: "guest" });

    expect(books.state()).toEqual({ status: "open", key: "guest", mode: "guest" });
    expect(books.current()).toBe(guest);
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("leave another account's books when an account that has not agreed signs in after it", async () => {
    const { books, onSwitch, become, answer } = setUp();
    void become(lin);
    await answer("lin", linBooks);
    expect(books.current()).toBe(linBooks);

    const wang = { status: "account", userId: "wang" } as const;
    const wangBooks = store("account:wang-space", "account");
    void become(wang);
    await answer("wang", "agreeing");

    expect(books.state()).toEqual({ status: "agreeing", userId: "wang" });
    expect(books.current()).toBe(guest);
    expect(onSwitch).toHaveBeenCalledTimes(2);

    void books.follow();
    await answer("wang", wangBooks);

    expect(books.state()).toEqual({ status: "open", key: "account:wang-space", mode: "account" });
    expect(books.current()).toBe(wangBooks);
    expect(onSwitch).toHaveBeenCalledTimes(3);
  });

  it("send an account's books from the device only while they are the ones in use", async () => {
    const { become, answer } = setUp();
    const sender = { start: vi.fn(), stop: vi.fn() };
    const sending = { ...linBooks, sync: sender as unknown as Sync };
    void become(lin);
    await answer("lin", sending);
    expect(sender.start).toHaveBeenCalledTimes(1);
    expect(sender.stop).not.toHaveBeenCalled();

    await become({ status: "guest" });
    expect(sender.stop).toHaveBeenCalledTimes(1);
  });

  it("stop sending one account's books before another account's open", async () => {
    const { become, answer } = setUp();
    const sender = { start: vi.fn(), stop: vi.fn() };
    void become(lin);
    await answer("lin", { ...linBooks, sync: sender as unknown as Sync });

    void become({ status: "account", userId: "wang" });
    // Stopped while wang's books are still being opened, not once they are
    expect(sender.stop).toHaveBeenCalledTimes(1);
  });
});
