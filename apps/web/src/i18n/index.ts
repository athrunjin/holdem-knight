import { en } from "./en";
import { type Messages, zh } from "./zh";

export type { Messages };

/**
 * The languages the interface comes in. Adding one is a folder beside `zh` and a line here: its
 * catalog is typed as `Messages`, so the compiler lists whatever it has yet to say (ADR 0047).
 */
export const LANGUAGES = {
  zh: { catalog: zh, name: "中文", tag: "zh-CN" },
  en: { catalog: en, name: "English", tag: "en" },
} as const satisfies Record<string, { catalog: Messages; name: string; tag: string }>;

export type Language = keyof typeof LANGUAGES;

/** What the organizer picked: a language, or whatever the device is set to. */
export type LanguageChoice = Language | "device";

const STORAGE_KEY = "app.language";

const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && value in LANGUAGES;

/** The device's first language the interface comes in. Chinese for any kind of Chinese, else English. */
export function deviceLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split("-")[0];
    if (isLanguage(primary)) return primary;
  }
  return "en";
}

function storedChoice(): LanguageChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : "device";
  } catch {
    // Without storage the device decides
    return "device";
  }
}

const resolve = (picked: LanguageChoice): Language =>
  picked === "device"
    ? deviceLanguage(typeof navigator === "undefined" ? [] : navigator.languages)
    : picked;

const choice: LanguageChoice = storedChoice();
const language: Language = resolve(choice);

// Tells the browser what the page is written in, for readers and its own offers to translate
if (typeof document !== "undefined") document.documentElement.lang = LANGUAGES[language].tag;

/** The language the interface is in, for as long as the page is open. */
export const currentLanguage: Language = language;

/** What was picked: a language, or the device's. */
export const languageChoice: LanguageChoice = choice;

/**
 * The interface's text in the language in use. It is settled when the page loads, so it can be
 * read anywhere: in a component, in a helper, in a constant at the top of a file.
 */
export const t: Messages = LANGUAGES[language].catalog;

/**
 * The language tag for formatting dates as the interface reads. The device's own tag for the
 * language is used where it has one, so English dates are in the order of its region.
 */
export const localeTag: string =
  (typeof navigator === "undefined"
    ? undefined
    : navigator.languages.find((tag) => tag.toLowerCase().split("-")[0] === language)) ??
  LANGUAGES[language].tag;

/**
 * Keeps the choice in this browser and loads the page again in it. A language is changed rarely,
 * and starting over means no text anywhere is left in the old one.
 */
export function setLanguageChoice(next: LanguageChoice) {
  try {
    if (next === "device") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Without storage there is nowhere to keep a choice, so the device goes on deciding
    return;
  }
  window.location.reload();
}
