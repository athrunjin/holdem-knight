import { describe, expect, it } from "vitest";

import { deviceLanguage, LANGUAGES } from ".";

describe("the device's language", () => {
  it("is Chinese for any kind of Chinese", () => {
    expect(deviceLanguage(["zh-CN"])).toBe("zh");
    expect(deviceLanguage(["zh-Hant-TW", "en"])).toBe("zh");
    expect(deviceLanguage(["ZH"])).toBe("zh");
  });

  it("is the first one the interface comes in", () => {
    expect(deviceLanguage(["fr-FR", "en-AU", "zh-CN"])).toBe("en");
    expect(deviceLanguage(["ja", "zh-CN", "en"])).toBe("zh");
  });

  it("is English when none of them is offered, or none is known", () => {
    expect(deviceLanguage(["fr-FR", "de"])).toBe("en");
    expect(deviceLanguage([])).toBe("en");
  });
});

/** Every text of a catalog with where it sits, calling those that take something to fill in. */
function texts(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (typeof node === "function") {
    const fill = Array.from({ length: node.length }, () => 2);
    return texts((node as (...filled: number[]) => unknown)(...fill), `${path}()`);
  }
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => texts(value, `${path}.${key}`));
  }
  return [];
}

describe("the catalogs", () => {
  const chinese = new Map(texts(LANGUAGES.zh.catalog));

  it("say in English everything the Chinese says, and nothing else", () => {
    const english = texts(LANGUAGES.en.catalog).map(([path]) => path);

    expect(english).toEqual([...chinese.keys()]);
  });

  it("leave no Chinese in the English but the app's Chinese name, which the terms give", () => {
    const left = texts(LANGUAGES.en.catalog).filter(([, text]) =>
      /[一-鿿]/.test(text.replaceAll("有局", "")),
    );

    expect(left).toEqual([]);
  });
});
