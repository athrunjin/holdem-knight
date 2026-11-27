import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Fold } from "@/components/transfers/TransferRows";
import {
  failureOf,
  type GuestHoldings,
  type ImportResult,
  useBringGuestBooks,
  useGuestOffer,
} from "@/data/guest-import";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";

const cardClass = "rounded-2xl border border-line bg-surface";
const buttonClass = "min-h-11 rounded-xl px-2 text-sm font-medium disabled:opacity-60";

/**
 * The offers the card has played in for since the app was opened: one already shown is there at
 * once when 我的 is come back to, from a game or a tab, as it was left.
 */
const appeared = new Set<string>();

/** A line of what will be brought: the kind muted at the left, the count at the right. */
function CountRow({ name, count }: { name: string; count: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <dt className="text-muted">{name}</dt>
      <dd className="font-medium tabular-nums">{count}</dd>
    </div>
  );
}

/**
 * On 我的, signed in, while this device's guest books hold something the account has not been
 * given (ADR 0053): how many games they hold, and a way to bring them in. Tapped, what will be
 * brought opens under it, with the buttons to go on or not, as ticked transfers' do; once
 * brought, that closes back up as what came of it opens in its place, and stays until the page
 * is left. The card is not offered again for these records.
 */
export function GuestImportCard() {
  const text = t.me.guestImport;
  const { data: offer } = useGuestOffer();
  const bring = useBringGuestBooks();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<ImportResult>();
  // What was offered at the tap: the books read again while it runs, the card keeps to it
  const [started, setStarted] = useState<GuestHoldings>();
  // Set at the tap itself, so a second tap in the same moment finds one already running
  const running = useRef(false);
  // Whether the organizer has opened, closed or brought anything yet: only then does focus move
  const acted = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const details = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);

  // Focus goes where the card now is: into what opened, back to the button that opened it, or
  // to what came of it
  useEffect(() => {
    if (!acted.current) return;
    const target = done ? result.current : open ? details.current : openButton.current;
    target?.focus({ preventScroll: true });
  }, [open, done]);

  const holdings = done?.holdings ?? offer?.holdings ?? started;
  const key = offer?.fingerprint;
  // Played in on the first arrival of an offer only, settled when the offer is first seen here
  const settled = useRef<{ key: string; plays: boolean }>(undefined);
  if (key !== undefined && settled.current?.key !== key) {
    settled.current = { key, plays: !appeared.has(key) };
  }
  const plays = settled.current?.plays ?? false;
  useEffect(() => {
    if (key !== undefined) appeared.add(key);
  }, [key]);

  // Nothing while the device's books are read, and nothing when there is nothing to bring
  if (!holdings) return null;

  const { games, players, settings } = holdings;
  const working = bring.isPending;
  const asked = open && !done;

  return (
    <section
      className={cn(cardClass, "mt-3", plays && "animate-appear")}
      aria-busy={working || undefined}
    >
      <div className="flex items-center justify-between gap-3 pl-4 pr-3">
        {/* The count gives way to the next line before the button does */}
        <p className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-1.5 py-2.5 text-sm">
          <span className="text-muted">{text.title}</span>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="font-medium">{text.headline(games)}</span>
        </p>
        <button
          ref={openButton}
          type="button"
          aria-expanded={asked}
          aria-controls="guest-import-details"
          // Out of the way while what it opened shows, keeping its place
          className={cn(
            "min-h-11 shrink-0 px-1 text-sm font-medium text-highlight transition-opacity duration-200",
            (open || done) && "pointer-events-none opacity-0",
          )}
          inert={open || done !== undefined}
          onClick={() => {
            acted.current = true;
            bring.reset();
            setOpen(true);
          }}
        >
          {text.open}
        </button>
      </div>
      <Fold open={asked}>
        <div id="guest-import-details" ref={details} tabIndex={-1} className="outline-none">
          <div className="border-t border-line px-4 pt-3 pb-2 text-sm">
            <p className="text-muted">{text.lead}</p>
            <dl className="mt-1 divide-y divide-line">
              <CountRow name={text.games} count={text.gamesCount(games)} />
              <CountRow name={text.players} count={text.playersCount(players)} />
              <CountRow name={text.settings} count={text.settingsCount(settings)} />
            </dl>
            <p className="mt-2 text-muted">{text.stays}</p>
            {bring.isError && (
              <p role="alert" className="mt-2 text-highlight">
                {failureOf(bring.error) === "refused" ? text.failedRefused : text.failedUnknown}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-line p-2">
            <button
              type="button"
              disabled={working}
              onClick={() => {
                acted.current = true;
                setOpen(false);
              }}
              className={cn(buttonClass, "border border-line")}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => {
                if (running.current) return;
                running.current = true;
                acted.current = true;
                setStarted(holdings);
                bring.mutate(undefined, {
                  onSuccess: setDone,
                  onSettled: () => {
                    running.current = false;
                  },
                });
              }}
              className={cn(buttonClass, "bg-accent text-accent-text")}
            >
              {working ? text.working : bring.isError ? t.common.retry : text.confirm}
            </button>
          </div>
        </div>
      </Fold>
      {/* What came of it opens where the details close, so the card changes height as one */}
      <Fold open={done !== undefined}>
        <div role="status" ref={result} tabIndex={-1} className="outline-none">
          {done && (
            <div className="border-t border-line px-4 pb-3 text-sm">
              <p className="flex min-h-11 items-center gap-2 font-medium">
                <Check className="size-4.5 shrink-0 text-win" aria-hidden />
                {text.done}
              </p>
              <p>{text.doneBody(done.added, done.skipped)}</p>
              <p className="mt-1 text-muted">{text.doneStays}</p>
            </div>
          )}
        </div>
      </Fold>
    </section>
  );
}
