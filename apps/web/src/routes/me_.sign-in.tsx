import { parseEmail, parsePassword } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import {
  AuthPage,
  EMAIL_ISSUE_TEXT,
  EmailField,
  FormIssue,
  PASSWORD_ISSUE_TEXT,
  PasswordField,
  SubmitButton,
  textLinkClass,
} from "@/components/account/AuthParts";
import { type AuthIssue, resendCode, signIn } from "@/data/auth";
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const address = parseEmail(email);
    // Only that it was typed: an older account may have a password today's rule would refuse
    const typed = parsePassword(password);
    setEmailIssue(address.ok ? undefined : EMAIL_ISSUE_TEXT[address.issue]);
    setPasswordIssue(!typed.ok && typed.issue === "empty" ? PASSWORD_ISSUE_TEXT.empty : undefined);
    setIssue(undefined);
    if (!address.ok || password === "") return;

    setBusy(true);
    const failed = await signIn(address.value, password);
    if (failed === "email-not-confirmed") {
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
    <AuthPage title="登录" audience="guests" onSubmit={handleSubmit}>
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
      <SubmitButton busy={busy}>登录</SubmitButton>
      <div className="flex justify-between">
        <Link to="/me/reset" className={textLinkClass}>
          忘记密码
        </Link>
        <Link to="/me/sign-up" className={textLinkClass}>
          没有账户？注册
        </Link>
      </div>
    </AuthPage>
  );
}
