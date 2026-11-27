import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/account/AuthParts";
import { LegalText } from "@/components/account/LegalText";
import { useBooks } from "@/data";
import { t } from "@/i18n";

export const Route = createFileRoute("/me_/terms")({
  component: TermsPage,
});

function TermsPage() {
  // Read from an account's first entry, the way back is to it: it stands in for 我的
  const back = useBooks().status === "agreeing" ? "/me" : "/me/sign-up";
  return (
    <AuthPage title={t.account.terms} back={back} audience="anyone">
      <LegalText document={t.legal.terms} />
    </AuthPage>
  );
}
