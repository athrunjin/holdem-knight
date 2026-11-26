import { describe, expect, it } from "vitest";

import { authIssue, emailSignUpOpen, firstEntryName, oauthReturn } from "./auth";

describe("authIssue", () => {
  it("goes by the service's code", () => {
    expect(authIssue({ code: "invalid_credentials", status: 400 })).toBe("invalid-credentials");
    expect(authIssue({ code: "email_not_confirmed", status: 400 })).toBe("email-not-confirmed");
    expect(authIssue({ code: "weak_password", status: 422 })).toBe("weak-password");
    expect(authIssue({ code: "same_password", status: 422 })).toBe("same-password");
    expect(authIssue({ code: "otp_expired", status: 403 })).toBe("invalid-code");
    expect(authIssue({ code: "email_address_invalid", status: 400 })).toBe("invalid-email");
    expect(authIssue({ code: "over_email_send_rate_limit", status: 429 })).toBe("rate-limited");
  });

  it("takes any refusal for too many requests as that", () => {
    expect(authIssue({ status: 429 })).toBe("rate-limited");
  });

  it("tells a request that never got through from one that was refused", () => {
    expect(authIssue({ name: "AuthRetryableFetchError", status: 0 })).toBe("network");
    expect(authIssue({ name: "AuthApiError", status: 500 })).toBe("unknown");
  });

  it("makes nothing of what is not an error from the service", () => {
    expect(authIssue(undefined)).toBe("unknown");
    expect(authIssue("boom")).toBe("unknown");
    expect(authIssue({ code: "something_new" })).toBe("unknown");
  });
});

describe("oauthReturn", () => {
  const at = (path: string) => oauthReturn(new URL(`https://app.example${path}`));

  it("says nothing of an address that came back with no error", () => {
    expect(at("/me/sign-in")).toBeUndefined();
    expect(at("/me/sign-in?tab=1#section")).toBeUndefined();
  });

  it("takes the person turning Google down as cancelled, after the # or in the query", () => {
    expect(at("/me/sign-in#error=access_denied&error_description=x")).toBe("cancelled");
    expect(at("/me/sign-up?error=access_denied")).toBe("cancelled");
    expect(at("/me/sign-in#error_code=access_denied")).toBe("cancelled");
  });

  it("takes any other error as failed", () => {
    expect(at("/me/sign-in?error=server_error&error_description=x")).toBe("failed");
    expect(at("/me/sign-in#error=invalid_request&error_code=bad_oauth_state")).toBe("failed");
    expect(at("/me/sign-up#error_code=unexpected_failure")).toBe("failed");
  });

  it("reads the query before the #, as the client does", () => {
    expect(at("/me/sign-in?error=server_error#error=access_denied")).toBe("failed");
  });
});

describe("emailSignUpOpen", () => {
  it("is closed only by off", () => {
    expect(emailSignUpOpen("off")).toBe(false);
    expect(emailSignUpOpen(undefined)).toBe(true);
    expect(emailSignUpOpen("")).toBe(true);
    expect(emailSignUpOpen("on")).toBe(true);
  });
});

describe("firstEntryName", () => {
  it("offers the name the account shows", () => {
    expect(firstEntryName("Lin Wei", "lin.wei@gmail.com", "Lin Wei")).toBe("Lin Wei");
    expect(firstEntryName("小林", "lin@example.com", undefined)).toBe("小林");
  });

  it("offers Google's name where the account shows only what its address made", () => {
    expect(firstEntryName("pat.obrien", "pat.obrien@gmail.com", "Pat O'Brien")).toBe("Pat O'Brien");
    expect(firstEntryName("玩家", "+++@example.com", "<b>")).toBe("<b>");
  });

  it("keeps the address's name where Google gave none", () => {
    expect(firstEntryName("lin", "lin@example.com", undefined)).toBe("lin");
  });
});
