/** What a change waiting to be sent is of, as the sync status names it. */
export type StoppedKind = "game" | "ledger" | "insuranceHand" | "summary" | "player" | "setting";

const KINDS: Record<StoppedKind, string> = {
  game: "牌局",
  ledger: "账目",
  insuranceHand: "保险",
  summary: "结算",
  player: "一位玩家",
  setting: "一个保存的设置",
};

/** The frame around every page: navigation, and what shows when a page or the books cannot open. */
export const shell = {
  nav: {
    label: "主导航",
    games: "牌局",
    players: "玩家",
    start: "开局",
    tools: "工具",
    me: "我的",
    // After the 我的 tab's label, for readers, while records wait to be sent (ADR 0054)
    unsent: "，有记录未发送",
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
    // Never read whole on this device, whatever stopped the first read
    firstOpenHeading: "这台设备还没打开过这个账户",
    firstOpenBody:
      "第一次打开要联网，把账户里的记录下载到这台设备上，之后没网也能用。请检查网络后重试。",
    // Read here before, and the account turns the read down now
    refusedHeading: "现在读不到账户",
    refusedBody:
      "账户没有接受这台设备的读取。这台设备上的记录都还在，没发送的也在，下次打开时继续发送。请稍后重试，或退出后重新登录。",
    unreachableNote: "退出登录后可以继续用这台设备上的游客记录，它们不会进入账户。",
    readFailedAccount: "记录没有读出来，这一页可能不完整。",
    readFailedGuest: "记录没有读出来，这一页可能不完整。",
  },
  /** What an account's books on this device have still to send (ADR 0054). */
  sync: {
    /** A moment, as 11月28日 20:15 */
    day: (month: number, day: number, time: string) => `${month}月${day}日 ${time}`,
    today: (time: string) => `今天 ${time}`,
    refused: (count: number) => `${count} 条记录没有发送`,
    /** What the sender stopped at, in the app's words: a kind, of a game where it has one */
    stoppedAt: (kind: StoppedKind, removed: boolean, game?: string) => {
      const what =
        game === undefined
          ? KINDS[kind]
          : kind === "game"
            ? `${game} 那局`
            : `${game} 那局的${KINDS[kind]}`;
      return removed ? `删除${game === undefined ? "" : " "}${what}` : what;
    },
    stopped: (what: string) => `停在${/^\d/.test(what) ? " " : ""}${what}。记录都在这台设备上。`,
    about: "账户没有接受这条记录，后面的记录都在等它。可以重试，或先导出备份。",
  },
};
