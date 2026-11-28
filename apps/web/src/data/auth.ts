import { DATABASE_FALLBACK_NAME } from "@/i18n/zh/account";
import { TERMS_VERSION } from "@/lib/terms";
import { storedUser, supabase } from "./supabase";

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

/** The pages a sign-in with Google can start from, and comes back to. */
export type GooglePage = "/me/sign-in" | "/me/sign-up";

/**
 * Leaves for Google to sign in, and comes back to the page it left, on whatever address the app
 * is served from, so a branch preview comes back to itself (ADR 0052). The address has to be on
 * the project's list of redirect URLs. Coming back signed in, the page sends the account on to
 * 我的; coming back with an error, the page says so (`oauthReturn`).
 */
export const signInWithGoogle = (page: GooglePage): Outcome =>
  attempt((auth) =>
    auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${page}` },
    }),
  );

/** How a sign-in with Google came back to the page, where it came back without an account. */
export type OAuthReturn = "cancelled" | "failed";

/**
 * What the address a sign-in with Google came back to says, where it came back with an error. The
 * client signs in by the implicit flow, so the service may put the error in the query or after
 * the `#`; both are read, the query first, as the client does. `access_denied` is the person
 * turning Google down, not a failure.
 */
export function oauthReturn(url: URL): OAuthReturn | undefined {
  const params = new URLSearchParams(url.hash.slice(1));
  for (const [key, value] of url.searchParams) params.set(key, value);
  const error = params.get("error");
  const code = params.get("error_code");
  if (!error && !code) return undefined;
  return error === "access_denied" || code === "access_denied" ? "cancelled" : "failed";
}

/**
 * Whether a new account can be made with an email and a password in this build. Online builds set
 * `VITE_EMAIL_SIGN_UP=off` until the project has a sending domain, as no code could reach anyone
 * outside the project's members; with it off, sign-up is through Google only and the password
 * reset is linked from nowhere (ADR 0052). Missing, or anything but `off`, it is open.
 */
export const emailSignUpOpen = (value: string | undefined = import.meta.env.VITE_EMAIL_SIGN_UP) =>
  value !== "off";

/**
 * The signed-in account says it is 18 and agrees to the terms of `TERMS_VERSION`, under the name it
 * confirms, which its space takes too. The database keeps the time, from the first time only.
 */
export async function agreeToTerms(displayName: string): Outcome {
  if (!supabase) return "unavailable";
  try {
    const { error, status } = await supabase.rpc("agree_to_terms", {
      display_name: displayName,
      version: TERMS_VERSION,
    });
    if (!error) return undefined;
    // The client answers with no status where the request never got through
    return status === 0 ? "network" : "unknown";
  } catch {
    return "network";
  }
}

/**
 * The name to offer an account at its first entry: the one it shows, unless that is only what
 * the database made of its address, or its last resort, because the name Google gave could not
 * be shown (`handle_new_user`). Then Google's, for the person to correct.
 */
export function firstEntryName(shown: string, email: string, given: string | undefined): string {
  const fromAddress = (email.split("@")[0] ?? "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 30);
  const fellBack = shown === fromAddress || shown === DATABASE_FALLBACK_NAME;
  return fellBack && given ? given : shown;
}

/**
 * Signs out of this browser only. Other devices stay signed in. With no network the client still
 * signs this browser out, first, and then says it could not tell the service: that is done, not
 * a failure (ADR 0054).
 */
export async function signOut(): Outcome {
  const issue = await attempt((auth) => auth.signOut({ scope: "local" }));
  return issue === "network" && storedUser() === undefined ? undefined : issue;
}
