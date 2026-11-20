import { TERMS_VERSION } from "@/lib/terms";
import { supabase } from "./supabase";

/** Why a sign-in step did not go through. The UI decides the wording. */
export type AuthIssue =
  | "invalid-credentials"
  | "email-not-confirmed"
  | "weak-password"
  | "same-password"
  | "invalid-code"
  | "invalid-email"
  | "rate-limited"
  | "network"
  | "unavailable"
  | "unknown";

/** What a code is for: confirming a new account's address, or resetting a password. */
export type CodePurpose = "sign-up" | "recovery";

const BY_CODE: Record<string, AuthIssue> = {
  invalid_credentials: "invalid-credentials",
  email_not_confirmed: "email-not-confirmed",
  weak_password: "weak-password",
  same_password: "same-password",
  // The service gives one answer for a code that is wrong and one that has run out
  otp_expired: "invalid-code",
  email_address_invalid: "invalid-email",
  over_email_send_rate_limit: "rate-limited",
  over_request_rate_limit: "rate-limited",
};

/** The issue behind an error from the sign-in service, by its code and never by its wording. */
export function authIssue(error: unknown): AuthIssue {
  if (typeof error !== "object" || error === null) return "unknown";
  const { code, status, name } = error as { code?: unknown; status?: unknown; name?: unknown };
  if (typeof code === "string" && code in BY_CODE) return BY_CODE[code] ?? "unknown";
  if (status === 429) return "rate-limited";
  // The request never reached the service, or its answer never came back
  if (name === "AuthRetryableFetchError" || status === 0) return "network";
  return "unknown";
}

type Outcome = Promise<AuthIssue | undefined>;

/** Runs one call to the sign-in service and says what went wrong, if anything did. */
async function attempt(
  call: (auth: NonNullable<typeof supabase>["auth"]) => Promise<{ error: unknown }>,
): Outcome {
  if (!supabase) return "unavailable";
  try {
    const { error } = await call(supabase.auth);
    return error ? authIssue(error) : undefined;
  } catch (error) {
    return authIssue(error);
  }
}

/**
 * Makes an account and sends the code that confirms its address, for someone who has said they
 * are 18 and agreed to the terms: the version they saw goes with the account, and the service
 * notes the time. The service says so when the
 * address already has an account; the app does not pass that on, and goes on as if a code were on
 * its way, so its pages never say whether an address is registered (ADR 0041). No email is sent,
 * and the account is left as it was.
 */
export const signUp = (displayName: string, email: string, password: string): Outcome =>
  attempt(async (auth) => {
    const { error } = await auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, terms_version: TERMS_VERSION } },
    });
    return { error: error?.code === "user_already_exists" ? null : error };
  });

export const signIn = (email: string, password: string): Outcome =>
  attempt((auth) => auth.signInWithPassword({ email, password }));

/** Sends the code for a password reset, to an address that has an account. */
export const requestReset = (email: string): Outcome =>
  attempt((auth) => auth.resetPasswordForEmail(email));

/** Checks a code. A right one signs the account in. */
export const verifyCode = (email: string, code: string, purpose: CodePurpose): Outcome =>
  attempt((auth) =>
    auth.verifyOtp({ email, token: code, type: purpose === "sign-up" ? "signup" : "recovery" }),
  );

export const resendCode = (email: string, purpose: CodePurpose): Outcome =>
  purpose === "sign-up"
    ? attempt((auth) => auth.resend({ type: "signup", email }))
    : requestReset(email);

/** A new password for the account signed in, which a reset has just done. */
export const setPassword = (password: string): Outcome =>
  attempt((auth) => auth.updateUser({ password }));

/** Signs out of this browser only. Other devices stay signed in. */
export const signOut = (): Outcome => attempt((auth) => auth.signOut({ scope: "local" }));
