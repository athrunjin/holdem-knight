import { parseDisplayName, parseEmail, parsePassword } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import {
  AuthPage,
  EmailField,
  FormIssue,
  PasswordField,
  SubmitButton,
  textLinkClass,
} from "@/components/account/AuthParts";
import { TextField } from "@/components/TextField";
import { type AuthIssue, signUp } from "@/data/auth";
import { messages, useMessages } from "@/i18n";
import { keepPendingCode } from "@/lib/pending-code";

export const Route = createFileRoute("/me_/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const m = useMessages();
  const navigate = Route.useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [issues, setIssues] = useState<{
    name?: string;
    email?: string;
    password?: string;
    agreed?: string;
  }>({});
  const [issue, setIssue] = useState<AuthIssue>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const shown = parseDisplayName(name);
    const address = parseEmail(email);
    const chosen = parsePassword(password);
    setIssues({
      ...(!shown.ok && { name: messages().account.nameIssue[shown.issue] }),
      ...(!address.ok && { email: messages().account.emailIssue[address.issue] }),
      ...(!chosen.ok && { password: messages().account.passwordIssue[chosen.issue] }),
      ...(!agreed && { agreed: messages().account.signUpPage.agreeFirst }),
    });
    setIssue(undefined);
    if (!shown.ok || !address.ok || !chosen.ok || !agreed) return;

    setBusy(true);
    const failed = await signUp(shown.value, address.value, chosen.value);
    if (failed) {
      setBusy(false);
      setIssue(failed);
      return;
    }
    keepPendingCode({ email: address.value, purpose: "sign-up", sentAt: Date.now() });
    await navigate({ to: "/me/verify" });
  }

  const clear = (field: keyof typeof issues) => setIssues({ ...issues, [field]: undefined });

  return (
    <AuthPage title={m.common.signUp} audience="guests" onSubmit={handleSubmit}>
      <TextField
        id="display-name"
        label={m.account.name}
        value={name}
        issue={issues.name}
        inputMode="text"
        autoComplete="nickname"
        onChange={(next) => {
          setName(next);
          clear("name");
        }}
      />
      <EmailField
        value={email}
        issue={issues.email}
        onChange={(next) => {
          setEmail(next);
          clear("email");
        }}
      />
      <PasswordField
        label={m.account.passwordWithRule}
        fresh
        value={password}
        issue={issues.password}
        onChange={(next) => {
          setPassword(next);
          clear("password");
        }}
      />
      <div>
        <div className="flex items-start gap-1">
          <input
            id="agreed"
            type="checkbox"
            checked={agreed}
            aria-describedby={issues.agreed ? "agreed-issue" : undefined}
            onChange={(event) => {
              setAgreed(event.target.checked);
              clear("agreed");
            }}
            // 44px for a thumb around a box of 20
            className="m-3 size-5 shrink-0 accent-(--accent)"
          />
          <p className="pt-2.5 text-sm text-muted">
            <label htmlFor="agreed">{m.account.signUpPage.agree}</label>
            <Link to="/me/terms" className="text-highlight">
              {m.account.terms}
            </Link>
            {m.account.signUpPage.and}
            <Link to="/me/privacy" className="text-highlight">
              {m.account.privacy}
            </Link>
            {m.account.signUpPage.agreeEnd}
          </p>
        </div>
        {issues.agreed && (
          <p id="agreed-issue" className="text-sm text-highlight">
            {issues.agreed}
          </p>
        )}
      </div>
      <FormIssue issue={issue} />
      <SubmitButton busy={busy}>{m.account.sendCode}</SubmitButton>
      <Link to="/me/sign-in" className={`${textLinkClass} self-center`}>
        {m.account.signUpPage.toSignIn}
      </Link>
    </AuthPage>
  );
}
