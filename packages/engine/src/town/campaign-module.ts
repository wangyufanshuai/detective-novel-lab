import type { TownCaseType } from "../persistent-town";
import {
  localizedSafeText,
  type AuthoredCampaignCaseDefinition,
  type AuthoredCampaignLeadFocus,
  type DetectiveCampaignDefinition,
  type DetectiveCampaignRouteId,
  type DetectiveCampaignVolumeId,
  type LocalizedSafeText
} from "./campaign-types";

const RHYTHMS = [
  ["staging", "opportunity", "means", "motive", "trace"],
  ["trace", "opportunity", "staging", "means", "motive"],
  ["means", "trace", "staging", "opportunity", "motive"],
  ["opportunity", "motive", "trace", "means", "staging"],
  ["motive", "means", "opportunity", "trace", "staging"],
  ["staging", "trace", "opportunity", "means", "motive"]
] as const;

type Bilingual = LocalizedSafeText;
export type ExpansionChapterSource = {
  label: Bilingual;
  objective?: Bilingual;
  caseFamily: TownCaseType;
  alternates: readonly TownCaseType[];
  evidenceTheme?: Bilingual;
  worldSurface?: Bilingual;
  leadFocus: AuthoredCampaignLeadFocus;
  title: Bilingual;
  place: Bilingual;
  subject: Bilingual;
  object: Bilingual;
  route: Bilingual;
  pressureGroup: Bilingual;
  witnessAnchor: Bilingual;
  exclusionAnchor: Bilingual;
  aftermath?: Bilingual;
};

export type ExpansionRouteSource = {
  id: DetectiveCampaignRouteId;
  label: Bilingual;
  strategy: Bilingual;
  finaleLabel: Bilingual;
  replayContrast: Bilingual;
  chapters: readonly [ExpansionChapterSource, ExpansionChapterSource, ExpansionChapterSource];
};

export type ExpansionCampaignSource<Id extends string> = {
  id: Id;
  worldPackageId: string;
  volumeId: DetectiveCampaignVolumeId;
  volumeLabel: Bilingual;
  presentationKey: string;
  label: Bilingual;
  theme: Bilingual;
  routes: readonly [ExpansionRouteSource, ExpansionRouteSource];
};

export function expansionChapter(input: Omit<ExpansionChapterSource, "objective" | "evidenceTheme" | "worldSurface" | "aftermath"> & Partial<Pick<ExpansionChapterSource, "objective" | "evidenceTheme" | "worldSurface" | "aftermath">>): ExpansionChapterSource {
  const worldSurface = input.worldSurface || sentence(`${en(input.place)} accountability`, `${zh(input.place)}问责`);
  return {
    ...input,
    objective: input.objective || sentence(
      `Certify ${en(input.subject)} through ${en(input.object)} handling, ${en(input.route)}, and a defensible exclusion.`,
      `通过${zh(input.object)}的经手记录、${zh(input.route)}与可成立的排除项认证${zh(input.subject)}。`
    ),
    evidenceTheme: input.evidenceTheme || sentence(
      `${en(input.object)}, timing, and exclusion`,
      `${zh(input.object)}、时序与排除项`
    ),
    worldSurface,
    aftermath: input.aftermath || sentence(
      `${en(input.label)} leaves ${en(worldSurface)} reviewable for the next chapter.`,
      `${zh(input.label)}让${zh(worldSurface)}在下一章仍可复核。`
    )
  };
}

function en(value: Bilingual) { return value["en-US"]; }
function zh(value: Bilingual) { return value["zh-CN"]; }

function addText(index: Record<string, LocalizedSafeText>, value: Bilingual) {
  index[en(value)] = value;
  return en(value);
}

function sentence(enText: string, zhText: string) {
  return localizedSafeText(enText, zhText);
}

function treatmentText(chapter: ExpansionChapterSource) {
  const theme = sentence(
    `${en(chapter.subject)} becomes reliable only when its handling, timing, and exclusions are read as one certified chain.`,
    `只有把${zh(chapter.subject)}的经手、时序与排除项合并为一条认证链，它才具有可信度。`
  );
  const premise = sentence(
    `At ${en(chapter.place)}, a disputed ${en(chapter.object)} crosses ${en(chapter.route)} while ${en(chapter.pressureGroup)} insist the ordinary record is complete.`,
    `在${zh(chapter.place)}，一份有争议的${zh(chapter.object)}经过${zh(chapter.route)}，而${zh(chapter.pressureGroup)}坚持常规记录没有缺口。`
  );
  const file = sentence(
    `Reconstruct who could handle the ${en(chapter.object)}, use ${en(chapter.route)}, and benefit from pressure around ${en(chapter.subject)} without treating visibility as proof.`,
    `重建谁能够经手${zh(chapter.object)}、利用${zh(chapter.route)}并从${zh(chapter.subject)}的压力中获益，同时不得把显眼等同于证明。`
  );
  const bridge = sentence(
    `The surviving chain will determine how ${en(chapter.worldSurface!)} enters the next chapter.`,
    `最终成立的证据链将决定${zh(chapter.worldSurface!)}以何种方式进入下一章。`
  );
  const pressure = sentence(
    `${en(chapter.pressureGroup)} must protect daily work while preserving a reviewable account of ${en(chapter.subject)}.`,
    `${zh(chapter.pressureGroup)}既要维持日常工作，也必须保留一份可复核的${zh(chapter.subject)}记录。`
  );
  const frame = sentence(
    `Read the ${en(chapter.object)}, ${en(chapter.route)}, and ${en(chapter.witnessAnchor)} as one bounded evidence route`,
    `把${zh(chapter.object)}、${zh(chapter.route)}与${zh(chapter.witnessAnchor)}视为同一条有界证据路线`
  );
  const redOne = sentence(
    `A public dispute around ${en(chapter.subject)} creates a visible motive, but ${en(chapter.exclusionAnchor)} removes access to the decisive ${en(chapter.object)}.`,
    `围绕${zh(chapter.subject)}的公开争执制造了显眼动机，但${zh(chapter.exclusionAnchor)}排除了接触关键${zh(chapter.object)}的可能。`
  );
  const redTwo = sentence(
    `A worker knows ${en(chapter.route)}, yet the verified schedule excludes the interval when the record changed.`,
    `一名工作人员熟悉${zh(chapter.route)}，但经过核验的排班排除了记录发生变化的时段。`
  );
  const witness = sentence(
    `The witness anchors the account to ${en(chapter.witnessAnchor)}, not to the conclusion repeated by the crowd.`,
    `证人把陈述锚定在${zh(chapter.witnessAnchor)}，而不是人群反复传播的结论上。`
  );
  const challenge = sentence(
    `Compare ${en(chapter.route)} with ${en(chapter.exclusionAnchor)} before assigning intent to the disputed ${en(chapter.object)}.`,
    `在给有争议的${zh(chapter.object)}归因之前，先把${zh(chapter.route)}与${zh(chapter.exclusionAnchor)}进行对照。`
  );
  const evidence = {
    means: sentence(`${en(chapter.object)} access instrument`, `${zh(chapter.object)}接触工具`),
    motive: sentence(`${en(chapter.subject)} pressure notice`, `${zh(chapter.subject)}压力通知`),
    opportunity: sentence(`${en(chapter.route)} interval sighting`, `${zh(chapter.route)}时段目击`),
    staging: sentence(`Reconciled ${en(chapter.object)} entry`, `补齐的${zh(chapter.object)}条目`),
    trace: sentence(`${en(chapter.object)} transfer trace`, `${zh(chapter.object)}转移痕迹`),
    exclusion: sentence(`${en(chapter.exclusionAnchor)} rollcall`, `${zh(chapter.exclusionAnchor)}点名记录`)
  };
  return { theme, premise, file, bridge, pressure, frame, redOne, redTwo, witness, challenge, evidence };
}

export function defineExpansionCampaign<Id extends string>(source: ExpansionCampaignSource<Id>) {
  const localizedText: Record<string, LocalizedSafeText> = {};
  const cases: AuthoredCampaignCaseDefinition[] = [];
  const routes = source.routes.map((route, routeIndex) => ({
    id: route.id,
    label: addText(localizedText, route.label),
    strategyLabel: addText(localizedText, route.strategy),
    finaleLabel: addText(localizedText, route.finaleLabel),
    finaleCaseType: route.chapters[2].caseFamily,
    replayContrast: addText(localizedText, route.replayContrast),
    chapters: route.chapters.map((chapter, chapterIndex) => {
      const ordinal = (chapterIndex + 1) as 1 | 2 | 3;
      const copy = treatmentText(chapter);
      const caseText: Record<string, LocalizedSafeText> = {};
      const canonical = (value: Bilingual) => addText(caseText, value);
      cases.push({
        campaignId: source.id,
        routeId: route.id,
        ordinal,
        caseFamily: chapter.caseFamily,
        title: canonical(chapter.title),
        theme: canonical(copy.theme),
        publicPremise: canonical(copy.premise),
        publicCaseFile: canonical(copy.file),
        causalBridge: canonical(copy.bridge),
        occupationalPressure: canonical(copy.pressure),
        evidenceFrame: canonical(copy.frame),
        evidenceTitles: {
          means: canonical(copy.evidence.means), motive: canonical(copy.evidence.motive), opportunity: canonical(copy.evidence.opportunity),
          staging: canonical(copy.evidence.staging), trace: canonical(copy.evidence.trace), exclusion: canonical(copy.evidence.exclusion)
        },
        redHerrings: [canonical(copy.redOne), canonical(copy.redTwo)],
        rhythm: [...RHYTHMS[(routeIndex * 3 + chapterIndex) % RHYTHMS.length]],
        witnessFrame: canonical(copy.witness),
        challengeFrame: canonical(copy.challenge),
        leadFocus: chapter.leadFocus,
        aftermathLabel: canonical(chapter.aftermath!),
        localizedText: caseText
      });
      Object.assign(localizedText, caseText);
      return {
        ordinal,
        label: addText(localizedText, chapter.label),
        objectiveLabel: addText(localizedText, chapter.objective!),
        preferredCaseTypes: [chapter.caseFamily, ...chapter.alternates],
        evidenceThemeLabel: addText(localizedText, chapter.evidenceTheme!),
        worldSurfaceLabel: addText(localizedText, chapter.worldSurface!)
      };
    })
  })) as unknown as DetectiveCampaignDefinition<Id>["routes"];
  const campaign: DetectiveCampaignDefinition<Id> = {
    id: source.id,
    worldPackageIds: [source.worldPackageId],
    volumeId: source.volumeId,
    volumeLabel: addText(localizedText, source.volumeLabel),
    presentationKey: source.presentationKey,
    label: addText(localizedText, source.label),
    themeLabel: addText(localizedText, source.theme),
    routes,
    localizedText
  };
  return Object.freeze({ campaign: Object.freeze(campaign), cases: Object.freeze(cases) });
}

export const tx = localizedSafeText;
