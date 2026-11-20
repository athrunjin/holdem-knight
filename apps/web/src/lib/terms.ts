/**
 * Which text of the terms and the privacy policy an account agrees to when it signs up. It is
 * kept with the account and the time (ADR 0041), so a later text can tell who agreed to what.
 * `0` stands for the pages as they are before their text is written; give each published text a
 * new version, such as the month it took effect.
 */
export const TERMS_VERSION = "0";
