import { type PointerEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** The element ID of a letter's section, which the index scrolls to. */
export function letterSectionId(letter: string): string {
  return `letter-${letter}`;
}

/** Space between the top of the window and a section counted as current. */
const ACTIVE_OFFSET = 96;

/** The letter whose section sits at the top of the window. */
export function useActiveLetter(letters: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(letters[0]);
  const key = letters.join(" ");

  useEffect(() => {
    const list = key === "" ? [] : key.split(" ");
    function update() {
      let current = list[0];
      for (const letter of list) {
        const top = document.getElementById(letterSectionId(letter))?.getBoundingClientRect().top;
        if (top !== undefined && top <= ACTIVE_OFFSET) current = letter;
      }
      setActive(current);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [key]);

  return active;
}

/** How long a press lasts before the index grows. */
const HOLD_MS = 200;

interface LetterIndexProps {
  letters: readonly string[];
  /** Highlighted while not pressed */
  active: string | undefined;
}

/**
 * Letters down the right edge of a grouped list. A tap jumps to that letter. Holding enlarges the
 * index and shows the letter in a bubble, and sliding jumps as the finger passes each letter.
 */
export function LetterIndex({ letters, active }: LetterIndexProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pressing, setPressing] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [picked, setPicked] = useState<string>();

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  function letterAt(clientY: number): string | undefined {
    const rect = listRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const index = Math.floor(((clientY - rect.top) / rect.height) * letters.length);
    return letters[Math.min(letters.length - 1, Math.max(0, index))];
  }

  function jumpTo(clientY: number) {
    const letter = letterAt(clientY);
    if (letter === undefined || letter === picked) return;
    setPicked(letter);
    document.getElementById(letterSectionId(letter))?.scrollIntoView({ block: "start" });
    navigator.vibrate?.(5);
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressing(true);
    jumpTo(event.clientY);
    holdTimer.current = setTimeout(() => setEnlarged(true), HOLD_MS);
  }

  function handleUp() {
    clearTimeout(holdTimer.current);
    setPressing(false);
    setEnlarged(false);
    setPicked(undefined);
  }

  const shown = pressing ? (picked ?? active) : active;

  return (
    <nav aria-label="按字母跳转" className="absolute top-0 right-0 h-full">
      <div className="sticky top-16 flex items-start">
        {enlarged && shown && (
          <span
            aria-hidden
            className="absolute top-1/2 right-full mr-3 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-text shadow-lg"
          >
            {shown}
          </span>
        )}
        <div
          ref={listRef}
          role="presentation"
          onPointerDown={handleDown}
          onPointerMove={(event) => pressing && jumpTo(event.clientY)}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          className={cn(
            "flex touch-none flex-col items-center rounded-full py-1 transition-all select-none",
            enlarged && "-mr-1 bg-surface px-1 shadow-lg ring-1 ring-line",
          )}
        >
          {letters.map((letter) => (
            <span
              key={letter}
              className={cn(
                "grid place-items-center rounded-full font-semibold transition-all",
                enlarged ? "size-6.5 text-sm" : "size-5 text-[11px]",
                letter === shown ? "bg-highlight text-bg" : "text-muted",
              )}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}
