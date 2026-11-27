import type { AccountIssue } from "@holdem-knight/core";
import type { AuthIssue } from "@/data/auth";

const invalidEmail = "邮箱地址无效";
const invalidName = "昵称不能包含特殊符号，可以用文字、数字、空格和 - . _";
const invalidCode = (digits: number) => `验证码是 ${digits} 位数字`;

/** Signing up, signing in, codes and passwords. */
export const account = {
  /** What the sign-in service's answers read as. None says whether an address has an account. */
  authIssue: {
    "invalid-credentials": "邮箱或密码不正确",
    "email-not-confirmed": "这个邮箱还没有验证",
    "weak-password": "密码太简单：至少 8 位，包含字母和数字",
    "same-password": "新密码不能和原来的一样",
    "invalid-code": "验证码不正确或已过期",
    "invalid-email": invalidEmail,
    "rate-limited": "操作太频繁，请稍后再试",
    network: "网络连接失败，请重试",
    unavailable: "这个版本还不能登录",
    unknown: "出错了，请重试",
  } satisfies Record<AuthIssue, string> as Record<AuthIssue, string>,
  emailIssue: {
    empty: "请输入邮箱",
    invalid: invalidEmail,
    "too-short": invalidEmail,
    "too-long": invalidEmail,
    weak: invalidEmail,
    reserved: invalidEmail,
  } satisfies Record<AccountIssue, string> as Record<AccountIssue, string>,
  passwordIssue: {
    empty: "请输入密码",
    invalid: "密码无效",
    "too-short": "密码至少 8 位",
    "too-long": "密码最多 72 位",
    weak: "密码需要同时包含字母和数字",
    reserved: "密码无效",
  } satisfies Record<AccountIssue, string> as Record<AccountIssue, string>,
  nameIssue: {
    empty: "请输入昵称",
    invalid: invalidName,
    "too-short": invalidName,
    "too-long": "昵称最多 30 个字",
    weak: invalidName,
    reserved: "这个昵称不能使用，请换一个",
  } satisfies Record<AccountIssue, string> as Record<AccountIssue, string>,
  codeIssue: (digits: number): Record<AccountIssue, string> => ({
    empty: "请输入验证码",
    invalid: invalidCode(digits),
    "too-short": invalidCode(digits),
    "too-long": invalidCode(digits),
    weak: invalidCode(digits),
    reserved: invalidCode(digits),
  }),
  email: "邮箱",
  password: "密码",
  /** A field's name with the rule a password has to meet, said before anything is typed. */
  passwordWithRule: "密码，至少 8 位，包含字母和数字",
  newPasswordWithRule: "新密码，至少 8 位，包含字母和数字",
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
  code: "验证码",
  name: "昵称",
  sendCode: "发送验证码",
  signInPage: {
    forgot: "忘记密码",
    toSignUp: "没有账户？注册",
  },
  signUpPage: {
    agreeFirst: "请先确认年龄并同意协议",
    /** Beside the box, which it ticks; the two documents are links on a row of their own under it */
    agree: "我已年满 18 岁，并同意用户协议和隐私政策",
    toSignIn: "已有账户？登录",
  },
  /** Signing in with Google, on the sign-in and sign-up pages (ADR 0052). */
  google: {
    continue: "使用 Google 账号继续",
    /** Between the Google button and the email form */
    or: "或",
    cancelled: "已取消 Google 登录。",
    failed: "Google 登录没有完成，请重试。",
    /** On the sign-up page of a build with email sign-up closed */
    only: "目前只能用 Google 账号注册。",
  },
  /** The step an account that has not agreed to the terms passes before its books open. */
  firstEntry: {
    title: "完成注册",
    /** Read around the address: `signedInBefore`, the address, `signedInAfter`. */
    signedInBefore: "已登录为 ",
    signedInAfter: "。确认昵称并同意协议后开始使用。",
    start: "开始使用",
  },
  terms: "用户协议",
  privacy: "隐私政策",
  textToCome: "正式文本会在账户功能上线前补充。",
  resetPage: {
    title: "重置密码",
    body: "输入注册时的邮箱，我们发一个验证码给你。",
  },
  newPasswordPage: {
    title: "设置新密码",
  },
  verifyPage: {
    title: "输入验证码",
    /** Read around the address: `sentBefore`, the address, `sentAfter`. */
    sentBefore: (digits: number) => `${digits} 位验证码已发到 `,
    sentAfter: "，1 小时内有效。",
    resent: "已重新发送，",
    resendIn: (seconds: number) => `${seconds} 秒后可重新发送`,
    resend: "重新发送",
    changeEmail: "换个邮箱",
    notReceived: "没收到？先看看垃圾邮件箱。",
    alreadyRegistered: "如果这个邮箱已经注册过，不会再收到验证码，请直接登录或重置密码。",
  },
};
