import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { dayAndTime } from "@/components/account/SyncRow";
import { useBackupExport } from "@/components/BackupSection";
import { InfoButton } from "@/components/InfoButton";
import { repository, retrySending, useSyncStatus } from "@/data";
import type { SyncStatus as Status, StoppedAt } from "@/data/sync";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { still } from "@/lib/motion";

/** What the sender stopped at, in the app's words: the kind, and the game's start where the copy holds it. */
function useStoppedText(stoppedAt: StoppedAt | undefined): string {
  const gameId = stoppedAt?.gameId;
  const { data: game } = useQuery({
    queryKey: ["games", gameId],
    queryFn: async () =>
      gameId === undefined ? null : ((await repository.games.get(gameId)) ?? null),
    enabled: gameId !== undefined,
  });
  if (!stoppedAt) return "";
  // The game's start as its row in a list gives it
  const started = game ? dayAndTime(game.createdAt) : undefined;
  return t.shell.sync.stoppedAt(stoppedAt.kind, stoppedAt.removed, started);
}

/**
 * The alert itself: how many records wait behind the one turned down, what that one is of, and
 * 导出备份 and 重试 on a row of their own. The account's answer is not shown, only its code behind
 * the (i).
 */
function RefusedAlert({ status }: { status: Status }) {
  const what = useStoppedText(status.stoppedAt);
  const backup = useBackupExport();
  const { reread } = backup;
  const code = status.stoppedAt?.code;

  // What is written meanwhile goes into the next export too. The first read is the hook's own
  const counted = useRef(status.pending);
  useEffect(() => {
    if (counted.current === status.pending) return;
    counted.current = status.pending;
    reread();
  }, [status.pending, reread]);

  return (
    <div role="alert" className="rounded-xl border border-line bg-surface px-4 pt-3 pb-1 text-sm">
      <p className="font-medium text-highlight">{t.shell.sync.refused(status.pending)}</p>
      <p className="mt-0.5 text-muted">
        {what && t.shell.sync.stopped(what)}
        {/* A whole target at the line's end, which its negative margins keep from raising the line */}
        <span className="-my-3 -ml-2.5 inline-grid align-middle">
          <InfoButton title={t.shell.sync.refused(status.pending)} target>
            <p className="text-sm text-muted">{t.shell.sync.about}</p>
            {code !== undefined && <p className="mt-1 text-xs text-muted tabular-nums">{code}</p>}
          </InfoButton>
        </span>
      </p>
      {backup.failed && <p className="mt-1 text-highlight">{backup.failed}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          disabled={backup.busy}
          onClick={() => void backup.exportBackup()}
          className="min-h-11 rounded-xl border border-line px-4 font-medium disabled:opacity-60"
        >
          {t.me.backup.export}
        </button>
        <button
          type="button"
          onClick={retrySending}
          className="-mr-2 min-h-11 rounded-xl px-4 font-medium text-highlight"
        >
          {t.common.retry}
        </button>
      </div>
    </div>
  );
}

type Phase = "closed" | "opening" | "open" | "closing";

/**
 * The refusal alert at the top of every page of an account's books (ADR 0054), once the account
 * has turned a change down, which stops the rest behind it. It opens in place and what is under it
 * moves with it; it stays put across pages, so it plays once on arrival. Nothing while records
 * only wait: the dot on 我的 says so. Nothing for a guest.
 */
export function SyncStatus() {
  const status = useSyncStatus();
  const refused = status !== undefined && status.pending > 0 && status.refused;
  const [phase, setPhase] = useState<Phase>("closed");
  // The last status that was turned down, shown while the alert closes
  const [shown, setShown] = useState<Status>();

  useEffect(() => {
    if (refused) {
      setShown(status);
      setPhase((phase) =>
        phase === "open" || phase === "opening" ? phase : still() ? "open" : "opening",
      );
    } else {
      setPhase((phase) => (phase === "closed" ? phase : still() ? "closed" : "closing"));
    }
  }, [refused, status]);

  // Opening starts folded and grows on the next frame, so the change can be seen
  useEffect(() => {
    if (phase !== "opening") return;
    const frame = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  if (phase === "closed" || !shown) return null;

  return (
    <div
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && phase === "closing") setPhase("closed");
      }}
      className={cn(
        "mx-auto grid w-[calc(100%-2rem)] max-w-3xl transition-[grid-template-rows,opacity]",
        phase === "open"
          ? "grid-rows-[1fr] opacity-100 duration-350 ease-out"
          : "grid-rows-[0fr] opacity-0",
        phase === "closing" && "duration-250 ease-in",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="pt-3">
          <RefusedAlert status={shown} />
        </div>
      </div>
    </div>
  );
}
