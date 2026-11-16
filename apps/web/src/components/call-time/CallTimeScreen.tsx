import {
  CALL_TIME_PRESETS,
  CALL_TIME_STEP,
  canAdjustCallTime,
  MAX_CALL_TIME,
  MIN_CALL_TIME,
  parseCallTime,
} from "@holdem-knight/core";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Minimize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Page } from "@/components/Page";
import { callTimeActions, useCallTime } from "@/lib/call-time";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";
import { CallTimeDial } from "./CallTimeDial";

const stepClass =
  "grid size-14 shrink-0 place-items-center rounded-full border border-line bg-surface font-semibold transition-colors active:bg-line/40 disabled:opacity-40";
const mainClass = "min-h-14 w-full rounded-xl text-lg font-semibold";
const figureClass = "text-6xl leading-none font-bold tabular-nums";

/**
 * The length before a start, as a field: a tap selects it and a whole number of seconds can be
 * typed over it. Every valid length typed is set at once. A number out of range shows the range
 * in place of 秒, and is dropped on leaving.
 */
function LengthField({ seconds }: { seconds: number }) {
  // What is in the field while it differs from the length, such as nothing or a zero
  const [draft, setDraft] = useState<string>();
  // An empty field is still being typed in. Only a number out of range is wrong.
  const invalid = draft !== undefined && draft !== "" && parseCallTime(draft) === undefined;

  // A length set any other way, by a preset or a step, replaces what was being typed
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a new length, which it does not read
  useEffect(() => setDraft(undefined), [seconds]);

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        enterKeyHint="done"
        autoComplete="off"
        aria-label="时长（秒），点按后输入"
        aria-invalid={invalid ? true : undefined}
        value={draft ?? String(seconds)}
        onFocus={(event) => selectOnFocus(event.currentTarget)}
        onChange={(event) => {
          const text = event.target.value.replace(/\D/g, "");
          const typed = parseCallTime(text);
          setDraft(text);
          if (typed !== undefined) callTimeActions.setLength(typed);
        }}
        onBlur={() => setDraft(undefined)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={cn(figureClass, "w-full rounded-lg bg-transparent text-center outline-none")}
      />
      <span className={cn("mt-1 text-sm", invalid ? "text-highlight" : "text-muted")}>
        {invalid ? `范围 ${MIN_CALL_TIME}–${MAX_CALL_TIME} 秒` : "秒"}
      </span>
    </>
  );
}

/**
 * The Call Time countdown, the same wherever it is opened from: set a length, start, and leave
 * by the cross, which goes back to the page it was opened from. A countdown under way can be
 * shrunk to float over the other pages.
 */
export function CallTimeScreen({ gameId }: { gameId?: string }) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { callTime, phase, seconds, lastSeconds, fraction, now } = useCallTime();
  const counting = phase === "running" || phase === "warning";
  const done = phase === "done";

  /** Back to the page this one was opened from. A countdown still under way floats over it. */
  function leave() {
    if (canGoBack) return router.history.back();
    // Opened by its address, with no page before it
    return gameId === undefined
      ? navigate({ to: "/tools", replace: true })
      : navigate({ to: "/games/$gameId", params: { gameId }, replace: true });
  }

  function exit() {
    callTimeActions.stop();
    leave();
  }

  const step = (delta: number) => (
    <button
      type="button"
      aria-label={`${delta > 0 ? "增加" : "减少"} ${CALL_TIME_STEP} 秒`}
      disabled={!canAdjustCallTime(callTime, delta, now)}
      onClick={() => callTimeActions.adjust(delta)}
      className={cn(stepClass, done && "invisible")}
    >
      {delta > 0 ? "+" : "−"}
      {CALL_TIME_STEP}s
    </button>
  );

  return (
    <Page
      title="Call Time"
      actions={
        <button
          type="button"
          aria-label="返回"
          onClick={exit}
          className="-mr-2 grid size-11 shrink-0 place-items-center"
        >
          <X className="size-6" strokeWidth={1.75} aria-hidden />
        </button>
      }
    >
      <div className="mx-auto flex max-w-sm flex-col gap-5 pt-2 pb-6">
        <div className="flex items-center justify-between gap-2">
          {step(-CALL_TIME_STEP)}
          <CallTimeDial
            phase={phase}
            fraction={fraction}
            stroke={6}
            className="w-full max-w-56 min-w-0"
          >
            {phase === "idle" && <LengthField seconds={seconds} />}
            {counting && (
              <>
                <span role="timer" aria-label={`剩余 ${seconds} 秒`} className={figureClass}>
                  {lastSeconds ? (
                    <>
                      {lastSeconds.whole}
                      <span className="text-3xl">.{lastSeconds.hundredths}</span>
                    </>
                  ) : (
                    seconds
                  )}
                </span>
                <span className={cn("mt-1 text-sm", !lastSeconds && "text-muted")}>秒</span>
              </>
            )}
            {done && <span className="text-4xl font-bold">时间到</span>}
          </CallTimeDial>
          {step(CALL_TIME_STEP)}
        </div>

        {/* The lengths before a start, then the button that shrinks a countdown under way */}
        <div className="flex min-h-14 items-center justify-end">
          {phase === "idle" && (
            <ul className="grid w-full grid-cols-4 gap-2">
              {CALL_TIME_PRESETS.map((preset) => (
                <li key={preset}>
                  <button
                    type="button"
                    aria-pressed={preset === seconds}
                    onClick={() => callTimeActions.setLength(preset)}
                    className={cn(
                      "min-h-12 w-full rounded-xl border font-semibold transition-colors",
                      preset === seconds
                        ? "border-text/60 bg-line/50 text-text"
                        : "border-line bg-surface text-muted",
                    )}
                  >
                    {preset}s
                  </button>
                </li>
              ))}
            </ul>
          )}
          {counting && (
            <button type="button" aria-label="缩小成悬浮窗" onClick={leave} className={stepClass}>
              <Minimize2 className="size-6" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>

        {phase === "idle" && (
          <button
            type="button"
            onClick={callTimeActions.start}
            className={cn(mainClass, "bg-accent text-accent-text")}
          >
            开始
          </button>
        )}
        {counting && (
          <button
            type="button"
            onClick={callTimeActions.stop}
            className={cn(mainClass, "border border-line bg-surface")}
          >
            结束
          </button>
        )}
        {done && (
          <button
            type="button"
            onClick={exit}
            className={cn(mainClass, "bg-accent text-accent-text")}
          >
            退出
          </button>
        )}
      </div>
    </Page>
  );
}
