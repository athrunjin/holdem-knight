import { type Game, gameStage } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { GameOptions } from "@/components/game/GameOptions";
import { InDevelopment } from "@/components/InDevelopment";
import { Page } from "@/components/Page";
import { useGames } from "@/data/games";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/")({
  component: SessionsPage,
});

const STARTED_AT = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type Role = "host" | "player";

const ROLES: readonly { readonly role: Role; readonly label: string }[] = [
  { role: "host", label: "Host" },
  { role: "player", label: "Player" },
];

function GameRow({ game }: { game: Game }) {
  // A game being settled opens where it was left, on its results
  const settling = game.status === "settling";
  return (
    <li>
      <Link
        to={settling ? "/games/$gameId/settlement" : "/games/$gameId"}
        params={{ gameId: game.id }}
        className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-2"
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <CurrencyIcon currency={game.currency} className="size-4.5 self-center text-muted" />
          <span className="font-medium">
            {game.smallBlindChips} / {game.bigBlindChips}
          </span>
          <GameOptions game={game} />
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
          {settling && (
            <span className="rounded-md border border-highlight px-1.5 py-0.5 text-xs text-highlight">
              结算中
            </span>
          )}
          {STARTED_AT.format(game.createdAt)}
        </span>
      </Link>
    </li>
  );
}

function GameList({ games }: { games: readonly Game[] }) {
  return games.length > 0 ? (
    <ul className="mt-1 flex flex-col gap-2">
      {games.map((game) => (
        <GameRow key={game.id} game={game} />
      ))}
    </ul>
  ) : (
    <p className="px-1 py-2 text-sm text-muted">暂无牌局</p>
  );
}

interface GameSectionProps {
  /** The heading, with a count where one helps. */
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
}

function GameSection({ title, defaultOpen, children }: GameSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center justify-between px-1 font-medium"
        >
          <span>{title}</span>
          <ChevronDown
            className={cn("size-5 text-muted transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>
      {open && children}
    </section>
  );
}

/** One part of history under a small heading of its own. */
function HistoryGroup({ title, games }: { title: string; games: readonly Game[] }) {
  return (
    <section className="mt-2">
      <h3 className="px-1 text-sm text-muted">{title}</h3>
      <GameList games={games} />
    </section>
  );
}

function HostGames() {
  const { data: games = [] } = useGames();
  // Games at the table and games being settled are both still under way
  const live = games.filter((game) => game.status !== "settled");
  // History has the rest: pending from the moment it is settled, complete once archived as such
  const pending = games.filter((game) => gameStage(game) === "pending");
  const complete = games.filter((game) => gameStage(game) === "complete");

  return (
    <>
      <section className="flex flex-col items-center gap-6 py-10 text-center md:py-16">
        {/* The start button is drawn as a chip: the only visual focus on the page */}
        <Link
          to="/games/new"
          className="group relative grid size-44 place-items-center rounded-full bg-felt-700 text-bone shadow-[0_6px_0_0_rgb(0_0_0/0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgb(0_0_0/0.25)]"
        >
          <span
            aria-hidden
            className="absolute inset-3 rounded-full border-[3px] border-dashed border-chip-gold/80"
          />
          <span className="text-2xl font-bold [font-stretch:125%]">开一局</span>
        </Link>
        {games.length === 0 && (
          <div className="max-w-sm space-y-3">
            <p className="text-lg font-medium">还没有进行中的牌局</p>
            <p className="text-muted">
              开局后可以记录每位玩家的 Buy-in、补码和离桌，散局时自动算出谁该转给谁多少。
            </p>
          </div>
        )}
      </section>

      {games.length > 0 && (
        <div className="flex flex-col gap-2 pb-6">
          <GameSection title={`进行中（${live.length}）`} defaultOpen>
            <GameList games={live} />
          </GameSection>
          <GameSection title="历史对局" defaultOpen={false}>
            <HistoryGroup title="积分待处理" games={pending} />
            <HistoryGroup title="完成" games={complete} />
          </GameSection>
        </div>
      )}
    </>
  );
}

function PlayerGames() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <InDevelopment milestone="M7" />
      <p className="max-w-sm text-muted">以玩家身份参加的牌局会显示在这里。</p>
    </section>
  );
}

function SessionsPage() {
  const [role, setRole] = useState<Role>("host");

  return (
    <Page title="牌局">
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((item) => (
          <button
            key={item.role}
            type="button"
            aria-pressed={role === item.role}
            onClick={() => setRole(item.role)}
            className={cn(
              "min-h-11 rounded-xl border px-3 font-medium",
              role === item.role
                ? "border-accent bg-accent text-accent-text"
                : "border-line bg-surface",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {role === "host" ? <HostGames /> : <PlayerGames />}
    </Page>
  );
}
