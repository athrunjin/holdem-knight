/** After a saved config's name while its values have been changed by hand. */
export const MODIFIED_MARK = " · 已修改";

/** Asks before a saved config is deleted, saying so when game configs follow it. */
export function removalQuestion(what: string, name: string, followers: number) {
  const question = `删除${what}「${name}」？`;
  return followers > 0
    ? `${question}\n有 ${followers} 个全局设置在用它，删除后它们保留现在的数值。`
    : question;
}

/** Asks before a saved config that game configs follow takes new values. */
export function updateQuestion(name: string, followers: number) {
  return `更新「${name}」？\n有 ${followers} 个全局设置在用它，之后用它们开局会按新的数值。`;
}
