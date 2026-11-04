import type { AppLocale } from "./locale-catalog";

/**
 * Simplified Chinese for the public "why now" (causalBridge) and "pressure"
 * (occupationalPressure) lines of every authored campaign case. These are
 * public framing sentences only; they carry no case truth.
 */
const AUTHORED_CASE_ZH: Readonly<Record<string, string>> = {
  "The surviving custody gap will decide which civic office enters the next debt inquiry under pressure.": "残存的保管缺口，将决定哪个市政部门在压力下进入下一场债务调查。",
  "Public staff are balancing access duties against fear of being blamed for a broken custody chain.": "公职人员一边要履行查阅职责，一边害怕为断裂的保管链背锅。",
  "The resolved debt route determines which institution arrives at the Civic Reckoning with credibility intact.": "债务线索的结论，将决定哪个机构能带着公信力走进市政清算。",
  "Clerks, merchants, and messengers face conflicting duties to preserve records, customers, and institutional standing.": "书记员、商人和信使夹在保全记录、照顾主顾与维护机构名声之间。",
  "This certified conclusion closes the Town Reckoning while preserving every earlier case as an independent truth.": "这一认证结论收束了城镇清算，同时让此前每个案件保持各自独立的真相。",
  "Court staff and civic witnesses must choose between routine procedure and public accountability.": "法院职员和市民证人必须在例行程序与公共问责之间做出选择。",
  "The verified route determines whose account can be trusted when witness identity becomes disputed.": "经核实的路线，将决定证人身份受到质疑时谁的说法可信。",
  "Dock workers, tally clerks, and carriers risk wages and standing when they contradict the official manifest.": "码头工人、理货员和脚夫一旦反驳官方货单，就可能丢掉工钱和地位。",
  "The corrected witness identity determines who enters the Harbor Inquest under protection and who enters under scrutiny.": "更正后的证人身份，将决定谁受保护、谁受审视地进入港口审讯。",
  "Informants, court messengers, and union witnesses weigh truthful correction against public retaliation.": "线人、法院信使和工会证人在说出真相与遭受公开报复之间权衡。",
  "This conclusion fixes the harbor account while leaving another Campaign free to reach a different Finale family.": "这一结论定下了港口的说法，同时允许另一条战役走向不同的终章。",
  "Union representatives, court officers, and dock witnesses must preserve both safety and a verifiable public account.": "工会代表、法警和码头证人既要保住安全，也要留下可核实的公开记录。",
  "The verified interval determines which private access record becomes vulnerable to publication.": "经核实的时间段，将决定哪份私人查阅记录可能被公之于众。",
  "Clinical staff balance patient privacy, inventory duty, and fear that any correction will look like concealment.": "诊所人员要兼顾病人隐私和库存职责，又怕任何更正都像在掩盖。",
  "The resolved publication route decides whether the final trust review begins as protection, scrutiny, or institutional repair.": "报道线索的结论，将决定最终的信任审查以保护、审视还是机构修复开场。",
  "Family staff, editors, and medical workers face incompatible expectations of privacy and public accountability.": "家仆、编辑和医护人员面对隐私与公共问责之间互不相容的期待。",
  "This conclusion closes Clinic Headlines and records which form of public trust the town chose to preserve.": "这一结论收束了诊所头条，并记下小镇选择守护哪一种公共信任。",
  "Medical reviewers, household representatives, and press workers risk institutional trust when they correct the shared record.": "医疗审查员、家族代表和报社人员更正共同记录时，都在拿机构信任冒险。",
  "The verified permit route decides which household obligation becomes vulnerable to commercial pressure.": "经核实的许可线索，将决定哪项家族义务暴露在商业压力之下。",
  "Permit clerks, stall stewards, and couriers must protect public access while merchants contest who was authorized to trade.": "商人们争执谁有权经营时，许可文书、摊位管事和信差必须守住公共通行。",
  "The recovered custody sequence determines which signature reaches the final inheritance review with authority intact.": "找回的保管顺序，将决定哪个签名能带着效力进入最终的遗产审查。",
  "Household stewards, merchants, and legal clerks face competing duties to family privacy, valuation, and public recordkeeping.": "管家、商人和法务书记员夹在家族隐私、财产估值与公共存档之间。",
  "This certified conclusion closes the merchant route while preserving each earlier investigation as an independent truth.": "这一认证结论收束了商人路线，同时让此前每次调查保持各自独立的真相。",
  "Legal clerks, household witnesses, and market representatives risk property and standing when they correct the inherited record.": "法务书记员、家族证人和市场代表更正继承记录时，都在拿财产和地位冒险。",
  "The protected movement trail determines which official seal can be trusted in the next custody dispute.": "受保护的行动轨迹，将决定下一场保管纠纷中哪枚官印可信。",
  "Watch officers, dockworkers, and informants balance shift duties against fear that cooperation will expose them to retaliation.": "巡夜员、码头工人和线人一边要当班，一边害怕合作会招来报复。",
  "The corrected seal history decides which break in the evidence chain becomes visible at the tribunal.": "更正后的印章记录，将决定证据链的哪一处断裂会在法庭上暴露。",
  "Court messengers, tally clerks, and protected witnesses risk employment and safety when they contradict an official-looking document.": "法院信使、理货员和受保护证人一旦反驳看似官方的文件，就会危及饭碗和安全。",
  "This certified conclusion closes the chain-protection route without rewriting the cargo-first Harbor Inquest.": "这一认证结论收束了证据链保护路线，而不改写以货物为先的港口审讯。",
  "Evidence clerks, union stewards, and court officers must protect both a vulnerable witness and an auditable chain.": "证物书记员、工会管事和法警既要保护脆弱的证人，也要守住可审计的证据链。",
  "The verified household route determines which protected copy reaches editorial custody.": "经核实的家族线索，将决定哪份受保护的副本落入编辑部手中。",
  "Family representatives, servants, and clinic clerks balance privacy duties against the need to correct a public account.": "家族代表、仆从和诊所书记员在保密职责与更正公开说法之间权衡。",
  "The resolved copy route determines which editorial decision reaches the final correction hearing.": "副本线索的结论，将决定哪项编辑决定进入最终的更正听证。",
  "Household stewards, legal custodians, and editors face incompatible promises of privacy, verification, and publication.": "管家、法定保管人和编辑面对隐私、核实与发表之间互相冲突的承诺。",
  "This certified conclusion closes the public-correction route while preserving the clinical review as a distinct replay.": "这一认证结论收束了公开更正路线，同时把诊所审查保留为独立的回放。",
  "Editors, medical reviewers, and household representatives risk trust when they correct the same record for different reasons.": "编辑、医疗审查员和家族代表出于不同理由更正同一份记录，都在拿信任冒险。"
};

const NEXT_CHAPTER_PREFIX = "The next chapter follows the public consequence: ";

export function localizeAuthoredCaseText(value: string, locale: AppLocale): string | undefined {
  if (locale !== "zh-CN") return undefined;
  const exact = AUTHORED_CASE_ZH[value];
  if (exact) return exact;
  if (value.startsWith(NEXT_CHAPTER_PREFIX)) {
    const bridge = AUTHORED_CASE_ZH[value.slice(NEXT_CHAPTER_PREFIX.length)];
    if (bridge) return `下一章将沿着公开后果展开：${bridge}`;
  }
  if (value === "The next chapter follows the visible town consequence.") return "下一章将沿着小镇可见的后果展开。";
  return undefined;
}
