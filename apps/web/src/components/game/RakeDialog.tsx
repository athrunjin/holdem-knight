import { parseChips, type RakeRule, rakeFromPot } from "@holdem-knight/core";
import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";

/** How long 不保存该更新并返回 stays lit, waiting for the tap that confirms it. */
const ARMED_MS = 5000;
/** A second tap this soon after the first is the same tap twice, not a confirmation. */
const DOUBLE_TAP_MS = 350;

interface RakeDialogProps {
  /** The rake recorded so far, in chips */
  currentChips: number;
  rule: RakeRule;
  /** The total 撤销 goes back to. Missing when there is nothing to take back */
  undoTo: number | undefined;
  saving: boolean;
  saveFailed: boolean;
  /** Records the new total. Resolves once the page shows it */
  onSave: (totalChips: number) => Promise<void>;
  /** Takes back the latest rake recorded. Resolves once the page shows the total before it */
  onUndo: () => Promise<void>;
  onClose: () => void;
}

/** A number field in the dialog: its figure centered, and its hint small enough for a narrow column. */
const fieldClass =
  "min-h-12 w-full min-w-0 rounded-xl border bg-surface px-1 text-center text-lg tabular-nums outline-none placeholder:text-xs placeholder:text-muted focus:border-highlight aria-invalid:border-highlight";

/** A whole number of chips, or `null` for anything else. An empty field is 0 where `empty` says so. */
function chipsOf(text: string, empty: number | null) {
  return text.trim() === "" ? empty : parseChips(text);
}

/**
 * 抽水计算: what the game has, plus what this pot adds, makes the new total. A pot typed at the top
 * works its rake out into the field under it, which can also be typed into directly. The total so
 * far can be typed over too, to correct it. 更新 saves the new total and keeps the dialog open for
 * the next pot, and 撤销 goes back to the total saved before the latest one.
 *
 * Leaving with a change not saved takes two taps, as 结算并下桌 does: the first lights the new total
 * and 更新, and turns 返回 into 不保存该更新并返回, filled with green that runs out from the right.
 * A tap while it is lit leaves without saving; once it goes out, 返回 is back.
 */
export function RakeDialog({
  currentChips,
  rule,
  undoTo,
  saving,
  saveFailed,
  onSave,
  onUndo,
  onClose,
}: RakeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [potText, setPotText] = useState("");
  const [addText, setAddText] = useState("");
  // What is typed over the total so far. Missing until it is tapped, when it shows the total
  const [currentText, setCurrentText] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const armedAt = useRef(0);
  const armTimer = useRef<number>(undefined);

  useEffect(() => {
    ref.current?.showModal();
    return () => window.clearTimeout(armTimer.current);
  }, []);

  const base = currentText === undefined ? currentChips : chipsOf(currentText, null);
  const added = chipsOf(addText, 0);
  const total = base === null || added === null ? null : base + added;
  const pending = total !== null && total !== currentChips;
  const typedOver = base !== null && base !== currentChips;

  function disarm() {
    window.clearTimeout(armTimer.current);
    setArmed(false);
  }

  /** Back to a fresh dialog over the saved total. */
  function reset() {
    setPotText("");
    setAddText("");
    setCurrentText(undefined);
    disarm();
  }

  function handlePot(text: string) {
    setPotText(text);
    const pot = parseChips(text);
    setAddText(pot === null || pot === 0 ? "" : String(rakeFromPot(pot, rule)));
    disarm();
  }

  /** A rake typed in directly no longer comes from the pot above it, so the pot clears. */
  function handleAdd(text: string) {
    setAddText(text);
    setPotText("");
    disarm();
  }

  async function handleUpdate() {
    if (!pending || saving) return;
    try {
      await onSave(total);
      reset();
    } catch {
      // The failure shows from the mutation state, and what was typed stays
    }
  }

  async function handleUndo() {
    if (undoTo === undefined || saving) return;
    try {
      await onUndo();
      reset();
    } catch {
      // As above
    }
  }

  function handleBack() {
    if (!pending) {
      ref.current?.close();
      return;
    }
    const now = Date.now();
    if (armed) {
      if (now - armedAt.current < DOUBLE_TAP_MS) return;
      disarm();
      ref.current?.close();
      return;
    }
    armedAt.current = now;
    setArmed(true);
    window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmed(false), ARMED_MS);
  }

  // Lit while leaving would lose the change typed in
  const nudge = armed && "animate-flash rounded-md";
  const invalid = (text: string, empty: number | null) =>
    text.trim() !== "" && chipsOf(text, empty) === null ? true : undefined;

  // In the page's body, like the other dialogs, so it never nests in a form around the opener
  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        // Escape leaves the way 返回 does, so a change is never lost to it at once
        event.preventDefault();
        handleBack();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-text backdrop:bg-black/60"
    >
      <div className="-mt-2 -mr-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">抽水计算</h2>
        <button
          type="button"
          aria-label="抽水设置"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={cn(
            "grid size-11 place-items-center text-muted",
            settingsOpen && "text-highlight",
          )}
        >
          <Settings className="size-5" aria-hidden />
        </button>
      </div>
      {/* Rake has one rule for now. Its own settings come later */}
      {settingsOpen && (
        <p className="mt-1 rounded-xl border border-line px-3 py-2 text-xs text-muted">
          抽水设置还在开发中，目前按底池 {rule.percent}% 计算，不足 1 筹码舍去。
        </p>
      )}

      <div className="mt-3 grid grid-cols-[minmax(0,5fr)_auto_minmax(0,6fr)_auto_minmax(0,5fr)] items-center gap-x-1 gap-y-1 text-center">
        <label htmlFor="rake-pot" className="col-span-5 text-sm text-muted">
          输入底池计算新增
        </label>
        <input
          id="rake-pot"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={potText}
          aria-invalid={invalid(potText, null)}
          onChange={(event) => handlePot(event.target.value)}
          onFocus={(event) => selectOnFocus(event.currentTarget)}
          className={cn(fieldClass, "col-start-3 border-line")}
        />

        {/* The pot gives the rake under it; the captions of the row of three share its line */}
        <span className="col-start-1 mt-1 text-sm text-muted">当前已有</span>
        <span className="col-start-3 text-lg leading-none text-muted" aria-hidden>
          ⇓
        </span>
        <span className="col-start-5 mt-1 text-sm text-muted">更新后</span>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="当前已有抽水，点击修改"
          value={currentText ?? String(currentChips)}
          aria-invalid={invalid(currentText ?? "", null)}
          onChange={(event) => {
            setCurrentText(event.target.value);
            disarm();
          }}
          onFocus={(event) => selectOnFocus(event.currentTarget)}
          className={cn(
            fieldClass,
            "col-start-1 border-transparent font-semibold",
            typedOver && "text-highlight",
          )}
        />
        <span className="text-lg text-muted" aria-hidden>
          +
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="新增抽水"
          placeholder="手动输入新增"
          value={addText}
          aria-invalid={invalid(addText, 0)}
          onChange={(event) => handleAdd(event.target.value)}
          onFocus={(event) => selectOnFocus(event.currentTarget)}
          className={cn(fieldClass, "border-line")}
        />
        <span className="text-lg text-muted" aria-hidden>
          =
        </span>
        <p
          className={cn(
            "flex min-h-12 items-center justify-center text-lg font-semibold tabular-nums [overflow-wrap:anywhere]",
            pending && "text-win",
            nudge,
          )}
        >
          {total === null ? "—" : total.toLocaleString("zh-CN")}
        </p>

        <span className="col-start-1 self-start text-xs text-muted">点击修改</span>
        <button
          type="button"
          disabled={!pending || saving}
          onClick={handleUpdate}
          className={cn(
            "col-start-5 mt-1 min-h-11 rounded-xl text-sm font-semibold transition-colors",
            pending
              ? "bg-accent text-accent-text"
              : "border border-line text-muted disabled:opacity-60",
            armed && "animate-flash ring-2 ring-highlight",
          )}
        >
          更新
        </button>
      </div>

      {saveFailed && (
        <p role="alert" className="mt-3 text-center text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}

      <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <button
          type="button"
          disabled={undoTo === undefined || saving}
          onClick={handleUndo}
          className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-line px-4 disabled:opacity-40"
        >
          <span className="font-medium">撤销</span>
          <span className="text-[11px] leading-tight text-muted tabular-nums">
            退回至：{undoTo === undefined ? "—" : undoTo.toLocaleString("zh-CN")}
          </span>
        </button>
        <BackButton armed={armed} onClick={handleBack} />
      </div>
    </dialog>,
    document.body,
  );
}

/**
 * 返回, which turns into 不保存该更新并返回 while lit: it fills with green that runs out from the
 * right, as 结算并下桌 does. The fill is a second copy of the label, dark on green, cut back from
 * the right, so the text changes color where the green ends.
 */
function BackButton({ armed, onClick }: { armed: boolean; onClick: () => void }) {
  const label = armed ? "不保存该更新并返回" : "返回";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative grid min-h-14 place-items-center overflow-hidden rounded-xl border px-2 font-medium",
        armed ? "border-accent text-win" : "border-line",
      )}
    >
      <span className="col-start-1 row-start-1">{label}</span>
      {armed && (
        <span
          aria-hidden
          style={{ animationDuration: `${ARMED_MS}ms` }}
          className="absolute inset-0 grid animate-drain place-items-center bg-accent font-semibold text-accent-text"
        >
          {label}
        </span>
      )}
    </button>
  );
}
