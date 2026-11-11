import { BUILT_IN_RULES, formatOdds, parseOdds } from "@holdem-knight/core";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
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
import { formatOddsText, selectOnFocus } from "@/lib/number-input";
import { ChoiceModal } from "./ChoiceModal";
import { Modal } from "./Modal";

const sameOdds = (a: readonly (number | null)[], b: readonly (number | null)[]) =>
  a.length === b.length && a.every((odds, i) => odds === b[i]);

interface OddsTableEditorProps {
  /** The odds in use for this game */
  odds: readonly string[];
  onApply: (odds: readonly string[]) => void;
}

/**
 * The odds table, folded by default. A built-in or saved table applies at once. Edits stay a draft
 * until confirmed, and can then be saved as a table for later games.
 */
export function OddsTableEditor({ odds, onApply }: OddsTableEditorProps) {
  const { data: saved = [] } = useOddsTables();
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
  const parsedDraft = draft.map(parseOdds);
  const valid = draft.length > 0 && parsedDraft.every((value) => value !== null);
  const canConfirm = valid && !sameOdds(parsedDraft, current);

  function pickTable(id: string) {
    const table = tables.find((t) => t.id === id);
    if (table) onApply(table.oddsHundredths.map(formatOdds));
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

  const last = draft.length - 1;

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
          <div className="grid grid-cols-4 gap-2">
            {draft.map((value, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: each cell is the place for that many outs
              <div key={i} className="min-w-0">
                <div className="flex h-5 items-center justify-between text-xs text-muted">
                  <label htmlFor={`odds-${i + 1}`}>{i + 1} outs</label>
                  {i === last && last > 0 && (
                    <button
                      type="button"
                      aria-label={`删除 ${i + 1} outs`}
                      onClick={() => setDraft(draft.slice(0, -1))}
                      className="relative z-10 -my-3 -mr-1.5 grid h-11 w-8 place-items-center"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
                <input
                  id={`odds-${i + 1}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  aria-invalid={parsedDraft[i] === null ? true : undefined}
                  onChange={(event) =>
                    setDraft(draft.map((v, j) => (j === i ? event.target.value : v)))
                  }
                  onFocus={(event) => selectOnFocus(event.currentTarget)}
                  onBlur={() => setDraft(draft.map((v, j) => (j === i ? formatOddsText(v) : v)))}
                  // Enter would submit the whole game form
                  onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
                  className={cn(
                    "mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-bg px-1 text-center tabular-nums outline-none focus:border-highlight",
                    parsedDraft[i] === null ? "border-highlight" : "border-line",
                  )}
                />
              </div>
            ))}
            <div className="flex items-end">
              <button
                type="button"
                aria-label="增加一行"
                onClick={() => setDraft([...draft, draft.at(-1) ?? "1"])}
                className="grid min-h-11 w-full place-items-center rounded-lg border border-dashed border-line text-muted"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>

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
