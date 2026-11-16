import { parseOdds } from "@holdem-knight/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { newOddsTable, useOddsTables, useSaveOddsTable } from "@/data/insurance";
import { cn } from "@/lib/cn";
import { datedName } from "@/lib/dated-name";
import { formatOddsText } from "@/lib/number-input";
import { Modal } from "./Modal";
import { OddsGrid, sameOdds, validOdds } from "./OddsGrid";
import { OddsTableMenu } from "./OddsTableMenu";

interface OddsTableEditorProps {
  /** The odds in use for this game */
  odds: readonly string[];
  onApply: (odds: readonly string[]) => void;
}

/**
 * The odds table, folded by default. A built-in or saved table, picked from the menu at the right,
 * applies at once. Edits stay a draft until confirmed, and can then be saved as a table for later
 * games.
 */
export function OddsTableEditor({ odds, onApply }: OddsTableEditorProps) {
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

  function handleApply() {
    onApply(draft);
    setStep("save");
  }

  function handleSave(name: string) {
    const oddsHundredths = parsedDraft.flatMap((value) => (value === null ? [] : [value]));
    const existing = saved.find((t) => t.name === name);
    const table = existing ? { ...existing, oddsHundredths } : newOddsTable(name, oddsHundredths);
    saveTable.mutate(table, { onSuccess: () => setStep(null) });
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
          赔率表
          <ChevronDown
            className={cn("size-5 text-muted transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        <OddsTableMenu odds={odds} onApply={onApply} align="right" className="text-sm" />
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
              查看demo
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => setStep("apply")}
              className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-accent-text disabled:bg-line disabled:text-muted"
            >
              确认
            </button>
            <button
              type="button"
              aria-label="收起赔率表"
              onClick={() => setOpen(false)}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted"
            >
              <ChevronUp className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {step === "apply" && (
        <Modal title="应用赔率表" onClose={() => setStep(null)}>
          <p>是否应用到本局？</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStep(null)}
              className="min-h-11 rounded-xl border border-line font-medium"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text"
            >
              确认
            </button>
          </div>
        </Modal>
      )}

      {step === "save" && (
        <SaveNameDialog
          title="保存为赔率表，下次快速应用？"
          label="赔率表名称，同名会覆盖"
          initialName={datedName("赔率表", new Set(saved.map((t) => t.name)))}
          saving={saveTable.isPending}
          saveFailed={saveTable.isError}
          onSave={handleSave}
          onClose={() => setStep(null)}
        />
      )}

      {step === "demo" && (
        <Modal title="查看demo" onClose={() => setStep(null)}>
          <p className="py-6 text-center text-muted">开发中</p>
          <button
            type="button"
            onClick={() => setStep(null)}
            className="min-h-11 w-full rounded-xl border border-line font-medium"
          >
            关闭
          </button>
        </Modal>
      )}
    </div>
  );
}
