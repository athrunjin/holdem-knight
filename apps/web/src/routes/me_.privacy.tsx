import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/account/AuthParts";
import { useBooks } from "@/data";
import { t } from "@/i18n";

export const Route = createFileRoute("/me_/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  // Read from an account's first entry, the way back is to it: it stands in for 我的
  const back = useBooks().status === "agreeing" ? "/me" : "/me/sign-up";
  return (
    <AuthPage title={t.account.privacy} back={back} audience="anyone">
      {/* A place for the text, which is written before accounts open to the public (ADR 0041) */}
      <p className="text-muted">{t.account.textToCome}</p>
    </AuthPage>
  );
}
