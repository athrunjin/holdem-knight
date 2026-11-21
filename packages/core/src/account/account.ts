/**
 * What an account's sign-in forms take: an address, a password, the name an account shows, and
 * the code an email carries (ADR 0041). Form values are strings typed by the user, checked here.
 */

import { INSURANCE_PLAYER_NAME, RAKE_PLAYER_NAME } from "../domain";

/** Issue codes. The UI decides the wording. */
export type AccountIssue = "empty" | "invalid" | "too-short" | "too-long" | "weak" | "reserved";

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issue: AccountIssue };

export const MIN_PASSWORD_LENGTH = 8;
/** The sign-in service hashes at most this many characters, so a longer password is refused. */
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_DISPLAY_NAME_LENGTH = 30;
export const CODE_LENGTH = 6;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An address with the spaces around it gone. Whether it exists is for the email to find out. */
export function parseEmail(input: string): Parsed<string> {
  const email = input.trim();
  if (email === "") return { ok: false, issue: "empty" };
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, issue: "invalid" };
  return { ok: true, value: email };
}

/**
 * A password as typed: spaces count, at the ends too. It needs a letter and a digit, as the
 * sign-in service asks, which counts the letters a to z alone.
 */
export function parsePassword(input: string): Parsed<string> {
  if (input === "") return { ok: false, issue: "empty" };
  if (input.length < MIN_PASSWORD_LENGTH) return { ok: false, issue: "too-short" };
  if (input.length > MAX_PASSWORD_LENGTH) return { ok: false, issue: "too-long" };
  if (!/[a-zA-Z]/.test(input) || !/[0-9]/.test(input)) return { ok: false, issue: "weak" };
  return { ok: true, value: input };
}

/** Names no account may show: what the seats and the host are called in a game. */
export const RESERVED_DISPLAY_NAMES: readonly string[] = [
  INSURANCE_PLAYER_NAME,
  RAKE_PLAYER_NAME,
  "组织者",
];

/** Spaces of other kinds, such as the wide one a Chinese keyboard types, which read as a space. */
const OTHER_SPACES = /[\t\n\r\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;

type Ranges = readonly (readonly [from: number, to: number])[];

/**
 * Characters that show nothing or steer the text around them: controls, zero-width and
 * direction marks, blank letters, and characters with no agreed meaning. A name made of them
 * would look empty, or like someone else's.
 */
const UNSEEN: Ranges = [
  [0x0000, 0x001f],
  [0x007f, 0x00a0],
  [0x00ad, 0x00ad],
  [0x115f, 0x1160],
  [0x1680, 0x1680],
  [0x17b4, 0x17b5],
  [0x180b, 0x180f],
  [0x2000, 0x200f],
  [0x2028, 0x202f],
  [0x205f, 0x206f],
  [0x2800, 0x2800],
  [0x3000, 0x3000],
  [0x3164, 0x3164],
  // Half of a pair on its own, which is no character
  [0xd800, 0xdfff],
  [0xe000, 0xf8ff],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xfff9, 0xfffb],
  [0xe0000, 0xe0fff],
  [0xf0000, 0x10ffff],
];

/**
 * The marks of the keyboard's first row and the like, all but `-`, `.` and `_`. A name is only
 * ever handled as text, never as code or markup, so these could do no harm; leaving them out
 * keeps that true wherever a name may be shown later.
 */
const MARKS: Ranges = [
  [0x21, 0x2c],
  [0x2f, 0x2f],
  [0x3a, 0x40],
  [0x5b, 0x5e],
  [0x60, 0x60],
  [0x7b, 0x7e],
];

const within = (ranges: Ranges, text: string) =>
  [...text].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return ranges.some(([from, to]) => point >= from && point <= to);
  });

/** For comparing names: without spaces and ignoring case. */
const comparable = (name: string) => name.replace(/ /g, "").toLowerCase();

/**
 * The name an account shows: letters of any script, digits, emoji, single spaces, and `-`, `.`
 * and `_`, up to 30 characters. It need not be unique, as an account is known by its ID
 * (ADR 0040). The database holds a name to the same rule (`valid_display_name`).
 */
export function parseDisplayName(input: string): Parsed<string> {
  const name = input.normalize("NFC").replace(OTHER_SPACES, " ").replace(/ +/g, " ").trim();
  if (name === "") return { ok: false, issue: "empty" };
  if ([...name].length > MAX_DISPLAY_NAME_LENGTH) return { ok: false, issue: "too-long" };
  if (within(UNSEEN, name) || within(MARKS, name)) return { ok: false, issue: "invalid" };
  if (RESERVED_DISPLAY_NAMES.some((reserved) => comparable(reserved) === comparable(name))) {
    return { ok: false, issue: "reserved" };
  }
  return { ok: true, value: name };
}

/** The digits of a code, however they were typed or pasted: `482 916` and `482-916` both count. */
export function codeDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export function parseCode(input: string): Parsed<string> {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return { ok: false, issue: "empty" };
  if (digits.length !== CODE_LENGTH) return { ok: false, issue: "invalid" };
  return { ok: true, value: digits };
}
