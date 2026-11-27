import { Check } from "lucide-react";
import { useState } from "react";
import { Fold } from "@/components/transfers/TransferRows";
import { type ImportResult, useBringGuestBooks, useGuestOffer } from "@/data/guest-import";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";

const cardClass = "rounded-2xl border border-line bg-surface";
const buttonClass = "min-h-11 rounded-xl px-2 text-sm font-medium disabled:opacity-60";

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
 * brought, what came of it stays until the page is left, and the card is not offered again for
 * these records.
 */
export function GuestImportCard() {
  const text = t.me.guestImport;
  const { data: offer } = useGuestOffer();
  const bring = useBringGuestBooks();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<ImportResult>();

  if (done) {
    return (
      <section role="status" className={cn(cardClass, "mt-3 px-4 pb-3")}>
        <p className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <Check className="size-4.5 shrink-0 text-win" aria-hidden />
          {text.done}
        </p>
        <p className="text-sm">{text.doneBody(done.added, done.skipped)}</p>
        <p className="mt-1 text-sm text-muted">{text.doneStays}</p>
      </section>
    );
  }
  // Nothing while the device's books are read, and nothing when there is nothing to bring
  if (!offer) return null;

  const { games, players, settings } = offer.holdings;
  const working = bring.isPending;

  return (
    <section className={cn(cardClass, "mt-3 animate-appear")} aria-busy={working}>
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
          type="button"
          aria-expanded={open}
          aria-controls="guest-import-details"
          // Out of the way while what it opened shows, keeping its place
          className={cn(
            "min-h-11 shrink-0 px-1 text-sm font-medium text-highlight transition-opacity duration-200",
            open && "pointer-events-none opacity-0",
          )}
          tabIndex={open ? -1 : 0}
          onClick={() => {
            bring.reset();
            setOpen(true);
          }}
        >
          {text.open}
        </button>
      </div>
      <Fold open={open}>
        <div id="guest-import-details">
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
                {text.failed}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-line p-2">
            <button
              type="button"
              disabled={working}
              onClick={() => setOpen(false)}
              className={cn(buttonClass, "border border-line")}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => bring.mutate(undefined, { onSuccess: setDone })}
              className={cn(buttonClass, "bg-accent font-semibold text-accent-text")}
            >
              {working ? text.working : bring.isError ? t.common.retry : text.confirm}
            </button>
          </div>
        </div>
      </Fold>
    </section>
  );
}
