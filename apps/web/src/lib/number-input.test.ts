/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { selectOnFocus } from "./number-input";

describe("selectOnFocus", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("selects a field that still has focus, and leaves one that lost it", () => {
    vi.useFakeTimers();
    const first = document.createElement("input");
    const second = document.createElement("input");
    document.body.append(first, second);
    const select = vi.spyOn(first, "select");
    first.focus();
    selectOnFocus(first);
    second.focus();
    selectOnFocus(second);
    vi.runAllTimers();
    // The first field lost focus before its turn, so it is not selected, nor focused again
    expect(select).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(second);
  });
});
