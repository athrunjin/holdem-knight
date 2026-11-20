import {
  BUILT_IN_RULES,
  formatOdds,
  type OddsTableRef,
  oddsTableInUse,
  parseOdds,
} from "@holdem-knight/core";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { TextMenu } from "@/components/TextMenu";
import { useConfigFollowers } from "@/data/game-configs";
import { useOddsTables, useRemoveOddsTable } from "@/data/insurance";
import { removalQuestion } from "@/lib/config-text";
import { OddsTableDialog, type OddsTableSubject } from "./OddsTableDialog";

/** Stands for odds that are no table on offer. */
const CUSTOM_TABLE = "custom";

interface OddsTableMenuProps {
  /** The odds in use */
  odds: readonly string[];
  /** The table those odds were taken from, which names it where another holds the same odds */
  tableId: string | undefined;
  /** Called with a table's odds and the table they are from */
  onApply: (odds: readonly string[], tableId: string) => void;
  /** Which edge of the line the list hangs from */
  align?: "left" | "right";
  className?: string;
}

/**
 * The odds table in use, as its name with a chevron, and a menu in the page to pick another: the
 * two built in and the saved ones. A saved table has a pencil and a bin after its name, one built
 * in has an eye where the bin would be, and a plus under the tables makes a new one. Odds that
 * are no table on offer read 自定义.
 */
export function OddsTableMenu({ odds, tableId, onApply, align, className }: OddsTableMenuProps) {
  const { data: saved = [] } = useOddsTables();
  const removeTable = useRemoveOddsTable();
  const followers = useConfigFollowers();
  // The odds table being made, edited or looked at
  const [subject, setSubject] = useState<OddsTableSubject>();

  const apply = ({ id, oddsHundredths }: OddsTableRef) =>
    onApply(oddsHundredths.map(formatOdds), id);
  const tables = [...BUILT_IN_RULES.map(({ id, name, rule }) => ({ id, name, ...rule })), ...saved];
  // By the table the odds came from, not by the odds alone: two tables can hold the same odds
  const selected = oddsTableInUse(tables, odds.map(parseOdds), tableId);

  const options = [
    // The two built in can be looked at, where a saved table has its bin, but not changed
    ...BUILT_IN_RULES.map(({ id, name, rule }) => ({
      value: id as string,
      label: name,
      actions: [
        {
          label: "查看",
          icon: <Eye className="size-4" aria-hidden />,
          onSelect: () => setSubject({ kind: "view", name, oddsHundredths: rule.oddsHundredths }),
        },
      ],
    })),
    ...saved.map((table) => ({
      value: table.id,
      label: <span className="truncate">{table.name}</span>,
      name: table.name,
      actions: [
        {
          label: "编辑",
          icon: <Pencil className="size-4" aria-hidden />,
          onSelect: () => setSubject({ kind: "edit", table }),
        },
        {
          label: "删除",
          icon: <Trash2 className="size-4" aria-hidden />,
          onSelect: () => {
            const using = followers({ oddsTableId: table.id });
            if (window.confirm(removalQuestion("赔率表", table.name, using))) {
              removeTable.mutate(table.id);
            }
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
          if (table) apply(table);
        }}
        footer={{
          label: "新建赔率表",
          icon: <Plus className="size-4" aria-hidden />,
          onSelect: () => setSubject({ kind: "new" }),
        }}
        {...(align && { align })}
        {...(className !== undefined && { className })}
      />
      {subject && (
        <OddsTableDialog
          subject={subject}
          onSaved={(table) => {
            // A new table is put in use, and so are the new odds of the table already in use
            if (subject.kind === "new" || selected?.id === table.id) apply(table);
            setSubject(undefined);
          }}
          onClose={() => setSubject(undefined)}
        />
      )}
    </>
  );
}
