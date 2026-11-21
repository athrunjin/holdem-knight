/**
 * Waits until the local Supabase sends this project's emails. Sign-in reads the templates from the
 * gateway as it starts; when the gateway is not up yet it falls back to its own emails, in English
 * and with a link, and reads ours some ten seconds later. `supabase start` returns before that, so
 * this asks for both emails until each carries its code in the subject, then clears its traces.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { status } from "./status.mjs";

const { url, publicKey, secretKey, mailUrl } = status();
const quiet = { auth: { persistSession: false, autoRefreshToken: false } };
const app = createClient(url, publicKey, quiet);
const admin = createClient(url, secretKey, quiet);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mailTo(email) {
  const found = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  return (await found.json()).messages;
}

/** Whether an account made now gets both emails as the templates have them. */
async function sendsOurEmails() {
  const email = `ready-${randomUUID()}@example.com`;
  const { data, error } = await app.auth.signUp({ email, password: `ready-${randomUUID()}` });
  if (error) throw new Error(`Could not sign up at the local Supabase: ${error.message}`);
  try {
    const reset = await app.auth.resetPasswordForEmail(email);
    if (reset.error) throw new Error(`Could not ask for a reset: ${reset.error.message}`);

    let mails = [];
    for (let tries = 0; tries < 20 && mails.length < 2; tries++) {
      await wait(250);
      mails = await mailTo(email);
    }
    await fetch(`${mailUrl}/api/v1/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDs: mails.map((mail) => mail.ID) }),
    });
    return mails.length === 2 && mails.every((mail) => /^\d{6} /.test(mail.Subject));
  } finally {
    if (data.user) await admin.auth.admin.deleteUser(data.user.id);
  }
}

const deadline = Date.now() + 60_000;
while (!(await sendsOurEmails())) {
  if (Date.now() > deadline) {
    throw new Error(
      "The local Supabase still sends its own emails, not the ones in supabase/templates.",
    );
  }
  await wait(2000);
}
console.log("The local Supabase sends this project's emails.");
