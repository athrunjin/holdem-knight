import { codeDigits } from "@holdem-knight/core";
import { Link, Navigate } from "@tanstack/react-router";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Page } from "@/components/Page";
import { TextField } from "@/components/TextField";
import type { AuthIssue } from "@/data/auth";
import { type Session, useSession } from "@/data/session";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";

interface AuthPageProps {
  title: string;
  /** Where the arrow before the title goes back to. 我的 unless said */
  back?: "/me" | "/me/sign-in" | "/me/sign-up" | "/me/reset";
  /** Who the page is for. Anyone else is sent to where they belong. */
  audience: "guests" | "accounts" | "anyone";
  onSubmit?: (event: FormEvent) => void;
  children: ReactNode | ((session: Session) => ReactNode);
}

/**
 * One step of signing in: a narrow page with a way back before its title and a single form. A
 * page for guests sends an account on to 我的, and a page for accounts sends a guest to sign in.
 * Where the app was built with no project to sign in to, it says so and offers nothing.
 */
export function AuthPage({ title, back = "/me", audience, onSubmit, children }: AuthPageProps) {
  const session = useSession();
  const heading = (
    <span className="flex items-center">
      <Link
        to={back}
        aria-label={t.common.back}
        className="-ml-3 grid size-11 shrink-0 place-items-center text-muted"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </Link>
      {title}
    </span>
  );

  if (session.status === "signed-in" && audience === "guests") return <Navigate to="/me" replace />;
  if (session.status === "signed-out" && audience === "accounts") {
    return <Navigate to="/me/sign-in" replace />;
  }
  const content = typeof children === "function" ? children(session) : children;

  return (
    <Page title={heading} centered>
      {session.status === "unavailable" && audience !== "anyone" ? (
        <p className="text-muted">{t.account.authIssue.unavailable}</p>
      ) : session.status === "loading" ? null : onSubmit ? (
        <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4 pb-8">
          {content}
        </form>
      ) : (
        <div className="flex max-w-md flex-col gap-4 pb-8">{content}</div>
      )}
    </Page>
  );
}

interface FieldProps {
  value: string;
  issue: string | undefined;
  onChange: (value: string) => void;
}

export function EmailField({ value, issue, onChange }: FieldProps) {
  return (
    <TextField
      id="email"
      label={t.account.email}
      value={value}
      issue={issue}
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder="name@example.com"
      onChange={onChange}
    />
  );
}

/** A password with a button that shows it, as a phone's keyboard hides what was typed. */
export function PasswordField({
  value,
  issue,
  onChange,
  label,
  fresh = false,
}: FieldProps & {
  label?: string;
  /** A password being chosen, which a password manager may offer to make and keep */
  fresh?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      id="password"
      label={label ?? t.account.password}
      value={value}
      issue={issue}
      type={shown ? "text" : "password"}
      inputMode="text"
      autoComplete={fresh ? "new-password" : "current-password"}
      onChange={onChange}
      trailing={
        <button
          type="button"
          aria-label={shown ? t.account.hidePassword : t.account.showPassword}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
          className="-mr-3 grid size-11 shrink-0 place-items-center text-muted"
        >
          {shown ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
        </button>
      }
    />
  );
}

/**
 * The six digits from an email, in one field: large and spaced so they read as six, yet a paste
 * and a phone's own offer of the code both land whole, which six separate boxes do not manage.
 */
export function CodeField({ value, issue, onChange }: FieldProps) {
  return (
    <div>
      <label htmlFor="code" className="sr-only">
        {t.account.code}
      </label>
      <input
        id="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        aria-invalid={issue ? true : undefined}
        aria-describedby={issue ? "code-issue" : undefined}
        onChange={(event) => onChange(codeDigits(event.target.value))}
        className={cn(
          "min-h-14 w-full rounded-xl border bg-surface text-center text-3xl font-semibold tracking-[0.4em] tabular-nums outline-none focus:border-highlight",
          // The spacing after the last digit would push them off center
          "indent-[0.4em]",
          issue ? "border-highlight" : "border-line",
        )}
      />
      {issue && (
        <p id="code-issue" className="mt-1 text-sm text-highlight">
          {issue}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-2 min-h-12 rounded-xl bg-accent px-6 font-semibold text-accent-text disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Why the step did not go through, said under the form. */
export function FormIssue({ issue }: { issue: AuthIssue | undefined }) {
  if (!issue) return null;
  return (
    <p role="alert" className="text-sm text-highlight">
      {t.account.authIssue[issue]}
    </p>
  );
}

/** A link in the form's own color, tall enough for a thumb. */
export const textLinkClass = "inline-flex min-h-11 items-center text-sm font-medium text-highlight";
