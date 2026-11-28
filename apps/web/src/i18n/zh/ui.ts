/** Shared pieces of the interface. */
export const ui = {
  configMenu: {
    delete: "删除",
  },
  filterBar: {
    // A filter bar's switches chip, with how many of them are on
    options: "设置",
    optionsOn: (on: number, all: number) => `设置 ${on}/${all}`,
    clear: "清除",
    clearFilters: "清除筛选",
  },
  infoButton: {
    about: (a: string | number) => `${a}说明`,
    gotIt: "知道了",
  },
  roleSwitch: {
    host: "Host",
    player: "玩家",
    // What the switch is when it is on
    label: "玩家视角",
  },
  textMenu: {
    collapse: "收起",
  },
  toggle: {
    about: (a: string | number) => `${a}说明`,
    gotIt: "知道了",
  },
};
