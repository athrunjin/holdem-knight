import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface TextMenuProps<T extends string> {
  /** What is being chosen, for a reader */
  label: string;
  options: readonly { readonly value: T; readonly label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Styles the text that shows the choice */
  className?: string;
}

/** A choice shown as plain text in a line. A tap lists the options and one more picks. */
export function TextMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: TextMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape closes the list from any option in it
    <div
      className="relative min-w-0"
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}：${current?.label ?? ""}`}
        onClick={() => setOpen(!open)}
        className={cn("min-h-11 max-w-full truncate", className)}
      >
        {current?.label}
      </button>
      {open && (
        <>
          {/* A tap anywhere else puts the list away */}
          <button
            type="button"
            aria-label="收起"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            aria-label={label}
            className="absolute top-full left-0 z-20 w-max min-w-36 rounded-xl border border-line bg-surface py-1 shadow-lg"
          >
            {options.map((option) => {
              const checked = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  onClick={() => {
                    setOpen(false);
                    if (!checked) onChange(option.value);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm",
                    checked && "font-medium text-highlight",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {checked && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
