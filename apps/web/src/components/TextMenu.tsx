import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";

interface TextMenuOption<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
  /** For a reader, where the label is not text */
  readonly name?: string;
}

interface TextMenuProps<T extends string> {
  /** What is being chosen, for a reader */
  label: string;
  options: readonly TextMenuOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shows the label before the choice, and a chevron after it */
  captioned?: boolean;
  /** Styles the text that shows the choice */
  className?: string;
}

const readerText = ({ label, name }: TextMenuOption<string>) =>
  name ?? (typeof label === "string" ? label : "");

/** A choice shown as plain text in a line. A tap lists the options and one more picks. */
export function TextMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  captioned = false,
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
        aria-label={`${label}：${current ? readerText(current) : ""}`}
        onClick={() => setOpen(!open)}
        className={cn("flex min-h-11 max-w-full items-center gap-1", className)}
      >
        {captioned && <span className="mr-1 shrink-0 font-normal text-muted">{label}</span>}
        <span className="flex min-w-0 items-center truncate">{current?.label}</span>
        {captioned && (
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
            aria-hidden
          />
        )}
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
            className="absolute top-full left-0 z-20 w-max min-w-28 rounded-xl border border-line bg-surface py-1 shadow-lg"
          >
            {options.map((option) => {
              const checked = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  aria-label={option.name}
                  onClick={() => {
                    setOpen(false);
                    if (!checked) onChange(option.value);
                  }}
                  className={cn(
                    // The choice in force is the one in full white
                    "flex min-h-11 w-full items-center px-3 text-left text-sm",
                    checked ? "font-medium text-text" : "text-muted",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
