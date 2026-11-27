/**
 * A document's text as its shape, with each string widened: the Chinese is written `as const` so
 * the number of sections, blocks and list items is part of the type, and every other language must
 * keep them, while saying them in its own words.
 */
type Shape<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { readonly [K in keyof T]: Shape<T[K]> };

/**
 * The terms of use and the privacy policy (ADR 0052). Each section is a heading and its blocks: a
 * string is a paragraph, a list of strings is a bulleted list. Their wording is decided by the
 * organizer and copied as it stands; a change to it is a new `TERMS_VERSION`.
 */
const text = {
  terms: {
    effective: "生效日期：2026 年 11 月 27 日",
    version: (version: string) => `版本：${version}`,
    sections: [
      {
        heading: "1. 这是什么",
        blocks: [
          "Hold’em Knight（有局，下称“本应用”）由 Holdemknight 提供，是给线下私人德州扑克牌局组局者用的记账工具：记录买入、兑出、玩家之间的结算、保险、抽水、台费、工资和计时，并生成报表。",
        ],
      },
      {
        heading: "2. 这不是什么",
        blocks: [
          "本应用不经手任何钱：不收款、不付款、不保管资金，不组织或运营牌局，不发牌，也不是赌博服务。应用里的数字都是你自己的记录，不代表任何人真的付了钱或欠了钱。在哪里打牌，就要遵守当地关于牌局和赌博的法律，这由你自己负责。",
        ],
      },
      {
        heading: "3. 年龄",
        blocks: ["你必须年满 18 岁才能使用本应用。注册时需要确认这一点。"],
      },
      {
        heading: "4. 账户和安全",
        blocks: [
          "不登录也能用（访客模式），记录只存在这台设备上。注册账户需要邮箱和密码或 Google 登录。请保管好密码，不要和别人共用账户。发现账户被别人使用，请尽快联系我们。",
        ],
      },
      {
        heading: "5. 你录入的玩家信息",
        blocks: [
          "组局者会录入其他人的信息：名字、编号，以及每局的成绩和应收应付。这些人可能没有账户。你要确保自己有权记录这些信息，只把它们用于组局和结账，并在对方要求时帮忙更正或删除。以后组局者可以把某条记录交给玩家的账户，让玩家看自己的成绩；交给谁由你决定。",
        ],
      },
      {
        heading: "6. 合理使用",
        blocks: [
          "不得用本应用做违法的事，不得冒充他人，不得攻击、破坏或滥用服务，比如批量注册、绕过限制或读取别人的数据。",
        ],
      },
      {
        heading: "7. 不作保证",
        blocks: [
          "本应用目前免费，按现状提供。我们尽力让计算正确，但不保证服务一直可用、没有错误或数据不会丢失。重要的账请自己核对，并用“数据备份”定期导出。正式上线前我们可能需要重置数据，会至少提前 14 天通知，并留出导出的时间。",
        ],
      },
      {
        heading: "8. 责任限制",
        blocks: [
          "在法律允许的范围内，因使用或无法使用本应用造成的损失，包括记录错误、数据丢失和牌局中的纠纷，我们不承担责任。玩家之间的钱款往来与我们无关。",
        ],
      },
      {
        heading: "9. 协议变更",
        blocks: [
          "我们可能修改本协议。重要修改会提前在应用内告知。应用会记下你同意的是哪个版本；修改生效后继续使用，即表示接受新版本。",
        ],
      },
      {
        heading: "10. 停止使用和删除",
        blocks: [
          "你可以随时停止使用。删除账户目前请联系我们办理；以后会改为在应用内申请，并有 30 天可以撤回。删除组局者的账户，会一并删除其全部账本。违反本协议的，我们可以暂停或关闭账户。",
        ],
      },
      {
        heading: "11. 适用法律和联系方式",
        blocks: ["本协议适用澳大利亚维多利亚州法律。有问题请联系 Athrunjin@gmail.com。"],
      },
    ],
  },
  privacy: {
    effective: "生效日期：2026 年 11 月 27 日",
    version: (version: string) => `版本：${version}`,
    sections: [
      {
        heading: "1. 适用范围",
        blocks: ["本政策说明 Holdemknight 运营 Hold’em Knight（有局）时如何处理信息。"],
      },
      {
        heading: "2. 访客模式",
        blocks: [
          "不登录时，所有记录只保存在你这台设备的浏览器里，不会发给我们。清除浏览器数据或换设备会丢失这些记录，请用“数据备份”导出。",
        ],
      },
      {
        heading: "3. 账户会保存的信息",
        blocks: [
          [
            "邮箱地址和密码，由登录服务处理；",
            "昵称和 8 位账户编号；",
            "注册时间，确认年满 18 岁并同意协议的时间和版本；",
            "你的账本：牌局、玩家记录、买入兑出、保险、各项设置和已结算牌局的汇总；",
            "用 Google 登录时，Google 提供的姓名、邮箱和头像地址，由登录服务保存；",
            "浏览器里还会保存你的登录状态和语言等界面偏好。",
          ],
          "和所有网站一样，提供服务的公司在处理请求时会接触到你的 IP 地址和浏览器信息。",
        ],
      },
      {
        heading: "4. 组局者录入的玩家信息",
        blocks: [
          "组局者的账本里有其他玩家的名字、编号、每局成绩和应收应付，这些人可能没有账户。录入这些信息由组局者负责；我们只替组局者保存，不作别的用途。以后组局者可以把记录交给玩家的账户：玩家只能看到自己参加的牌局里自己的成绩和这局的规则，看不到别人的成绩，也不能改账本。",
        ],
      },
      {
        heading: "5. 用途",
        blocks: [
          "这些信息只用来：让你登录，保存你的账本，发送验证码邮件，维护服务安全，回复你的请求。我们不出售任何信息，也不用于广告。应用里没有分析或广告追踪工具。",
        ],
      },
      {
        heading: "6. 谁帮我们处理",
        blocks: [
          [
            "Supabase：数据库、登录和验证码；",
            "Cloudflare：网站托管；",
            "Google：仅在你用 Google 登录时。",
          ],
          "这些服务的服务器可能不在你所在的国家或地区。",
        ],
      },
      {
        heading: "7. 保存和删除",
        blocks: [
          "账户存在期间，信息一直保存。删除账户目前请联系我们；以后可以在应用内申请，30 天后删除。组局者的账户删除时，其账本一并删除；玩家账户删除时，只解除和记录的关联，组局者的账本不受影响。服务商的备份和日志可能会多保留一段时间。",
        ],
      },
      {
        heading: "8. 查看、更正和删除",
        blocks: [
          "你可以在应用里改昵称、改记录、导出备份。想查看、更正或删除你的信息，请联系 Athrunjin@gmail.com。如果你是玩家，想更正或删除组局者记下的你的信息，请先联系组局者；也可以联系我们，我们会转给组局者处理。",
        ],
      },
      {
        heading: "9. 未满 18 岁",
        blocks: ["本应用不面向未满 18 岁的人。如果发现有未成年人的账户，我们会删除。"],
      },
      {
        heading: "10. 政策变更",
        blocks: ["我们可能修改本政策，重要修改会提前在应用内告知，并更新版本号。"],
      },
      {
        heading: "11. 联系方式",
        blocks: ["Athrunjin@gmail.com"],
      },
    ],
  },
} as const;

export const legal: Shape<typeof text> = text;
