import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, nextSort, sortCards } from "./card-sort";

const people = [
  { name: "张三", initials: "zs", net: 300, amount: 3000 },
  { name: "李四", initials: "ls", net: -500, amount: -5000 },
  { name: "王五", initials: "ww", net: 300, amount: 3000 },
];
const names = (list: readonly { name: string }[]) => list.map(({ name }) => name);

describe("sortCards", () => {
  it("starts in alphabetical order by initials", () => {
    expect(names(sortCards(people, DEFAULT_SORT, (p) => p))).toEqual(["李四", "王五", "张三"]);
  });

  it("orders by a figure either way, alphabetically where level", () => {
    const up = nextSort(DEFAULT_SORT, "net");
    expect(up).toEqual({ key: "net", dir: "asc" });
    expect(names(sortCards(people, up, (p) => p))).toEqual(["李四", "王五", "张三"]);
    const down = nextSort(up, "net");
    expect(down).toEqual({ key: "net", dir: "desc" });
    expect(names(sortCards(people, down, (p) => p))).toEqual(["王五", "张三", "李四"]);
  });

  it("turns the name order round on a second tap", () => {
    const down = nextSort(DEFAULT_SORT, "name");
    expect(names(sortCards(people, down, (p) => p))).toEqual(["张三", "王五", "李四"]);
  });
});
