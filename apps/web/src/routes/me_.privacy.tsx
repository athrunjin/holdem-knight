import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/account/AuthParts";
import { LegalText } from "@/components/account/LegalText";
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
      <LegalText document={t.legal.privacy} />
    </AuthPage>
  );
}
