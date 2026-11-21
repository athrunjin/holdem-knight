import { useQueryClient } from "@tanstack/react-query";
import { Fragment, type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { Page } from "@/components/Page";
import { retryBooks, useBooks } from "@/data";
import { signOut } from "@/data/auth";
import { useMessages } from "@/i18n";

const buttonClass = "min-h-12 rounded-xl px-4 font-medium disabled:opacity-60";

/** Shown while the books are being opened. It says so only if that takes more than a moment. */
function Opening() {
  const m = useMessages();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div aria-busy className="grid min-h-[50dvh] place-items-center px-4">
      {slow && (
        <p role="status" className="text-sm text-muted">
          {m.shell.books.opening}
        </p>
      )}
    </div>
  );
}

/**
 * An account is signed in and its books cannot be read, as with no network. The guest's books on
 * this device are not shown in their place: what is recorded would go where the account never
 * sees it. Signing out is the way to them.
 */
function Unreachable() {
  const m = useMessages();
  const [leaving, setLeaving] = useState(false);

  return (
    <Page title={m.shell.books.unreachableTitle} centered>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-medium">{m.shell.books.unreachableHeading}</p>
        <p className="mt-1 text-sm text-muted">{m.shell.books.unreachableBody}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              await signOut();
              setLeaving(false);
            }}
            className={`${buttonClass} border border-line`}
          >
            {m.common.signOut}
          </button>
          <button
            type="button"
            onClick={retryBooks}
            className={`${buttonClass} bg-accent font-semibold text-accent-text`}
          >
            {m.common.retry}
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">{m.shell.books.unreachableNote}</p>
      </section>
    </Page>
  );
}

/**
 * Says so when something on the page could not be read, with a way to try again. A list that
 * failed to load would otherwise look the same as an empty one.
 */
function ReadFailure({ account }: { account: boolean }) {
  const m = useMessages();
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  // The account card says for itself when the account cannot be read
  const failed = (query: { queryKey: readonly unknown[]; state: { status: string } }) =>
    query.state.status === "error" && query.queryKey[0] !== "account";
  const failing = useSyncExternalStore(
    (listener) => cache.subscribe(listener),
    () => cache.findAll({ type: "active", predicate: failed }).length > 0,
  );

  if (!failing) return null;

  return (
    <div
      role="alert"
      className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-3xl items-center gap-3 rounded-xl border border-line bg-surface py-1 pr-1 pl-4 text-sm"
    >
      <p className="min-w-0 flex-1 py-2 text-highlight">
        {account ? m.shell.books.readFailedAccount : m.shell.books.readFailedGuest}
      </p>
      <button
        type="button"
        onClick={() => queryClient.refetchQueries({ type: "active", predicate: failed })}
        className="min-h-11 shrink-0 rounded-lg px-3 font-medium"
      >
        {m.common.retry}
      </button>
    </div>
  );
}

/**
 * Shows the pages once there are books to read: at once for a guest, and after the account's
 * space is found for someone signed in. When the books change hands at a sign-in or a sign-out,
 * every page starts over, so nothing that was read from one set shows for the other (ADR 0046).
 */
export function BooksGate({ children }: { children: ReactNode }) {
  const books = useBooks();

  if (books.status === "opening") return <Opening />;
  if (books.status === "unreachable") return <Unreachable />;
  return (
    <Fragment key={books.key}>
      <ReadFailure account={books.mode === "account"} />
      {children}
    </Fragment>
  );
}
