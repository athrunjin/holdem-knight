/** 我的: who is signed in, the language, and backups. */
export const me = {
  title: "我的",
  version: (version: string) => `Hold’em Knight · 开发版 ${version}`,
  guestOnly: {
    title: "游客模式",
    body: "记录只保存在这台设备上。登录后可以保存玩家库和历史牌局，并在多台设备间同步。",
  },
  signedOut: {
    title: "还没有登录",
    body: "记录只保存在这台设备上。登录后新的记录保存到云端的账户里，换手机也不会丢。这台设备上已有的记录暂时不会带进账户。",
  },
  account: {
    rename: "改昵称",
    renameFailed: "保存失败，请重试",
    code: "账户编号",
    copyCode: "复制账户编号",
    copied: "已复制",
    copyFailed: "复制失败，请手动抄写",
    email: "邮箱",
    unread: "账户信息没有读出来，请检查网络后重试。",
    note: "已登录。牌局和玩家记录保存在云端的账户里，需要联网才能读写。这台设备上登录前的游客记录没有带进账户，退出登录后还在。",
  },
  language: {
    title: "语言",
    device: "跟随系统",
  },
  backup: {
    title: "数据备份",
    bodyAccount: "导出账户里的全部记录，留作备份。恢复只新增记录，不会覆盖账户里已有的数据。",
    bodyGuest:
      "换手机或清理浏览器数据后，本机记录会丢失。定期导出备份，需要时再恢复。恢复只新增记录，不会覆盖本机已有的数据。",
    export: "导出备份",
    restore: "恢复备份",
    chooseFile: "选择备份文件",
    exportFailed: (reason: string) => `导出失败${reason && `（${reason}）`}，请重试。`,
    newerVersion: "这个备份来自更新的版本，请先刷新应用。",
    unreadable: "文件无法识别，请选择 Hold’em Knight 导出的备份。",
    restored: (added: number) => `恢复完成：新增 ${added} 条记录。`,
    restoredSkippingAccount: (added: number, skipped: number) =>
      `恢复完成：新增 ${added} 条，跳过 ${skipped} 条账户里已有的记录。`,
    restoredSkippingGuest: (added: number, skipped: number) =>
      `恢复完成：新增 ${added} 条，跳过 ${skipped} 条本机已有的记录。`,
    foreignAccount: "这个备份不是这个账户导出的，不能恢复到账户里。",
    foreignGuest: "这个备份属于其他账户，不能恢复。",
    failedAccount: "恢复失败，账户里的数据没有改动。",
    failedGuest: "恢复失败，本机的数据没有改动。",
  },
};
