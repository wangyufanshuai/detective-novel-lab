import { isCinematicDeductionGoldSlice } from "./cinematic-deduction-model";

export const FIRST_CASE_SOLUTION_REVIEW_TITLE = "The Printed Whisper";

export function isFirstCaseSolutionReview(runtimeMode: string, campaign: Parameters<typeof isCinematicDeductionGoldSlice>[0], caseTitle?: string) {
  return runtimeMode === "server" && isCinematicDeductionGoldSlice(campaign) && caseTitle === FIRST_CASE_SOLUTION_REVIEW_TITLE;
}

export type FirstCaseSolutionReviewModel =
  | { state: "locked" }
  | { state: "returned-text"; paragraphs: string[] }
  | { state: "structured"; culprit: string; motive: string; method: string; evidenceTitles: string[] };

// Only known engine reference prefixes are presentation-only. Unknown prose
// and unfamiliar reveal formats remain visible; this does not evaluate truth.
const INTERNAL_REFERENCE_SOURCE = "(?:npc-\\d+|ev-[A-Za-z0-9][A-Za-z0-9_-]*|caseview-[A-Za-z0-9][A-Za-z0-9_-]*|mem-d\\d+-[A-Za-z0-9_-]+|agent-(?:case|showcase)-[A-Za-z0-9_-]+)";
const INTERNAL_REFERENCE = new RegExp(`\\b${INTERNAL_REFERENCE_SOURCE}\\b`, "g");

function publicText(value: string, localize: (value: string) => string, references: Map<string, string>) {
  const readableReferences = value.replace(INTERNAL_REFERENCE, (reference) => {
    if (!references.has(reference)) {
      const label = reference.startsWith("npc-") ? "Character reference" : reference.startsWith("ev-") ? "Evidence reference" : reference.startsWith("mem-") ? "Memory reference" : "Event reference";
      const ordinal = reference.startsWith("npc-") ? reference.slice(4) : references.size + 1;
      references.set(reference, `${localize(label)} ${ordinal}`);
    }
    return references.get(reference)!;
  });
  return localize(readableReferences.trim());
}

/** Project the already returned reveal, never the editable theory or old graph. */
export function buildFirstCaseSolutionReview(input: {
  accepted: boolean;
  revealText?: string;
  localize?: (value: string) => string;
}): FirstCaseSolutionReviewModel {
  if (!input.accepted || !input.revealText?.trim()) return { state: "locked" };
  const localize = input.localize || ((value: string) => value);
  const references = new Map<string, string>();
  const display = (value: string) => publicText(value, localize, references);
  const lines = input.revealText.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const culprit = lines[0]?.match(/^本地规则复盘：凶手是([^\r\n]+)（npc-[A-Za-z0-9_-]+）。$/);
  const motive = lines[1]?.match(/^动机：(.+)$/);
  const method = lines[2]?.match(/^手法：(.+)$/);
  const evidence = lines[3]?.match(/^关键证据链：(.+)。$/);
  const sourceEvents = lines[4]?.match(/^源事件：([A-Za-z0-9_、-]+)。$/);
  const evidenceItems = evidence?.[1].split("、").map((item) => item.match(/^ev-[A-Za-z0-9_-]+\/(.+)$/));

  // This is the five-line format of makeLocalReveal. Do not silently discard
  // additional narrative, partial fields, or a different provider's response.
  if (lines.length === 5 && culprit && motive && method && sourceEvents && evidenceItems?.length && evidenceItems.every(Boolean)) {
    return {
      state: "structured",
      culprit: display(culprit[1]),
      motive: display(motive[1]),
      method: display(method[1]),
      evidenceTitles: evidenceItems.map((item) => display(item![1]))
    };
  }
  return { state: "returned-text", paragraphs: lines.map(display).filter(Boolean) };
}
