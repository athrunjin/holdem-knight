/**
 * Signing up, signing in and resetting a password as the app does them, against the local
 * Supabase and the emails it sends (`pnpm db:start`, then `pnpm test:local`).
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { TERMS_VERSION } from "@/lib/terms";
import { requestReset, setPassword, signIn, signOut, signUp, verifyCode } from "./auth";
import { supabase } from "./supabase";

const mailUrl: string = import.meta.env.MAIL_URL;
const admin = createClient(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const run = crypto.randomUUID().slice(0, 8);
const address = (name: string) => `${name}-${run}@example.com`;
const password = `first-${crypto.randomUUID()}`;

interface Mail {
  readonly subject: string;
  readonly text: string;
}

/** The emails sent to an address, newest first. */
async function mailTo(email: string): Promise<Mail[]> {
  const found = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const { messages } = (await found.json()) as { messages: { ID: string; Subject: string }[] };
  return Promise.all(
    messages.map(async ({ ID, Subject }) => {
      const message = await fetch(`${mailUrl}/api/v1/message/${ID}`);
      const { Text, HTML } = (await message.json()) as { Text: string; HTML: string };
      return { subject: Subject, text: `${Text}\n${HTML}` };
    }),
  );
}

/** The code of the newest email to an address, once it has arrived. */
async function codeFor(email: string, after = 0): Promise<string> {
  for (let tries = 0; tries < 40; tries++) {
    const mails = await mailTo(email);
    const code = mails.length > after ? /\d{6}/.exec(mails[0]?.subject ?? "")?.[0] : undefined;
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No code reached ${email}`);
}

const signedInAs = async () => (await supabase?.auth.getSession())?.data.session?.user.email;

afterAll(async () => {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const mine = data.users.filter((user) => user.email?.includes(`-${run}@`));
  await Promise.all(mine.map((user) => admin.auth.admin.deleteUser(user.id)));
});

describe("signing up", () => {
  const email = address("new");

  it("sends a code, and no link, to the address", async () => {
    expect(await signUp("老王", email, password)).toBeUndefined();
    expect(await signedInAs()).toBeUndefined();

    const code = await codeFor(email);
    const [mail] = await mailTo(email);
    expect(mail?.subject).toContain("注册验证码");
    expect(mail?.text).toContain(code);
    expect(mail?.text).not.toMatch(/https?:\/\//);
  });

  it("refuses to sign in before the address is confirmed", async () => {
    expect(await signIn(email, password)).toBe("email-not-confirmed");
  });

  it("refuses a wrong code and takes the right one, which signs the account in", async () => {
    const code = await codeFor(email);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await verifyCode(email, wrong, "sign-up")).toBe("invalid-code");
    expect(await verifyCode(email, code, "sign-up")).toBeUndefined();
    expect(await signedInAs()).toBe(email);

    const profile = await supabase?.from("profiles").select("display_name").single();
    expect(profile?.data?.display_name).toBe("老王");
  });

  it("answers the same for an address that already has an account, and sends nothing", async () => {
    expect(await signOut()).toBeUndefined();
    const before = (await mailTo(email)).length;
    expect(await signUp("别人", email, `other-${crypto.randomUUID()}`)).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect((await mailTo(email)).length).toBe(before);
    // And the account is as it was
    expect(await signIn(email, password)).toBeUndefined();
    const profile = await supabase?.from("profiles").select("display_name").single();
    expect(profile?.data?.display_name).toBe("老王");
  });
});

describe("what the service itself holds an account to", () => {
  it("keeps the time and the version of the terms the account agreed to", async () => {
    // By the account's own ID: another account may show the same name
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const id = users.users.find((user) => user.email === address("new"))?.id;
    const { data } = await admin
      .from("profiles")
      .select("agreed_at, agreed_version")
      .eq("id", id ?? "")
      .single();
    expect(data?.agreed_version).toBe(TERMS_VERSION);
    expect(Date.parse(data?.agreed_at)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("refuses a password with no digit, even from a client that skips the app's own check", async () => {
    const direct = await supabase?.auth.signUp({
      email: address("letters"),
      password: "onlyletters",
    });
    expect(direct?.error?.code).toBe("weak_password");
  });

  it("gives a name the app would refuse another one, and still makes the account", async () => {
    const email = address("first.last");
    const direct = await supabase?.auth.signUp({
      email,
      password,
      options: { data: { display_name: "<script>alert(1)</script>" } },
    });
    expect(direct?.error).toBeNull();
    const { data } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", direct?.data.user?.id ?? "")
      .single();
    expect(data?.display_name).toBe(`first.last-${run}`);
  });
});

describe("signing in", () => {
  const email = address("new");

  it("gives one answer for a wrong password and for an address with no account", async () => {
    await signOut();
    expect(await signIn(email, "not-the-password")).toBe("invalid-credentials");
    expect(await signIn(address("nobody"), password)).toBe("invalid-credentials");
    expect(await signedInAs()).toBeUndefined();
  });

  it("signs out of this browser", async () => {
    expect(await signIn(email, password)).toBeUndefined();
    expect(await signedInAs()).toBe(email);
    expect(await signOut()).toBeUndefined();
    expect(await signedInAs()).toBeUndefined();
  });
});

describe("resetting a password", () => {
  const email = address("new");
  const renewed = `second-${crypto.randomUUID()}`;

  it("sends a code that signs the account in, which then takes a new password", async () => {
    const before = (await mailTo(email)).length;
    expect(await requestReset(email)).toBeUndefined();
    const code = await codeFor(email, before);
    const [mail] = await mailTo(email);
    expect(mail?.subject).toContain("重置密码验证码");
    expect(mail?.text).not.toMatch(/https?:\/\//);

    expect(await verifyCode(email, code, "recovery")).toBeUndefined();
    expect(await signedInAs()).toBe(email);
    expect(await setPassword(renewed)).toBeUndefined();
  });

  it("refuses the password the account already has", async () => {
    expect(await setPassword(renewed)).toBe("same-password");
  });

  it("leaves only the new password working", async () => {
    await signOut();
    expect(await signIn(email, password)).toBe("invalid-credentials");
    expect(await signIn(email, renewed)).toBeUndefined();
    await signOut();
  });

  it("answers the same for an address with no account, and sends nothing", async () => {
    const stranger = address("stranger");
    expect(await requestReset(stranger)).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await mailTo(stranger)).toEqual([]);
  });
});
