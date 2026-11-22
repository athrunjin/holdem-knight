import {
  parseChips,
  potForRake,
  type RakeBlinds,
  type RakeRule,
  rakeFromPot,
} from "@holdem-knight/core";
import { ScrollText } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/insurance/Modal";
import { RollingNumber } from "@/components/RollingNumber";
import { localeTag, t } from "@/i18n";
import { cn } from "@/lib/cn";
import { selectOnFocus } from "@/lib/number-input";

/** How long 不保存该更新并返回 stays lit, waiting for the tap that confirms it. */
const ARMED_MS = 5000;
/** A second tap this soon after the first is the same tap twice, not a confirmation. */
const DOUBLE_TAP_MS = 350;

/**
 * One rake saved: when, the change in chips, the pot it came from when one was typed, and whether
 * the total was typed over instead.
 */
export interface RakeEntry {
  readonly id: string;
  readonly occurredAt: number;
  readonly chips: number;
  readonly potChips?: number;
  readonly typedOver?: true;
}

/** The records shown under the buttons; the rest are a tap on 记录 away. */
const RECENT_ENTRIES = 3;

/** How a rake was put in: from a pot, added by hand, or the total typed over. */
type EntryInput = "pot" | "added" | "set";

const INPUT_NAMES: Record<EntryInput, string> = {
  pot: t.game.rakeDialog.pot,
  added: t.game.rakeDialog.added,
  set: t.game.rakeDialog.edit,
};

/** Rakes from before `typedOver` was kept count a fall as typed over, as nothing else lowers it. */
const inputOf = ({ potChips, typedOver, chips }: RakeEntry): EntryInput =>
  potChips !== undefined ? "pot" : typedOver || chips < 0 ? "set" : "added";

const ENTRY_TIME = new Intl.DateTimeFormat(localeTag, { hour: "2-digit", minute: "2-digit" });

interface RakeDialogProps {
  /** The rake recorded so far, in chips */
  currentChips: number;
  rule: RakeRule;
  /** The game's blinds, for amounts set in blinds. Missing outside a game */
  blinds?: RakeBlinds | undefined;
  /** The title line, with the rule's settings, which names the dialog 抽水计算 */
  settings: ReactNode;
  /** What has been saved, oldest first */
  entries: readonly RakeEntry[];
  /** The total 撤销 goes back to. Missing when there is nothing to take back */
  undoTo: number | undefined;
  saving: boolean;
  saveFailed: boolean;
  /**
   * Records the new total, with the pot when it came from one, and whether the total so far was
   * typed over. Resolves once the page shows it
   */
  onSave: (totalChips: number, potChips: number | undefined, typedOver: boolean) => Promise<void>;
  /** Takes back the latest rake recorded. Resolves once the page shows the total before it */
  onUndo: () => Promise<void>;
  onClose: () => void;
}

/** A number field in the dialog, its figure centered. */
const fieldClass =
  "min-h-12 w-full min-w-0 rounded-xl border bg-surface px-1 text-center text-lg tabular-nums outline-none placeholder:text-muted focus:border-highlight aria-invalid:border-highlight";

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
  blinds,
  settings,
  entries,
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
  const [editingCurrent, setEditingCurrent] = useState(false);
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
  // A rake typed by hand shows, faintly, the smallest pot it could have come from
  const potHint =
    potText === "" && addText.trim() !== "" && added !== null && added > 0
      ? potForRake(added, rule, blinds)
      : undefined;
  // Nothing typed: the totals show the saved rake, and roll when a save or 撤销 changes it
  const untouched = currentText === undefined && addText.trim() === "";

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
    setAddText(pot === null || pot === 0 ? "" : String(rakeFromPot(pot, rule, blinds)));
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
    // The pot is kept only when the rake added is the one it gave, with the total not typed over
    const pot = parseChips(potText);
    const fromPot =
      pot !== null &&
      pot > 0 &&
      currentText === undefined &&
      added === rakeFromPot(pot, rule, blinds)
        ? pot
        : undefined;
    try {
      await onSave(total, fromPot, typedOver);
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
      // React passes a dialog opened from this one, such as all the records, its close and
      // Escape on to this one, which leaves them to it
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        // Escape leaves the way 返回 does, so a change is never lost to it at once
        event.preventDefault();
        handleBack();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-text backdrop:bg-black/60"
    >
      {settings}

      <div className="mt-3 grid grid-cols-[minmax(0,5fr)_auto_minmax(0,6fr)_auto_minmax(0,5fr)] items-center gap-x-1 gap-y-1 text-center">
        <label htmlFor="rake-pot" className="col-span-5 text-sm text-muted">
          {t.game.rakeDialog.enterAPotToWorkOut}
        </label>
        <input
          id="rake-pot"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={potText}
          placeholder={potHint?.toLocaleString("zh-CN")}
          aria-invalid={invalid(potText, null)}
          onChange={(event) => handlePot(event.target.value)}
          onFocus={(event) => selectOnFocus(event.currentTarget)}
          className={cn(fieldClass, "col-start-3 border-line placeholder:opacity-60")}
        />

        {/* The pot gives the rake under it; the captions of the row of three share its line */}
        <span className="col-start-1 mt-1 text-sm text-muted">{t.game.rakeDialog.soFar}</span>
        <span className="col-start-3 text-lg leading-none text-muted" aria-hidden>
          ⇓
        </span>
        <span className="col-start-5 mt-1 text-sm text-muted">{t.game.rakeDialog.after}</span>

        {/* The saved rake rolls over the field until it is tapped to be typed over */}
        <div className="relative col-start-1">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={t.game.rakeDialog.rakeSoFarTapToEdit}
            value={currentText ?? String(currentChips)}
            aria-invalid={invalid(currentText ?? "", null)}
            onChange={(event) => {
              setCurrentText(event.target.value);
              disarm();
            }}
            onFocus={(event) => {
              setEditingCurrent(true);
              selectOnFocus(event.currentTarget);
            }}
            onBlur={() => setEditingCurrent(false)}
            className={cn(
              fieldClass,
              "border-transparent font-semibold",
              typedOver && "text-highlight",
              !editingCurrent && currentText === undefined && "text-transparent",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 grid place-items-center text-lg font-semibold tabular-nums",
              (editingCurrent || currentText !== undefined) && "invisible",
            )}
          >
            <RollingNumber value={currentChips} />
          </span>
        </div>
        <span className="text-lg text-muted" aria-hidden>
          +
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t.game.rakeDialog.newRake}
          placeholder={t.game.rakeDialog.typeTheRakeToAdd}
          value={addText}
          aria-invalid={invalid(addText, 0)}
          onChange={(event) => handleAdd(event.target.value)}
          onFocus={(event) => selectOnFocus(event.currentTarget)}
          className={cn(fieldClass, "border-line placeholder:text-xs")}
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
          {untouched ? (
            <RollingNumber value={currentChips} />
          ) : total === null ? (
            "—"
          ) : (
            total.toLocaleString("zh-CN")
          )}
        </p>

        <span className="col-start-1 self-start text-xs text-muted">
          {t.game.rakeDialog.tapToEdit}
        </span>
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
          {t.game.rakeDialog.update}
        </button>
      </div>

      {saveFailed && (
        <p role="alert" className="mt-3 text-center text-sm text-highlight">
          {t.common.couldntSaveTryAgain}
        </p>
      )}

      <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <button
          type="button"
          disabled={undoTo === undefined || saving}
          onClick={handleUndo}
          className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-line px-4 disabled:opacity-40"
        >
          <span className="font-medium">{t.game.rakeDialog.undo}</span>
          <span className="text-[11px] leading-tight text-muted tabular-nums">
            {t.game.rakeDialog.backTo(undoTo === undefined ? "—" : undoTo.toLocaleString("zh-CN"))}
          </span>
        </button>
        <BackButton armed={armed} onClick={handleBack} />
      </div>

      <RakeRecords entries={entries} rule={rule} blinds={blinds} />
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
  const label = armed ? t.game.rakeDialog.discardThisUpdateAndGoBack : t.common.back;
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

interface RecordsProps {
  entries: readonly RakeEntry[];
  rule: RakeRule;
  blinds: RakeBlinds | undefined;
}

/**
 * 记录 under the buttons: the latest 3 rakes, with the line and the table's head kept even before
 * there are any. The 记录 line, in gold, opens every record in a dialog of its own.
 */
function RakeRecords({ entries, rule, blinds }: RecordsProps) {
  const [showingAll, setShowingAll] = useState(false);
  const title = t.game.rakeDialog.log(entries.length);
  return (
    <section className="mt-4">
      <button
        type="button"
        onClick={() => setShowingAll(true)}
        aria-label={t.game.rakeDialog.tapToSeeAll(title)}
        className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-highlight"
      >
        <ScrollText className="size-4" aria-hidden />
        {title}
      </button>
      <RecordsTable entries={entries} rule={rule} blinds={blinds} limit={RECENT_ENTRIES} />
      {showingAll && (
        <Modal title={t.game.rakeDialog.rake(title)} onClose={() => setShowingAll(false)}>
          <RecordsTable entries={entries} rule={rule} blinds={blinds} />
          <form method="dialog">
            <button
              type="submit"
              className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
            >
              {t.common.back}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

/**
 * Each rake with its time, how it was put in, its pot, its change and the total after it, latest
 * first, up to `limit`. A rake added by hand shows, faintly, the smallest pot it could have come
 * from under the rule in use now.
 */
function RecordsTable({ entries, rule, blinds, limit }: RecordsProps & { limit?: number }) {
  let running = 0;
  const rows = entries.map((entry) => {
    running += entry.chips;
    return { entry, input: inputOf(entry), total: running };
  });
  const latestFirst = rows.reverse();
  const shown = limit === undefined ? latestFirst : latestFirst.slice(0, limit);
  const head = "px-1 py-1 text-xs font-normal text-muted";

  function potCell({ entry, input }: (typeof rows)[number]) {
    if (input === "set") return <span className="text-muted">N/A</span>;
    if (entry.potChips !== undefined) return entry.potChips.toLocaleString("zh-CN");
    const pot = potForRake(entry.chips, rule, blinds);
    return (
      <span className="text-muted opacity-60">{pot > 0 ? pot.toLocaleString("zh-CN") : "—"}</span>
    );
  }

  return (
    <table className="w-full table-fixed text-sm tabular-nums">
      <thead>
        <tr className="border-b border-line">
          <th className={cn(head, "w-[18%] text-left")}>{t.game.rakeDialog.time}</th>
          <th className={cn(head, "w-[16%] text-left")}>{t.game.rakeDialog.entered}</th>
          <th className={cn(head, "text-right")}>{t.game.rakeDialog.pot}</th>
          <th className={cn(head, "text-right")}>{t.game.rakeDialog.change}</th>
          <th className={cn(head, "text-right")}>{t.game.rakeDialog.totalRake}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {shown.map((row) => {
          const { entry, input, total } = row;
          return (
            <tr key={entry.id}>
              <td className="px-1 py-1.5 text-muted">{ENTRY_TIME.format(entry.occurredAt)}</td>
              <td className="px-1 py-1.5 text-muted">{INPUT_NAMES[input]}</td>
              <td className="px-1 py-1.5 text-right">{potCell(row)}</td>
              <td
                className={cn(
                  "px-1 py-1.5 text-right font-medium",
                  entry.chips > 0 ? "text-win" : "text-loss",
                )}
              >
                {entry.chips > 0 ? "+" : "−"}
                {Math.abs(entry.chips).toLocaleString("zh-CN")}
              </td>
              <td className="px-1 py-1.5 text-right">{total.toLocaleString("zh-CN")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
