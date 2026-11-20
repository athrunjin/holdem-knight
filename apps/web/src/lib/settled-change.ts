import { type FocusEvent, useRef, useState } from "react";

/** A field being typed into, whose every key would otherwise make a change of its own. */
const isTyping = (element: EventTarget | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === "text";

/**
 * Changes to settings that are asked about before they apply, such as a game's own rule, without
 * asking at every key: a change typed into a field waits, and the last of them goes through once
 * the field is left for anything but another field among the settings. Taps on switches and lists
 * go through at once. `onChange` returns false to turn a change down, and the settings then show
 * as they were. `containerProps` go on the element around the settings.
 */
export function useSettledChange<T>(value: T, onChange: (next: T) => boolean | undefined) {
  const [draft, setDraft] = useState<{ readonly next: T }>();
  // Set by a key in one of the fields, just before the field reports its change
  const typed = useRef(false);

  function settle(next: T) {
    setDraft(undefined);
    onChange(next);
  }

  return {
    /** What the settings show: the change being typed, or else `value` */
    value: draft ? draft.next : value,
    change(next: T) {
      const fromTyping = typed.current;
      typed.current = false;
      if (fromTyping) setDraft({ next });
      else settle(next);
    },
    containerProps: {
      onInputCapture(event: { target: EventTarget }) {
        typed.current = isTyping(event.target);
      },
      onBlur(event: FocusEvent<HTMLElement>) {
        if (!draft) return;
        const to = event.relatedTarget;
        if (isTyping(to) && event.currentTarget.contains(to)) return;
        settle(draft.next);
      },
    },
  };
}
