import { describe, expect, it } from "vitest";

import { codeDigits, parseCode, parseDisplayName, parseEmail, parsePassword } from "./account";

describe("parseEmail", () => {
  it("takes an address and drops the spaces around it", () => {
    expect(parseEmail("  name@example.com ")).toEqual({ ok: true, value: "name@example.com" });
  });

  it("refuses nothing, and what is not an address", () => {
    expect(parseEmail("  ")).toEqual({ ok: false, issue: "empty" });
    for (const bad of ["name", "name@", "@example.com", "name@example", "a b@example.com"]) {
      expect(parseEmail(bad), bad).toEqual({ ok: false, issue: "invalid" });
    }
  });
});

describe("parsePassword", () => {
  it("takes 8 characters or more with a letter and a digit, as typed, spaces and all", () => {
    expect(parsePassword(" pass word 1 ")).toEqual({ ok: true, value: " pass word 1 " });
    expect(parsePassword("abcdefg1")).toEqual({ ok: true, value: "abcdefg1" });
  });

  it("refuses one that is missing, too short or too long to be kept whole", () => {
    expect(parsePassword("")).toEqual({ ok: false, issue: "empty" });
    expect(parsePassword("abcde12")).toEqual({ ok: false, issue: "too-short" });
    expect(parsePassword(`1${"x".repeat(72)}`)).toEqual({ ok: false, issue: "too-long" });
    expect(parsePassword(`1${"x".repeat(71)}`).ok).toBe(true);
  });

  it("refuses one with no letter or no digit, counting only the letters a to z", () => {
    expect(parsePassword("12345678")).toEqual({ ok: false, issue: "weak" });
    expect(parsePassword("abcdefgh")).toEqual({ ok: false, issue: "weak" });
    expect(parsePassword("密码密码密码1234")).toEqual({ ok: false, issue: "weak" });
  });
});

describe("parseDisplayName", () => {
  it("takes a name of up to 30 characters, counting each character once", () => {
    expect(parseDisplayName(" 老王 ")).toEqual({ ok: true, value: "老王" });
    expect(parseDisplayName("王".repeat(30)).ok).toBe(true);
    expect(parseDisplayName("😀".repeat(30)).ok).toBe(true);
  });

  it("takes letters of any script, digits, emoji, and the marks - . _", () => {
    for (const name of ["Old Wang", "a_b-c.d", "王😀", "ＡＢＣ", "José", "김철수", "老王2"]) {
      expect(parseDisplayName(name), name).toEqual({ ok: true, value: name });
    }
  });

  it("reads every kind of space as one space", () => {
    expect(parseDisplayName("老\u3000王")).toEqual({ ok: true, value: "老 王" });
    expect(parseDisplayName("a \t  b")).toEqual({ ok: true, value: "a b" });
    expect(parseDisplayName("\u00a0老王\u2003")).toEqual({ ok: true, value: "老王" });
  });

  it("refuses an empty name, one of spaces alone, and one that is too long", () => {
    expect(parseDisplayName(" ")).toEqual({ ok: false, issue: "empty" });
    expect(parseDisplayName("\u3000\u00a0")).toEqual({ ok: false, issue: "empty" });
    expect(parseDisplayName("王".repeat(31))).toEqual({ ok: false, issue: "too-long" });
  });

  it("refuses characters that show nothing or steer the text", () => {
    const unseen = [
      "\u200b",
      "老\u200b王",
      "\u3164",
      "a\u202eb",
      "x\ue000",
      "老\ufeff王",
      "a\u0007b",
    ];
    for (const name of unseen) {
      expect(parseDisplayName(name), JSON.stringify(name)).toEqual({ ok: false, issue: "invalid" });
    }
  });

  it("refuses the marks that code and markup are written with", () => {
    for (const name of [
      "<b>",
      "a'b",
      'a"b',
      "a;b",
      "a\\b",
      "a/b",
      "a&b",
      "{x}",
      "a=b",
      "$a",
      "a`b",
    ]) {
      expect(parseDisplayName(name), name).toEqual({ ok: false, issue: "invalid" });
    }
  });

  it("refuses what a seat or the host is called in a game, however it is spaced", () => {
    for (const name of ["保险", "抽水", "组织者", "抽 水", " 保　险 "]) {
      expect(parseDisplayName(name), name).toEqual({ ok: false, issue: "reserved" });
    }
    expect(parseDisplayName("保险箱").ok).toBe(true);
  });
});

describe("codes", () => {
  it("keeps only the digits of what was typed or pasted, six at most", () => {
    expect(codeDigits("482 916")).toBe("482916");
    expect(codeDigits("验证码：482-916。")).toBe("482916");
    expect(codeDigits("48291699")).toBe("482916");
  });

  it("takes six digits and nothing else", () => {
    expect(parseCode("482 916")).toEqual({ ok: true, value: "482916" });
    expect(parseCode("")).toEqual({ ok: false, issue: "empty" });
    expect(parseCode("48291")).toEqual({ ok: false, issue: "invalid" });
    expect(parseCode("4829167")).toEqual({ ok: false, issue: "invalid" });
  });
});
