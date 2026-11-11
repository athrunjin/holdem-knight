const DATE = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });

/** A suggested name such as 赔率表_11-11, numbered when that name is taken. */
export function datedName(prefix: string, taken: ReadonlySet<string>, now = Date.now()) {
  const base = `${prefix}_${DATE.format(now).replace("/", "-")}`;
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
  return name;
}
