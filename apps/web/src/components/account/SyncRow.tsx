import { createContext, use, useEffect, useMemo, useState } from "react";
import { retrySending, useOnline, useSyncStatus } from "@/data";
import type { SyncStatus } from "@/data/sync";
import { localeTag, t } from "@/i18n";
import { cn } from "@/lib/cn";

/**
 * How an account's books on this device stand, as the interface tells it (ADR 0054): all sent;
 * sending, once a send has been under way a moment; offline; waiting between tries while online;
 * or not sent, once the account has turned the first change down.
 */
export type SyncState = "sent" | "sending" | "offline" | "waiting" | "refused";

export interface SyncView extends SyncStatus {
  readonly state: SyncState;
}

/** How long a send is under way before it says so, as opening the books does in `BooksGate` */
const MOMENT = 600;

/** The state the status is in, before any of it is held back */
function stateOf(status: SyncStatus, online: boolean): SyncState {
  if (status.pending === 0) return "sent";
  if (status.refused) return "refused";
  if (!online) return "offline";
  return status.sending ? "sending" : "waiting";
}

/**
 * The sync status in the states the interface shows, or nothing for a guest's books, worked out
 * once for the whole app by `AppShell`, which hands it on in `SyncViewContext`. A write is sent at
 * once, so a send is told only once it has been under way a moment: until then the state shown
 * before stays, whatever it was, and a send after every write, or a retry that goes through at
 * once, is never told. Every other state shows at once.
 */
export function useSyncViewSource(): SyncView | undefined {
  const status = useSyncStatus();
  const online = useOnline();
  const state = status && stateOf(status, online);
  // The state last shown that was not a send just begun
  const [before, setBefore] = useState<SyncState>();
  useEffect(() => {
    if (state !== "sending") {
      setBefore(state);
      return;
    }
    const timer = setTimeout(() => setBefore("sending"), MOMENT);
    return () => clearTimeout(timer);
  }, [state]);
  // Records wait meanwhile, where nothing was shown before them
  const shown = state === "sending" ? (before ?? "waiting") : state;
  // The same view until something in it changes, so what reads it is not drawn again for nothing
  return useMemo(() => status && shown && { ...status, state: shown }, [status, shown]);
}

/** The sync view `AppShell` works out, for every part of the app that tells it */
export const SyncViewContext = createContext<SyncView | undefined>(undefined);

/**
 * The sync status in the states the interface shows, or nothing for a guest's books. The dot on
 * 我的, the header on 我的, the 同步 row and the refusal alert all read this one, so they change
 * together and never disagree.
 */
export function useSyncView(): SyncView | undefined {
  return use(SyncViewContext);
}

/** The time of day, as 20:15 */
const TIME = new Intl.DateTimeFormat(localeTag, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** A moment as 11月28日 20:15, or 今天 20:15 where it is today and `today` is asked for. */
export function dayAndTime(at: number, today = false): string {
  const date = new Date(at);
  const now = new Date();
  const time = TIME.format(date);
  return today && date.toDateString() === now.toDateString()
    ? t.shell.sync.today(time)
    : t.shell.sync.day(date.getMonth() + 1, date.getDate(), time);
}

/** What the row says of a state, at its right */
function stateText({ state, pending }: SyncView): string {
  const text = t.me.sync;
  switch (state) {
    case "sent":
      return text.allSent;
    case "sending":
      return text.sending;
    case "offline":
      return text.offline(pending);
    case "waiting":
      return text.toSend(pending);
    case "refused":
      return text.notSent(pending);
  }
}

/**
 * The 同步 row of 我的's settings, signed in only: when the copy on this device was last read from
 * the account, how it stands, and one button that sends what waits and reads the account again.
 * Absolute times only, as a relative one would need a running clock (ADR 0001).
 */
export function SyncRow() {
  const view = useSyncView();
  // Its status is read from the device in a moment: the row keeps its place meanwhile
  if (!view) {
    return (
      <div className="flex min-h-12 items-center px-4">
        <p className="font-medium">{t.me.sync.title}</p>
      </div>
    );
  }

  const refused = view.state === "refused";
  return (
    <div className="flex items-start gap-3 px-4">
      {/* The state gives way under the label before the button shrinks, and starts under it; the
          button stays on the first line */}
      <div className="flex min-h-12 min-w-0 flex-1 flex-wrap content-center items-center gap-x-3 py-1">
        <div className="shrink-0 grow">
          <p className="font-medium">{t.me.sync.title}</p>
          {view.pulledAt !== undefined && (
            <p className="text-xs text-muted">
              {t.me.sync.lastSynced(dayAndTime(view.pulledAt, true))}
            </p>
          )}
        </div>
        <p
          role="status"
          className={cn(
            "text-sm tabular-nums transition-colors duration-200 ease-out",
            refused ? "text-highlight" : "text-muted",
          )}
        >
          {stateText(view)}
        </p>
      </div>
      {/* One button whatever the state, so focus stays on it as its words change */}
      <button
        type="button"
        disabled={view.state === "sending" || view.state === "offline"}
        onClick={retrySending}
        className="-mr-2 mt-0.5 min-h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-highlight disabled:opacity-60"
      >
        {refused ? t.common.retry : t.me.sync.syncNow}
      </button>
    </div>
  );
}
