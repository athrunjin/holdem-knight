import { account } from "./account";
import { common } from "./common";
import { me } from "./me";
import { shell } from "./shell";

/**
 * The interface in Chinese, which every other language is checked against: a catalog typed as
 * `Messages` has to have each of these, with the same things to fill in.
 */
export const zh = { common, shell, me, account };

export type Messages = typeof zh;
