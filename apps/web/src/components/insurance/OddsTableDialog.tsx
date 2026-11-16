import {
  BUILT_IN_RULES,
  formatOdds,
  parseOdds,
  RULE_30,
  type SavedOddsTable,
} from "@holdem-knight/core";
import { useState } from "react";
import { SaveNameDialog } from "@/components/SaveNameDialog";
import { newOddsTable, useOddsTables, useSaveOddsTable } from "@/data/insurance";
import { datedName } from "@/lib/dated-name";
import { formatOddsText } from "@/lib/number-input";
import { Modal } from "./Modal";
import { OddsGrid, sameOdds, validOdds } from "./OddsGrid";

interface OddsTableDialogProps {
  /** The saved table to edit. Left out to make a new one, which starts from 1 赔 30. */
  table?: SavedOddsTable | undefined;
  /** Called with the table once it is saved */
  onSaved: (table: SavedOddsTable) => void;
  onClose: () => void;
}

/**
 * Makes an odds table or edits a saved one, on its own, away from any game. The odds are edited
 * as in a game's settings, and 确认 lights only once they are valid and differ from the table they
 * started from. It then asks for the name and saves.
 */
export function OddsTableDialog({ table, onSaved, onClose }: OddsTableDialogProps) {
  const { data: saved = [] } = useOddsTables();
  const saveTable = useSaveOddsTable();
  const base = table?.oddsHundredths ?? RULE_30.oddsHundredths;
  const [draft, setDraft] = useState<readonly string[]>(() =>
    base.map((odds) => formatOddsText(formatOdds(odds))),
  );
  const [naming, setNaming] = useState(false);

  const canConfirm = validOdds(draft) && !sameOdds(draft.map(parseOdds), base);

  function handleSave(name: string) {
    const oddsHundredths = draft.flatMap((value) => parseOdds(value) ?? []);
    if (BUILT_IN_RULES.some((builtIn) => builtIn.name === name)) return "这是预设赔率表的名称";
    const namesake = saved.find((other) => other.name === name);
    if (table && namesake && namesake.id !== table.id) return "已有同名的赔率表";
    // A new table under a name in use replaces that table, as in a game's settings
    const next = table
      ? { ...table, name, oddsHundredths }
      : namesake
        ? { ...namesake, oddsHundredths }
        : newOddsTable(name, oddsHundredths);
    saveTable.mutate(next, { onSuccess: () => onSaved(next) });
    return undefined;
  }

  return (
    <Modal title={table ? `编辑赔率表「${table.name}」` : "新建赔率表"} onClose={onClose}>
      <OddsGrid draft={draft} onChange={setDraft} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-line font-medium"
        >
          取消
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => setNaming(true)}
          className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:bg-line disabled:text-muted"
        >
          确认
        </button>
      </div>
      {naming && (
        <SaveNameDialog
          title={table ? "保存修改后的赔率表？" : "保存为赔率表，下次快速应用？"}
          label={table ? "赔率表名称" : "赔率表名称，同名会覆盖"}
          initialName={table?.name ?? datedName("赔率表", new Set(saved.map((t) => t.name)))}
          saving={saveTable.isPending}
          saveFailed={saveTable.isError}
          onSave={handleSave}
          onClose={() => setNaming(false)}
        />
      )}
    </Modal>
  );
}
