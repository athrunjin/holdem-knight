import { account } from "./account";
import { callTime } from "./call-time";
import { common } from "./common";
import { game } from "./game";
import { gamePages } from "./game-pages";
import { insurance } from "./insurance";
import { lib } from "./lib";
import { me } from "./me";
import { players } from "./players";
import { shell } from "./shell";
import { tools } from "./tools";
import { ui } from "./ui";

/**
 * The interface in Chinese, which every other language is checked against: a catalog typed as
 * `Messages` has to have each of these, with the same things to fill in.
 */
export const zh = {
  account,
  callTime,
  common,
  game,
  gamePages,
  insurance,
  lib,
  me,
  players,
  shell,
  tools,
  ui,
};

export type Messages = typeof zh;
