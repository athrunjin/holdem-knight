/**
 * Which text of the terms and the privacy policy an account agrees to when it signs up. It is
 * kept with the account and the time (ADR 0041), so a later text can tell who agreed to what.
 * The text itself is in the `legal` catalogs, and its pages show this version under their title.
 * Each published text has a new version: the month it is for, then its number. Accounts that
 * agreed before the first text was written hold `0`.
 */
export const TERMS_VERSION = "2026-12_1.0";
