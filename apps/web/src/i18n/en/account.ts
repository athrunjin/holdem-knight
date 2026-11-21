import type { AccountIssue } from "@holdem-knight/core";
import type { Messages } from "../zh";

const invalidEmail = "That email address isn’t valid";
const invalidName = "A name can’t contain symbols. Use letters, digits, spaces and - . _";
const invalidCode = (digits: number) => `The code is ${digits} digits`;

export const account: Messages["account"] = {
  authIssue: {
    "invalid-credentials": "Wrong email or password",
    "email-not-confirmed": "This email hasn’t been confirmed yet",
    "weak-password": "Password too simple: at least 8 characters, with a letter and a digit",
    "same-password": "The new password can’t be the same as the old one",
    "invalid-code": "That code is wrong or has expired",
    "invalid-email": invalidEmail,
    "rate-limited": "Too many attempts. Try again in a while.",
    network: "Couldn’t connect. Try again.",
    unavailable: "This version can’t sign in yet",
    unknown: "Something went wrong. Try again.",
  },
  emailIssue: {
    empty: "Enter your email",
    invalid: invalidEmail,
    "too-short": invalidEmail,
    "too-long": invalidEmail,
    weak: invalidEmail,
    reserved: invalidEmail,
  },
  passwordIssue: {
    empty: "Enter your password",
    invalid: "That password isn’t valid",
    "too-short": "At least 8 characters",
    "too-long": "At most 72 characters",
    weak: "A password needs both a letter and a digit",
    reserved: "That password isn’t valid",
  },
  nameIssue: {
    empty: "Enter a name",
    invalid: invalidName,
    "too-short": invalidName,
    "too-long": "At most 30 characters",
    weak: invalidName,
    reserved: "That name can’t be used. Choose another.",
  },
  codeIssue: (digits): Record<AccountIssue, string> => ({
    empty: "Enter the code",
    invalid: invalidCode(digits),
    "too-short": invalidCode(digits),
    "too-long": invalidCode(digits),
    weak: invalidCode(digits),
    reserved: invalidCode(digits),
  }),
  email: "Email",
  password: "Password",
  passwordWithRule: "Password, at least 8 characters with a letter and a digit",
  newPasswordWithRule: "New password, at least 8 characters with a letter and a digit",
  showPassword: "Show password",
  hidePassword: "Hide password",
  code: "Code",
  name: "Name",
  sendCode: "Send code",
  signInPage: {
    forgot: "Forgot password",
    toSignUp: "No account? Sign up",
  },
  signUpPage: {
    agreeFirst: "Confirm your age and agree to the terms first",
    agree: "I am 18 or over and agree to the ",
    and: " and ",
    agreeEnd: ".",
    toSignIn: "Have an account? Sign in",
  },
  terms: "Terms of Use",
  privacy: "Privacy Policy",
  textToCome: "The full text will be added before accounts are released.",
  resetPage: {
    title: "Reset password",
    body: "Enter the email you signed up with and we’ll send you a code.",
  },
  newPasswordPage: {
    title: "Set a new password",
  },
  verifyPage: {
    title: "Enter the code",
    sentBefore: (digits) => `A ${digits}-digit code was sent to `,
    sentAfter: ". It is good for 1 hour.",
    resent: "Sent again. ",
    resendIn: (seconds) => `Send again in ${seconds}s`,
    resend: "Send again",
    changeEmail: "Use another email",
    notReceived: "Nothing arrived? Check your spam folder. ",
    alreadyRegistered:
      "An email that already has an account gets no code: sign in or reset your password instead.",
  },
};
