import { Link, Outlet, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SyncViewContext, useSyncViewSource } from "@/components/account/SyncRow";
import { BrandMark } from "@/components/BrandMark";
import { CallTimeFloat } from "@/components/call-time/CallTimeFloat";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { BooksGate } from "./BooksGate";
import { NAV_ITEMS } from "./nav-items";
import { UpdatePrompt } from "./UpdatePrompt";

const linkBase =
  "flex flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium text-muted transition-colors";
const linkActive = "text-text [&_svg]:text-highlight";

/** The start button sits in the middle of the navigation, with the same number of tabs on each side. */
const HALF = NAV_ITEMS.length / 2;

/**
 * Starts a game: the mark on a round badge, with its label on the tabs' line. On a phone the
 * badge rises 8px over the bar, which the bars resting on the navigation leave clear.
 */
function StartGameLink({ className }: { className?: string }) {
  return (
    <Link to="/games/new" className={cn(linkBase, "group text-text", className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-felt-700 transition-transform group-active:scale-95">
        <BrandMark className="w-5.5" />
      </span>
      {t.shell.nav.start}
    </Link>
  );
}

export function AppShell() {
  // Signed in, records of the account's books on this device wait to be sent (ADR 0054). Worked
  // out once here, so the dot and every page that tells it read one state
  const sync = useSyncViewSource();
  const unsent = sync !== undefined && sync.state !== "sent";

  // Game details live under /games but still count as the Games tab
  const inGame = useLocation({ select: (location) => location.pathname.startsWith("/games") });

  // Setting up, playing or settling a game: no second game is started from there, and the tabs
  // share the navigation among themselves.
  const withStart = (items: ReactNode[], className: string) =>
    inGame ? items : items.toSpliced(HALF, 0, <StartGameLink key="start" className={className} />);

  const tabs = (className: string) =>
    NAV_ITEMS.map(({ to, label, icon: Icon }) => (
      <Link
        key={to}
        to={to}
        className={cn(linkBase, className, to === "/" && inGame && linkActive)}
        activeProps={{ className: linkActive, "aria-current": "page" }}
        activeOptions={{ exact: to === "/" }}
      >
        <span className="relative size-6 shrink-0">
          <Icon className="size-6" strokeWidth={1.75} aria-hidden />
          {/* On the icon's top-right corner, ringed off it; it takes no space and is no target */}
          {to === "/me" && unsent && (
            <span
              aria-hidden
              className="absolute -top-1.25 -right-1.25 size-2.5 animate-appear rounded-full border-2 border-surface bg-highlight"
            />
          )}
        </span>
        <span>
          {t.shell.nav[label]}
          {to === "/me" && unsent && <span className="sr-only">{t.shell.nav.unsent}</span>}
        </span>
      </Link>
    ));

  return (
    <SyncViewContext value={sync}>
      <div className="min-h-dvh md:grid md:grid-cols-[96px_1fr]">
        {/* Tablet and up: side navigation */}
        <nav
          aria-label={t.shell.nav.label}
          className="sticky top-0 hidden h-dvh flex-col items-center gap-2 border-r border-line bg-surface pt-[max(1rem,env(safe-area-inset-top))] md:flex"
        >
          <img src="/favicon.svg" alt="" className="mb-4 size-10" />
          {withStart(tabs("size-18 hover:bg-bg"), "size-18 hover:bg-bg")}
        </nav>

        {/* Focus can rest on it, as where the refusal alert hands it on when it closes */}
        <main
          tabIndex={-1}
          className="min-w-0 outline-none pt-[env(safe-area-inset-top)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8"
        >
          <BooksGate>
            <Outlet />
          </BooksGate>
        </main>

        {/* Phone: bottom navigation */}
        <nav
          aria-label={t.shell.nav.label}
          className={cn(
            "fixed inset-x-0 bottom-0 z-10 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
            inGame ? "grid-cols-4" : "grid-cols-5",
          )}
        >
          {withStart(tabs("h-16"), "h-16 justify-end gap-0.5 pb-2.5")}
        </nav>

        <CallTimeFloat />
        <UpdatePrompt />
      </div>
    </SyncViewContext>
  );
}
