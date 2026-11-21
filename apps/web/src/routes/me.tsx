import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountCard } from "@/components/account/AccountCard";
import { BackupSection } from "@/components/BackupSection";
import { InDevelopment } from "@/components/InDevelopment";
import { Page } from "@/components/Page";
import { TextMenu } from "@/components/TextMenu";
import { useSession } from "@/data/session";
import {
  LANGUAGES,
  type LanguageChoice,
  setLanguageChoice,
  useLanguageChoice,
  useMessages,
} from "@/i18n";

export const Route = createFileRoute("/me")({
  component: MePage,
});

const cardClass = "rounded-2xl border border-line bg-surface p-5";

/** With no project to sign in to, as this build has none: the app is a guest's only. */
function GuestOnly() {
  const m = useMessages();
  return (
    <section className={cardClass}>
      <p className="font-medium">{m.me.guestOnly.title}</p>
      <p className="mt-1 text-sm text-muted">{m.me.guestOnly.body}</p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled
          className="h-11 rounded-xl bg-accent px-5 font-semibold text-accent-text disabled:opacity-60"
        >
          {m.common.signIn}
        </button>
        <InDevelopment milestone="M6" />
      </div>
    </section>
  );
}

function SignedOut() {
  const m = useMessages();
  return (
    <section className={cardClass}>
      <p className="font-medium">{m.me.signedOut.title}</p>
      <p className="mt-1 text-sm text-muted">{m.me.signedOut.body}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/me/sign-in"
          className="grid min-h-11 place-items-center rounded-xl bg-accent px-5 font-semibold text-accent-text"
        >
          {m.common.signIn}
        </Link>
        <Link
          to="/me/sign-up"
          className="grid min-h-11 place-items-center rounded-xl border border-line px-5 font-medium"
        >
          {m.common.signUp}
        </Link>
      </div>
    </section>
  );
}

/**
 * The language of the interface: the device's, or one picked here, which takes effect at once and
 * is kept in this browser. Each language is listed under its own name, so it can be found by
 * someone who cannot read the one in use.
 */
function LanguageRow() {
  const m = useMessages();
  const choice = useLanguageChoice();
  const options = [
    { value: "device" as LanguageChoice, label: m.me.language.device },
    ...Object.entries(LANGUAGES).map(([value, { name }]) => ({
      value: value as LanguageChoice,
      label: name,
    })),
  ];

  return (
    <section className={`${cardClass} mt-4 flex min-h-11 items-center justify-between gap-3 py-3`}>
      <p className="shrink-0 font-medium">{m.me.language.title}</p>
      <TextMenu
        label={m.me.language.title}
        options={options}
        value={choice}
        onChange={setLanguageChoice}
        align="right"
        className="min-h-11"
      />
    </section>
  );
}

function MePage() {
  const m = useMessages();
  const session = useSession();

  return (
    <Page title={m.me.title}>
      {session.status === "unavailable" && <GuestOnly />}
      {session.status === "signed-out" && <SignedOut />}
      {session.status === "signed-in" && (
        <AccountCard userId={session.userId} email={session.email} />
      )}
      {/* While the kept session is being read, the card's place stays empty for a moment */}
      {session.status === "loading" && <section className={`${cardClass} min-h-40`} />}
      <LanguageRow />
      <BackupSection account={session.status === "signed-in"} />
      <p className="mt-6 text-center text-xs text-muted">{m.me.version(__APP_VERSION__)}</p>
    </Page>
  );
}
