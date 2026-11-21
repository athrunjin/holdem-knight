import { describe, expect, it } from "vitest";

import { authIssue } from "./auth";

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
