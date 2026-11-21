/** The frame around every page: navigation, and what shows when a page or the books cannot open. */
export const shell = {
  nav: {
    label: "主导航",
    games: "牌局",
    players: "玩家",
    start: "开局",
    tools: "工具",
    me: "我的",
  },
  update: {
    ready: "有新版本可用",
    later: "稍后",
  },
  routeError: {
    title: "页面没能打开",
    body: "可能是刚发布了新版本，刷新后就能打开。数据都保存在本机，不会丢失。",
  },
  inDevelopment: (milestone: string) => `${milestone} 开发中`,
  books: {
    opening: "正在打开账户…",
    unreachableTitle: "连不上账户",
    unreachableHeading: "账户里的记录现在读不出来",
    unreachableBody: "登录后的牌局和玩家记录保存在云端，需要联网才能读写。请检查网络后重试。",
    unreachableNote: "退出登录后可以继续用这台设备上的游客记录，它们不会进入账户。",
    readFailedAccount: "云端的记录没有读出来，这一页可能不完整。请检查网络。",
    readFailedGuest: "记录没有读出来，这一页可能不完整。",
  },
};
