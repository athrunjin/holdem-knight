import { useEffect, useRef, useState } from "react";
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

/** Whether something has held for a moment. One that does not last that long is never told. */
function useLasted(holds: boolean): boolean {
  const [lasted, setLasted] = useState(false);
  useEffect(() => {
    if (!holds) {
      setLasted(false);
      return;
    }
    const timer = setTimeout(() => setLasted(true), MOMENT);
    return () => clearTimeout(timer);
  }, [holds]);
  return holds && lasted;
}

/**
 * The sync status in the states the interface shows, or nothing for a guest's books. The dot on
 * 我的, the header on 我的 and the 同步 row all read it, so they never disagree. A write is sent
 * at once, so for a moment after records start to wait, and after a send starts, the state shown
 * before stays: a send after every write is not told.
 */
export function useSyncView(): SyncView | undefined {
  const status = useSyncStatus();
  const online = useOnline();
  const waited = useLasted((status?.pending ?? 0) > 0);
  const sent = useLasted(status?.sending ?? false);
  const shown = useRef<SyncState>(undefined);
  if (!status) return undefined;

  // What was shown while the device was offline, or turned down, is not held once it is not
  const held =
    shown.current === "offline" || shown.current === "refused" ? undefined : shown.current;
  let state: SyncState;
  if (status.pending === 0) state = "sent";
  else if (status.refused) state = "refused";
  else if (!online) state = "offline";
  else if (held && (!waited || (status.sending && !sent))) state = held;
  else state = status.sending ? "sending" : "waiting";
  shown.current = state;
  return { ...status, state };
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
    <div className="flex min-h-12 items-center gap-3 px-4">
      {/* The state gives way under the label's line before the button shrinks */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 py-1">
        <div className="shrink-0">
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
            "ml-auto text-sm tabular-nums transition-colors duration-200 ease-out",
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
        className="-mr-2 min-h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-highlight disabled:opacity-60"
      >
        {refused ? t.common.retry : t.me.sync.syncNow}
      </button>
    </div>
  );
}
