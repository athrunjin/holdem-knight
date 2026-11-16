import {
  BUILT_IN_RULES,
  formatOdds,
  parseOdds,
  RULE_30,
  type SavedOddsTable,
} from "@holdem-knight/core";
import { PenLine, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  newOddsTable,
  useOddsTables,
  useRemoveOddsTable,
  useSaveOddsTable,
} from "@/data/insurance";
import { datedName } from "@/lib/dated-name";
import { formatOddsText, selectOnFocus } from "@/lib/number-input";
import { Modal } from "./Modal";
import { OddsGrid, sameOdds, validOdds } from "./OddsGrid";

/** What the dialog is opened on: a table to make, a saved one to edit, or one built in to look at. */
export type OddsTableSubject =
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly table: SavedOddsTable }
  | { readonly kind: "view"; readonly name: string; readonly oddsHundredths: readonly number[] };

interface OddsTableDialogProps {
  subject: OddsTableSubject;
  /** Called with the table once it is saved */
  onSaved: (table: SavedOddsTable) => void;
  onClose: () => void;
}

const iconClass = "grid size-11 shrink-0 place-items-center text-muted";

/**
 * An odds table on its own, away from any game: its name at the top, then the odds for each number
 * of outs, edited as in a game's settings. A new table starts from 1 赔 30 under a dated name and
 * can be saved as it is. A saved one is saved again only once its name or odds have changed, and
 * can be deleted here. Odds the same as another table's are saved only after asking. A table
 * built in is only shown.
 */
export function OddsTableDialog({ subject, onSaved, onClose }: OddsTableDialogProps) {
  const { data: saved = [] } = useOddsTables();
  const saveTable = useSaveOddsTable();
  const removeTable = useRemoveOddsTable();
  const table = subject.kind === "edit" ? subject.table : undefined;
  const readOnly = subject.kind === "view";
  const base =
    subject.kind === "view"
      ? subject.oddsHundredths
      : (table?.oddsHundredths ?? RULE_30.oddsHundredths);

  const [name, setName] = useState(() =>
    subject.kind === "view"
      ? subject.name
      : (table?.name ?? datedName("赔率表", new Set(saved.map((other) => other.name)))),
  );
  // The name as it was before renaming began, to go back to if it is left empty
  const [renaming, setRenaming] = useState<string>();
  const [issue, setIssue] = useState<string>();
  const [draft, setDraft] = useState<readonly string[]>(() =>
    base.map((odds) => formatOddsText(formatOdds(odds))),
  );
  // The table whose odds are the same, while the dialog asks whether to save all the same
  const [twin, setTwin] = useState<string>();

  const parsed = draft.map(parseOdds);
  const changed = !table || name.trim() !== table.name || !sameOdds(parsed, base);
  const canConfirm = validOdds(draft) && changed && !saveTable.isPending;

  function save() {
    const oddsHundredths = parsed.flatMap((value) => value ?? []);
    const next = table
      ? { ...table, name: name.trim(), oddsHundredths }
      : newOddsTable(name.trim(), oddsHundredths);
    saveTable.mutate(next, { onSuccess: () => onSaved(next) });
  }

  function handleConfirm() {
    const trimmed = name.trim();
    const others = saved.filter((other) => other.id !== table?.id);
    if (trimmed === "") return setIssue("请输入名称");
    if (BUILT_IN_RULES.some((builtIn) => builtIn.name === trimmed)) {
      return setIssue("这是预设赔率表的名称");
    }
    if (others.some((other) => other.name === trimmed)) return setIssue("已有同名的赔率表");
    const same = [
      ...BUILT_IN_RULES.map(({ name: builtIn, rule }) => ({ name: builtIn, ...rule })),
      ...others,
    ].find(({ oddsHundredths }) => sameOdds(parsed, oddsHundredths));
    if (same) return setTwin(same.name);
    save();
  }

  function handleRemove() {
    if (table && window.confirm(`删除赔率表「${table.name}」？`)) {
      removeTable.mutate(table.id, { onSuccess: onClose });
    }
  }

  const title = (
    <span className="flex items-center text-lg">
      {renaming === undefined ? (
        <button
          type="button"
          disabled={readOnly}
          aria-label={readOnly ? undefined : `赔率表名称：${name}，点按重命名`}
          onClick={() => setRenaming(name)}
          className="min-h-11 min-w-0 flex-1 truncate text-left font-semibold"
        >
          {name}
        </button>
      ) : (
        <input
          type="text"
          aria-label="赔率表名称"
          // Opened by a tap on the name or the pen, so the keyboard is expected
          // biome-ignore lint/a11y/noAutofocus: the field appears in answer to that tap
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setIssue(undefined);
          }}
          onFocus={(event) => selectOnFocus(event.currentTarget)}
          onBlur={() => {
            if (name.trim() === "") setName(renaming);
            setRenaming(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-h-11 w-full min-w-0 flex-1 border-b border-highlight bg-transparent font-semibold outline-none"
        />
      )}
      {!readOnly && (
        <button
          type="button"
          aria-label="重命名"
          // Keeps the field's focus, so a tap while renaming does not end and restart it
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => renaming === undefined && setRenaming(name)}
          className={iconClass}
        >
          <PenLine className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      )}
      {table && (
        <button type="button" aria-label="删除赔率表" onClick={handleRemove} className={iconClass}>
          <Trash2 className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </span>
  );

  return (
    <Modal title={title} onClose={onClose}>
      {issue && (
        <p role="alert" className="mb-2 text-sm text-highlight">
          {issue}
        </p>
      )}
      <OddsGrid draft={draft} readOnly={readOnly} onChange={setDraft} />
      {(saveTable.isError || removeTable.isError) && (
        <p role="alert" className="mt-2 text-sm text-highlight">
          保存失败，请重试。
        </p>
      )}
      {readOnly ? (
        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
        >
          关闭
        </button>
      ) : (
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
            onClick={handleConfirm}
            className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text disabled:bg-line disabled:text-muted"
          >
            确认
          </button>
        </div>
      )}
      {twin !== undefined && (
        <Modal title="赔率相同" onClose={() => setTwin(undefined)}>
          <p>当前赔率和「{twin}」相同，是否保存？</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTwin(undefined)}
              className="min-h-11 rounded-xl border border-line font-medium"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setTwin(undefined);
                save();
              }}
              className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text"
            >
              保存
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
