import type { CallTimePhase } from "@holdem-knight/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface CallTimeDialProps {
  phase: CallTimePhase;
  /** The part of the countdown still to run, from 1 to 0 */
  fraction: number;
  /** Width of the ring, out of the 100 the dial is across */
  stroke: number;
  className?: string;
  children: ReactNode;
}

/**
 * A ring that empties as the countdown runs, around whatever shows the time. Gold until the last
 * seconds, then red and blinking. Once time is up the whole dial is red and blinks faster.
 */
export function CallTimeDial({ phase, fraction, stroke, className, children }: CallTimeDialProps) {
  const done = phase === "done";
  const alarm = phase === "warning" || done;
  return (
    <div
      className={cn(
        "relative grid aspect-square place-items-center rounded-full",
        phase === "warning" && "animate-alarm text-loss",
        done && "animate-alarm-fast bg-loss text-bg",
        className,
      )}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <title>倒计时</title>
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={stroke}
          className={done ? "stroke-transparent" : "stroke-line"}
        />
        {fraction > 0 && (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            className={cn(
              "transition-[stroke-dashoffset] duration-200 ease-linear",
              alarm ? "stroke-loss" : "stroke-highlight",
            )}
          />
        )}
      </svg>
      <div className="relative flex w-full flex-col items-center px-[12%]">{children}</div>
    </div>
  );
}
