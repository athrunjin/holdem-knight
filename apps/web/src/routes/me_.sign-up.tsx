import { parseDisplayName, parseEmail, parsePassword } from "@holdem-knight/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";
import {
  AgreeField,
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
import { TextField } from "@/components/TextField";
import { type AuthIssue, emailSignUpOpen, signUp } from "@/data/auth";
import { t } from "@/i18n";
import { keepPendingCode } from "@/lib/pending-code";

export const Route = createFileRoute("/me_/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const [returned, setReturned] = useGoogleReturn("/me/sign-up");
  const google = (
    <>
      <GoogleReturnNote returned={returned} />
      {!emailSignUpOpen() && <p className="text-sm text-muted">{t.account.google.only}</p>}
      <GoogleButton
        page="/me/sign-up"
        onLeave={() => setReturned(undefined)}
        onFail={() => setReturned("failed")}
      />
    </>
  );
  const toSignIn = (
    <Link to="/me/sign-in" className={`${textLinkClass} self-center`}>
      {t.account.signUpPage.toSignIn}
    </Link>
  );

  // Until there is a sending domain no code could reach anyone, so only Google makes an account,
  // and the terms are agreed to at its first entry (ADR 0052)
  if (!emailSignUpOpen()) {
    return (
      <AuthPage title={t.common.signUp} audience="guests">
        {google}
        {toSignIn}
      </AuthPage>
    );
  }
  return <EmailSignUp google={google} toSignIn={toSignIn} />;
}

/** Making an account with an email and a password, confirmed by a code. */
function EmailSignUp({ google, toSignIn }: { google: ReactNode; toSignIn: ReactNode }) {
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
      ...(!shown.ok && { name: t.account.nameIssue[shown.issue] }),
      ...(!address.ok && { email: t.account.emailIssue[address.issue] }),
      ...(!chosen.ok && { password: t.account.passwordIssue[chosen.issue] }),
      ...(!agreed && { agreed: t.account.signUpPage.agreeFirst }),
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
    <AuthPage title={t.common.signUp} audience="guests" onSubmit={handleSubmit}>
      {google}
      <OrDivider />
      <TextField
        id="display-name"
        label={t.account.name}
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
        label={t.account.passwordWithRule}
        fresh
        value={password}
        issue={issues.password}
        onChange={(next) => {
          setPassword(next);
          clear("password");
        }}
      />
      <AgreeField
        checked={agreed}
        issue={issues.agreed}
        onChange={(next) => {
          setAgreed(next);
          clear("agreed");
        }}
      />
      <FormIssue issue={issue} />
      <SubmitButton busy={busy}>{t.account.sendCode}</SubmitButton>
      {toSignIn}
    </AuthPage>
  );
}
