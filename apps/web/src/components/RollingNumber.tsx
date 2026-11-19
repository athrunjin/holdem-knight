import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface RollingNumberProps {
  value: number;
  /** How the figure reads. Whole chips with separators by default */
  format?: (value: number) => string;
  /** Changes without rolling, such as a figure following what is being typed */
  still?: boolean;
  className?: string;
}

const chips = (value: number) => value.toLocaleString("zh-CN");

/** How long the new color holds before it fades back, the roll included. */
const ROLL_MS = 700;

/**
 * A figure that rolls to a new value: up and green when it grows, down and red when it shrinks.
 * The color fades back once the roll is done. The old figure only shows while it rolls away.
 */
export function RollingNumber({
  value,
  format = chips,
  still = false,
  className,
}: RollingNumberProps) {
  const [roll, setRoll] = useState({ value, from: value, turn: 0, rolling: false });
  // A new value starts a roll from the last one, unless it should simply change
  if (roll.value !== value) {
    setRoll({ value, from: roll.value, turn: roll.turn + 1, rolling: !still });
  }
  const { turn, rolling } = roll;
  // Timed rather than told by the animation, which reduced motion leaves out
  useEffect(() => {
    if (!rolling) return;
    const timer = window.setTimeout(
      () =>
        setRoll((current) => (current.turn === turn ? { ...current, rolling: false } : current)),
      ROLL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [turn, rolling]);
  const up = roll.value > roll.from;
  const tone = roll.rolling ? (up ? "text-win" : "text-loss") : undefined;

  return (
    <span
      className={cn(
        "relative inline-grid overflow-hidden align-bottom transition-colors duration-700",
        tone,
        className,
      )}
    >
      {roll.rolling && (
        <span
          key={`from-${roll.turn}`}
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 motion-reduce:hidden",
            up ? "animate-roll-out-up" : "animate-roll-out-down",
          )}
        >
          {format(roll.from)}
        </span>
      )}
      <span
        key={`to-${roll.turn}`}
        className={cn(
          "col-start-1 row-start-1",
          roll.rolling && (up ? "animate-roll-in-up" : "animate-roll-in-down"),
          "motion-reduce:animate-none",
        )}
      >
        {format(roll.value)}
      </span>
    </span>
  );
}
