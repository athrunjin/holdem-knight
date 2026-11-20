import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";

/** Something to do from the list other than picking an option: an icon with a name for a reader. */
export interface TextMenuAction {
  readonly label: string;
  readonly icon: ReactNode;
  readonly onSelect: () => void;
}

export interface TextMenuOption<T extends string> {
  readonly value: T;
  /** What the list shows for it */
  readonly label: ReactNode;
  /** What the line shows while it is chosen, where that is not the label */
  readonly chosen?: ReactNode;
  /** For a reader, where the label is not text */
  readonly name?: string;
  /** Shown gray and not for picking, such as a choice already taken elsewhere */
  readonly disabled?: boolean;
  /** Icons after the label, such as to edit or delete what the option stands for */
  readonly actions?: readonly TextMenuAction[];
}

interface TextMenuProps<T extends string> {
  /** What is being chosen, for a reader */
  label: string;
  /** Shown before the choice */
  caption?: string;
  options: readonly TextMenuOption<T>[];
  /** Missing while nothing is chosen yet, when the line shows `placeholder` */
  value: T | undefined;
  placeholder?: ReactNode;
  /** Also called for the choice already in force */
  onChange: (value: T) => void;
  /** Which edge of the line the list hangs from */
  align?: "left" | "right";
  /** A last line under the options, such as one that adds an option */
  footer?: TextMenuAction;
  disabled?: boolean;
  /** Styles the line, and so the text that shows the choice */
  className?: string;
  captionClassName?: string;
  /** In place of the chevron, such as a mark for switching */
  icon?: ReactNode;
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
  placeholder,
  onChange,
  align = "left",
  footer,
  disabled = false,
  className,
  captionClassName,
  icon,
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
        aria-label={`${label}：${current ? readerText(current) : typeof placeholder === "string" ? placeholder : ""}`}
        onClick={() => setOpen(!open)}
        className={cn("flex min-h-11 max-w-full items-center gap-1 disabled:opacity-60", className)}
      >
        {caption && (
          <span className={cn("mr-1 shrink-0 font-normal text-muted", captionClassName)}>
            {caption}
          </span>
        )}
        <span className="flex min-w-0 items-center truncate">
          {current ? (current.chosen ?? current.label) : placeholder}
        </span>
        {icon ?? (
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
            className={cn(
              "absolute top-full z-20 max-h-[60dvh] w-max max-w-[calc(100vw-2rem)] min-w-28 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg",
              align === "left" ? "left-0" : "right-0",
            )}
          >
            {options.map((option) => {
              const checked = option.value === value;
              return (
                <div key={option.value} className="flex items-center">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    aria-label={option.name}
                    disabled={option.disabled}
                    onClick={() => {
                      setOpen(false);
                      onChange(option.value);
                    }}
                    className={cn(
                      // The choice in force is the one in full white
                      "flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 text-left text-sm font-normal disabled:opacity-40",
                      checked ? "font-medium text-text" : "text-muted",
                    )}
                  >
                    {option.label}
                  </button>
                  {option.actions?.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      role="menuitem"
                      aria-label={`${action.label} ${readerText(option)}`}
                      onClick={() => {
                        setOpen(false);
                        action.onSelect();
                      }}
                      className="grid h-11 w-10 shrink-0 place-items-center text-muted"
                    >
                      {action.icon}
                    </button>
                  ))}
                </div>
              );
            })}
            {footer && (
              <button
                type="button"
                role="menuitem"
                aria-label={footer.label}
                onClick={() => {
                  setOpen(false);
                  footer.onSelect();
                }}
                className="mt-1 flex min-h-11 w-full items-center justify-center border-t border-line text-muted"
              >
                {footer.icon}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
