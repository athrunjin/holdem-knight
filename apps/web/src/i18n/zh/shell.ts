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
    unreachableBody:
      "这台设备还没有打开过这个账户。第一次打开需要联网，把账户里的记录下载到这台设备上，之后没网也能用。请检查网络后重试。",
    unreachableNote: "退出登录后可以继续用这台设备上的游客记录，它们不会进入账户。",
    readFailedAccount: "记录没有读出来，这一页可能不完整。",
    readFailedGuest: "记录没有读出来，这一页可能不完整。",
  },
  /** What an account's books on this device have still to send (ADR 0054). */
  sync: {
    pending: (count: number) => `${count} 条记录待发送，联网后自动发到账户`,
    refused: (count: number) => `${count} 条记录没有发送`,
    refusedNote: "账户没有接受其中一条。记录都还在这台设备上，也可以导出备份。",
  },
};
