import { type GameTimer as Timer, timerElapsedMs } from "@holdem-knight/core";
import { Clock, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const pillClass =
  "inline-flex min-h-11 items-center gap-1 rounded-xl border border-line bg-surface px-2 text-sm font-semibold tabular-nums";

/** `01:23:45`. Hours keep counting past 99 rather than wrapping. */
export function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return [seconds / 3600, (seconds / 60) % 60, seconds % 60]
    .map((part) => String(Math.floor(part)).padStart(2, "0"))
    .join(":");
}

interface GameTimerProps {
  timer: Timer | undefined;
  /** Settled games show the final time and have no controls */
  editable: boolean;
  saving: boolean;
  onToggle: () => void;
}

/** How long the game has run. Only the display ticks; the time comes from timestamps. */
export function GameTimer({ timer, editable, saving, onToggle }: GameTimerProps) {
  const [now, setNow] = useState(Date.now);
  const running = timer?.runningSince !== undefined;

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  if (timer === undefined && !editable) return null;

  const elapsed = timer && formatElapsed(timerElapsedMs(timer, now));
  if (!editable) return <span className={`${pillClass} text-muted`}>{elapsed}</span>;

  if (timer === undefined) {
    return (
      <button
        type="button"
        disabled={saving}
        onClick={onToggle}
        className={`${pillClass} text-highlight`}
      >
        <Clock className="size-4" aria-hidden />
        Start
      </button>
    );
  }

  const Icon = running ? Pause : Play;
  return (
    <button
      type="button"
      aria-label={`${running ? "暂停" : "继续"}计时，已进行 ${elapsed}`}
      disabled={saving}
      onClick={onToggle}
      className={cn(pillClass, running ? "text-highlight" : "text-muted")}
    >
      {elapsed}
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
