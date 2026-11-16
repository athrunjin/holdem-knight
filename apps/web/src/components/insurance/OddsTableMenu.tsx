import { BUILT_IN_RULES, formatOdds, parseOdds, type SavedOddsTable } from "@holdem-knight/core";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { TextMenu } from "@/components/TextMenu";
import { useOddsTables, useRemoveOddsTable } from "@/data/insurance";
import { sameOdds } from "./OddsGrid";
import { OddsTableDialog } from "./OddsTableDialog";

/** Stands for odds that are no table on offer. */
const CUSTOM_TABLE = "custom";

interface OddsTableMenuProps {
  /** The odds in use */
  odds: readonly string[];
  onApply: (odds: readonly string[]) => void;
  /** Which edge of the line the list hangs from */
  align?: "left" | "right";
  className?: string;
}

/**
 * The odds table in use, as its name with a chevron, and a menu in the page to pick another: the
 * two built in and the saved ones. A saved table has a pencil and a bin after its name, and a
 * plus under the tables makes a new one. Odds that are no table on offer read 自定义.
 */
export function OddsTableMenu({ odds, onApply, align, className }: OddsTableMenuProps) {
  const { data: saved = [] } = useOddsTables();
  const removeTable = useRemoveOddsTable();
  // The odds table being made, with no table yet, or edited
  const [editing, setEditing] = useState<{ table?: SavedOddsTable }>();

  const current = odds.map(parseOdds);
  const inUse = (oddsHundredths: readonly number[]) => sameOdds(oddsHundredths, current);
  const apply = (oddsHundredths: readonly number[]) => onApply(oddsHundredths.map(formatOdds));
  const tables = [...BUILT_IN_RULES.map(({ id, name, rule }) => ({ id, name, ...rule })), ...saved];
  const selected = tables.find(({ oddsHundredths }) => inUse(oddsHundredths));

  const options = [
    // The two built in can only be picked
    ...BUILT_IN_RULES.map(({ id, name }) => ({ value: id as string, label: name })),
    ...saved.map((table) => ({
      value: table.id,
      label: <span className="truncate">{table.name}</span>,
      name: table.name,
      actions: [
        {
          label: "编辑",
          icon: <Pencil className="size-4" aria-hidden />,
          onSelect: () => setEditing({ table }),
        },
        {
          label: "删除",
          icon: <Trash2 className="size-4" aria-hidden />,
          onSelect: () => {
            if (window.confirm(`删除赔率表「${table.name}」？`)) removeTable.mutate(table.id);
          },
        },
      ],
    })),
    ...(selected ? [] : [{ value: CUSTOM_TABLE, label: "自定义" }]),
  ];

  return (
    <>
      <TextMenu
        label="赔率表"
        options={options}
        value={selected?.id ?? CUSTOM_TABLE}
        onChange={(id) => {
          const table = tables.find((other) => other.id === id);
          if (table) apply(table.oddsHundredths);
        }}
        footer={{
          label: "新建赔率表",
          icon: <Plus className="size-4" aria-hidden />,
          onSelect: () => setEditing({}),
        }}
        {...(align && { align })}
        {...(className !== undefined && { className })}
      />
      {editing && (
        <OddsTableDialog
          table={editing.table}
          onSaved={(table) => {
            // A new table is put in use, and so are the new odds of the table already in use
            if (!editing.table || selected?.id === table.id) apply(table.oddsHundredths);
            setEditing(undefined);
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
