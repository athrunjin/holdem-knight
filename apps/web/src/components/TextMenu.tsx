import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";

export interface TextMenuOption<T extends string> {
  readonly value: T;
  /** What the list shows for it */
  readonly label: ReactNode;
  /** What the line shows while it is chosen, where that is not the label */
  readonly chosen?: ReactNode;
  /** For a reader, where the label is not text */
  readonly name?: string;
}

interface TextMenuProps<T extends string> {
  /** What is being chosen, for a reader */
  label: string;
  /** Shown before the choice */
  caption?: string;
  options: readonly TextMenuOption<T>[];
  value: T;
  /** Also called for the choice already in force */
  onChange: (value: T) => void;
  /** Which edge of the line the list hangs from */
  align?: "left" | "right";
  disabled?: boolean;
  /** Styles the line, and so the text that shows the choice */
  className?: string;
  captionClassName?: string;
}

const readerText = ({ label, name }: TextMenuOption<string>) =>
  name ?? (typeof label === "string" ? label : "");

/**
 * A choice shown as text in a line, with a chevron after it. A tap lists the options right under
 * it, in the page, and one more picks.
 */
export function TextMenu<T extends string>({
  label,
  caption,
  options,
  value,
  onChange,
  align = "left",
  disabled = false,
  className,
  captionClassName,
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
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}：${current ? readerText(current) : ""}`}
        onClick={() => setOpen(!open)}
        className={cn("flex min-h-11 max-w-full items-center gap-1 disabled:opacity-60", className)}
      >
        {caption && (
          <span className={cn("mr-1 shrink-0 font-normal text-muted", captionClassName)}>
            {caption}
          </span>
        )}
        <span className="flex min-w-0 items-center truncate">
          {current?.chosen ?? current?.label}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
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
            className={cn(
              "absolute top-full z-20 w-max min-w-28 rounded-xl border border-line bg-surface py-1 shadow-lg",
              align === "left" ? "left-0" : "right-0",
            )}
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
                    onChange(option.value);
                  }}
                  className={cn(
                    // The choice in force is the one in full white
                    "flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-normal",
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
