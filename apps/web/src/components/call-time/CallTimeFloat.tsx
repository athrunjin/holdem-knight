import { useLocation, useNavigate } from "@tanstack/react-router";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import { callTimeActions, useCallTime } from "@/lib/call-time";
import { CallTimeDial } from "./CallTimeDial";

/** How far a finger moves before a press counts as dragging the clock, not tapping it. */
const DRAG_START = 6;
/** Space kept between the clock and the edge of the window. */
const EDGE = 8;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Keeps the screen on while `active`, where the browser can. Asked again after the page was hidden. */
function useScreenAwake(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let ended = false;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (ended) sentinel.release();
          else lock = sentinel;
        })
        // Refused on a low battery, for one: the countdown runs all the same
        .catch(() => {});
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      ended = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release();
    };
  }, [active]);
}

/** How long 时间到 blinks, on the full page as on the floating clock, before the countdown clears itself. */
const DONE_LINGER_MS = 3000;

/** The game whose page this is, for any page under a game. */
const gameIdOf = (pathname: string) => /^\/games\/(?!new(?:\/|$))([^/]+)/.exec(pathname)?.[1];

/**
 * The Call Time countdown outside its own page: a small clock with the time left that floats
 * over every other page while a countdown is under way. A tap goes back to the full countdown,
 * and it can be dragged out of the way. Always mounted, so it also buzzes when time runs out,
 * keeps the screen on, and clears a countdown a few seconds after it ran out, on any page.
 */
export function CallTimeFloat() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const onPage = pathname.endsWith("/call-time");
  const { callTime, phase, seconds, lastSeconds, fraction } = useCallTime();
  const endsAt = callTime.run?.endsAt;
  const shown = !onPage && endsAt !== undefined;
  const counting = phase === "running" || phase === "warning";
  const done = phase === "done";
  // Where the clock was dragged to, from its place at the lower right
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; from: typeof offset; box: DOMRect; moved: boolean }>(
    undefined,
  );
  const dragged = useRef(false);
  const wasCounting = useRef(false);

  useScreenAwake(counting);

  useEffect(() => {
    if (done && wasCounting.current) navigator.vibrate?.([300, 150, 300, 150, 600]);
    wasCounting.current = counting;
  }, [done, counting]);

  // Counted from the moment time ran out, so a countdown found run out later does not linger
  useEffect(() => {
    if (!done || endsAt === undefined) return;
    const left = endsAt + DONE_LINGER_MS - Date.now();
    const timeout = window.setTimeout(callTimeActions.stop, Math.max(0, left));
    return () => window.clearTimeout(timeout);
  }, [done, endsAt]);

  if (!shown) return null;

  function handleDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      from: offset,
      box: event.currentTarget.getBoundingClientRect(),
      moved: false,
    };
  }

  function handleMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_START) return;
    start.moved = true;
    const { box, from } = start;
    setOffset({
      x: from.x + clamp(dx, EDGE - box.left, window.innerWidth - EDGE - box.right),
      y: from.y + clamp(dy, EDGE - box.top, window.innerHeight - EDGE - box.bottom),
    });
  }

  function handleUp() {
    dragged.current = drag.current?.moved ?? false;
    drag.current = undefined;
  }

  function handleClick() {
    // The click that ends a drag is not a tap
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    // Over a game the countdown opens as that game's page, which keeps the game's navigation
    const gameId = gameIdOf(pathname);
    if (gameId === undefined) navigate({ to: "/tools/call-time" });
    else navigate({ to: "/games/$gameId/call-time", params: { gameId } });
  }

  return (
    <button
      type="button"
      aria-label={
        done
          ? t.callTime.callTimeFloat.callTimeIsUpBackTo
          : t.callTime.callTimeFloat.callTimeSLeftBackTo(seconds)
      }
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onClick={handleClick}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className="fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 size-16 touch-none rounded-full bg-surface shadow-lg shadow-black/40 select-none md:bottom-6"
    >
      <CallTimeDial phase={phase} fraction={fraction} stroke={8} className="size-full">
        <span className="leading-none font-bold tabular-nums">
          {lastSeconds ? (
            <>
              <span className="text-base">{lastSeconds.whole}</span>
              <span className="text-xs">.{lastSeconds.hundredths}</span>
            </>
          ) : (
            <span className="text-xl">{seconds}</span>
          )}
        </span>
      </CallTimeDial>
    </button>
  );
}
