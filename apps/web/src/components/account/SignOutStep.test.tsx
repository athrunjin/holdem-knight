/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  unsentBeforeSignOut: vi.fn<() => Promise<number>>(),
  signOutOfAccount: vi.fn<() => Promise<"network" | undefined>>(),
}));
vi.mock("@/data", () => data);

import { useSignOut } from "./SignOutStep";

afterEach(cleanup);
beforeEach(() => {
  data.unsentBeforeSignOut.mockReset().mockResolvedValue(0);
  data.signOutOfAccount.mockReset().mockResolvedValue(undefined);
});

describe("signing out", () => {
  it("signs out with nothing left to send, where no one is told after", async () => {
    const { result } = renderHook(() => useSignOut());
    await act(() => result.current.ask());

    expect(data.signOutOfAccount).toHaveBeenCalledTimes(1);
    expect(result.current.leaving).toBe(false);
  });

  it("tells whoever asked what the sign-out came to", async () => {
    data.signOutOfAccount.mockResolvedValue("network");
    const onSignedOut = vi.fn();
    const { result } = renderHook(() => useSignOut(onSignedOut));
    await act(() => result.current.ask());

    expect(data.signOutOfAccount).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledWith("network");
  });

  it("asks first with records left to send, and signs out once they are kept", async () => {
    data.unsentBeforeSignOut.mockResolvedValue(2);
    const { result } = renderHook(() => useSignOut());
    await act(() => result.current.ask());

    expect(result.current.unsent).toBe(2);
    expect(data.signOutOfAccount).not.toHaveBeenCalled();

    act(() => result.current.cancel());
    expect(result.current.unsent).toBeUndefined();
    expect(data.signOutOfAccount).not.toHaveBeenCalled();

    await act(() => result.current.ask());
    await act(() => result.current.keep());
    expect(data.signOutOfAccount).toHaveBeenCalledTimes(1);
  });
});
