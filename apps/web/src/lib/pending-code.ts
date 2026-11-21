import type { CodePurpose } from "@/data/auth";

/**
 * The code an email has just been sent with: whose it is and what it is for. Kept for this tab
 * only, so the page that takes the code survives a refresh, and never put in the address bar.
 */
export interface PendingCode {
  readonly email: string;
  readonly purpose: CodePurpose;
  /** When the last email went out, for holding back the next one */
  readonly sentAt: number;
}

const KEY = "account.pending-code";

export function readPendingCode(): PendingCode | undefined {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (typeof stored !== "object" || stored === null) return undefined;
    const { email, purpose, sentAt } = stored as Record<string, unknown>;
    if (typeof email !== "string" || typeof sentAt !== "number") return undefined;
    if (purpose !== "sign-up" && purpose !== "recovery") return undefined;
    return { email, purpose, sentAt };
  } catch {
    return undefined;
  }
}

export function keepPendingCode(pending: PendingCode | undefined) {
  try {
    if (pending) sessionStorage.setItem(KEY, JSON.stringify(pending));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Without storage the page only loses its place on a refresh
  }
}
