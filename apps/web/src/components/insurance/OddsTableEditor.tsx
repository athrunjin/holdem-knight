import { formatOdds, parseOdds } from "@holdem-knight/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { newOddsTable, useOddsTables, useSaveOddsTable } from "@/data/insurance";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { datedName } from "@/lib/dated-name";
import { formatOddsText } from "@/lib/number-input";
import { Modal } from "./Modal";
import { OddsGrid, sameOdds, validOdds } from "./OddsGrid";
import { OddsTableMenu } from "./OddsTableMenu";

interface OddsTableEditorProps {
  /** The odds in use for this game */
  odds: readonly string[];
  /** The table those odds were taken from, which names it where another holds the same odds */
  tableId: string | undefined;
  /** Called with the odds to use, and the table they are from where they are a table's */
  onApply: (odds: readonly string[], tableId: string | undefined) => void;
}

/**
 * The odds table, folded by default. A built-in or saved table, picked from the menu at the right,
 * applies at once. Edits stay a draft until confirmed, and can then be saved as a table for later
 * games.
 */
export function OddsTableEditor({ odds, tableId, onApply }: OddsTableEditorProps) {
  const { data: saved = [] } = useOddsTables();
  const saveTable = useSaveOddsTable();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"apply" | "save" | "demo" | null>(null);
  const [applied, setApplied] = useState(odds);
  const [draft, setDraft] = useState(() => odds.map(formatOddsText));

  // A new table from outside replaces the draft
  if (applied.join() !== odds.join()) {
    setApplied(odds);
    setDraft(odds.map(formatOddsText));
  }

  const parsedDraft = draft.map(parseOdds);
  const canConfirm = validOdds(draft) && !sameOdds(parsedDraft, odds.map(parseOdds));

  /** Odds typed here are no table's, until they are saved as one. */
  function handleApply() {
    onApply(draft, undefined);
    setStep("save");
  }

  function handleSave(name: string) {
    const oddsHundredths = parsedDraft.flatMap((value) => (value === null ? [] : [value]));
    const existing = saved.find((t) => t.name === name);
    const table = existing ? { ...existing, oddsHundredths } : newOddsTable(name, oddsHundredths);
    saveTable.mutate(table, {
      onSuccess: () => {
        // The odds in use are this table's from now on, whatever other table holds the same
        onApply(table.oddsHundredths.map(formatOdds), table.id);
        setStep(null);
      },
    });
    return undefined;
  }

  return (
    <div>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 items-center gap-1 font-medium"
        >
          {t.common.oddsTable}
          <ChevronDown
            className={cn("size-5 text-muted transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        <OddsTableMenu
          odds={odds}
          tableId={tableId}
          onApply={onApply}
          align="right"
          className="text-sm"
        />
      </div>

      {open && (
        <div className="flex flex-col gap-3 pb-2">
          <OddsGrid draft={draft} onChange={setDraft} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep("demo")}
              className="min-h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-medium"
            >
              {t.insurance.oddsTableEditor.seeADemo}
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => setStep("apply")}
              className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-accent-text disabled:bg-line disabled:text-muted"
            >
              {t.common.confirm}
            </button>
            <button
              type="button"
              aria-label={t.insurance.oddsTableEditor.collapseTheOddsTable}
              onClick={() => setOpen(false)}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted"
            >
              <ChevronUp className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {step === "apply" && (
        <Modal title={t.insurance.oddsTableEditor.applyOddsTable} onClose={() => setStep(null)}>
          <p>{t.insurance.oddsTableEditor.applyToThisGame}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStep(null)}
              className="min-h-11 rounded-xl border border-line font-medium"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text"
            >
              {t.common.confirm}
            </button>
          </div>
        </Modal>
      )}

      {step === "save" && (
        <SaveNameDialog
          title={t.insurance.oddsTableEditor.saveAsAnOddsTableTo}
          label={t.insurance.oddsTableEditor.oddsTableNameAnExistingName}
          initialName={datedName(t.common.oddsTable, new Set(saved.map((t) => t.name)))}
          saving={saveTable.isPending}
          saveFailed={saveTable.isError}
          onSave={handleSave}
          onClose={() => setStep(null)}
        />
      )}

      {step === "demo" && (
        <Modal title={t.insurance.oddsTableEditor.seeADemo} onClose={() => setStep(null)}>
          <p className="py-6 text-center text-muted">{t.insurance.oddsTableEditor.inProgress}</p>
          <button
            type="button"
            onClick={() => setStep(null)}
            className="min-h-11 w-full rounded-xl border border-line font-medium"
          >
            {t.common.close}
          </button>
        </Modal>
      )}
    </div>
  );
}
