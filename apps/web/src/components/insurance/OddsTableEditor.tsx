import { BUILT_IN_RULES, formatOdds, parseOdds } from "@holdem-knight/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import {
  newOddsTable,
  useOddsTables,
  useRemoveOddsTable,
  useSaveOddsTable,
} from "@/data/insurance";
import { cn } from "@/lib/cn";
import { datedName } from "@/lib/dated-name";
import { formatOddsText } from "@/lib/number-input";
import { ChoiceModal } from "./ChoiceModal";
import { Modal } from "./Modal";
import { OddsGrid, sameOdds, validOdds } from "./OddsGrid";

interface OddsTableEditorProps {
  /** The odds in use for this game */
  odds: readonly string[];
  onApply: (odds: readonly string[]) => void;
}

/**
 * The odds tables on offer, built in and saved, and the one the odds in use belong to, if any.
 * `apply` puts a table's odds in use.
 */
export function useOddsTableChoices(
  odds: readonly string[],
  onApply: (odds: readonly string[]) => void,
) {
  const { data: saved = [] } = useOddsTables();
  const tables = [
    ...BUILT_IN_RULES.map(({ id, name, rule }) => ({
      id,
      name,
      oddsHundredths: rule.oddsHundredths,
    })),
    ...saved.map((table) => ({ ...table, removable: true })),
  ];
  const current = odds.map(parseOdds);
  const selected = tables.find((table) => sameOdds(table.oddsHundredths, current));

  function apply(id: string) {
    const table = tables.find((t) => t.id === id);
    if (table) onApply(table.oddsHundredths.map(formatOdds));
  }

  return { saved, tables, current, selected, apply };
}

/**
 * The odds table, folded by default. A built-in or saved table applies at once. Edits stay a draft
 * until confirmed, and can then be saved as a table for later games.
 */
export function OddsTableEditor({ odds, onApply }: OddsTableEditorProps) {
  const { saved, tables, current, selected, apply } = useOddsTableChoices(odds, onApply);
  const saveTable = useSaveOddsTable();
  const removeTable = useRemoveOddsTable();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [step, setStep] = useState<"apply" | "save" | "demo" | null>(null);
  const [applied, setApplied] = useState(odds);
  const [draft, setDraft] = useState(() => odds.map(formatOddsText));

  // A new table from outside replaces the draft
  if (applied.join() !== odds.join()) {
    setApplied(odds);
    setDraft(odds.map(formatOddsText));
  }

  const parsedDraft = draft.map(parseOdds);
  const canConfirm = validOdds(draft) && !sameOdds(parsedDraft, current);

  function pickTable(id: string) {
    apply(id);
    setPicking(false);
  }

  function handleRemove(id: string) {
    const table = saved.find((t) => t.id === id);
    if (table && window.confirm(`删除赔率表「${table.name}」？`)) removeTable.mutate(id);
  }

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
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setPicking(true)}
          className="flex min-h-11 min-w-0 items-center gap-0.5 text-sm"
        >
          <span className="truncate">{selected?.name ?? "自定义"}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
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

      {picking && (
        <ChoiceModal
          title="赔率表"
          choices={tables}
          selectedId={selected?.id}
          onPick={pickTable}
          onRemove={handleRemove}
          onClose={() => setPicking(false)}
        />
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
