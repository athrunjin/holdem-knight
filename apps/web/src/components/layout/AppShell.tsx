import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/cn";
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
      开局
    </Link>
  );
}

export function AppShell() {
  // Game details live under /games but still count as the Games tab
  const inGame = useLocation({ select: (location) => location.pathname.startsWith("/games") });

  const tabs = (className: string) =>
    NAV_ITEMS.map(({ to, label, icon: Icon }) => (
      <Link
        key={to}
        to={to}
        className={cn(linkBase, className, to === "/" && inGame && linkActive)}
        activeProps={{ className: linkActive, "aria-current": "page" }}
        activeOptions={{ exact: to === "/" }}
      >
        <Icon className="size-6" strokeWidth={1.75} aria-hidden />
        {label}
      </Link>
    ));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[96px_1fr]">
      {/* Tablet and up: side navigation */}
      <nav
        aria-label="主导航"
        className="sticky top-0 hidden h-dvh flex-col items-center gap-2 border-r border-line bg-surface pt-[max(1rem,env(safe-area-inset-top))] md:flex"
      >
        <img src="/favicon.svg" alt="" className="mb-4 size-10" />
        {tabs("size-18 hover:bg-bg").toSpliced(
          HALF,
          0,
          <StartGameLink key="start" className="size-18 hover:bg-bg" />,
        )}
      </nav>

      <main className="min-w-0 pt-[env(safe-area-inset-top)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
        <Outlet />
      </main>

      {/* Phone: bottom navigation */}
      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {tabs("h-16").toSpliced(
          HALF,
          0,
          <StartGameLink key="start" className="h-16 justify-end gap-0.5 pb-2.5" />,
        )}
      </nav>

      <UpdatePrompt />
    </div>
  );
}
