import { parseEmail, parsePassword } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import {
  AuthPage,
  EmailField,
  FormIssue,
  GoogleButton,
  GoogleReturnNote,
  OrDivider,
  PasswordField,
  SubmitButton,
  textLinkClass,
  useGoogleReturn,
} from "@/components/account/AuthParts";
import { type AuthIssue, emailSignUpOpen, resendCode, signIn } from "@/data/auth";
import { t } from "@/i18n";
import { keepPendingCode } from "@/lib/pending-code";

export const Route = createFileRoute("/me_/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const navigate = Route.useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailIssue, setEmailIssue] = useState<string>();
  const [passwordIssue, setPasswordIssue] = useState<string>();
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);
  const [returned, setReturned] = useGoogleReturn("/me/sign-in");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const address = parseEmail(email);
    // Only that it was typed: an older account may have a password today's rule would refuse
    const typed = parsePassword(password);
    setEmailIssue(address.ok ? undefined : t.account.emailIssue[address.issue]);
    setPasswordIssue(
      !typed.ok && typed.issue === "empty" ? t.account.passwordIssue.empty : undefined,
    );
    setIssue(undefined);
    if (!address.ok || password === "") return;

    setBusy(true);
    const failed = await signIn(address.value, password);
    // With email sign-up closed no code can be delivered, so the issue is said instead (ADR 0052)
    if (failed === "email-not-confirmed" && emailSignUpOpen()) {
      // The account is there but its address was never confirmed: send the code again
      await resendCode(address.value, "sign-up");
      keepPendingCode({ email: address.value, purpose: "sign-up", sentAt: Date.now() });
      await navigate({ to: "/me/verify" });
      return;
    }
    setBusy(false);
    // Signed in: the page sends an account on to 我的 by itself
    setIssue(failed);
  }

  return (
    <AuthPage title={t.common.signIn} audience="guests" onSubmit={handleSubmit}>
      <GoogleReturnNote returned={returned} />
      <GoogleButton
        page="/me/sign-in"
        onLeave={() => setReturned(undefined)}
        onFail={() => setReturned("failed")}
      />
      <OrDivider />
      <EmailField
        value={email}
        issue={emailIssue}
        onChange={(next) => {
          setEmail(next);
          setEmailIssue(undefined);
        }}
      />
      <PasswordField
        value={password}
        issue={passwordIssue}
        onChange={(next) => {
          setPassword(next);
          setPasswordIssue(undefined);
        }}
      />
      <FormIssue issue={issue} />
      <SubmitButton busy={busy}>{t.common.signIn}</SubmitButton>
      {/* A reset sends a code by email, which needs a sending domain as sign-up does (ADR 0052) */}
      <div className="flex justify-between">
        {emailSignUpOpen() && (
          <Link to="/me/reset" className={textLinkClass}>
            {t.account.signInPage.forgot}
          </Link>
        )}
        <Link to="/me/sign-up" className={`${textLinkClass} ml-auto`}>
          {t.account.signInPage.toSignUp}
        </Link>
      </div>
    </AuthPage>
  );
}
