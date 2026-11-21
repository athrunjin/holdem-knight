import type { Messages } from "../zh";

const records = (count: number) => `${count} ${count === 1 ? "record" : "records"}`;

export const me: Messages["me"] = {
  title: "Me",
  version: (version) => `Hold’em Knight · dev ${version}`,
  guestOnly: {
    title: "Guest mode",
    body: "Records are kept on this device only. Signing in will keep your players and past games, and sync them across devices.",
  },
  signedOut: {
    title: "Not signed in",
    body: "Records are kept on this device only. Once you sign in, new records go to your account in the cloud and survive a change of phone. Records already on this device are not brought into the account for now.",
  },
  account: {
    rename: "Rename",
    name: "Name",
    renameFailed: "Couldn’t save. Try again.",
    code: "Account ID",
    copyCode: "Copy account ID",
    copied: "Copied",
    copyFailed: "Couldn’t copy. Please write it down.",
    email: "Email",
    unread: "Couldn’t read your account. Check your network and try again.",
    note: "Signed in. Games and players are kept in your account in the cloud and need a connection to read and write. The guest records made on this device before signing in were not brought in; they are still here after you sign out.",
  },
  language: {
    title: "Language",
    device: "Same as device",
  },
  backup: {
    title: "Backup",
    bodyAccount:
      "Export every record in your account as a backup. Restoring only adds records; it never overwrites what the account already has.",
    bodyGuest:
      "Records on this device are lost if you change phones or clear the browser’s data. Export a backup now and then, and restore it when needed. Restoring only adds records; it never overwrites what this device already has.",
    export: "Export",
    restore: "Restore",
    chooseFile: "Choose a backup file",
    exportFailed: (reason) => `Export failed${reason && ` (${reason})`}. Try again.`,
    newerVersion: "This backup comes from a newer version. Refresh the app first.",
    unreadable: "This file isn’t recognized. Choose a backup exported by Hold’em Knight.",
    restored: (added) => `Restored: ${records(added)} added.`,
    restoredSkippingAccount: (added, skipped) =>
      `Restored: ${records(added)} added, ${skipped} already in the account skipped.`,
    restoredSkippingGuest: (added, skipped) =>
      `Restored: ${records(added)} added, ${skipped} already on this device skipped.`,
    foreignAccount: "This backup wasn’t exported from this account, so it can’t be restored here.",
    foreignGuest: "This backup belongs to another account and can’t be restored.",
    failedAccount: "Restore failed. Nothing in the account was changed.",
    failedGuest: "Restore failed. Nothing on this device was changed.",
  },
};
