import type { CaseCandidate, NpcActionCandidate, NpcActionKind, PersistentTownRuntime, TownStateSnapshot } from "./persistent-town";
import type { WorldSystemRuntimeHints } from "./detective-content";
import type { NPCProfile, WorldEvent, WorldLocation, WorldState } from "./world-types";

export type TownInstitutionKind = "police" | "media" | "family" | "commerce" | "civic" | "medical" | "court" | "dock_union";

export type TownInstitution = {
  id: string;
  name: string;
  kind: TownInstitutionKind;
  resources: number;
  reputation: number;
  pressure: number;
  agenda: string;
  influenceByLocation: Record<string, number>;
  trustByNpcId: Record<string, number>;
  activeCaseIds: string[];
  policyPressure: number;
};

export type TownProfessionKind = "detective" | "officer" | "reporter" | "doctor" | "merchant" | "lawyer" | "clerk" | "dockworker" | "servant" | "informant";

export type TownProfession = {
  npcId: string;
  kind: TownProfessionKind;
  institutionId?: string;
  rank: number;
  skills: string[];
  income: number;
  workload: number;
};

export type PublicOpinionState = {
  heat: number;
  trustInPolice: number;
  mediaPressure: number;
  rumorVelocity: number;
  witnessFear: number;
  updatedAtTick: number;
};

export type EvidenceContaminationState = {
  contamination: number;
  pollutedEvidenceIds: string[];
  sourceEventIds: string[];
  riskByLocation: Record<string, number>;
  updatedAtTick: number;
};

export type EvidenceChainItem = {
  id: string;
  caseId?: string;
  caseIds?: string[];
  kind?: "physical" | "testimony" | "medical" | "ledger" | "rumor" | "document" | "trace" | "court-record" | "cargo-log" | "telegram" | "receipt" | "footprint" | "blood-pattern" | "autopsy-note" | "alibi-note" | "newspaper-proof" | "family-letter" | "weapon-mark" | "key-impression" | "anonymous-tip";
  locationId: string;
  discoveredByNpcId?: string;
  handledByNpcIds: string[];
  integrity: number;
  contamination: number;
  provenance: "weak" | "mixed" | "strong";
  sourceEventIds: string[];
  sourceActionIds?: string[];
  tamperHistory?: EvidenceTamperRecord[];
  usedInResolution?: boolean;
  publiclyKnown?: boolean;
  updatedAtTick: number;
};

export type EvidenceTamperRecord = {
  tick: number;
  actorId: string;
  actionId: string;
  deltaIntegrity: number;
  deltaContamination: number;
};

export type EvidenceChainState = {
  items: EvidenceChainItem[];
  updatedAtTick: number;
};

export type CaseAftermath = {
  id: string;
  tick: number;
  caseId: string;
  outcome: "solved" | "failed" | "extracted" | "forming";
  institutionDeltas: Record<string, { resources?: number; reputation?: number; pressure?: number }>;
  publicOpinionDelta: Partial<Omit<PublicOpinionState, "updatedAtTick">>;
  relationshipNotes: string[];
};

export type InstitutionStrategy =
  | "allocate-investigation"
  | "chase-headline"
  | "protect-family"
  | "audit-ledger"
  | "schedule-autopsy"
  | "review-court-record"
  | "trace-cargo"
  | "cultivate-informant"
  | "hold-position";

export type InstitutionDecision = {
  id: string;
  tick: number;
  institutionId: string;
  strategy: InstitutionStrategy;
  reason: string;
  targetNpcId?: string;
  targetLocationId?: string;
  eventId?: string;
  worldSystemLabels?: string[];
};

export type LongActionStatus = "ready" | "running" | "completed" | "cancelled" | "blocked";

export type LongActionKind =
  | "investigate-scene"
  | "file-police-report"
  | "publish-rumor"
  | "suppress-story"
  | "tamper-evidence"
  | "protect-witness"
  | "bribe-witness"
  | "conduct-autopsy"
  | "audit-ledger"
  | "family-pressure"
  | "surveil-suspect"
  | "interview-witness"
  | "intimidate-witness"
  | "request-warrant"
  | "leak-to-press"
  | "verify-alibi"
  | "hold-inquest"
  | "cross-examine-witness"
  | "review-court-record"
  | "trace-cargo"
  | "bribe-dockhand"
  | "inspect-warehouse"
  | "seal-autopsy-record"
  | "second-medical-opinion"
  | "secure-evidence-locker"
  | "protect-chain-of-custody"
  | "summon-family-council"
  | "pressure-editor"
  | "cultivate-informant"
  | "verify-anonymous-tip";

export type LongActionInstance = {
  id: string;
  kind: LongActionKind;
  actorId: string;
  targetNpcId?: string;
  targetLocationId?: string;
  institutionId?: string;
  status: LongActionStatus;
  startedAtTick: number;
  updatedAtTick: number;
  durationTicks: number;
  progress: number;
  eventIds: string[];
  blockedReason?: string;
  resultSummary?: string;
  appliedResult?: {
    institutionDeltas: Record<string, { resources: number; reputation: number; pressure: number }>;
    publicOpinionDelta: Partial<Omit<PublicOpinionState, "updatedAtTick">>;
    evidenceContaminationDelta: number;
  };
};

export type LongActionDefinition = {
  kind: LongActionKind;
  label: string;
  durationTicks: number;
  canStart: (input: LongActionContext) => { ok: boolean; reason?: string };
  start: (input: LongActionContext) => LongActionInstance;
  tick: (input: LongActionContext & { action: LongActionInstance }) => LongActionInstance;
  finish: (input: LongActionContext & { action: LongActionInstance }) => LongActionResolution;
  cancel: (input: LongActionContext & { action: LongActionInstance; reason?: string }) => LongActionInstance;
};

export type LongActionContext = {
  world: WorldState;
  runtime: TownRuleRuntimeState;
  actor: NPCProfile;
  events: WorldEvent[];
  tick: number;
  targetNpcId?: string;
  targetLocationId?: string;
  institutionId?: string;
};

export type LongActionResolution = {
  action: LongActionInstance;
  institutionDeltas: Record<string, { resources?: number; reputation?: number; pressure?: number }>;
  publicOpinionDelta: Partial<Omit<PublicOpinionState, "updatedAtTick">>;
  evidenceDelta: {
    contamination?: number;
    sourceEventIds?: string[];
    riskByLocation?: Record<string, number>;
    kind?: EvidenceChainItem["kind"];
    provenance?: EvidenceChainItem["provenance"];
    publiclyKnown?: boolean;
    usedInResolution?: boolean;
  };
};

function retainEvidenceChain(items: EvidenceChainItem[], recentLimit = 80, totalLimit = 160) {
  const retained = [...items.filter((item) => item.usedInResolution), ...items.slice(0, recentLimit)];
  const seen = new Set<string>();
  return retained.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, totalLimit);
}

export type TownRuleRuntimeState = {
  institutions: TownInstitution[];
  professions: TownProfession[];
  catalogLongActionDefinitions: TownRuleCatalogLongAction[];
  evidenceRules: EvidenceRuleCatalogEntry[];
  publicOpinion: PublicOpinionState;
  evidenceContamination: EvidenceContaminationState;
  evidenceChain: EvidenceChainState;
  longActions: LongActionInstance[];
  aftermaths: CaseAftermath[];
  institutionDecisions: InstitutionDecision[];
  resourceLedger: TownResourceLedger;
};

export type TownRuleSnapshotSummary = {
  institutions: Array<Pick<TownInstitution, "id" | "kind" | "resources" | "reputation" | "pressure" | "policyPressure">>;
  publicOpinion: PublicOpinionState;
  evidenceContamination: EvidenceContaminationState;
  evidenceChain: EvidenceChainState;
  runningLongActions: LongActionInstance[];
  institutionDecisions: InstitutionDecision[];
  resourceLedger: TownResourceLedger;
};

export type TownResourceKind =
  | "police_time"
  | "media_attention"
  | "family_influence"
  | "merchant_credit"
  | "medical_capacity"
  | "evidence_integrity"
  | "court_docket"
  | "dock_credit"
  | "informant_trust";

export type TownLongActionReservation = Partial<Record<TownResourceKind, number>>;

export type TownResourceState = {
  kind: TownResourceKind;
  label: string;
  value: number;
  capacity: number;
  pressure: number;
};

export type TownResourceLedger = Record<TownResourceKind, {
  available: number;
  reserved: number;
  spentThisRun: number;
  pressure: number;
}>;

export type TownRuleCatalogLongAction = {
  kind: LongActionKind;
  label: string;
  durationTicks: number;
  requiredInstitutionId?: string;
  resourceCosts: Partial<Record<TownResourceKind, number>>;
  institutionDeltas: Record<string, { resources?: number; reputation?: number; pressure?: number }>;
  publicOpinionDelta: Partial<Omit<PublicOpinionState, "updatedAtTick">>;
  evidenceContaminationDelta: number;
};

export type EvidenceRuleCatalogEntry = {
  id: string;
  kind: NonNullable<EvidenceChainItem["kind"]>;
  weakContaminationThreshold: number;
  strongProvenanceIntegrityFloor: number;
  relatedCaseTypes: string[];
  publicExposureDelta?: number;
};

export type TownRuleCatalog = {
  id: string;
  name: string;
  version: string;
  resources: TownResourceState[];
  institutions: TownInstitution[];
  professions: TownProfession[];
  longActionDefinitions: TownRuleCatalogLongAction[];
  randomEvents: Array<{ id: string; label: string; weight: number; tags: string[] }>;
  casePressureRules: Array<{ id: string; resource: TownResourceKind; threshold: number; effect: string }>;
  evidenceRules?: EvidenceRuleCatalogEntry[];
};

export type RuleCatalogValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    catalogId?: string;
    resourceCount: number;
    institutionCount: number;
    professionCount: number;
    longActionCount: number;
    randomEventCount: number;
    casePressureRuleCount: number;
    evidenceRuleCount: number;
  };
};

const DEFAULT_LONG_ACTION_CATALOG: TownRuleCatalogLongAction[] = [
  { kind: "investigate-scene", label: "Investigate scene", durationTicks: 3, resourceCosts: { police_time: 4 }, institutionDeltas: { "inst-police": { resources: -4, reputation: 2, pressure: -3 } }, publicOpinionDelta: { trustInPolice: 2, witnessFear: -2 }, evidenceContaminationDelta: -8 },
  { kind: "file-police-report", label: "File police report", durationTicks: 2, requiredInstitutionId: "inst-police", resourceCosts: { police_time: 2 }, institutionDeltas: { "inst-police": { reputation: 2, pressure: -5 }, "inst-media": { pressure: 2 } }, publicOpinionDelta: { trustInPolice: 3, heat: -2 }, evidenceContaminationDelta: -4 },
  { kind: "publish-rumor", label: "Publish rumor", durationTicks: 2, resourceCosts: { media_attention: -3 }, institutionDeltas: { "inst-media": { resources: 3, reputation: -2, pressure: 5 }, "inst-police": { pressure: 4 } }, publicOpinionDelta: { heat: 12, mediaPressure: 10, rumorVelocity: 15, witnessFear: 5 }, evidenceContaminationDelta: 5 },
  { kind: "suppress-story", label: "Suppress story", durationTicks: 3, resourceCosts: { police_time: 3, media_attention: 5 }, institutionDeltas: { "inst-police": { reputation: -2, pressure: -3 }, "inst-media": { pressure: -5 } }, publicOpinionDelta: { heat: -10, mediaPressure: -10, trustInPolice: -4 }, evidenceContaminationDelta: 3 },
  { kind: "tamper-evidence", label: "Tamper evidence", durationTicks: 2, resourceCosts: { evidence_integrity: 18 }, institutionDeltas: { "inst-police": { pressure: 6, reputation: -4 } }, publicOpinionDelta: { trustInPolice: -6, witnessFear: 6 }, evidenceContaminationDelta: 18 },
  { kind: "protect-witness", label: "Protect witness", durationTicks: 3, requiredInstitutionId: "inst-police", resourceCosts: { police_time: 5 }, institutionDeltas: { "inst-police": { resources: -5, reputation: 3, pressure: -2 } }, publicOpinionDelta: { witnessFear: -12, trustInPolice: 3 }, evidenceContaminationDelta: -3 },
  { kind: "bribe-witness", label: "Bribe witness", durationTicks: 2, resourceCosts: { merchant_credit: 4 }, institutionDeltas: { "inst-commerce": { resources: -4, pressure: 4 }, "inst-police": { reputation: -3 } }, publicOpinionDelta: { witnessFear: 9, trustInPolice: -4 }, evidenceContaminationDelta: 10 },
  { kind: "conduct-autopsy", label: "Conduct autopsy", durationTicks: 4, requiredInstitutionId: "inst-medical", resourceCosts: { medical_capacity: 3 }, institutionDeltas: { "inst-medical": { resources: -3, reputation: 4 }, "inst-police": { pressure: -4 } }, publicOpinionDelta: { trustInPolice: 2, heat: -2 }, evidenceContaminationDelta: -12 },
  { kind: "audit-ledger", label: "Audit ledger", durationTicks: 4, resourceCosts: { merchant_credit: 2 }, institutionDeltas: { "inst-commerce": { reputation: -2, pressure: 6 }, "inst-civic": { reputation: 3 } }, publicOpinionDelta: { heat: 4, mediaPressure: 3 }, evidenceContaminationDelta: -6 },
  { kind: "family-pressure", label: "Apply family pressure", durationTicks: 3, resourceCosts: { family_influence: 2 }, institutionDeltas: { "inst-family": { resources: -2, reputation: -2, pressure: 5 }, "inst-police": { pressure: 3 } }, publicOpinionDelta: { witnessFear: 8, heat: -2 }, evidenceContaminationDelta: 4 },
  { kind: "surveil-suspect", label: "Surveil suspect", durationTicks: 4, resourceCosts: { police_time: 3 }, institutionDeltas: { "inst-police": { resources: -3, reputation: 1, pressure: -2 } }, publicOpinionDelta: { witnessFear: -1, trustInPolice: 1 }, evidenceContaminationDelta: -4 },
  { kind: "interview-witness", label: "Interview witness", durationTicks: 2, resourceCosts: { police_time: 2 }, institutionDeltas: { "inst-police": { resources: -2, reputation: 2 } }, publicOpinionDelta: { witnessFear: -4, trustInPolice: 2 }, evidenceContaminationDelta: -2 },
  { kind: "intimidate-witness", label: "Intimidate witness", durationTicks: 2, resourceCosts: { family_influence: 3 }, institutionDeltas: { "inst-family": { resources: -3, pressure: 5 }, "inst-police": { reputation: -3, pressure: 4 } }, publicOpinionDelta: { witnessFear: 12, trustInPolice: -5 }, evidenceContaminationDelta: 8 },
  { kind: "request-warrant", label: "Request warrant", durationTicks: 3, requiredInstitutionId: "inst-police", resourceCosts: { police_time: 3 }, institutionDeltas: { "inst-police": { resources: -3, reputation: 3, pressure: -3 }, "inst-civic": { pressure: 2 } }, publicOpinionDelta: { trustInPolice: 3, heat: 1 }, evidenceContaminationDelta: -5 },
  { kind: "leak-to-press", label: "Leak to press", durationTicks: 2, resourceCosts: { media_attention: -4 }, institutionDeltas: { "inst-media": { resources: 4, reputation: -3, pressure: 7 }, "inst-police": { reputation: -4, pressure: 5 } }, publicOpinionDelta: { heat: 15, mediaPressure: 14, rumorVelocity: 12, witnessFear: 6 }, evidenceContaminationDelta: 7 },
  { kind: "verify-alibi", label: "Verify alibi", durationTicks: 3, resourceCosts: { police_time: 2 }, institutionDeltas: { "inst-police": { resources: -2, reputation: 2, pressure: -2 } }, publicOpinionDelta: { trustInPolice: 2, witnessFear: -2 }, evidenceContaminationDelta: -7 },
  { kind: "hold-inquest", label: "Hold inquest", durationTicks: 4, requiredInstitutionId: "inst-court", resourceCosts: { court_docket: 4 }, institutionDeltas: { "inst-court": { resources: -4, reputation: 4, pressure: -4 }, "inst-police": { pressure: -2 }, "inst-media": { pressure: 3 } }, publicOpinionDelta: { heat: 4, trustInPolice: 2, witnessFear: -3 }, evidenceContaminationDelta: -8 },
  { kind: "cross-examine-witness", label: "Cross-examine witness", durationTicks: 3, requiredInstitutionId: "inst-court", resourceCosts: { court_docket: 3 }, institutionDeltas: { "inst-court": { resources: -3, reputation: 3, pressure: -2 }, "inst-family": { pressure: 4 } }, publicOpinionDelta: { witnessFear: 5, trustInPolice: 1 }, evidenceContaminationDelta: -5 },
  { kind: "review-court-record", label: "Review court record", durationTicks: 3, requiredInstitutionId: "inst-court", resourceCosts: { court_docket: 2 }, institutionDeltas: { "inst-court": { resources: -2, reputation: 2, pressure: -3 }, "inst-civic": { reputation: 2 } }, publicOpinionDelta: { trustInPolice: 1 }, evidenceContaminationDelta: -6 },
  { kind: "trace-cargo", label: "Trace cargo", durationTicks: 4, requiredInstitutionId: "inst-dock-union", resourceCosts: { dock_credit: 4 }, institutionDeltas: { "inst-dock-union": { resources: -4, reputation: 2, pressure: 3 }, "inst-commerce": { pressure: 4 } }, publicOpinionDelta: { heat: 3, mediaPressure: 2 }, evidenceContaminationDelta: -4 },
  { kind: "bribe-dockhand", label: "Bribe dockhand", durationTicks: 2, resourceCosts: { dock_credit: 5, merchant_credit: 2 }, institutionDeltas: { "inst-dock-union": { resources: -5, reputation: -4, pressure: 7 }, "inst-commerce": { pressure: 5 } }, publicOpinionDelta: { witnessFear: 8, trustInPolice: -3 }, evidenceContaminationDelta: 9 },
  { kind: "inspect-warehouse", label: "Inspect warehouse", durationTicks: 3, requiredInstitutionId: "inst-dock-union", resourceCosts: { dock_credit: 3 }, institutionDeltas: { "inst-dock-union": { resources: -3, reputation: 2, pressure: -2 }, "inst-police": { pressure: -1 } }, publicOpinionDelta: { trustInPolice: 1 }, evidenceContaminationDelta: -7 },
  { kind: "seal-autopsy-record", label: "Seal autopsy record", durationTicks: 3, requiredInstitutionId: "inst-medical", resourceCosts: { medical_capacity: 3, evidence_integrity: 4 }, institutionDeltas: { "inst-medical": { resources: -3, reputation: -2, pressure: 5 }, "inst-court": { pressure: 3 } }, publicOpinionDelta: { heat: -2, witnessFear: 3, trustInPolice: -2 }, evidenceContaminationDelta: 6 },
  { kind: "second-medical-opinion", label: "Second medical opinion", durationTicks: 4, requiredInstitutionId: "inst-medical", resourceCosts: { medical_capacity: 4 }, institutionDeltas: { "inst-medical": { resources: -4, reputation: 5, pressure: -4 }, "inst-court": { reputation: 2 } }, publicOpinionDelta: { trustInPolice: 2, witnessFear: -2 }, evidenceContaminationDelta: -10 },
  { kind: "secure-evidence-locker", label: "Secure evidence locker", durationTicks: 3, requiredInstitutionId: "inst-police", resourceCosts: { police_time: 3, evidence_integrity: 2 }, institutionDeltas: { "inst-police": { resources: -3, reputation: 3, pressure: -4 }, "inst-court": { reputation: 1 } }, publicOpinionDelta: { trustInPolice: 3, witnessFear: -2 }, evidenceContaminationDelta: -14 },
  { kind: "protect-chain-of-custody", label: "Protect chain of custody", durationTicks: 3, requiredInstitutionId: "inst-police", resourceCosts: { police_time: 3, evidence_integrity: 2 }, institutionDeltas: { "inst-police": { resources: -3, reputation: 2, pressure: -3 }, "inst-court": { pressure: -2 } }, publicOpinionDelta: { trustInPolice: 2 }, evidenceContaminationDelta: -12 },
  { kind: "summon-family-council", label: "Summon family council", durationTicks: 3, resourceCosts: { family_influence: 4 }, institutionDeltas: { "inst-family": { resources: -4, reputation: -2, pressure: 6 }, "inst-court": { pressure: 2 } }, publicOpinionDelta: { witnessFear: 7, heat: -1 }, evidenceContaminationDelta: 3 },
  { kind: "pressure-editor", label: "Pressure editor", durationTicks: 2, resourceCosts: { media_attention: 3, family_influence: 2 }, institutionDeltas: { "inst-media": { resources: -3, reputation: -4, pressure: 7 }, "inst-family": { pressure: 3 } }, publicOpinionDelta: { heat: -6, mediaPressure: -4, rumorVelocity: 5, trustInPolice: -2 }, evidenceContaminationDelta: 4 },
  { kind: "cultivate-informant", label: "Cultivate informant", durationTicks: 4, resourceCosts: { informant_trust: 4, police_time: 1 }, institutionDeltas: { "inst-police": { resources: -1, reputation: 2 }, "inst-media": { pressure: 2 }, "inst-dock-union": { pressure: 2 } }, publicOpinionDelta: { witnessFear: -3, rumorVelocity: 3 }, evidenceContaminationDelta: -6 },
  { kind: "verify-anonymous-tip", label: "Verify anonymous tip", durationTicks: 3, resourceCosts: { informant_trust: 2, police_time: 2 }, institutionDeltas: { "inst-police": { resources: -2, reputation: 2, pressure: -2 }, "inst-media": { pressure: -1 } }, publicOpinionDelta: { trustInPolice: 2, rumorVelocity: -3 }, evidenceContaminationDelta: -7 }
];

const DEFAULT_EVIDENCE_RULES: EvidenceRuleCatalogEntry[] = [
  { id: "physical-trace", kind: "physical", weakContaminationThreshold: 72, strongProvenanceIntegrityFloor: 55, relatedCaseTypes: ["murder", "evidence-tampering"] },
  { id: "testimony-chain", kind: "testimony", weakContaminationThreshold: 65, strongProvenanceIntegrityFloor: 50, relatedCaseTypes: ["false-testimony", "media-rumor"], publicExposureDelta: 8 },
  { id: "medical-finding", kind: "medical", weakContaminationThreshold: 78, strongProvenanceIntegrityFloor: 60, relatedCaseTypes: ["murder", "medical-coverup"] },
  { id: "ledger-entry", kind: "ledger", weakContaminationThreshold: 70, strongProvenanceIntegrityFloor: 58, relatedCaseTypes: ["ledger-fraud", "merchant-extortion"] },
  { id: "rumor-source", kind: "rumor", weakContaminationThreshold: 55, strongProvenanceIntegrityFloor: 45, relatedCaseTypes: ["media-rumor", "family-scandal"], publicExposureDelta: 14 },
  { id: "document-chain", kind: "document", weakContaminationThreshold: 68, strongProvenanceIntegrityFloor: 58, relatedCaseTypes: ["police-misjudgment", "family-scandal"] },
  { id: "scene-trace", kind: "trace", weakContaminationThreshold: 75, strongProvenanceIntegrityFloor: 55, relatedCaseTypes: ["missing-person", "evidence-tampering"] },
  { id: "court-record-chain", kind: "court-record", weakContaminationThreshold: 66, strongProvenanceIntegrityFloor: 60, relatedCaseTypes: ["court-intimidation", "forged-will", "false-testimony"] },
  { id: "cargo-log-chain", kind: "cargo-log", weakContaminationThreshold: 70, strongProvenanceIntegrityFloor: 58, relatedCaseTypes: ["dock-smuggling", "merchant-extortion"] },
  { id: "telegram-chain", kind: "telegram", weakContaminationThreshold: 64, strongProvenanceIntegrityFloor: 55, relatedCaseTypes: ["blackmail", "media-rumor"] },
  { id: "receipt-chain", kind: "receipt", weakContaminationThreshold: 68, strongProvenanceIntegrityFloor: 58, relatedCaseTypes: ["ledger-fraud", "dock-smuggling"] },
  { id: "footprint-chain", kind: "footprint", weakContaminationThreshold: 74, strongProvenanceIntegrityFloor: 56, relatedCaseTypes: ["missing-person", "murder"] },
  { id: "blood-pattern-chain", kind: "blood-pattern", weakContaminationThreshold: 78, strongProvenanceIntegrityFloor: 62, relatedCaseTypes: ["murder", "medical-coverup"] },
  { id: "autopsy-note-chain", kind: "autopsy-note", weakContaminationThreshold: 76, strongProvenanceIntegrityFloor: 62, relatedCaseTypes: ["medical-coverup", "murder"] },
  { id: "alibi-note-chain", kind: "alibi-note", weakContaminationThreshold: 63, strongProvenanceIntegrityFloor: 52, relatedCaseTypes: ["false-testimony", "witness-disappearance"] },
  { id: "newspaper-proof-chain", kind: "newspaper-proof", weakContaminationThreshold: 58, strongProvenanceIntegrityFloor: 50, relatedCaseTypes: ["media-rumor", "blackmail"], publicExposureDelta: 12 },
  { id: "family-letter-chain", kind: "family-letter", weakContaminationThreshold: 62, strongProvenanceIntegrityFloor: 55, relatedCaseTypes: ["family-scandal", "forged-will"] },
  { id: "weapon-mark-chain", kind: "weapon-mark", weakContaminationThreshold: 76, strongProvenanceIntegrityFloor: 60, relatedCaseTypes: ["murder", "evidence-tampering"] },
  { id: "key-impression-chain", kind: "key-impression", weakContaminationThreshold: 72, strongProvenanceIntegrityFloor: 58, relatedCaseTypes: ["missing-person", "court-intimidation"] },
  { id: "anonymous-tip-chain", kind: "anonymous-tip", weakContaminationThreshold: 60, strongProvenanceIntegrityFloor: 48, relatedCaseTypes: ["blackmail", "witness-disappearance"], publicExposureDelta: 6 }
];

function defaultLongActionCatalog(kind: LongActionKind) {
  const setting = DEFAULT_LONG_ACTION_CATALOG.find((item) => item.kind === kind);
  if (!setting) throw new Error(`Unknown long action catalog entry: ${kind}`);
  return setting;
}

function runtimeLongActionCatalog(state: TownRuleRuntimeState, kind: LongActionKind) {
  return state.catalogLongActionDefinitions?.find((item) => item.kind === kind) || defaultLongActionCatalog(kind);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function hasAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

function scanUnsafeCatalogValue(value: unknown, path = "$", errors: string[] = []) {
  if (typeof value === "string") {
    if (/sk-[a-z0-9]/i.test(value) || /api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token/i.test(path)) errors.push(`${path} may contain a secret`);
    if (hasAbsolutePath(value)) errors.push(`${path} contains an absolute path`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafeCatalogValue(item, `${path}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (["runtime", "snapshot", "benchmarkLatest", "hiddenDebugLog", "agent_state_snapshot", "checkpoint"].includes(key)) {
        errors.push(`${path}.${key} contains runtime-only state`);
      }
      scanUnsafeCatalogValue(nested, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function professionForNpc(npc: NPCProfile, index: number): TownProfessionKind {
  const role = `${npc.role} ${npc.skills.join(" ")}`.toLowerCase();
  if (role.includes("detective")) return "detective";
  if (role.includes("police") || role.includes("constable") || role.includes("officer")) return "officer";
  if (role.includes("report") || role.includes("journal")) return "reporter";
  if (role.includes("doctor") || role.includes("clinic") || role.includes("medical")) return "doctor";
  if (role.includes("merchant") || role.includes("shop") || role.includes("trade")) return "merchant";
  if (role.includes("law")) return "lawyer";
  if (role.includes("clerk") || role.includes("archive")) return "clerk";
  if (role.includes("dock")) return "dockworker";
  if (role.includes("informant") || role.includes("source") || role.includes("tip")) return "informant";
  if (role.includes("servant") || role.includes("maid")) return "servant";
  return (["clerk", "merchant", "servant", "dockworker", "informant"] as TownProfessionKind[])[index % 5];
}

function institutionForProfession(kind: TownProfessionKind) {
  if (kind === "officer" || kind === "detective") return "inst-police";
  if (kind === "reporter") return "inst-media";
  if (kind === "doctor") return "inst-medical";
  if (kind === "merchant") return "inst-commerce";
  if (kind === "dockworker") return "inst-dock-union";
  if (kind === "lawyer") return "inst-court";
  if (kind === "clerk") return "inst-civic";
  if (kind === "informant") return "inst-media";
  return "inst-family";
}

function locationInfluence(locations: WorldLocation[], kind: TownInstitutionKind) {
  const result: Record<string, number> = {};
  for (const location of locations) {
    const text = `${location.kind} ${location.name} ${location.description}`.toLowerCase();
    let value = 20;
    if (kind === "police" && (text.includes("police") || location.kind === "restricted")) value = 70;
    if (kind === "media" && (text.includes("press") || text.includes("paper") || location.kind === "public")) value = 55;
    if (kind === "family" && location.kind === "home") value = 65;
    if (kind === "commerce" && (text.includes("shop") || text.includes("market") || text.includes("dock") || location.kind === "work")) value = 60;
    if (kind === "civic" && (text.includes("hall") || text.includes("archive") || location.kind === "public")) value = 55;
    if (kind === "medical" && (text.includes("clinic") || text.includes("doctor"))) value = 70;
    if (kind === "court" && (text.includes("court") || text.includes("hall") || text.includes("archive") || location.kind === "work")) value = 62;
    if (kind === "dock_union" && (text.includes("dock") || text.includes("market") || text.includes("warehouse") || text.includes("trade") || location.kind === "work")) value = 62;
    result[location.id] = value;
  }
  return result;
}

export function createDefaultTownRuleCatalog(world: WorldState, tick = 0): TownRuleCatalog {
  const professions = world.npcs.map((npc, index) => {
    const kind = professionForNpc(npc, index);
    return {
      npcId: npc.id,
      kind,
      institutionId: institutionForProfession(kind),
      rank: 1 + (index % 5),
      skills: [...npc.skills],
      income: 20 + (index % 5) * 10,
      workload: 30 + (index % 4) * 12
    };
  });
  const trustByInstitution = (institutionId: string) => Object.fromEntries(professions.map((profession) => [
    profession.npcId,
    profession.institutionId === institutionId ? 70 : 45
  ]));
  const institutions: TownInstitution[] = [
    { id: "inst-police", name: "Town Police", kind: "police", resources: 62, reputation: 58, pressure: 35, agenda: "Close cases without public panic.", influenceByLocation: locationInfluence(world.locations, "police"), trustByNpcId: trustByInstitution("inst-police"), activeCaseIds: [], policyPressure: 35 },
    { id: "inst-media", name: "Local Gazette", kind: "media", resources: 48, reputation: 52, pressure: 42, agenda: "Publish dramatic but defensible stories.", influenceByLocation: locationInfluence(world.locations, "media"), trustByNpcId: trustByInstitution("inst-media"), activeCaseIds: [], policyPressure: 50 },
    { id: "inst-family", name: "Old Families", kind: "family", resources: 58, reputation: 60, pressure: 45, agenda: "Protect family standing and private secrets.", influenceByLocation: locationInfluence(world.locations, "family"), trustByNpcId: trustByInstitution("inst-family"), activeCaseIds: [], policyPressure: 40 },
    { id: "inst-commerce", name: "Merchants Guild", kind: "commerce", resources: 70, reputation: 55, pressure: 38, agenda: "Keep trade moving and losses contained.", influenceByLocation: locationInfluence(world.locations, "commerce"), trustByNpcId: trustByInstitution("inst-commerce"), activeCaseIds: [], policyPressure: 44 },
    { id: "inst-civic", name: "Town Hall", kind: "civic", resources: 54, reputation: 50, pressure: 36, agenda: "Preserve civic order and records.", influenceByLocation: locationInfluence(world.locations, "civic"), trustByNpcId: trustByInstitution("inst-civic"), activeCaseIds: [], policyPressure: 42 },
    { id: "inst-medical", name: "Clinic and Coroner", kind: "medical", resources: 46, reputation: 57, pressure: 30, agenda: "Protect forensic integrity and patients.", influenceByLocation: locationInfluence(world.locations, "medical"), trustByNpcId: trustByInstitution("inst-medical"), activeCaseIds: [], policyPressure: 28 },
    { id: "inst-court", name: "Magistrate Court", kind: "court", resources: 52, reputation: 53, pressure: 46, agenda: "Protect docket order, warrants, wills, and sworn testimony.", influenceByLocation: locationInfluence(world.locations, "court"), trustByNpcId: trustByInstitution("inst-court"), activeCaseIds: [], policyPressure: 48 },
    { id: "inst-dock-union", name: "Dock Union", kind: "dock_union", resources: 56, reputation: 49, pressure: 47, agenda: "Control cargo records, warehouse access, and quiet labor favors.", influenceByLocation: locationInfluence(world.locations, "dock_union"), trustByNpcId: trustByInstitution("inst-dock-union"), activeCaseIds: [], policyPressure: 45 }
  ];
  return {
    id: "detective-default",
    name: "Detective Default Rule Catalog",
    version: "1.0.0",
    resources: [
      { kind: "police_time", label: "Police Time", value: 62, capacity: 100, pressure: 35 },
      { kind: "media_attention", label: "Media Attention", value: 48, capacity: 100, pressure: 42 },
      { kind: "family_influence", label: "Family Influence", value: 58, capacity: 100, pressure: 45 },
      { kind: "merchant_credit", label: "Merchant Credit", value: 70, capacity: 100, pressure: 38 },
      { kind: "medical_capacity", label: "Medical Capacity", value: 46, capacity: 100, pressure: 30 },
      { kind: "evidence_integrity", label: "Evidence Integrity", value: 90, capacity: 100, pressure: 10 },
      { kind: "court_docket", label: "Court Docket", value: 52, capacity: 100, pressure: 46 },
      { kind: "dock_credit", label: "Dock Credit", value: 56, capacity: 100, pressure: 47 },
      { kind: "informant_trust", label: "Informant Trust", value: 50, capacity: 100, pressure: 42 }
    ],
    institutions,
    professions,
    longActionDefinitions: DEFAULT_LONG_ACTION_CATALOG.map((entry) => ({
      ...entry,
      resourceCosts: { ...entry.resourceCosts },
      institutionDeltas: Object.fromEntries(Object.entries(entry.institutionDeltas).map(([id, delta]) => [id, { ...delta }])),
      publicOpinionDelta: { ...entry.publicOpinionDelta }
    })),
    randomEvents: [
      { id: "rumor-spike", label: "Rumor spike", weight: 30, tags: ["media", "public-opinion"] },
      { id: "ledger-gap", label: "Ledger gap discovered", weight: 20, tags: ["commerce", "evidence"] },
      { id: "witness-recants", label: "Witness recants testimony", weight: 18, tags: ["testimony", "fear"] },
      { id: "autopsy-delay", label: "Autopsy delay", weight: 15, tags: ["medical", "evidence"] },
      { id: "family-alibi", label: "Family-backed alibi", weight: 16, tags: ["family", "alibi"] },
      { id: "press-leak", label: "Press leak", weight: 22, tags: ["media", "rumor"] },
      { id: "court-docket-gap", label: "Court docket gap", weight: 16, tags: ["court", "record", "testimony"] },
      { id: "cargo-ledger-gap", label: "Cargo ledger gap", weight: 18, tags: ["dock", "cargo", "commerce"] },
      { id: "anonymous-tip", label: "Anonymous tip", weight: 14, tags: ["informant", "witness", "tip"] },
      { id: "chain-custody-break", label: "Chain of custody break", weight: 12, tags: ["evidence", "custody", "court"] }
    ],
    casePressureRules: [
      { id: "low-evidence-integrity", resource: "evidence_integrity", threshold: 45, effect: "candidate validation requires stronger provenance" },
      { id: "high-media-attention", resource: "media_attention", threshold: 70, effect: "witness fear rises and media long actions become likelier" },
      { id: "low-police-time", resource: "police_time", threshold: 35, effect: "police misjudgment and delayed protection become likelier" },
      { id: "high-family-pressure", resource: "family_influence", threshold: 65, effect: "family scandal and witness intimidation become likelier" },
      { id: "low-merchant-credit", resource: "merchant_credit", threshold: 45, effect: "ledger fraud and merchant extortion become likelier" },
      { id: "low-medical-capacity", resource: "medical_capacity", threshold: 40, effect: "medical coverup and autopsy delay become likelier" },
      { id: "weak-evidence-provenance", resource: "evidence_integrity", threshold: 60, effect: "evidence tampering warnings become likelier" },
      { id: "high-public-heat", resource: "media_attention", threshold: 55, effect: "media rumor and false testimony become likelier" },
      { id: "court-docket-pressure", resource: "court_docket", threshold: 58, effect: "court intimidation, forged wills, and witness reversals become likelier" },
      { id: "low-dock-credit", resource: "dock_credit", threshold: 45, effect: "dock smuggling and cargo record pressure become likelier" },
      { id: "low-informant-trust", resource: "informant_trust", threshold: 42, effect: "anonymous tips become weaker and witness disappearance becomes likelier" }
    ],
    evidenceRules: DEFAULT_EVIDENCE_RULES.map((rule) => ({ ...rule, relatedCaseTypes: [...rule.relatedCaseTypes] }))
  };
}

export function catalogToTownRuleRuntimeState(catalog: TownRuleCatalog, tick = 0): TownRuleRuntimeState {
  const resource = (kind: TownResourceKind, fallback: number) => catalog.resources.find((item) => item.kind === kind)?.value ?? fallback;
  const resourceLedger = Object.fromEntries(
    catalog.resources.map((item) => [item.kind, {
      available: item.value,
      reserved: 0,
      spentThisRun: 0,
      pressure: item.pressure
    }])
  ) as TownResourceLedger;
  return {
    institutions: catalog.institutions.map((institution) => ({ ...institution, influenceByLocation: { ...institution.influenceByLocation }, trustByNpcId: { ...institution.trustByNpcId }, activeCaseIds: [...institution.activeCaseIds] })),
    professions: catalog.professions.map((profession) => ({ ...profession, skills: [...profession.skills] })),
    catalogLongActionDefinitions: catalog.longActionDefinitions.map((entry) => ({
      ...entry,
      resourceCosts: { ...entry.resourceCosts },
      institutionDeltas: Object.fromEntries(Object.entries(entry.institutionDeltas).map(([id, delta]) => [id, { ...delta }])),
      publicOpinionDelta: { ...entry.publicOpinionDelta }
    })),
    evidenceRules: (catalog.evidenceRules?.length ? catalog.evidenceRules : DEFAULT_EVIDENCE_RULES).map((rule) => ({ ...rule, relatedCaseTypes: [...rule.relatedCaseTypes] })),
    publicOpinion: {
      heat: clamp(resource("media_attention", 48) - 28),
      trustInPolice: catalog.institutions.find((institution) => institution.id === "inst-police")?.reputation || 58,
      mediaPressure: catalog.institutions.find((institution) => institution.id === "inst-media")?.pressure || 30,
      rumorVelocity: 15,
      witnessFear: 20,
      updatedAtTick: tick
    },
    evidenceContamination: {
      contamination: clamp(100 - resource("evidence_integrity", 90)),
      pollutedEvidenceIds: [],
      sourceEventIds: [],
      riskByLocation: {},
      updatedAtTick: tick
    },
    evidenceChain: { items: [], updatedAtTick: tick },
    longActions: [],
    aftermaths: [],
    institutionDecisions: [],
    resourceLedger
  };
}

export function validateTownRuleCatalog(catalog: unknown): RuleCatalogValidationReport {
  const candidate = catalog && typeof catalog === "object" ? catalog as Partial<TownRuleCatalog> : {};
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!catalog || typeof catalog !== "object") errors.push("catalog must be an object");
  if (!candidate.id) errors.push("catalog.id is required");
  if (!candidate.resources?.length) errors.push("resources must not be empty");
  if (!candidate.institutions?.length) errors.push("institutions must not be empty");
  if (!candidate.professions?.length) warnings.push("professions are empty");
  if (!candidate.longActionDefinitions?.length) warnings.push("longActionDefinitions are empty");
  if (!candidate.evidenceRules?.length) warnings.push("evidenceRules are missing; default evidence rules will be used");
  const resourceKinds = new Set((candidate.resources || []).map((resource) => resource.kind));
  const institutionIds = new Set((candidate.institutions || []).map((institution) => institution.id));
  const professionNpcIds = new Set<string>();
  const longActionKinds = new Set<string>();
  for (const kind of ["police_time", "media_attention", "family_influence", "merchant_credit", "medical_capacity", "evidence_integrity"] as TownResourceKind[]) {
    if (!resourceKinds.has(kind)) errors.push(`resource ${kind} is required`);
  }
  for (const resource of candidate.resources || []) {
    if (!resource.kind) errors.push("resource.kind is required");
    if (resourceKinds.has(resource.kind) && (candidate.resources || []).filter((item) => item.kind === resource.kind).length > 1) errors.push(`resource ${resource.kind} is duplicated`);
    if (!Number.isFinite(resource.value) || resource.value < 0) errors.push(`resource ${resource.kind} value must be non-negative`);
    if (!Number.isFinite(resource.capacity) || resource.capacity <= 0) errors.push(`resource ${resource.kind} capacity must be positive`);
    if (!Number.isFinite(resource.pressure)) errors.push(`resource ${resource.kind} pressure must be numeric`);
  }
  for (const institution of candidate.institutions || []) {
    if (!institution.id) errors.push("institution.id is required");
    if (!institution.kind) errors.push(`institution ${institution.id || "(missing id)"} kind is required`);
    for (const field of ["resources", "reputation", "pressure", "policyPressure"] as const) {
      if (!Number.isFinite(institution[field])) errors.push(`institution ${institution.id || "(missing id)"} ${field} must be numeric`);
    }
  }
  for (const profession of candidate.professions || []) {
    if (!profession.npcId) errors.push("profession.npcId is required");
    if (professionNpcIds.has(profession.npcId)) errors.push(`profession for ${profession.npcId} is duplicated`);
    professionNpcIds.add(profession.npcId);
    if (profession.institutionId && !institutionIds.has(profession.institutionId)) errors.push(`profession ${profession.npcId} references missing institution ${profession.institutionId}`);
  }
  for (const action of candidate.longActionDefinitions || []) {
    if (!action.kind) errors.push("longActionDefinitions.kind is required");
    if (longActionKinds.has(action.kind)) errors.push(`long action ${action.kind} is duplicated`);
    longActionKinds.add(action.kind);
    if (!Number.isFinite(action.durationTicks) || action.durationTicks <= 0) errors.push(`long action ${action.kind} durationTicks must be positive`);
    if (action.requiredInstitutionId && !institutionIds.has(action.requiredInstitutionId)) errors.push(`long action ${action.kind} references missing institution ${action.requiredInstitutionId}`);
    for (const resourceKind of Object.keys(action.resourceCosts || {}) as TownResourceKind[]) {
      if (!resourceKinds.has(resourceKind)) errors.push(`long action ${action.kind} references missing resource ${resourceKind}`);
    }
    for (const institutionId of Object.keys(action.institutionDeltas || {})) {
      if (!institutionIds.has(institutionId)) errors.push(`long action ${action.kind} references missing institution ${institutionId}`);
    }
  }
  for (const event of candidate.randomEvents || []) {
    if (!event.id) errors.push("randomEvents.id is required");
    if (!Number.isFinite(event.weight) || event.weight < 0) errors.push(`random event ${event.id || "(missing id)"} weight must be non-negative`);
  }
  for (const rule of candidate.casePressureRules || []) {
    if (!rule.id) errors.push("casePressureRules.id is required");
    if (rule.resource && !resourceKinds.has(rule.resource)) errors.push(`case pressure rule ${rule.id} references missing resource ${rule.resource}`);
    if (!Number.isFinite(rule.threshold)) errors.push(`case pressure rule ${rule.id || "(missing id)"} threshold must be numeric`);
  }
  for (const rule of candidate.evidenceRules || []) {
    if (!rule.id) errors.push("evidenceRules.id is required");
    if (!rule.kind) errors.push(`evidence rule ${rule.id || "(missing id)"} kind is required`);
    if (!Number.isFinite(rule.weakContaminationThreshold)) errors.push(`evidence rule ${rule.id || "(missing id)"} weakContaminationThreshold must be numeric`);
    if (!Number.isFinite(rule.strongProvenanceIntegrityFloor)) errors.push(`evidence rule ${rule.id || "(missing id)"} strongProvenanceIntegrityFloor must be numeric`);
    if (!Array.isArray(rule.relatedCaseTypes) || !rule.relatedCaseTypes.length) errors.push(`evidence rule ${rule.id || "(missing id)"} relatedCaseTypes must not be empty`);
  }
  errors.push(...scanUnsafeCatalogValue(candidate));
  const uniqueErrors = Array.from(new Set(errors));
  return {
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: Array.from(new Set(warnings)),
    summary: {
      catalogId: candidate.id,
      resourceCount: candidate.resources?.length || 0,
      institutionCount: candidate.institutions?.length || 0,
      professionCount: candidate.professions?.length || 0,
      longActionCount: candidate.longActionDefinitions?.length || 0,
      randomEventCount: candidate.randomEvents?.length || 0,
      casePressureRuleCount: candidate.casePressureRules?.length || 0,
      evidenceRuleCount: candidate.evidenceRules?.length || 0
    }
  };
}

export function createTownRuleRuntimeState(world: WorldState, tick = 0): TownRuleRuntimeState {
  return catalogToTownRuleRuntimeState(createDefaultTownRuleCatalog(world, tick), tick);
}

export function ensureTownRuleRuntimeState(world: WorldState, runtime: PersistentTownRuntime & { ruleState?: TownRuleRuntimeState }) {
  runtime.ruleState ||= createTownRuleRuntimeState(world, runtime.tick || 0);
  const fallback = createDefaultTownRuleCatalog(world, runtime.tick || 0);
  runtime.ruleState.evidenceChain ||= { items: [], updatedAtTick: runtime.tick || 0 };
  runtime.ruleState.evidenceRules ||= fallback.evidenceRules || DEFAULT_EVIDENCE_RULES;
  runtime.ruleState.institutionDecisions ||= [];
  runtime.ruleState.catalogLongActionDefinitions ||= fallback.longActionDefinitions.map((entry) => ({
    ...entry,
    resourceCosts: { ...entry.resourceCosts },
    institutionDeltas: Object.fromEntries(Object.entries(entry.institutionDeltas).map(([id, delta]) => [id, { ...delta }])),
    publicOpinionDelta: { ...entry.publicOpinionDelta }
  }));
  runtime.ruleState.resourceLedger ||= Object.fromEntries(
    fallback.resources.map((item) => [item.kind, {
      available: item.value,
      reserved: 0,
      spentThisRun: 0,
      pressure: item.pressure
    }])
  ) as TownResourceLedger;
  return runtime.ruleState;
}

function makeLongAction(input: LongActionContext, kind: LongActionKind, durationTicks: number): LongActionInstance {
  return {
    id: `long-action-${kind}-${input.tick}-${input.actor.id}`,
    kind,
    actorId: input.actor.id,
    targetNpcId: input.targetNpcId,
    targetLocationId: input.targetLocationId || input.actor.homeLocationId,
    institutionId: input.institutionId || input.runtime.professions.find((profession) => profession.npcId === input.actor.id)?.institutionId,
    status: "running",
    startedAtTick: input.tick,
    updatedAtTick: input.tick,
    durationTicks,
    progress: 0,
    eventIds: []
  };
}

function canActorStart(input: LongActionContext, requiredInstitution?: string) {
  const running = input.runtime.longActions.some((action) => action.actorId === input.actor.id && action.status === "running");
  if (running) return { ok: false, reason: "actor already has a running long action" };
  if (requiredInstitution) {
    const profession = input.runtime.professions.find((item) => item.npcId === input.actor.id);
    if (profession?.institutionId !== requiredInstitution) return { ok: false, reason: `actor is not attached to ${requiredInstitution}` };
  }
  return { ok: true };
}

function professionDurationMultiplier(kind: LongActionKind, profession?: TownProfession) {
  if (!profession) return 1;
  if ((kind === "publish-rumor" || kind === "suppress-story") && profession.kind === "reporter") return 0.75;
  if ((kind === "pressure-editor") && profession.kind === "reporter") return 0.8;
  if ((kind === "conduct-autopsy" || kind === "seal-autopsy-record" || kind === "second-medical-opinion") && profession.kind === "doctor") return 0.7;
  if ((kind === "file-police-report" || kind === "protect-witness" || kind === "investigate-scene" || kind === "surveil-suspect" || kind === "interview-witness" || kind === "request-warrant" || kind === "verify-alibi" || kind === "secure-evidence-locker" || kind === "protect-chain-of-custody" || kind === "verify-anonymous-tip") && (profession.kind === "officer" || profession.kind === "detective")) return 0.8;
  if ((kind === "audit-ledger" || kind === "bribe-witness" || kind === "bribe-dockhand") && profession.kind === "merchant") return 0.8;
  if ((kind === "trace-cargo" || kind === "inspect-warehouse" || kind === "bribe-dockhand") && profession.kind === "dockworker") return 0.75;
  if ((kind === "hold-inquest" || kind === "cross-examine-witness" || kind === "review-court-record") && profession.kind === "lawyer") return 0.75;
  if ((kind === "cultivate-informant" || kind === "verify-anonymous-tip") && profession.kind === "informant") return 0.75;
  return 1;
}

function canSpendResources(input: LongActionContext, kind: LongActionKind) {
  const setting = runtimeLongActionCatalog(input.runtime, kind);
  for (const [resourceKind, cost] of Object.entries(setting.resourceCosts) as Array<[TownResourceKind, number]>) {
    if (cost <= 0) continue;
    const ledger = input.runtime.resourceLedger[resourceKind];
    if (!ledger || ledger.available < cost) return { ok: false, reason: `${resourceKind} is insufficient` };
  }
  return { ok: true };
}

function reserveResources(state: TownRuleRuntimeState, kind: LongActionKind) {
  const setting = runtimeLongActionCatalog(state, kind);
  for (const [resourceKind, cost] of Object.entries(setting.resourceCosts) as Array<[TownResourceKind, number]>) {
    const ledger = state.resourceLedger[resourceKind];
    if (!ledger || cost <= 0) continue;
    ledger.available = clamp(ledger.available - cost);
    ledger.reserved = clamp(ledger.reserved + cost);
  }
}

function spendReservedResources(state: TownRuleRuntimeState, kind: LongActionKind) {
  const setting = runtimeLongActionCatalog(state, kind);
  for (const [resourceKind, cost] of Object.entries(setting.resourceCosts) as Array<[TownResourceKind, number]>) {
    const ledger = state.resourceLedger[resourceKind];
    if (!ledger || cost <= 0) continue;
    ledger.reserved = clamp(ledger.reserved - cost);
    ledger.spentThisRun = clamp(ledger.spentThisRun + cost);
    ledger.pressure = clamp(ledger.pressure + Math.ceil(cost / 2));
  }
}

function progressAction(input: LongActionContext & { action: LongActionInstance }) {
  return {
    ...input.action,
    updatedAtTick: input.tick,
    progress: clamp(input.action.progress + Math.ceil(100 / input.action.durationTicks))
  };
}

function finishWith(input: LongActionContext & { action: LongActionInstance }, resolution: Omit<LongActionResolution, "action">): LongActionResolution {
  return {
    ...resolution,
    action: {
      ...input.action,
      status: "completed",
      updatedAtTick: input.tick,
      progress: 100,
      resultSummary: `${input.action.kind} completed`
    }
  };
}

function finishFromCatalog(
  input: LongActionContext & { action: LongActionInstance },
  kind: LongActionKind,
  evidenceExtras: Partial<LongActionResolution["evidenceDelta"]> = {}
) {
  const setting = runtimeLongActionCatalog(input.runtime, kind);
  return finishWith(input, {
    institutionDeltas: setting.institutionDeltas,
    publicOpinionDelta: setting.publicOpinionDelta,
    evidenceDelta: {
      contamination: setting.evidenceContaminationDelta,
      ...evidenceExtras
    }
  });
}

function definitionFromCatalog(
  kind: LongActionKind,
  finish: (input: LongActionContext & { action: LongActionInstance }) => LongActionResolution = (input) => finishFromCatalog(input, kind)
): LongActionDefinition {
  const fallbackSetting = defaultLongActionCatalog(kind);
  return {
    kind,
    label: fallbackSetting.label,
    durationTicks: fallbackSetting.durationTicks,
    canStart: (input) => {
      const setting = runtimeLongActionCatalog(input.runtime, kind);
      const actorCheck = canActorStart(input, setting.requiredInstitutionId);
      if (!actorCheck.ok) return actorCheck;
      return canSpendResources(input, kind);
    },
    start: (input) => {
      const setting = runtimeLongActionCatalog(input.runtime, kind);
      reserveResources(input.runtime, kind);
      const profession = input.runtime.professions.find((item) => item.npcId === input.actor.id);
      const durationTicks = Math.max(1, Math.round(setting.durationTicks * professionDurationMultiplier(kind, profession)));
      return makeLongAction(input, kind, durationTicks);
    },
    tick: progressAction,
    finish,
    cancel: ({ action, reason, tick }) => ({ ...action, status: "cancelled", updatedAtTick: tick, blockedReason: reason })
  };
}

const DEFINITIONS: LongActionDefinition[] = [
  definitionFromCatalog("investigate-scene", (input) => finishFromCatalog(input, "investigate-scene", { kind: "physical", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), riskByLocation: input.action.targetLocationId ? { [input.action.targetLocationId]: -10 } : {} })),
  definitionFromCatalog("file-police-report", (input) => finishFromCatalog(input, "file-police-report", { kind: "document", provenance: "mixed", sourceEventIds: input.events.slice(-2).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("publish-rumor", (input) => finishFromCatalog(input, "publish-rumor", { kind: "rumor", provenance: "weak", publiclyKnown: true, sourceEventIds: input.events.slice(-2).map((event) => event.id) })),
  definitionFromCatalog("suppress-story", (input) => finishFromCatalog(input, "suppress-story", { kind: "testimony", provenance: "mixed", publiclyKnown: false, sourceEventIds: input.events.slice(-2).map((event) => event.id) })),
  definitionFromCatalog("tamper-evidence", (input) => finishFromCatalog(input, "tamper-evidence", { kind: "trace", provenance: "weak", sourceEventIds: input.events.slice(-2).map((event) => event.id), riskByLocation: input.action.targetLocationId ? { [input.action.targetLocationId]: 20 } : {} })),
  definitionFromCatalog("protect-witness"),
  definitionFromCatalog("bribe-witness"),
  definitionFromCatalog("conduct-autopsy", (input) => finishFromCatalog(input, "conduct-autopsy", { kind: "medical", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("audit-ledger", (input) => finishFromCatalog(input, "audit-ledger", { kind: "ledger", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("family-pressure", (input) => finishFromCatalog(input, "family-pressure", { kind: "testimony", provenance: "weak", sourceEventIds: input.events.slice(-2).map((event) => event.id) })),
  definitionFromCatalog("surveil-suspect", (input) => finishFromCatalog(input, "surveil-suspect", { kind: "trace", provenance: "mixed", sourceEventIds: input.events.slice(-3).map((event) => event.id) })),
  definitionFromCatalog("interview-witness", (input) => finishFromCatalog(input, "interview-witness", { kind: "testimony", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id) })),
  definitionFromCatalog("intimidate-witness", (input) => finishFromCatalog(input, "intimidate-witness", { kind: "testimony", provenance: "weak", sourceEventIds: input.events.slice(-2).map((event) => event.id) })),
  definitionFromCatalog("request-warrant", (input) => finishFromCatalog(input, "request-warrant", { kind: "document", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("leak-to-press", (input) => finishFromCatalog(input, "leak-to-press", { kind: "rumor", provenance: "weak", publiclyKnown: true, sourceEventIds: input.events.slice(-2).map((event) => event.id) })),
  definitionFromCatalog("verify-alibi", (input) => finishFromCatalog(input, "verify-alibi", { kind: "testimony", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("hold-inquest", (input) => finishFromCatalog(input, "hold-inquest", { kind: "court-record", provenance: "strong", sourceEventIds: input.events.slice(-4).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("cross-examine-witness", (input) => finishFromCatalog(input, "cross-examine-witness", { kind: "testimony", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("review-court-record", (input) => finishFromCatalog(input, "review-court-record", { kind: "court-record", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("trace-cargo", (input) => finishFromCatalog(input, "trace-cargo", { kind: "cargo-log", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("bribe-dockhand", (input) => finishFromCatalog(input, "bribe-dockhand", { kind: "anonymous-tip", provenance: "weak", sourceEventIds: input.events.slice(-2).map((event) => event.id), publiclyKnown: false })),
  definitionFromCatalog("inspect-warehouse", (input) => finishFromCatalog(input, "inspect-warehouse", { kind: "receipt", provenance: "mixed", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("seal-autopsy-record", (input) => finishFromCatalog(input, "seal-autopsy-record", { kind: "autopsy-note", provenance: "weak", sourceEventIds: input.events.slice(-2).map((event) => event.id), publiclyKnown: false })),
  definitionFromCatalog("second-medical-opinion", (input) => finishFromCatalog(input, "second-medical-opinion", { kind: "autopsy-note", provenance: "strong", sourceEventIds: input.events.slice(-4).map((event) => event.id), usedInResolution: true })),
  definitionFromCatalog("secure-evidence-locker", (input) => finishFromCatalog(input, "secure-evidence-locker", { kind: "key-impression", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true, riskByLocation: input.action.targetLocationId ? { [input.action.targetLocationId]: -12 } : {} })),
  definitionFromCatalog("protect-chain-of-custody", (input) => finishFromCatalog(input, "protect-chain-of-custody", { kind: "document", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true, riskByLocation: input.action.targetLocationId ? { [input.action.targetLocationId]: -8 } : {} })),
  definitionFromCatalog("summon-family-council", (input) => finishFromCatalog(input, "summon-family-council", { kind: "family-letter", provenance: "mixed", sourceEventIds: input.events.slice(-2).map((event) => event.id) })),
  definitionFromCatalog("pressure-editor", (input) => finishFromCatalog(input, "pressure-editor", { kind: "newspaper-proof", provenance: "mixed", publiclyKnown: true, sourceEventIds: input.events.slice(-2).map((event) => event.id) })),
  definitionFromCatalog("cultivate-informant", (input) => finishFromCatalog(input, "cultivate-informant", { kind: "anonymous-tip", provenance: "mixed", sourceEventIds: input.events.slice(-3).map((event) => event.id) })),
  definitionFromCatalog("verify-anonymous-tip", (input) => finishFromCatalog(input, "verify-anonymous-tip", { kind: "anonymous-tip", provenance: "strong", sourceEventIds: input.events.slice(-3).map((event) => event.id), usedInResolution: true }))
];

export function getLongActionDefinitions() {
  return DEFINITIONS;
}

export function getLongActionDefinition(kind: LongActionKind) {
  const definition = DEFINITIONS.find((item) => item.kind === kind);
  if (!definition) throw new Error(`Unknown long action: ${kind}`);
  return definition;
}

export function startTownLongAction(input: {
  world: WorldState;
  state: TownRuleRuntimeState;
  actor: NPCProfile;
  kind: LongActionKind;
  events: WorldEvent[];
  tick: number;
  targetNpcId?: string;
  targetLocationId?: string;
  institutionId?: string;
}): { action?: LongActionInstance; blockedReason?: string; reservedResources: TownLongActionReservation } {
  const definition = getLongActionDefinition(input.kind);
  const context: LongActionContext = {
    world: input.world,
    runtime: input.state,
    actor: input.actor,
    events: input.events,
    tick: input.tick,
    targetNpcId: input.targetNpcId,
    targetLocationId: input.targetLocationId,
    institutionId: input.institutionId
  };
  const canStart = definition.canStart(context);
  if (!canStart.ok) return { blockedReason: canStart.reason || "long action cannot start", reservedResources: {} };
  const beforeAvailable = Object.fromEntries(
    Object.entries(input.state.resourceLedger).map(([kind, ledger]) => [kind, ledger.available])
  ) as Record<TownResourceKind, number>;
  const action = definition.start(context);
  const reservedResources = Object.fromEntries(
    Object.entries(input.state.resourceLedger)
      .map(([kind, ledger]) => [kind, Math.max(0, (beforeAvailable[kind as TownResourceKind] || 0) - ledger.available)] as const)
      .filter(([, amount]) => amount > 0)
  ) as TownLongActionReservation;
  input.state.longActions = [action, ...input.state.longActions].slice(0, 40);
  return { action, reservedResources };
}

export function releaseTownLongActionReservation(state: TownRuleRuntimeState, reservation: TownLongActionReservation) {
  for (const [kind, amount] of Object.entries(reservation) as Array<[TownResourceKind, number]>) {
    const ledger = state.resourceLedger[kind];
    if (!ledger || amount <= 0) continue;
    ledger.available = clamp(ledger.available + amount);
    ledger.reserved = clamp(ledger.reserved - amount);
  }
}

function applyResolution(state: TownRuleRuntimeState, resolution: LongActionResolution, tick: number) {
  const institutionsBefore = new Map(state.institutions.map((institution) => [institution.id, {
    resources: institution.resources,
    reputation: institution.reputation,
    pressure: institution.pressure
  }]));
  const opinionBefore = { ...state.publicOpinion };
  const contaminationBefore = state.evidenceContamination.contamination;
  spendReservedResources(state, resolution.action.kind);
  const institutionDeltas = resolution.institutionDeltas;
  state.institutions = state.institutions.map((institution) => {
    const delta = institutionDeltas[institution.id];
    if (!delta) return institution;
    return {
      ...institution,
      resources: clamp(institution.resources + (delta.resources || 0)),
      reputation: clamp(institution.reputation + (delta.reputation || 0)),
      pressure: clamp(institution.pressure + (delta.pressure || 0)),
      policyPressure: clamp(institution.policyPressure + Math.ceil((delta.pressure || 0) / 2))
    };
  });
  state.publicOpinion = {
    ...state.publicOpinion,
    heat: clamp(state.publicOpinion.heat + (resolution.publicOpinionDelta.heat || 0)),
    trustInPolice: clamp(state.publicOpinion.trustInPolice + (resolution.publicOpinionDelta.trustInPolice || 0)),
    mediaPressure: clamp(state.publicOpinion.mediaPressure + (resolution.publicOpinionDelta.mediaPressure || 0)),
    rumorVelocity: clamp(state.publicOpinion.rumorVelocity + (resolution.publicOpinionDelta.rumorVelocity || 0)),
    witnessFear: clamp(state.publicOpinion.witnessFear + (resolution.publicOpinionDelta.witnessFear || 0)),
    updatedAtTick: tick
  };
  const riskByLocation = { ...state.evidenceContamination.riskByLocation };
  for (const [locationId, delta] of Object.entries(resolution.evidenceDelta.riskByLocation || {})) {
    riskByLocation[locationId] = clamp((riskByLocation[locationId] || 0) + delta);
  }
  state.evidenceContamination = {
    ...state.evidenceContamination,
    contamination: clamp(state.evidenceContamination.contamination + (resolution.evidenceDelta.contamination || 0)),
    sourceEventIds: Array.from(new Set([...state.evidenceContamination.sourceEventIds, ...(resolution.evidenceDelta.sourceEventIds || [])])).slice(-40),
    riskByLocation,
    updatedAtTick: tick
  };
  const sourceEventIds = resolution.evidenceDelta.sourceEventIds || resolution.action.eventIds || [];
  const evidenceId = `evidence-chain-${sourceEventIds[0] || resolution.action.id}`;
  const existing = state.evidenceChain.items.find((item) => item.id === evidenceId);
  const locationId = resolution.action.targetLocationId || "unknown-location";
  const contaminationDelta = resolution.evidenceDelta.contamination || 0;
  const integrityDelta = Math.max(0, -contaminationDelta) - Math.max(0, contaminationDelta);
  const tamperHistory = [
    ...(existing?.tamperHistory || []),
    ...(contaminationDelta > 0 ? [{
      tick,
      actorId: resolution.action.actorId,
      actionId: resolution.action.id,
      deltaIntegrity: integrityDelta,
      deltaContamination: contaminationDelta
    }] : [])
  ].slice(-12);
  const nextItem: EvidenceChainItem = {
    id: evidenceId,
    caseId: existing?.caseId,
    kind: resolution.evidenceDelta.kind || existing?.kind || "trace",
    locationId,
    discoveredByNpcId: existing?.discoveredByNpcId || (contaminationDelta <= 0 ? resolution.action.actorId : undefined),
    handledByNpcIds: Array.from(new Set([...(existing?.handledByNpcIds || []), resolution.action.actorId])),
    integrity: clamp((existing?.integrity ?? 70) + integrityDelta),
    contamination: clamp((existing?.contamination ?? 0) + contaminationDelta),
    provenance: resolution.evidenceDelta.provenance || (contaminationDelta <= -6 ? "strong" : contaminationDelta >= 10 ? "weak" : existing?.provenance || "mixed"),
    sourceEventIds: Array.from(new Set([...(existing?.sourceEventIds || []), ...sourceEventIds])).slice(-12),
    sourceActionIds: Array.from(new Set([...(existing?.sourceActionIds || []), resolution.action.id])).slice(-12),
    tamperHistory,
    usedInResolution: resolution.evidenceDelta.usedInResolution ?? existing?.usedInResolution ?? false,
    publiclyKnown: resolution.evidenceDelta.publiclyKnown ?? existing?.publiclyKnown ?? false,
    updatedAtTick: tick
  };
  state.evidenceChain = {
    updatedAtTick: tick,
    items: retainEvidenceChain([nextItem, ...state.evidenceChain.items.filter((item) => item.id !== evidenceId)])
  };
  resolution.action.appliedResult = {
    institutionDeltas: Object.fromEntries(state.institutions
      .map((institution) => {
        const before = institutionsBefore.get(institution.id);
        return [institution.id, {
          resources: institution.resources - (before?.resources || 0),
          reputation: institution.reputation - (before?.reputation || 0),
          pressure: institution.pressure - (before?.pressure || 0)
        }] as const;
      })
      .filter(([, delta]) => delta.resources !== 0 || delta.reputation !== 0 || delta.pressure !== 0)),
    publicOpinionDelta: Object.fromEntries(
      (["heat", "trustInPolice", "mediaPressure", "rumorVelocity", "witnessFear"] as const)
        .map((field) => [field, state.publicOpinion[field] - opinionBefore[field]] as const)
        .filter(([, value]) => value !== 0)
    ),
    evidenceContaminationDelta: state.evidenceContamination.contamination - contaminationBefore
  };
}

export function advanceTownLongActions(world: WorldState, state: TownRuleRuntimeState, events: WorldEvent[], tick: number) {
  const npcById = new Map(world.npcs.map((npc) => [npc.id, npc]));
  const nextActions: LongActionInstance[] = [];
  for (const action of state.longActions) {
    if (action.status !== "running") {
      nextActions.push(action);
      continue;
    }
    const actor = npcById.get(action.actorId);
    if (!actor) {
      nextActions.push({ ...action, status: "blocked", blockedReason: "actor not found", updatedAtTick: tick });
      continue;
    }
    const definition = getLongActionDefinition(action.kind);
    const context = { world, runtime: state, actor, events, tick, targetNpcId: action.targetNpcId, targetLocationId: action.targetLocationId, institutionId: action.institutionId };
    const progressed = definition.tick({ ...context, action });
    if (progressed.progress >= 100) {
      const resolution = definition.finish({ ...context, action: progressed });
      applyResolution(state, resolution, tick);
      nextActions.push(resolution.action);
    } else {
      nextActions.push(progressed);
    }
  }
  state.longActions = nextActions.slice(-40);
  state.publicOpinion.updatedAtTick = tick;
  state.evidenceContamination.updatedAtTick = tick;
  return state;
}

function catalogSupportsLongAction(state: TownRuleRuntimeState, kind: LongActionKind) {
  return state.catalogLongActionDefinitions?.some((entry) => entry.kind === kind) || false;
}

function firstSupportedLongAction(state: TownRuleRuntimeState, kinds: LongActionKind[]) {
  return kinds.find((kind) => catalogSupportsLongAction(state, kind)) || null;
}

function longActionForNpcAction(kind: NpcActionKind, state: TownRuleRuntimeState, profession?: TownProfession): LongActionKind | null {
  const institution = profession?.institutionId ? state.institutions.find((item) => item.id === profession.institutionId) : undefined;
  const contamination = state.evidenceContamination.contamination;
  if (kind === "investigate") {
    if ((profession?.kind === "officer" || profession?.kind === "detective") && contamination >= 35) return firstSupportedLongAction(state, ["secure-evidence-locker", "protect-chain-of-custody", "investigate-scene"]);
    return "investigate-scene";
  }
  if (kind === "spread-rumor") {
    if (profession?.kind === "reporter" && (institution?.pressure || 0) >= 50) return firstSupportedLongAction(state, ["pressure-editor", "leak-to-press", "publish-rumor"]);
    return "publish-rumor";
  }
  if (kind === "cover-up" || kind === "hide-trace") {
    if (profession?.kind === "doctor") return firstSupportedLongAction(state, ["seal-autopsy-record", "tamper-evidence"]);
    if (profession?.kind === "dockworker" || profession?.kind === "merchant") return firstSupportedLongAction(state, ["bribe-dockhand", "tamper-evidence"]);
    return "tamper-evidence";
  }
  if (kind === "seek-alibi") return "verify-alibi";
  if (kind === "pressure") {
    if (profession?.kind === "lawyer") return firstSupportedLongAction(state, ["cross-examine-witness", "intimidate-witness"]);
    if (profession?.kind === "informant") return firstSupportedLongAction(state, ["verify-anonymous-tip", "cultivate-informant", "intimidate-witness"]);
    if (profession?.kind === "servant") return firstSupportedLongAction(state, ["summon-family-council", "intimidate-witness"]);
    return "intimidate-witness";
  }
  if (kind === "confront") {
    if (profession?.kind === "lawyer") return firstSupportedLongAction(state, ["cross-examine-witness", "interview-witness"]);
    return "interview-witness";
  }
  if (kind === "obtain-resource") {
    if (profession?.kind === "dockworker") return firstSupportedLongAction(state, ["trace-cargo", "inspect-warehouse", "audit-ledger"]);
    if (profession?.kind === "lawyer") return firstSupportedLongAction(state, ["review-court-record", "audit-ledger"]);
    if (profession?.kind === "doctor") return firstSupportedLongAction(state, ["second-medical-opinion", "conduct-autopsy", "audit-ledger"]);
    if (profession?.kind === "informant") return firstSupportedLongAction(state, ["cultivate-informant", "audit-ledger"]);
    return "audit-ledger";
  }
  return null;
}

export function maybeStartLongActionFromCandidate(
  world: WorldState,
  state: TownRuleRuntimeState,
  actor: NPCProfile,
  candidate: NpcActionCandidate,
  events: WorldEvent[],
  tick: number
) {
  const profession = state.professions.find((item) => item.npcId === actor.id);
  const kind = longActionForNpcAction(candidate.kind, state, profession);
  if (!kind) return null;
  if (state.longActions.some((action) => action.actorId === actor.id && action.status === "running")) return null;
  return startTownLongAction({
    world,
    state,
    actor,
    kind,
    events,
    tick,
    targetNpcId: candidate.targetNpcId,
    targetLocationId: candidate.targetLocationId,
    institutionId: profession?.institutionId
  }).action || null;
}

export function updateTownRulePressureFromEvent(state: TownRuleRuntimeState, event: WorldEvent, tick: number) {
  const tags = new Set(event.tags || []);
  const publicHeat = event.hidden ? 0 : 2;
  const deathHeat = event.type === "death" ? 20 : 0;
  const rumorHeat = tags.has("rumor") || tags.has("secret_leak") ? 8 : 0;
  const contamination = event.type === "destroy_evidence" || tags.has("cover_up") || tags.has("staging") ? 8 : 0;
  state.publicOpinion = {
    ...state.publicOpinion,
    heat: clamp(state.publicOpinion.heat + publicHeat + deathHeat + rumorHeat),
    mediaPressure: clamp(state.publicOpinion.mediaPressure + Math.ceil((publicHeat + deathHeat + rumorHeat) / 2)),
    rumorVelocity: clamp(state.publicOpinion.rumorVelocity + (rumorHeat ? 5 : 0)),
    witnessFear: clamp(state.publicOpinion.witnessFear + (event.type === "conflict" || event.type === "death" ? 5 : 0)),
    updatedAtTick: tick
  };
  if (contamination) {
    state.evidenceContamination = {
      ...state.evidenceContamination,
      contamination: clamp(state.evidenceContamination.contamination + contamination),
      sourceEventIds: Array.from(new Set([event.id, ...state.evidenceContamination.sourceEventIds])).slice(0, 40),
      riskByLocation: {
        ...state.evidenceContamination.riskByLocation,
        [event.locationId]: clamp((state.evidenceContamination.riskByLocation[event.locationId] || 0) + contamination)
      },
      updatedAtTick: tick
    };
  }
  const evidenceBearing = contamination || event.evidenceId || event.type === "forensic_clue" || event.type === "death" ||
    ["motive", "means", "opportunity", "alibi", "witness", "ledger", "commerce", "secret_leak", "tension", "court", "record", "dock", "cargo", "informant", "tip", "custody", "warehouse"].some((tag) => tags.has(tag));
  if (evidenceBearing) {
    const evidenceId = `evidence-chain-${event.evidenceId || event.id}`;
    const existing = state.evidenceChain.items.find((item) => item.id === evidenceId);
    const integrityDelta = event.type === "forensic_clue" ? 8 : -contamination;
    const kind: EvidenceChainItem["kind"] =
      event.type === "death" || tags.has("blood") ? "blood-pattern" :
      tags.has("weapon") ? "weapon-mark" :
      tags.has("footprint") ? "footprint" :
      event.type === "forensic_clue" && (tags.has("autopsy") || tags.has("medical")) ? "autopsy-note" :
      event.type === "forensic_clue" ? "medical" :
      tags.has("court") || tags.has("record") || tags.has("custody") ? "court-record" :
      tags.has("cargo") || tags.has("dock") || tags.has("warehouse") ? "cargo-log" :
      tags.has("telegram") ? "telegram" :
      tags.has("receipt") ? "receipt" :
      tags.has("newspaper") || tags.has("press") ? "newspaper-proof" :
      tags.has("family") ? "family-letter" :
      tags.has("tip") || tags.has("informant") ? "anonymous-tip" :
      tags.has("rumor") || tags.has("secret_leak") ? "rumor" :
      tags.has("ledger") || tags.has("commerce") ? "ledger" :
      tags.has("alibi") ? "alibi-note" :
      tags.has("witness") ? "testimony" :
      "trace";
    const item: EvidenceChainItem = {
      id: evidenceId,
      caseId: existing?.caseId,
      caseIds: existing?.caseIds || (existing?.caseId ? [existing.caseId] : []),
      kind,
      locationId: event.locationId,
      discoveredByNpcId: existing?.discoveredByNpcId || event.actorIds[0],
      handledByNpcIds: Array.from(new Set([...(existing?.handledByNpcIds || []), ...event.actorIds])).slice(-8),
      integrity: clamp((existing?.integrity ?? 70) + integrityDelta),
      contamination: clamp((existing?.contamination ?? 0) + contamination),
      provenance: event.type === "forensic_clue" ? "strong" : contamination >= 8 ? "weak" : existing?.provenance || "mixed",
      sourceEventIds: Array.from(new Set([...(existing?.sourceEventIds || []), event.id])).slice(-12),
      sourceActionIds: existing?.sourceActionIds || [],
      tamperHistory: existing?.tamperHistory || [],
      usedInResolution: existing?.usedInResolution || false,
      publiclyKnown: existing?.publiclyKnown || !event.hidden || tags.has("rumor"),
      updatedAtTick: tick
    };
    state.evidenceChain = {
      updatedAtTick: tick,
      items: retainEvidenceChain([item, ...state.evidenceChain.items.filter((entry) => entry.id !== evidenceId)])
    };
  }
}

export function advanceTownInstitutionStrategies(
  world: WorldState,
  state: TownRuleRuntimeState,
  tick: number,
  worldSystemHints?: WorldSystemRuntimeHints | null,
  options: { excludeInstitutionIds?: string[] } = {}
) {
  if (tick % 5 !== 0) return [];
  const excludedInstitutionIds = new Set(options.excludeInstitutionIds || []);
  const livingNpcIds = world.npcs.filter((npc) => npc.alive).map((npc) => npc.id);
  const firstNpcForInstitution = (institutionId: string) => state.professions.find((profession) => profession.institutionId === institutionId && livingNpcIds.includes(profession.npcId))?.npcId;
  const firstLocationId = world.locations[0]?.id || "town-square";
  const worldSystemLabels = worldSystemHints?.summary.active ? worldSystemHints.institutionLabels.slice(0, 4) : [];
  const worldSystemReason = worldSystemLabels.length ? `; world-system ${worldSystemLabels.join(" / ")}` : "";
  const decisions = state.institutions.filter((institution) => !excludedInstitutionIds.has(institution.id)).map((institution): InstitutionDecision => {
    const pressure = institution.pressure + institution.policyPressure + (institution.resources <= 42 ? 18 : 0);
    const strategy: InstitutionStrategy =
      institution.kind === "police" && pressure >= 60 ? "allocate-investigation" :
      institution.kind === "media" && state.publicOpinion.rumorVelocity >= 50 && state.resourceLedger.informant_trust?.available >= 35 ? "cultivate-informant" :
      institution.kind === "media" && state.publicOpinion.heat + state.publicOpinion.mediaPressure >= 70 ? "chase-headline" :
      institution.kind === "family" && institution.pressure >= 55 ? "protect-family" :
      institution.kind === "commerce" && institution.resources <= 55 ? "audit-ledger" :
      institution.kind === "medical" && (institution.resources <= 52 || institution.pressure >= 50) ? "schedule-autopsy" :
      institution.kind === "court" && (pressure >= 62 || institution.resources <= 56) ? "review-court-record" :
      institution.kind === "dock_union" && (pressure >= 58 || institution.resources <= 58) ? "trace-cargo" :
      "hold-position";
    return {
      id: `institution-decision-${institution.id}-${tick}`,
      tick,
      institutionId: institution.id,
      strategy,
      targetNpcId: firstNpcForInstitution(institution.id),
      targetLocationId: Object.entries(institution.influenceByLocation).sort(([, left], [, right]) => right - left)[0]?.[0] || firstLocationId,
      reason: `${institution.kind} resources ${institution.resources}, pressure ${institution.pressure}, reputation ${institution.reputation}${worldSystemReason}`,
      worldSystemLabels
    };
  });
  for (const decision of decisions) {
    const resourceKind: TownResourceKind | null =
      decision.strategy === "allocate-investigation" ? "police_time" :
      decision.strategy === "chase-headline" ? "media_attention" :
      decision.strategy === "protect-family" ? "family_influence" :
      decision.strategy === "audit-ledger" ? "merchant_credit" :
      decision.strategy === "schedule-autopsy" ? "medical_capacity" :
      decision.strategy === "review-court-record" ? "court_docket" :
      decision.strategy === "trace-cargo" ? "dock_credit" :
      decision.strategy === "cultivate-informant" ? "informant_trust" :
      null;
    if (resourceKind && state.resourceLedger[resourceKind]) {
      state.resourceLedger[resourceKind].reserved = clamp(state.resourceLedger[resourceKind].reserved + 1);
      state.resourceLedger[resourceKind].pressure = clamp(state.resourceLedger[resourceKind].pressure + 2);
    }
  }
  state.institutionDecisions = [...decisions, ...(state.institutionDecisions || [])].slice(0, 80);
  return decisions;
}

export function buildTownRuleSnapshotSummary(state: TownRuleRuntimeState): TownRuleSnapshotSummary {
  return {
    institutions: state.institutions.map((institution) => ({
      id: institution.id,
      kind: institution.kind,
      resources: institution.resources,
      reputation: institution.reputation,
      pressure: institution.pressure,
      policyPressure: institution.policyPressure
    })),
    publicOpinion: { ...state.publicOpinion },
    evidenceContamination: {
      ...state.evidenceContamination,
      pollutedEvidenceIds: [...state.evidenceContamination.pollutedEvidenceIds],
      sourceEventIds: [...state.evidenceContamination.sourceEventIds],
      riskByLocation: { ...state.evidenceContamination.riskByLocation }
    },
    evidenceChain: {
      updatedAtTick: state.evidenceChain.updatedAtTick,
      items: state.evidenceChain.items.map((item) => ({
        ...item,
        handledByNpcIds: [...item.handledByNpcIds],
        sourceEventIds: [...item.sourceEventIds],
        sourceActionIds: [...(item.sourceActionIds || [])]
      }))
    },
    runningLongActions: state.longActions.filter((action) => action.status === "running").map((action) => ({ ...action, eventIds: [...action.eventIds] })),
    institutionDecisions: (state.institutionDecisions || []).slice(0, 12).map((decision) => ({ ...decision })),
    resourceLedger: JSON.parse(JSON.stringify(state.resourceLedger)) as TownResourceLedger
  };
}

export function diffTownRuleSnapshots(
  from?: TownRuleSnapshotSummary | null,
  to?: TownRuleSnapshotSummary | null
) {
  if (!from || !to) return { institutionChanges: [], publicOpinionChanges: [], evidenceChanges: [] };
  const fromInstitutions = new Map(from.institutions.map((item) => [item.id, item]));
  const institutionChanges = to.institutions
    .map((after) => {
      const before = fromInstitutions.get(after.id);
      if (!before) return { institutionId: after.id, changedFields: ["created"], before: null, after };
      const changedFields = (["resources", "reputation", "pressure", "policyPressure"] as const).filter((field) => before[field] !== after[field]);
      return changedFields.length ? { institutionId: after.id, changedFields, before, after } : null;
    })
    .filter(Boolean);
  const publicOpinionChanges = (["heat", "trustInPolice", "mediaPressure", "rumorVelocity", "witnessFear"] as const)
    .filter((field) => from.publicOpinion[field] !== to.publicOpinion[field])
    .map((field) => ({ field, before: from.publicOpinion[field], after: to.publicOpinion[field] }));
  const evidenceChanges = (["contamination"] as const)
    .filter((field) => from.evidenceContamination[field] !== to.evidenceContamination[field])
    .map((field) => ({ field, before: from.evidenceContamination[field], after: to.evidenceContamination[field] }));
  const evidenceChainChanges = from.evidenceChain.items.length !== to.evidenceChain.items.length
    ? [{ field: "items", before: from.evidenceChain.items.length, after: to.evidenceChain.items.length }]
    : [];
  return { institutionChanges, publicOpinionChanges, evidenceChanges, evidenceChainChanges };
}

export function applyCaseAftermath(
  state: TownRuleRuntimeState,
  input: {
    tick: number;
    caseId: string;
    outcome: CaseAftermath["outcome"];
    culpritId?: string;
    victimId?: string;
    valid: boolean;
  }
) {
  const solved = input.valid || input.outcome === "solved" || input.outcome === "extracted";
  const aftermath: CaseAftermath = {
    id: `aftermath-${input.caseId}-${input.tick}`,
    tick: input.tick,
    caseId: input.caseId,
    outcome: solved ? "extracted" : input.outcome,
    institutionDeltas: solved
      ? {
          "inst-police": { resources: -3, reputation: 4, pressure: -6 },
          "inst-media": { pressure: -2 },
          "inst-civic": { reputation: 2 },
          "inst-court": { reputation: 1, pressure: -2 },
          "inst-dock-union": { pressure: -1 }
        }
      : {
          "inst-police": { resources: -4, reputation: -5, pressure: 8 },
          "inst-media": { resources: 2, pressure: 6 },
          "inst-family": { pressure: 4 },
          "inst-court": { pressure: 3 },
          "inst-dock-union": { pressure: 2 }
        },
    publicOpinionDelta: solved
      ? { heat: -8, trustInPolice: 5, mediaPressure: -5, witnessFear: -4 }
      : { heat: 10, trustInPolice: -6, mediaPressure: 8, witnessFear: 7 },
    relationshipNotes: [
      `${input.culpritId || "unknown culprit"} -> ${input.victimId || "unknown victim"} ended as ${solved ? "reviewable/extracted" : "failed"}.`
    ]
  };
  applyResolution(state, {
    action: {
      id: aftermath.id,
      kind: solved ? "file-police-report" : "publish-rumor",
      actorId: input.culpritId || "system",
      status: "completed",
      startedAtTick: input.tick,
      updatedAtTick: input.tick,
      durationTicks: 1,
      progress: 100,
      eventIds: [],
      resultSummary: `case aftermath ${aftermath.outcome}`
    },
    institutionDeltas: aftermath.institutionDeltas,
    publicOpinionDelta: aftermath.publicOpinionDelta,
    evidenceDelta: solved ? { contamination: -6 } : { contamination: 6 }
  }, input.tick);
  state.aftermaths = [aftermath, ...(state.aftermaths || [])].slice(0, 40);
  return aftermath;
}

export function explainCandidateRuleInfluence(candidate: CaseCandidate, snapshot?: TownStateSnapshot & { ruleSummary?: TownRuleSnapshotSummary }) {
  const summary = snapshot?.ruleSummary;
  if (!summary) return ["No rule snapshot was recorded for this candidate yet."];
  const hotInstitution = [...summary.institutions].sort((a, b) => b.pressure - a.pressure)[0];
  const contamination = summary.evidenceContamination.contamination;
  const opinion = summary.publicOpinion.heat;
  return [
    `${hotInstitution?.kind || "institution"} pressure ${hotInstitution?.pressure ?? 0} influenced ${candidate.culpritId} -> ${candidate.victimId}.`,
    `Public opinion heat is ${opinion}; witness fear is ${summary.publicOpinion.witnessFear}.`,
    `Evidence contamination is ${contamination}, backed by ${summary.evidenceContamination.sourceEventIds.length} source events.`
  ];
}
