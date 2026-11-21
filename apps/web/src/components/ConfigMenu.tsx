import { ChevronDown, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ConfigName } from "@/components/ConfigName";
import { ChoiceModal } from "@/components/insurance/ChoiceModal";
import { TextMenu } from "@/components/TextMenu";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { MODIFIED_MARK } from "@/lib/config-text";

/** One set of settings on offer: last time's, the default, or a saved one. */
export interface ConfigChoice {
  readonly id: string;
  readonly name: string;
  /** Drawn before the name in the list */
  readonly icon?: ReactNode;
  /** A saved one, which can be deleted from the list */
  readonly removable?: boolean;
}

/** With more saved ones than this, the list opens as a dialog instead of under its line. */
export const MOST_SAVED_IN_MENU = 5;

/** Stands in the list for settings that are none of those on offer. */
const CUSTOM = "custom";

interface ConfigMenuProps {
  /** What is being chosen, such as 工资设置: for a reader, and the dialog's title */
  label: string;
  /** Shown before the choice */
  caption?: string;
  choices: readonly ConfigChoice[];
  /** The choice in use. One that is not on offer reads 自定义 */
  selectedId: string | undefined;
  /** The settings were changed by hand since they were taken from the saved choice in use */
  modified?: boolean;
  /** Also called for the choice already in use, which takes its settings back */
  onPick: (id: string) => void;
  /** Deletes a saved choice. Missing where the list cannot delete */
  onRemove?: (id: string) => void;
  align?: "left" | "right";
  /** Styles the line */
  className?: string;
  /** In place of the chevron */
  icon?: ReactNode;
}

/**
 * The settings in use, as a name on a line, and a way to switch: a tap lists the others right under
 * the line and one more switches, with nothing to confirm. The saved ones each have a bin. Once
 * there are more than five saved ones, not counting last time's and the default, the list opens as
 * a dialog, where it has room to scroll.
 */
export function ConfigMenu({
  label,
  caption,
  choices,
  selectedId,
  modified = false,
  onPick,
  onRemove,
  align = "left",
  className,
  icon,
}: ConfigMenuProps) {
  const [open, setOpen] = useState(false);
  const selected = choices.find((choice) => choice.id === selectedId);
  const changed = modified && selected !== undefined;
  const name = selected?.name ?? t.common.custom;
  const inDialog = choices.filter((choice) => choice.removable).length > MOST_SAVED_IN_MENU;

  if (!inDialog) {
    return (
      <TextMenu
        label={label}
        {...(caption !== undefined && { caption })}
        options={[
          ...choices.map((choice) => ({
            value: choice.id,
            label: (
              <>
                {choice.icon}
                <span className="truncate">{choice.name}</span>
              </>
            ),
            name: choice.name,
            ...(choice.id === selectedId && {
              chosen: <ConfigName name={choice.name} modified={changed} />,
              name: `${choice.name}${changed ? MODIFIED_MARK : ""}`,
            }),
            ...(choice.removable &&
              onRemove && {
                actions: [
                  {
                    label: t.ui.configMenu.delete,
                    icon: <Trash2 className="size-4" aria-hidden />,
                    onSelect: () => onRemove(choice.id),
                  },
                ],
              }),
          })),
          ...(selected ? [] : [{ value: selectedId ?? CUSTOM, label: t.common.custom }]),
        ]}
        value={selectedId ?? CUSTOM}
        onChange={onPick}
        align={align}
        {...(className !== undefined && { className })}
        {...(icon !== undefined && { icon })}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${label}：${name}${changed ? MODIFIED_MARK : ""}`}
        onClick={() => setOpen(true)}
        className={cn("flex min-h-11 max-w-full min-w-0 items-center gap-1", className)}
      >
        {caption && <span className="mr-1 shrink-0 font-normal text-muted">{caption}</span>}
        <ConfigName name={name} modified={changed} />
        {icon ?? <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />}
      </button>
      {open && (
        <ChoiceModal
          title={label}
          choices={choices}
          selectedId={selectedId}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
          }}
          {...(onRemove && { onRemove })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
