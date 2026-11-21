import { useSyncExternalStore } from "react";

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

let choice: LanguageChoice = storedChoice();
let language: Language = resolve(choice);
const listeners = new Set<() => void>();

/** Tells the browser what the page is written in, for readers, hyphenation and its own offers to translate. */
function mark() {
  if (typeof document !== "undefined") document.documentElement.lang = LANGUAGES[language].tag;
}
mark();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Changes the language at once and keeps the choice in this browser. */
export function setLanguageChoice(next: LanguageChoice) {
  choice = next;
  language = resolve(next);
  try {
    if (next === "device") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Without storage the choice still holds until the page is left
  }
  mark();
  for (const listener of listeners) listener();
}

export const currentLanguage = (): Language => language;

/**
 * The interface's text in the language in use, for code outside components: what a form answers
 * with, what goes on a shared image. Components take it from `useMessages`.
 */
export const messages = (): Messages => LANGUAGES[language].catalog;

/** The language tag for formatting dates and numbers as the interface reads. */
export const localeTag = (): string => LANGUAGES[language].tag;

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, currentLanguage);
}

export function useLanguageChoice(): LanguageChoice {
  return useSyncExternalStore(subscribe, () => choice);
}

/** The interface's text in the language in use. The component renders again when it changes. */
export function useMessages(): Messages {
  return LANGUAGES[useLanguage()].catalog;
}
