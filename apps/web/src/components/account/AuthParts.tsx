import { type AccountIssue, CODE_LENGTH, codeDigits } from "@holdem-knight/core";
import { Link, Navigate } from "@tanstack/react-router";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Page } from "@/components/Page";
import { TextField } from "@/components/TextField";
import type { AuthIssue } from "@/data/auth";
import { type Session, useSession } from "@/data/session";
import { cn } from "@/lib/cn";

/** What the sign-in service's answers read as. None says whether an address has an account. */
export const AUTH_ISSUE_TEXT: Record<AuthIssue, string> = {
  "invalid-credentials": "邮箱或密码不正确",
  "email-not-confirmed": "这个邮箱还没有验证",
  "weak-password": "密码太简单：至少 8 位，包含字母和数字",
  "same-password": "新密码不能和原来的一样",
  "invalid-code": "验证码不正确或已过期",
  "invalid-email": "邮箱地址无效",
  "rate-limited": "操作太频繁，请稍后再试",
  network: "网络连接失败，请重试",
  unavailable: "这个版本还不能登录",
  unknown: "出错了，请重试",
};

const INVALID_EMAIL = "邮箱地址无效";

export const EMAIL_ISSUE_TEXT: Record<AccountIssue, string> = {
  empty: "请输入邮箱",
  invalid: INVALID_EMAIL,
  "too-short": INVALID_EMAIL,
  "too-long": INVALID_EMAIL,
  weak: INVALID_EMAIL,
  reserved: INVALID_EMAIL,
};

/** What a password has to be, said on the field before anything is typed. */
export const PASSWORD_RULE = "至少 8 位，包含字母和数字";

export const PASSWORD_ISSUE_TEXT: Record<AccountIssue, string> = {
  empty: "请输入密码",
  invalid: "密码无效",
  "too-short": "密码至少 8 位",
  "too-long": "密码最多 72 位",
  weak: "密码需要同时包含字母和数字",
  reserved: "密码无效",
};

const INVALID_NAME = "昵称不能包含特殊符号，可以用文字、数字、空格和 - . _";

export const NAME_ISSUE_TEXT: Record<AccountIssue, string> = {
  empty: "请输入昵称",
  invalid: INVALID_NAME,
  "too-short": INVALID_NAME,
  "too-long": "昵称最多 30 个字",
  weak: INVALID_NAME,
  reserved: "这个昵称不能使用，请换一个",
};

const INVALID_CODE = `验证码是 ${CODE_LENGTH} 位数字`;

export const CODE_ISSUE_TEXT: Record<AccountIssue, string> = {
  empty: "请输入验证码",
  invalid: INVALID_CODE,
  "too-short": INVALID_CODE,
  "too-long": INVALID_CODE,
  weak: INVALID_CODE,
  reserved: INVALID_CODE,
};

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
        aria-label="返回"
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
        <p className="text-muted">{AUTH_ISSUE_TEXT.unavailable}。</p>
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
      label="邮箱"
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
  label = "密码",
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
      label={label}
      value={value}
      issue={issue}
      type={shown ? "text" : "password"}
      inputMode="text"
      autoComplete={fresh ? "new-password" : "current-password"}
      onChange={onChange}
      trailing={
        <button
          type="button"
          aria-label={shown ? "隐藏密码" : "显示密码"}
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
        验证码
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
      {AUTH_ISSUE_TEXT[issue]}
    </p>
  );
}

/** A link in the form's own color, tall enough for a thumb. */
export const textLinkClass = "inline-flex min-h-11 items-center text-sm font-medium text-highlight";
