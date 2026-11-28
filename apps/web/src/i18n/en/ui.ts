import type { Messages } from "../zh";

export const ui: Messages["ui"] = {
  configMenu: {
    delete: "Delete",
  },
  filterBar: {
    options: "Options",
    optionsOn: (on, all) => `Options ${on}/${all}`,
    clear: "Clear",
    clearFilters: "Clear filters",
  },
  infoButton: {
    about: (a) => `About ${a}`,
    gotIt: "Got it",
  },
  roleSwitch: {
    host: "Host",
    player: "Player",
    label: "Player view",
  },
  textMenu: {
    collapse: "Collapse",
  },
  toggle: {
    about: (a) => `About ${a}`,
    gotIt: "Got it",
  },
};
