// Tests read the interface in Chinese, the language the catalogs are written from, whatever the
// machine that runs them is set to. The language is settled as the catalogs load, so this comes first.
Object.defineProperty(navigator, "languages", { value: ["zh-CN"], configurable: true });
