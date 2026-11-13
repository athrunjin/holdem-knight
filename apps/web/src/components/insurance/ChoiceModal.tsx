import { Check, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Modal } from "./Modal";

export interface Choice {
  readonly id: string;
  readonly name: string;
  /** Drawn before the name */
  readonly icon?: ReactNode;
  /** Saved choices can be deleted from the list */
  readonly removable?: boolean;
}

interface ChoiceModalProps {
  title: string;
  choices: readonly Choice[];
  selectedId: string | undefined;
  onPick: (id: string) => void;
  onRemove?: (id: string) => void;
  onClose: () => void;
}

/** A dropdown's options in a dialog: tap one to pick it. */
export function ChoiceModal({
  title,
  choices,
  selectedId,
  onPick,
  onRemove,
  onClose,
}: ChoiceModalProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <ul className="max-h-[60dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {choices.map(({ id, name, icon, removable }) => (
          <li key={id} className="flex">
            <button
              type="button"
              onClick={() => onPick(id)}
              className={cn(
                "flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left font-medium",
                selectedId === id && "text-highlight",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {icon}
                <span className="truncate">{name}</span>
              </span>
              {selectedId === id && <Check className="size-5 shrink-0" aria-label="当前选中" />}
            </button>
            {removable && onRemove && (
              <button
                type="button"
                aria-label={`删除 ${name}`}
                onClick={() => onRemove(id)}
                className="grid min-h-12 w-12 shrink-0 place-items-center text-muted"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
      >
        关闭
      </button>
    </Modal>
  );
}
