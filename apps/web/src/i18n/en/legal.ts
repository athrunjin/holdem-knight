import type { Messages } from "../zh";

export const legal: Messages["legal"] = {
  terms: {
    effective: "Effective date: 27 November 2026",
    version: (version: string) => `Version: ${version}`,
    sections: [
      {
        heading: "1. About these Terms",
        blocks: [
          'These Terms of Use ("these Terms") are an agreement between you and Holdemknight ("we", "us" or "our") governing your use of Hold’em Knight (Chinese name 有局, the "App"). Holdemknight is an individual operator based in Melbourne, Victoria, Australia, and is not a company.',
          'In these Terms: "guest mode" means using the App without signing in to an account; "account" means an account you sign in to in the App; "host" means a person who uses the App to keep records of a game; "books" means all records you enter in or generate with the App, including games, player records, buy-ins and cash-outs, insurance, settings and summaries of settled games; and "player record" means a record a host creates in their books for a person who takes part in a game.',
          "If you use the App with an account, you agree to these Terms and the Privacy Policy by ticking the confirmation box on your first entry. If you use the App in guest mode, these Terms also apply to that use. If you do not agree to these Terms, do not use the App.",
        ],
      },
      {
        heading: "2. What the App is",
        blocks: [
          "The App is a record-keeping tool for hosts of private, in-person Texas Hold’em games. It records buy-ins, cash-outs, settlement between players, insurance, rake, table fees, wages and timing, and generates reports from those records.",
          "The App handles no money. It does not receive, make, hold or transfer payments, and it does not verify whether any amount has actually been paid. It does not organise, run or promote any game, offers no online play and provides no gambling service.",
          "The figures in the App are records entered by users, or results calculated from them. They are not evidence that anyone has paid, owes or is obliged to pay any amount. We are not a party to, and have no responsibility for, any payment, wager, settlement or dispute between users or players.",
          "The App does not provide legal, financial, tax or accounting advice.",
        ],
      },
      {
        heading: "3. Gaming and gambling laws",
        blocks: [
          "Items such as rake, table fees, wages and insurance are provided in the App as accounting fields only. Their presence does not mean that such charges or arrangements are lawful where you play.",
          "In some places, including Victoria, Australia, a private game played for money may be unlawful if anyone charges a fee, takes a rake, or receives a share or payment for organising it. In some places, including mainland China, playing for money may be unlawful or an offence even where no fee or rake is taken, depending on the stakes and the circumstances.",
          "Laws on card games and gambling differ from place to place. You are solely responsible for finding out about and complying with all laws that apply where you play. Nothing in this section is legal advice.",
        ],
      },
      {
        heading: "4. Eligibility",
        blocks: [
          "The App is intended only for persons who are at least 18 years old and have full legal capacity to enter into these Terms.",
          "On your first entry to the App with an account, you must confirm that you are at least 18 years old. We record when you gave that confirmation and agreed to these Terms, and which version of these Terms you agreed to.",
          "Guest mode has no age confirmation. By using the App in guest mode, you confirm that you meet the requirements of this section.",
        ],
      },
      {
        heading: "5. Guest mode and accounts",
        blocks: [
          "In guest mode, your records are kept only in the browser on your device and are not sent to us. Clearing the browser's data, changing device or changing browser may cause those records to be lost, and we cannot recover them.",
          "Accounts are currently created by signing in with Google. A small number of accounts created by us sign in with an email address and password. We may offer other ways to sign up or sign in in future.",
          "You must keep your means of signing in secure and must not share your account with anyone. If you become aware that someone has used your account without authorisation, notify us promptly at the email address in section 18.",
        ],
      },
      {
        heading: "6. Information you enter about other people",
        blocks: [
          "A host's books hold information about other people, including a name or nickname that the host enters, a player number that the App assigns within that host's books (not a phone number or identity document number), results for each game, and amounts owed or due. Those people may not have an account.",
          "Before entering another person's information, you must give that person any notice, and obtain any consent, that applicable law requires. You may use that information only to organise games and record settlement, and you must not enter information that section 7 prohibits.",
          "If that person asks you to correct or delete their information, or we pass such a request on to you, you must deal with it within a reasonable time.",
          "We plan to offer a feature for handing a player record to that player's account. Once it is available, the host decides whether to hand over a record and to which account, and a player who receives a record will be able to see only their own results in games they played and the rules of those games.",
        ],
      },
      {
        heading: "7. Acceptable use",
        blocks: [
          "You must not use the App to do, or help anyone else do, any of the following:",
          [
            "organise, run, promote or assist any unlawful gambling, or engage in any other unlawful activity;",
            "impersonate any person, or enter false or misleading information about another person;",
            "enter sensitive personal information, including identity document numbers, bank account or payment card details, health information, or anyone's contact details or address;",
            "reverse engineer or decompile the App, except to the extent that applicable law expressly permits;",
            "scrape or harvest data from the App by automated means, or create accounts in bulk;",
            "attack, interfere with or disrupt the App or its servers, circumvent any access restriction, or access data that does not belong to you.",
          ],
        ],
      },
      {
        heading: "8. Licence and intellectual property",
        blocks: [
          "Subject to your compliance with these Terms, we grant you a personal, limited, non-exclusive, non-transferable and revocable licence to access and use the App for the purpose of keeping records of private games.",
          'All rights in the App, including its software, interface design, text, logo and the names "Hold’em Knight" and "有局", belong to us or our licensors. Except for the licence expressly granted in this section, these Terms do not transfer or grant you any other right.',
          "Except as applicable law expressly permits or as we agree in writing, you must not copy, modify or distribute the App or any part of it, or create derivative works based on the App.",
        ],
      },
      {
        heading: "9. Your records",
        blocks: [
          "The records you enter in the App remain yours, to the extent of the rights you have in them by law.",
          "You grant us a non-exclusive, royalty-free licence to store, back up, process and display those records solely in order to provide the App to you, and, once the feature described in section 6 is available, to show records to a player's account as you choose. This licence ends when your account and its records are deleted, except for the retention in backups and logs described in the Privacy Policy.",
        ],
      },
      {
        heading: "10. Third-party services",
        blocks: [
          "The App relies on third-party services to operate, including Supabase (database and sign-in), Cloudflare (serving the website) and Google (sign-in with Google). When you sign in with Google, you must also comply with Google's own terms and policies.",
          "We do not control these third-party services. Subject to section 13, we are not liable for any interruption, change or failure of a third-party service, except to the extent caused by our own fault.",
        ],
      },
      {
        heading: "11. Fees",
        blocks: [
          "The App is currently free of charge and has no paid features. We will not charge you anything without your agreement.",
        ],
      },
      {
        heading: "12. Availability, soft launch and data reset",
        blocks: [
          "We use reasonable efforts to keep the App running and its calculations correct, but we do not promise that the App will be uninterrupted or error-free or that data will never be lost. You should check important figures yourself and export your books regularly with the Backup feature.",
          "The App is currently in a soft launch to a small group of users. Before general release, we may need to reset the data held on our servers. If we do, we will give at least 14 days' notice in the App and allow time for you to export your books.",
          "We may change or add features of the App from time to time. Before we remove a core feature or substantially reduce it, we will give at least 14 days' notice in the App and allow time for you to export your books, except where urgent security or legal reasons require immediate action.",
        ],
      },
      {
        heading: "13. Your rights under consumer law",
        blocks: [
          "Nothing in these Terms excludes, restricts or modifies any guarantee, right or remedy you have under the Australian Consumer Law or any other applicable law that cannot lawfully be excluded, restricted or modified. Each exclusion and limitation in these Terms applies only to the extent that such law permits.",
        ],
      },
      {
        heading: "14. Limitation of liability",
        blocks: [
          "Subject to section 13, and to the maximum extent permitted by law, we are not liable for:",
          [
            "any indirect, incidental or consequential loss;",
            "any loss arising from errors in, or omissions from, records entered by users;",
            "the loss of guest-mode records caused by clearing browser data or losing a device;",
            "any loss arising from a game, or from any payment, wager, settlement or dispute between users or players.",
          ],
          "This section does not limit our liability for fraud, wilful misconduct or anything else for which liability cannot lawfully be limited.",
        ],
      },
      {
        heading: "15. Your responsibility for third-party claims",
        blocks: [
          "To the extent permitted by law, if a third party makes a claim against us, you must compensate us for the reasonable losses and reasonable legal costs we actually incur as a result of that claim, to the extent that they are directly caused by: (a) your intentional or reckless use of the App for unlawful gambling or other unlawful activity; or (b) your entering sensitive personal information that section 7 prohibits, or your entering another person's information maliciously. You are not responsible for any part caused by our breach of these Terms or by our fault.",
        ],
      },
      {
        heading: "16. Changes to these Terms",
        blocks: [
          "We may change these Terms. A changed version will show a new effective date and version number.",
          "For a material change, we will give at least 14 days' notice in the App before it takes effect. If you do not agree to the change, you may export your books, stop using the App and request deletion of your account.",
          "The App records which version of these Terms you agreed to. After a material change takes effect, you must confirm your agreement to the changed Terms on your next entry to the App with an account before you continue to use that account; until you confirm, you can still export your books. A change that is not material, and any change as it applies to use in guest mode, applies from its effective date.",
        ],
      },
      {
        heading: "17. Suspension, termination and discontinuation",
        blocks: [
          "You may stop using the App at any time. At present, you request deletion of your account by writing to the email address in section 18; deletion within the App is not yet available. Deleting a host's account also deletes all the books held under that account.",
          "If we reasonably believe that you are using the App for unlawful activity, that your use creates a security risk to the App or other users, or that you have seriously or repeatedly breached these Terms, we may suspend or close your account immediately. For any other breach of these Terms, we will notify you first where reasonably practicable and give you a reasonable opportunity to remedy it. If we suspend or close your account, we will take reasonable steps to let you export your books, unless the law prohibits it or a serious security risk prevents it, and you may ask for a review by writing to the email address in section 18.",
          "We may discontinue the App by giving at least 30 days' notice in the App and allowing time for you to export your books.",
          "Sections 1, 2, 3, 8, 9, 13, 14, 15, 18, 19 and 20, and any other provision that by its nature should continue, survive the termination of these Terms.",
        ],
      },
      {
        heading: "18. Notices and contact",
        blocks: [
          "We give notices under these Terms in the App.",
          "You can contact us at Athrunjin@gmail.com, including to ask a question, request deletion of your account or report a breach of these Terms.",
        ],
      },
      {
        heading: "19. Governing law and jurisdiction",
        blocks: [
          "Without affecting any right you have under the law where you live that cannot lawfully be excluded, these Terms are governed by the laws of Victoria, Australia, and you and we submit to the non-exclusive jurisdiction of the courts of Victoria, Australia.",
          "If a dispute arises, we encourage you to contact us first at the email address in section 18 so that we can try to resolve it by agreement.",
        ],
      },
      {
        heading: "20. General",
        blocks: [
          "If any provision of these Terms is found to be invalid or unenforceable, that provision is to be read down or severed to the minimum extent necessary, and the remaining provisions continue in effect.",
          "A failure or delay by us in exercising any right under these Terms is not a waiver of that right.",
          "These Terms and the Privacy Policy together form the entire agreement between you and us about the App.",
          "These Terms are provided in Chinese and English. If the two versions are inconsistent, the English version prevails.",
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
          'This Privacy Policy ("this Policy") explains how Holdemknight ("we", "us" or "our") collects, uses, stores, discloses and deletes personal information in providing Hold’em Knight (Chinese name 有局, the "App"). Holdemknight is an individual operator based in Melbourne, Victoria, Australia, and is not a company.',
          'In this Policy, "guest mode", "account", "host", "books" and "player record" have the meanings given to them in the Terms of Use.',
        ],
      },
      {
        heading: "2. Guest mode",
        blocks: [
          "In guest mode, all your records are kept only in the browser on your device. They are not sent to us, and we cannot see them.",
          "Clearing the browser's data, changing device or changing browser may cause those records to be lost, and we cannot recover them. Export them regularly with the Backup feature.",
          "Anyone else who can use the same device and browser may be able to see your guest-mode records. Bear this in mind when using guest mode on a shared device.",
          "Even in guest mode, Cloudflare processes your IP address and browser details when it serves the website to you (see section 8).",
        ],
      },
      {
        heading: "3. Information kept for an account",
        blocks: [
          "When you use an account, we keep the following information:",
          [
            "your email address;",
            "your display name and an 8-character account code;",
            "when the account was created;",
            "when you confirmed that you are at least 18 and agreed to the Terms of Use and this Policy, and which version you agreed to;",
            "if you sign in with Google, the Google account identifier, name, email address and profile picture URL that Google provides, which the sign-in service keeps;",
            "your books, including games, player records, buy-ins and cash-outs, insurance, settings and summaries of settled games.",
          ],
          "For an account that signs in with an email address and password, the password is handled and kept by the sign-in service.",
          "Our service providers receive and process your IP address and browser details when they handle your requests, as is necessary to serve any website.",
        ],
      },
      {
        heading: "4. Player information entered by hosts",
        blocks: [
          "A host's books hold information about other people: a name or nickname that the host enters, a player number that the App assigns within that host's books (not a phone number or identity document number), results for each game, and amounts owed or due. Those people may not have an account.",
          "The host is responsible for entering this information, and for giving the people concerned any notice and obtaining any consent that the law requires. We keep this information on the host's behalf and use it only to provide the App to that host, to keep the service secure, and to deal with requests about that information.",
          "We plan to offer a feature for handing a player record to that player's account. Once it is available, a player who receives a record will be able to see only their own results in games they played and the rules of those games, will not see anyone else's results, and will not be able to change the host's books.",
        ],
      },
      {
        heading: "5. Browser storage",
        blocks: [
          "The App keeps in your browser only what it needs to work: guest-mode records, your sign-in session, and interface preferences such as the language.",
          "The App uses no analytics, advertising or tracking tools, and uses no cookies for those purposes.",
        ],
      },
      {
        heading: "6. How we use information",
        blocks: [
          "We use the information described above only to:",
          [
            "sign you in and identify your account;",
            "keep your books and show them to you when you are signed in;",
            "record your age confirmation and your agreement to the Terms of Use and this Policy;",
            "keep the App and its users secure and prevent misuse;",
            "answer your questions and requests;",
            "comply with applicable law.",
          ],
          "We do not sell any personal information, use it for advertising or use it to profile you. The App makes no automated decisions about individuals; it only performs calculations on the figures entered.",
          "The App does not currently send you any email. If we later offer features such as confirmation codes sent by email, we will update this Policy accordingly.",
        ],
      },
      {
        heading: "7. Google user data",
        blocks: [
          "When you sign in with Google, the App receives from Google, through the sign-in service, information within the openid, email and profile scopes: your Google account identifier, name, email address and profile picture URL.",
          "We use this information only to sign you in, to create and identify your account, to handle your requests, to keep the App secure and to comply with applicable law. We do not use it for advertising, sell it or use it to train artificial intelligence or machine learning models. It is not read by any person except with your consent, for security purposes, to comply with the law, or as Google's policy otherwise permits.",
          "You can revoke the App's access at any time in your Google Account settings. Revoking access does not delete the information we already hold; to have it deleted, make a request under section 10.",
          "Hold’em Knight's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.",
        ],
      },
      {
        heading: "8. Service providers and overseas processing",
        blocks: [
          "We use the following service providers to process information:",
          [
            "Supabase: database and sign-in services; account information and books are stored in Sydney, Australia;",
            "Cloudflare: serves the website to you through its global network; your requests may be handled by servers outside Australia;",
            "Google: processes sign-in information when you sign in with Google, and messages sent to our contact address (see section 16), and may do so in countries or regions outside Australia.",
          ],
          "As a result, if you are outside Australia (including in mainland China), your account information and books will be transferred to Australia for storage, and your requests and Google sign-in information may be processed in other countries or regions. Each of these service providers processes information under its own terms and privacy policy.",
          "We, Holdemknight (contact details in section 16), arrange this processing. By agreeing to this Policy on your first entry with an account, you consent to the overseas processing described in this section. If you do not want your account information and books stored outside your country, do not create an account; in guest mode your records do not leave your device, although the website itself is still served by Cloudflare.",
        ],
      },
      {
        heading: "9. Disclosure",
        blocks: [
          "We do not provide your personal information to anyone other than the service providers listed in section 8, except:",
          [
            "with your consent or at your direction;",
            "where applicable law, a court order or a government authority acting under law requires it;",
            "where necessary to protect the safety of the App, its users or the public, to the extent the law permits.",
          ],
        ],
      },
      {
        heading: "10. Retention and deletion",
        blocks: [
          "We keep the information relating to an account for as long as the account exists.",
          "At present, you request deletion of your account by writing to Athrunjin@gmail.com; deletion within the App is not yet available. Deleting a host's account also deletes all the books held under that account, including the player records in them.",
          "After deletion, our service providers' backups and logs may retain the information for a limited period until it is overwritten or removed under their processes.",
          "If we need to reset the data on our servers before general release, we will give at least 14 days' notice in the App, as section 12 of the Terms of Use provides.",
        ],
      },
      {
        heading: "11. Your rights",
        blocks: [
          "In the App, you can change your display name, correct records in your books and export your books with the Backup feature.",
          "To access, correct or delete personal information we hold about you, email Athrunjin@gmail.com. To protect your information, we may take reasonable steps to verify your identity before acting on a request. We aim to respond within 30 days of receiving a request.",
          "Depending on the law that applies where you live (including, where applicable, the Personal Information Protection Law of the People's Republic of China), you may have other rights, such as obtaining a copy of your information, asking us to explain this Policy, or withdrawing your consent. You can export your books with the Backup feature or make a request at the email address above, and we will deal with it to the extent applicable law requires. Withdrawing your consent may require your account to be deleted.",
        ],
      },
      {
        heading: "12. Players without an account",
        blocks: [
          "If a host has recorded information about you in their books and you want it corrected or deleted, please contact that host first.",
          "You may also contact us. Because we cannot verify the identity of players offline, we will usually ask you for reasonable details to identify the records concerned and will pass your request on to that host. Where the law requires it or there is clear misuse, we may restrict or delete the information concerned.",
        ],
      },
      {
        heading: "13. Security",
        blocks: [
          "We rely on the service providers listed in section 8 to store and transmit information, and we limit the information we collect to what is needed to provide the App. No online service, however, can guarantee absolute security.",
          "Keep your means of signing in secure, and do not stay signed in on a shared device. If you believe your account or information has been accessed without authorisation, contact us promptly.",
        ],
      },
      {
        heading: "14. Minors",
        blocks: [
          "The App is not intended for anyone under 18. If we find that an account belongs to a person under 18, we will delete that account. If you believe this is the case for an account, please contact us.",
        ],
      },
      {
        heading: "15. Changes to this Policy",
        blocks: [
          "We may change this Policy. A changed version will show a new effective date and version number.",
          "For a material change, we will give at least 14 days' notice in the App before it takes effect. If you do not agree to the change, you may export your books and request deletion of your account before the change takes effect.",
        ],
      },
      {
        heading: "16. Contact and complaints",
        blocks: [
          "If you have a question, request or complaint about this Policy or about how we handle personal information, email Athrunjin@gmail.com. We aim to respond to a complaint within 30 days of receiving it. Messages sent to that address are handled by our email provider, Google, and kept for as long as needed to deal with the request.",
          "The Privacy Act 1988 (Cth) generally does not apply to small business operators with an annual turnover of AUD 3 million or less, unless an exception applies. The App is provided free of charge, and as an individual operator we may not be covered by that Act. We nonetheless handle personal information as this Policy describes.",
          "If you are in Australia and are not satisfied with our response, you may contact the Office of the Australian Information Commissioner (OAIC) through its website, https://www.oaic.gov.au. However, if the Privacy Act 1988 (Cth) does not apply to us, the OAIC may be unable to deal with your complaint.",
        ],
      },
      {
        heading: "17. Language",
        blocks: [
          "This Policy is provided in Chinese and English. If the two versions are inconsistent, the English version prevails.",
        ],
      },
    ],
  },
};
