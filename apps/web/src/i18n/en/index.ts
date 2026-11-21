import type { Messages } from "../zh";
import { account } from "./account";
import { common } from "./common";
import { me } from "./me";
import { shell } from "./shell";

/** The interface in English. Typed against the Chinese, so nothing can be left unsaid. */
export const en: Messages = { common, shell, me, account };
