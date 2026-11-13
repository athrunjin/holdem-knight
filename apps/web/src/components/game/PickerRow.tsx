import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/insurance/Modal";
import { cn } from "@/lib/cn";

interface PickerRowProps<Value extends string> {
  /** What the row shows: the subject and the current choice */
  children: ReactNode;
  title: string;
  options: readonly (readonly [Value, string])[];
  value: Value | undefined;
  /** Locked rows show the choice with no way to change it */
  disabled: boolean;
  /** Draws attention, for a choice that still needs making or changes the books */
  warn?: boolean;
  /** Small highlighted text with an arrow in place of the row, to sit at the end of a line of text. */
  inline?: boolean;
  onChange: (value: Value) => void;
}

/** One compact row showing a choice, which opens the options when tapped. */
export function PickerRow<Value extends string>({
  children,
  title,
  options,
  value,
  disabled,
  warn = false,
  inline = false,
  onChange,
}: PickerRowProps<Value>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {inline ? (
        // The 44px target reaches up from the line of text, which stays as short as it was
        <button
          type="button"
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="-mt-8 flex min-h-11 max-w-[45%] min-w-0 shrink-0 items-end text-xs leading-none text-highlight"
        >
          <span className="truncate pb-px">{children}</span>
          {!disabled && <ChevronDown className="-mb-px size-3.5 shrink-0" aria-hidden />}
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            "mt-2 flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm",
            warn ? "border-highlight bg-highlight/10" : "border-line bg-surface",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{children}</span>
          {!disabled && (
            <span className="flex shrink-0 items-center text-xs text-muted">
              切换
              <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </button>
      )}
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {options.map(([option, label]) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left font-medium",
                    value === option && "text-highlight",
                  )}
                >
                  <span className="truncate">{label}</span>
                  {value === option && <Check className="size-5 shrink-0" aria-label="当前选中" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 min-h-11 w-full rounded-xl border border-line font-medium"
          >
            取消
          </button>
        </Modal>
      )}
    </>
  );
}
