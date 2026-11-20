/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { numberTyped, selectOnFocus } from "./number-input";

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

describe("numberTyped", () => {
  it("lets through digits alone for a whole number", () => {
    expect(numberTyped("1,000", true)).toBe("1000");
    expect(numberTyped("-12.5a", true)).toBe("125");
  });

  it("lets a decimal point through otherwise, and no minus sign or letter", () => {
    expect(numberTyped("-1a.5x", false)).toBe("1.5");
    expect(numberTyped("2.50", false)).toBe("2.50");
  });
});
