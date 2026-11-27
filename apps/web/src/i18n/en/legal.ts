import type { Messages } from "../zh";

export const legal: Messages["legal"] = {
  terms: {
    effective: "Effective date: 27 November 2026",
    version: (version: string) => `Version: ${version}`,
    sections: [
      {
        heading: "1. What this is",
        blocks: [
          'Hold’em Knight (the "app") is provided by Holdemknight. It is a record-keeping tool for people who organize private, in-person Texas Hold’em games: it records buy-ins, cash-outs, settlement between players, insurance, rake, table fees, wages and timing, and makes reports.',
        ],
      },
      {
        heading: "2. What this is not",
        blocks: [
          "The app handles no money: it takes no payments, makes no payments and holds no funds. It does not organize or run games, does not deal cards, and is not a gambling service. The figures in it are your own records; they do not mean anyone has actually paid or owes anything. Wherever you play, you are responsible for following the local law on card games and gambling.",
        ],
      },
      {
        heading: "3. Age",
        blocks: ["You must be 18 or over to use the app. You confirm this when you sign up."],
      },
      {
        heading: "4. Your account and its security",
        blocks: [
          "You can use the app without signing in (guest mode); your records then stay on this device. An account needs an email address and a password or Google sign-in. Keep your password safe and do not share your account. If someone else is using your account, contact us as soon as you can.",
        ],
      },
      {
        heading: "5. The player information you enter",
        blocks: [
          "A host enters information about other people: a name, a number, and each game's results and what is owed or due. These people may have no account. You must make sure you have the right to record this information, use it only to run games and settle up, and help correct or delete it when the person asks. Later, a host will be able to hand a record to a player's account so the player can see their own results; who gets a record is your choice.",
        ],
      },
      {
        heading: "6. Acceptable use",
        blocks: [
          "Do not use the app for anything illegal, do not pretend to be someone else, and do not attack, disrupt or abuse the service, for example by signing up in bulk, getting around limits or reading other people's data.",
        ],
      },
      {
        heading: "7. No warranty",
        blocks: [
          "The app is free for now and provided as is. We try to get the figures right, but we do not promise that the service is always available, free of errors, or that data will never be lost. Check important figures yourself and export them regularly with Backup. Before the public launch we may need to reset data; we will tell you at least 14 days ahead and leave time to export.",
        ],
      },
      {
        heading: "8. Limits of liability",
        blocks: [
          "As far as the law allows, we are not responsible for losses from using or not being able to use the app, including wrong records, lost data and disputes over a game. Money between players is not our business.",
        ],
      },
      {
        heading: "9. Changes to these terms",
        blocks: [
          "We may change these terms. We will announce important changes in the app ahead of time. The app records which version you agreed to; using the app after a change takes effect means you accept the new version.",
        ],
      },
      {
        heading: "10. Stopping use and deletion",
        blocks: [
          "You can stop using the app at any time. For now, to delete your account, contact us; later you will be able to ask in the app, with 30 days to change your mind. Deleting a host's account also deletes all of its books. If you break these terms, we may suspend or close your account.",
        ],
      },
      {
        heading: "11. Governing law and contact",
        blocks: [
          "These terms are governed by the laws of Victoria, Australia. Questions: Athrunjin@gmail.com.",
        ],
      },
    ],
  },
  privacy: {
    effective: "Effective date: 27 November 2026",
    version: (version: string) => `Version: ${version}`,
    sections: [
      {
        heading: "1. Scope",
        blocks: [
          "This policy explains how Holdemknight handles information in running Hold’em Knight.",
        ],
      },
      {
        heading: "2. Guest mode",
        blocks: [
          "When you are not signed in, all your records stay in this device's browser and are never sent to us. Clearing the browser's data or changing devices loses them, so export them with Backup.",
        ],
      },
      {
        heading: "3. What an account keeps",
        blocks: [
          [
            "Your email address and password, handled by the sign-in service;",
            "Your display name and an 8-character account code;",
            "When you signed up, and when and which version of the terms you agreed to, confirming you are 18 or over;",
            "Your books: games, player records, buy-ins and cash-outs, insurance, your settings, and summaries of settled games;",
            "If you sign in with Google: the name, email address and picture address Google provides, kept by the sign-in service;",
            "Your browser also keeps you signed in and remembers preferences such as the language.",
          ],
          "As with any website, the companies that serve it see your IP address and browser details when they handle a request.",
        ],
      },
      {
        heading: "4. Player information entered by hosts",
        blocks: [
          "A host's books hold other players' names, numbers, each game's results and what they owe or are due. These people may have no account. The host is responsible for entering this information; we keep it for the host and use it for nothing else. Later, a host will be able to hand a record to a player's account: the player will see only their own results in games they played and the rules of those games, never anyone else's results, and cannot change the books.",
        ],
      },
      {
        heading: "5. What it is used for",
        blocks: [
          "Only to sign you in, keep your books, send confirmation codes by email, keep the service secure and answer your requests. We do not sell any information or use it for advertising. The app contains no analytics or advertising trackers.",
        ],
      },
      {
        heading: "6. Who processes it for us",
        blocks: [
          [
            "Supabase: the database, sign-in and confirmation codes;",
            "Cloudflare: serving the website;",
            "Google: only when you sign in with Google.",
          ],
          "Their servers may be outside your country or region.",
        ],
      },
      {
        heading: "7. Keeping and deleting",
        blocks: [
          "We keep the information for as long as the account exists. For now, to delete your account, contact us; later you will be able to ask in the app, and it is deleted 30 days later. When a host's account is deleted, its books go with it; when a player's account is deleted, it is only unlinked from records and the host's books stay whole. Our providers' backups and logs may keep data for a while longer.",
        ],
      },
      {
        heading: "8. Access, correction and deletion",
        blocks: [
          "In the app you can change your display name, edit records and export a backup. To see, correct or delete your information, contact Athrunjin@gmail.com. If you are a player and want information a host recorded about you corrected or deleted, contact the host first; you can also contact us and we will pass it on to the host.",
        ],
      },
      {
        heading: "9. Under 18",
        blocks: [
          "The app is not for anyone under 18. If we find an account belonging to a minor, we will delete it.",
        ],
      },
      {
        heading: "10. Changes to this policy",
        blocks: [
          "We may change this policy. We will announce important changes in the app ahead of time and update the version number.",
        ],
      },
      {
        heading: "11. Contact",
        blocks: ["Athrunjin@gmail.com"],
      },
    ],
  },
};
