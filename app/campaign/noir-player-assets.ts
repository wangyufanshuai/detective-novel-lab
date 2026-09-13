/** Original presentation art keyed by public identity. Never infer identity from an ID hash. */
export type NoirPlayerArt = { src: string; alt: string };
const portraits: Record<string, string> = {
  "林澈": "lin-che",
  "周岚": "zhou-lan",
  "赵砚": "zhao-yan",
  "顾沉": "gu-chen",
  "沈青禾": "shen-qinghe",
  "许真": "xu-zhen",
  "陆执": "lu-zhi",
  "陈映雪": "chen-yingxue",
  "韩照": "han-zhao",
  "方以恒": "fang-yiheng",
  "苏晚": "su-wan",
  "梁岚": "liang-lan",
  "唐纪": "tang-ji",
  "邵闻": "shao-wen",
  "白鹭": "bai-lu",
  "江燃": "jiang-ran",
  "程澄": "cheng-cheng",
  "孟遥": "meng-yao",
  "贺舟": "he-zhou",
  "秦露": "qin-lu"
};
const evidence: Record<string, string> = {
  "受限铅字块": "type-block",
  "Restricted type block": "type-block",
  "撤销署名通知": "cancelled-notice",
  "Cancelled billing notice": "cancelled-notice",
  "被替换的展示页": "display-sheet",
  "Replaced display sheet": "display-sheet",
  "售票处交接": "box-office",
  "Box-office handoff": "box-office",
  "新鲜油墨转印": "ink-transfer",
  "Fresh ink transfer": "ink-transfer",
  "排练点名簿": "call-ledger",
  "Rehearsal call ledger": "call-ledger"
};
export function getNoirPortrait(name: string): NoirPlayerArt | null {
  const key = portraits[name];
  return key ? { src: `/noir-archive/portraits/${key}.webp`, alt: name } : null;
}
export function getNoirEvidenceArt(title: string): NoirPlayerArt | null {
  const key = evidence[title];
  return key ? { src: `/noir-archive/evidence/${key}.webp`, alt: title } : null;
}
