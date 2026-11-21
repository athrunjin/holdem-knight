/** The player library. */
export const players = {
  title: "玩家",
  playerList: {
    allPlayers: "全部玩家",
    groups: "分组",
    all: "全部",
    filter: "筛选",
    sort: "排列方式",
    inProgress: (a: string | number) => `${a} · 开发中`,
  },
  playerPage: {
    thisPlayerCantBeFound: "找不到这位玩家。",
    backToPlayers: "回到玩家库",
    editPlayer: "修改玩家",
    name: "名字",
  },
  library: {
    searchOrAddAPlayer: "搜索或新建玩家",
    searchOrAddNameOrInitials: "搜索或新建：名字或拼音首字母",
    create: (a: string | number) => `新建「${a}」`,
    noPlayersYetTypeAName: "玩家库是空的。输入名字新建玩家，开局时就能直接选人。",
  },
};
