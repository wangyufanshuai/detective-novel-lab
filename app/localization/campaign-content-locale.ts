import { campaignLocalizedSafeTextIndex } from "@/lib/engine";
import type { AppLocale } from "./locale-catalog";
import { localizeMidnightChorusGoldSlice } from "./midnight-chorus-gold-slice-locale";

const CAMPAIGN_SAFE_TEXT = campaignLocalizedSafeTextIndex();

// Presentation metadata is authored beside the engine's art direction, so it
// is not part of the case-content translation index. Keep these public labels
// here rather than exposing the internal English art catalog in the archive.
const FRONT_DOOR_PRESENTATION_ZH: Readonly<Record<string, string>> = {
  "Volume I · Public Records": "第一卷 · 公共记录",
  "Volume II · Moving City": "第二卷 · 流动之城",
  "Volume III · Midnight Signals": "第三卷 · 午夜信号",
  "Civic Records Quarter": "市政档案区",
  "Clinic & Press Ward": "诊所报刊区",
  "Academy Quadrangle": "学院四方院",
  "Memorial Garden": "纪念花园",
  "Harbor Tribunal": "港湾审理区",
  "Signal Yard": "信号场",
  "Foundry Gate": "铸造厂门区",
  "River Lock District": "河闸区",
  "Theatre Night Market": "剧院夜市",
  "Grand Hotel": "大饭店区",
  "Power Station Ward": "电站区",
  "Wireless Tower District": "无线电塔区",
  "ledger seal": "账册印章",
  "medical index tab": "医疗索引卡",
  "library call slip": "图书借阅单",
  "memorial rubbing": "纪念拓印",
  "cargo tally": "货运点单",
  "railway ticket": "铁路票据",
  "inspection punch": "检查打孔章",
  "water gauge": "水位计",
  "guest register": "住客登记簿",
  "breaker docket": "断路器案卷",
  "frequency card": "频率卡",
  "Civic records, merchant debt, and institutional pressure": "市政档案、商会债务与机构压力",
  "Cargo movement, witness identity, and court pressure": "货物流转、证人身份与审理压力",
  "Medical timing, household access, and public reputation": "医疗时序、家庭通行与公众声誉",
  "Public performance, backstage access, and night-watch accountability": "公开演出、后台通行与夜巡问责"
};

export function localizeCampaignContent(value: string, locale: AppLocale) {
  return localizeMidnightChorusGoldSlice(value, locale)
    || (locale === "zh-CN" ? FRONT_DOOR_PRESENTATION_ZH[value] : undefined)
    || CAMPAIGN_SAFE_TEXT[value]?.[locale];
}
