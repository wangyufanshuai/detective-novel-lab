import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const createdAt = "2026-08-12T00:00:00.000Z";
const packages = [
  {
    id: "railway-signal-yard-town", name: "Railway Signal Yard Town", zh: "铁路信号场小镇", presentationKey: "railbound-alibi",
    description: "Railway permits, signal procedure, porter testimony and timetable custody.", caseTypes: ["permit-forgery", "archive-vanishing", "signal-tampering", "dock-smuggling", "false-testimony", "witness-disappearance"],
    locations: [["station-square", "Station Square", "车站广场"], ["permit-desk", "Station Permit Desk", "车站许可处"], ["rail-archive", "Rail Archive", "铁路档案室"], ["signal-cabin", "Signal Cabin", "信号房"], ["freight-platform", "Freight Platform", "货运站台"], ["porter-tunnel", "Porter Tunnel", "搬运行隧道"]],
    cast: [["Mara Bell", "detective"], ["Silas Reed", "clerk"], ["Nell Porter", "dockworker"], ["Iris Vale", "reporter"], ["Tomas Grey", "officer"], ["Elian Cross", "informant"]]
  },
  {
    id: "foundry-workers-gate-town", name: "Foundry Workers Gate Town", zh: "铸造厂工人门小镇", presentationKey: "furnace-oath",
    description: "Foundry inspection, medical timing, labor leverage and controlled machine access.", caseTypes: ["safety-inspection-fraud", "medical-coverup", "industrial-sabotage", "blackmail", "evidence-tampering", "merchant-extortion"],
    locations: [["foundry-square", "Foundry Square", "铸造广场"], ["inspection-office", "Inspection Office", "检查处"], ["works-infirmary", "Works Infirmary", "工厂医务室"], ["machine-hall", "Machine Hall", "机器大厅"], ["pay-window", "Pay Window", "工资窗口"], ["worker-gate", "Worker Gatehouse", "工人门房"]],
    cast: [["Ada Flint", "detective"], ["Bram Holt", "dockworker"], ["Clara Voss", "doctor"], ["Elias Forge", "merchant"], ["Nora Pike", "clerk"], ["Jon Reed", "informant"]]
  },
  {
    id: "river-lock-waterworks-town", name: "River Lock Waterworks Town", zh: "河闸水务小镇", presentationKey: "floodgate-covenant",
    description: "Water rights, public permits, floodgate custody and river-household claims.", caseTypes: ["water-rights-fraud", "permit-forgery", "floodgate-tampering", "family-scandal", "court-intimidation", "household-escrow"],
    locations: [["river-square", "River Square", "河岸广场"], ["water-ledger", "Waterworks Ledger Room", "水务账房"], ["licensing-counter", "River Licensing Counter", "河道许可柜台"], ["river-lock", "River Lock", "河闸"], ["riverside-house", "Riverside House", "河岸宅邸"], ["water-court", "Water Court", "水务法庭"]],
    cast: [["Mara Lock", "detective"], ["Ivo Reed", "clerk"], ["Nell Shore", "servant"], ["Tomas Vale", "lawyer"], ["Edda Mill", "merchant"], ["Bram Gauge", "dockworker"]]
  },
  {
    id: "academy-press-quadrangle-town", name: "Academy Press Quadrangle Town", zh: "学院报社方庭小镇", presentationKey: "scholarly-silence",
    description: "Academic records, patronage pressure, student testimony and public correction.", caseTypes: ["false-testimony", "patronage-coercion", "academic-record-forgery", "media-rumor", "editorial-coercion", "archive-vanishing"],
    locations: [["college-quadrangle", "College Quadrangle", "学院方庭"], ["lecture-hall", "Lecture Hall", "讲堂"], ["benefactors-room", "Benefactors Room", "赞助人室"], ["faculty-archive", "Faculty Archive", "教员档案室"], ["student-press", "Student Press", "学生报社"], ["senate-chamber", "Senate Chamber", "评议厅"]],
    cast: [["Ada Quill", "detective"], ["Elias March", "clerk"], ["Nora Bell", "reporter"], ["Silas Venn", "lawyer"], ["Iris Reed", "informant"], ["Tomas Grey", "servant"]]
  },
  {
    id: "grand-hotel-service-town", name: "Grand Hotel Service Town", zh: "大饭店服务小镇", presentationKey: "grand-hotel-register",
    description: "Guest identity, night-desk custody, service passages and private leverage.", caseTypes: ["ledger-fraud", "false-testimony", "identity-register-fraud", "evidence-tampering", "witness-disappearance", "blackmail"],
    locations: [["hotel-court", "Hotel Court", "饭店前庭"], ["accounts-office", "Accounts Office", "账房"], ["palm-court", "Palm Court", "棕榈庭"], ["night-desk", "Night Desk", "夜间前台"], ["luggage-room", "Luggage Room", "行李房"], ["service-basement", "Service Basement", "服务地下室"]],
    cast: [["Mara Key", "detective"], ["Elias Room", "clerk"], ["Nell Vale", "servant"], ["Bram Porter", "dockworker"], ["Iris Venn", "reporter"], ["Tomas Bell", "informant"]]
  },
  {
    id: "power-station-blackout-town", name: "Power Station Blackout Town", zh: "发电站停电小镇", presentationKey: "blackout-ledger",
    description: "Utility permits, night patrol decisions, switch-house custody and contractor accounts.", caseTypes: ["permit-forgery", "police-misjudgment", "utility-sabotage", "evidence-tampering", "court-intimidation", "ledger-fraud"],
    locations: [["blackout-square", "Blackout Square", "停电广场"], ["permit-office", "Utility Permit Office", "公用事业许可处"], ["precinct", "Blackout Precinct", "停电辖区"], ["switch-house", "Switch House", "开关站"], ["repair-depot", "Repair Depot", "维修仓库"], ["contractor-office", "Contractor Office", "承包商办公室"]],
    cast: [["Ada Volt", "detective"], ["Silas Wire", "officer"], ["Nora Fuse", "clerk"], ["Bram Pike", "dockworker"], ["Elias Watt", "merchant"], ["Iris Vale", "reporter"]]
  },
  {
    id: "memorial-garden-trust-town", name: "Memorial Garden Trust Town", zh: "纪念园信托小镇", presentationKey: "memorial-trust",
    description: "Burial records, inherited access, memorial custody and caretaker testimony.", caseTypes: ["forged-will", "family-scandal", "burial-record-forgery", "missing-person", "household-escrow"],
    locations: [["memorial-square", "Memorial Square", "纪念广场"], ["solicitor-office", "Trust Solicitor Office", "信托律师办公室"], ["memorial-garden", "Memorial Garden", "纪念园"], ["memorial-archive", "Memorial Archive", "纪念园档案室"], ["caretaker-lodge", "Caretaker Lodge", "看护人小屋"], ["memorial-chapel", "Memorial Chapel", "纪念礼堂"]],
    cast: [["Mara Ash", "detective"], ["Elias Venn", "lawyer"], ["Nell Moss", "servant"], ["Silas Reed", "clerk"], ["Iris Vale", "reporter"], ["Tomas Bell", "informant"]]
  },
  {
    id: "wireless-tower-press-town", name: "Wireless Tower Press Town", zh: "无线电塔报社小镇", presentationKey: "wireless-shadows",
    description: "Broadcast rumor, intercepted messages, editorial custody and wireless patrol procedure.", caseTypes: ["media-rumor", "editorial-coercion", "signal-interception", "blackmail", "police-misjudgment", "false-testimony"],
    locations: [["wireless-square", "Wireless Square", "无线广场"], ["broadcast-studio", "Broadcast Studio", "广播室"], ["newsroom", "Wireless Newsroom", "无线电新闻室"], ["transmitter-room", "Transmitter Room", "发射机房"], ["telephone-exchange", "Telephone Exchange", "电话交换所"], ["patrol-post", "Wireless Patrol Post", "无线巡查岗"]],
    cast: [["Ada Wave", "detective"], ["Iris Quill", "reporter"], ["Nora Bell", "clerk"], ["Silas Vale", "officer"], ["Elias Reed", "informant"], ["Tomas Venn", "lawyer"]]
  }
];

const resourceRows = [
  ["police_time", "Police Time", 54, 52], ["media_attention", "Media Attention", 48, 58], ["family_influence", "Family Influence", 52, 44],
  ["merchant_credit", "Merchant Credit", 50, 55], ["medical_capacity", "Medical Capacity", 54, 36], ["evidence_integrity", "Evidence Integrity", 74, 42],
  ["court_docket", "Court Docket", 50, 50], ["dock_credit", "Service Credit", 48, 56], ["informant_trust", "Informant Trust", 46, 57]
];

const institutionSpecs = [
  ["inst-police", "police", "Police Review"], ["inst-media", "media", "Public Record Desk"], ["inst-family", "family", "Household Trust"],
  ["inst-commerce", "commerce", "Commercial Board"], ["inst-civic", "civic", "Civic Records"], ["inst-medical", "medical", "Medical Review"],
  ["inst-court", "court", "Public Court"], ["inst-dock-union", "dock_union", "Service Guild"]
];

const professionKind = (role) => role === "detective" ? "detective" : role === "officer" ? "officer" : role === "doctor" ? "doctor" : role === "lawyer" ? "lawyer" : role === "merchant" ? "merchant" : role === "dockworker" ? "dockworker" : role === "reporter" ? "reporter" : role === "informant" ? "informant" : role === "servant" ? "servant" : "clerk";
const institutionFor = (role) => role === "detective" || role === "officer" ? "inst-police" : role === "reporter" || role === "informant" ? "inst-media" : role === "lawyer" ? "inst-court" : role === "doctor" ? "inst-medical" : role === "merchant" ? "inst-commerce" : role === "dockworker" ? "inst-dock-union" : role === "servant" ? "inst-family" : "inst-civic";
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

function buildPack(config) {
  const dir = path.join(root, "world-packs", config.id);
  fs.mkdirSync(dir, { recursive: true });
  const locations = config.locations.map(([id, name, zh], index) => ({
    id, name, kind: index === 0 ? "public" : index >= 3 ? "restricted" : "work",
    description: `${name} exposes a public, reviewable surface for ${config.description.toLowerCase()}`,
    connectedLocationIds: [config.locations[(index + config.locations.length - 1) % config.locations.length][0], config.locations[(index + 1) % config.locations.length][0]],
    x: [-1, 0, 1, 1, 0, -1][index], y: [0, -1, -1, 1, 2, 1][index], localizedName: { "en-US": name, "zh-CN": zh }
  }));
  const agents = config.cast.map(([name, role], index) => {
    const id = `npc-${config.presentationKey.slice(0, 3)}-${index + 1}`;
    const home = locations[(index + 1) % locations.length].id;
    return {
      id, name, role, homeLocationId: home,
      schedule: { "08:00": home, "12:00": locations[0].id, "18:00": locations[(index + 2) % locations.length].id },
      relationships: index ? { [`npc-${config.presentationKey.slice(0, 3)}-${index}`]: "public work contact" } : {},
      secret: "Keeps a private concern separate from certified evidence.", motiveSeed: "protect reviewable work", skills: [professionKind(role), "records"],
      memoryEventIds: [], liePolicy: "answers from public records", alive: true
    };
  });
  const manifest = {
    id: config.id, name: config.name, version: "1.0.0", schemaVersion: "world-package.v1", description: config.description,
    author: "Detective Novel Lab", createdAt, license: "project-local-original", scenarioPackPath: "scenario-pack.json", mapPackPath: "map-pack.json",
    ruleCatalogPath: "rule-catalog.json", agentPackPath: "agent-pack.json", ecosystemCatalogPath: "ecosystem-catalog.json", expectationsPath: "expectations.json",
    localization: { "en-US": config.name, "zh-CN": config.zh }, presentation: { key: config.presentationKey, style: "noir-archive" }
  };
  const scenarioPack = {
    manifest: { id: config.id, name: config.name, version: "1.0.0", schemaVersion: "scenario-pack.v1", description: config.description, createdAt, entrypoint: "scenario.json" },
    world: { seed: config.id, mode: "advanced", timelineHours: 96, locations, npcs: agents, institutions: [], professions: [] },
    rules: { enabledModules: ["institutions", "professions", "long-actions", "public-opinion", "evidence-contamination", "case-aftermath"], phaseConfig: { snapshotEveryTicks: 1, maxRunningLongActions: 8 }, thresholds: { maxEvidenceContamination: 74, maxPublicOpinionHeat: 88, minInstitutionTrust: 34 }, longActionKinds: ["investigate-scene", "verify-alibi", "audit-ledger", "secure-evidence-locker", "review-court-record", "cultivate-informant"] },
    scenario: { id: config.id, name: config.name, seed: config.id, worldOptions: { mode: "advanced", npcCount: agents.length, timelineHours: 96 }, baselineSteps: 8, branches: [], passCriteria: { minValidCandidates: 0, minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 } },
    expectations: { minValidCandidates: 1, minEvidenceCoverage: 80, maxEvidenceContamination: 74, maxPublicOpinionHeat: 88, benchmarkPreset: "quick-10" },
    assets: { presentationKey: config.presentationKey }, docs: { localization: manifest.localization }
  };
  const mapPack = {
    manifest: { id: `${config.id}-map`, name: `${config.name} Map`, version: "1.0.0", schemaVersion: "town-map-pack.v1", description: config.description, createdAt, entrypoint: "map.json" },
    locations,
    connections: locations.map((location, index) => ({ from: location.id, to: locations[(index + 1) % locations.length].id, kind: index % 2 ? "service-route" : "street", travelMinutes: 3 + index })),
    interactions: locations.slice(1).map((location, index) => ({ id: `inspect-${location.id}`, locationId: location.id, kind: index % 3 === 0 ? "search" : index % 3 === 1 ? "question" : "work", label: `Review ${location.name}`, risk: 28 + index * 6, tags: [config.presentationKey, index % 2 ? "record" : "witness"] })),
    spawnPoints: agents.slice(0, 4).map((agent, index) => ({ id: `spawn-${index + 1}`, locationId: agent.homeLocationId, roleHint: agent.role, weight: 80 - index * 5 })),
    assets: { presentationKey: config.presentationKey }, docs: { localization: manifest.localization }
  };
  const professions = agents.map((agent, index) => ({ npcId: agent.id, kind: professionKind(agent.role), institutionId: institutionFor(agent.role), rank: index === 0 ? 3 : 1 + (index % 2), skills: agent.skills, income: 36 + index * 3, workload: 42 + index * 4 }));
  const institutions = institutionSpecs.map(([id, kind, label], index) => ({
    id, name: `${config.name} ${label}`, kind, resources: 48 + (index % 4) * 3, reputation: 50 + (index % 3) * 2, pressure: 44 + (index % 5) * 4,
    agenda: `Keep ${config.presentationKey.replace(/-/g, " ")} outcomes reviewable.`, influenceByLocation: { [locations[index % locations.length].id]: 74, [locations[0].id]: 52 },
    trustByNpcId: Object.fromEntries(agents.filter((agent) => institutionFor(agent.role) === id).map((agent) => [agent.id, 70])), activeCaseIds: [], policyPressure: 44 + (index % 5) * 4
  }));
  const ruleCatalog = {
    id: `${config.id}-rules`, name: `${config.name} Rules`, version: "1.0.0",
    resources: resourceRows.map(([kind, label, value, pressure]) => ({ kind, label, value, capacity: 100, pressure })), institutions, professions,
    longActionDefinitions: [
      { kind: "investigate-scene", label: "Inspect public scene", durationTicks: 3, resourceCosts: { police_time: 3 }, institutionDeltas: { "inst-police": { resources: -2, reputation: 2, pressure: -1 } }, publicOpinionDelta: { trustInPolice: 1 }, evidenceContaminationDelta: -5 },
      { kind: "verify-alibi", label: "Verify public schedule", durationTicks: 3, resourceCosts: { police_time: 2, informant_trust: 2 }, institutionDeltas: { "inst-police": { resources: -2, reputation: 2, pressure: -1 } }, publicOpinionDelta: { witnessFear: -2 }, evidenceContaminationDelta: -3 },
      { kind: "audit-ledger", label: "Audit bounded ledger", durationTicks: 4, resourceCosts: { merchant_credit: 3 }, institutionDeltas: { "inst-commerce": { resources: -2, reputation: 2, pressure: 1 } }, publicOpinionDelta: { heat: 1 }, evidenceContaminationDelta: -4 },
      { kind: "secure-evidence-locker", label: "Secure evidence custody", durationTicks: 3, requiredInstitutionId: "inst-police", resourceCosts: { evidence_integrity: 3, police_time: 2 }, institutionDeltas: { "inst-police": { resources: -2, reputation: 2, pressure: -2 } }, publicOpinionDelta: { trustInPolice: 1 }, evidenceContaminationDelta: -8 },
      { kind: "review-court-record", label: "Review formal record", durationTicks: 3, requiredInstitutionId: "inst-court", resourceCosts: { court_docket: 3 }, institutionDeltas: { "inst-court": { resources: -3, reputation: 3, pressure: -2 } }, publicOpinionDelta: { heat: 1 }, evidenceContaminationDelta: -5 },
      { kind: "cultivate-informant", label: "Cultivate public source", durationTicks: 4, resourceCosts: { informant_trust: 4 }, institutionDeltas: { "inst-media": { resources: -2, reputation: 2, pressure: 2 } }, publicOpinionDelta: { witnessFear: -3, rumorVelocity: 1 }, evidenceContaminationDelta: -4 }
    ],
    randomEvents: config.caseTypes.slice(0, 4).map((caseType, index) => ({ id: `${config.presentationKey}-pressure-${index + 1}`, label: `${locations[(index + 1) % locations.length].name} pressure`, weight: 20 + index, tags: [config.presentationKey, caseType] })),
    casePressureRules: [["police_time", 52], ["media_attention", 55], ["evidence_integrity", 55], ["informant_trust", 50]].map(([resource, threshold], index) => ({ id: `${config.presentationKey}-case-pressure-${index + 1}`, resource, threshold, effect: `${config.caseTypes[index % config.caseTypes.length]} becomes prominent` })),
    evidenceRules: [["document", 66, 56], ["testimony", 62, 52], ["trace", 68, 56], ["receipt", 68, 54], ["telegram", 64, 52]].map(([kind, weakContaminationThreshold, strongProvenanceIntegrityFloor], index) => ({ id: `${config.presentationKey}-evidence-${index + 1}`, kind, weakContaminationThreshold, strongProvenanceIntegrityFloor, relatedCaseTypes: config.caseTypes.slice(index % 2, index % 2 + 3) }))
  };
  const agentPack = { manifest: { id: `${config.id}-agents`, name: `${config.name} Agents`, version: "1.0.0", schemaVersion: "agent-pack.v1", createdAt, description: config.description }, agents: agents.map((agent) => ({ ...agent, profession: professionKind(agent.role), institutionId: institutionFor(agent.role), publicMotive: "preserve a reviewable public account", visibleClues: ["tracks one public schedule and one controlled route"], resourceNeeds: { evidence_integrity: 3 } })) };
  const factionKinds = [["civic", "inst-civic", "Civic Record Circle"], ["commerce", "inst-commerce", "Working Exchange"], ["media", "inst-media", "Public Account Desk"], ["neutral", "inst-police", "Review Watch"]];
  const ecosystem = {
    manifest: { id: `${config.id}-ecosystem`, name: `${config.name} Ecosystem`, version: "1.0.0", schemaVersion: "ecosystem-catalog.v1", createdAt, description: config.description },
    factions: factionKinds.map(([kind, institutionId, name], index) => ({ id: `${config.presentationKey}-faction-${index + 1}`, name, institutionKind: institutions.find((item) => item.id === institutionId).kind, pressureBias: 10 + index, resourceBias: { [resourceRows[index][0]]: -5 - index }, preferredCaseTypes: config.caseTypes.slice(index, index + 2) })),
    resources: resourceRows.slice(0, 6).map(([kind, label], index) => ({ kind, label, valueDelta: -5 - (index % 3), pressureDelta: 6 + index })),
    markets: resourceRows.slice(0, 3).map(([kind, label], index) => ({ id: `${config.presentationKey}-market-${index + 1}`, label: `${label} exchange`, resource: kind, volatility: 0.25 + index * 0.04, tags: [config.presentationKey, "public"] })),
    territories: factionKinds.map((_, index) => ({ id: `${config.presentationKey}-territory-${index + 1}`, locationId: locations[(index + 1) % locations.length].id, factionId: `${config.presentationKey}-faction-${index + 1}`, influence: 72 + index * 3, tags: [config.presentationKey, "district"] })),
    taskTemplates: factionKinds.map((_, index) => ({ id: `${config.presentationKey}-task-${index + 1}`, label: `Review ${locations[(index + 1) % locations.length].name}`, institutionKind: institutions[index].kind, tags: [config.presentationKey, "review"], pressureDelta: 7 + index, evidenceKinds: [ruleCatalog.evidenceRules[index].kind] })),
    randomWorldEvents: config.caseTypes.slice(0, 4).map((caseType, index) => ({ id: `${config.presentationKey}-event-${index + 1}`, label: `${locations[(index + 1) % locations.length].name} shift`, weight: 20 + index, tags: [config.presentationKey, caseType], pressureDelta: 7 + index })),
    pressureRules: resourceRows.slice(0, 4).map(([kind], index) => ({ id: `${config.presentationKey}-resource-pressure-${index + 1}`, resource: kind, threshold: 50 + index, effect: `${config.caseTypes[index]} pressure becomes visible` }))
  };
  writeJson(path.join(dir, "manifest.json"), manifest);
  writeJson(path.join(dir, "scenario-pack.json"), scenarioPack);
  writeJson(path.join(dir, "map-pack.json"), mapPack);
  writeJson(path.join(dir, "rule-catalog.json"), ruleCatalog);
  writeJson(path.join(dir, "agent-pack.json"), agentPack);
  writeJson(path.join(dir, "ecosystem-catalog.json"), ecosystem);
  writeJson(path.join(dir, "expectations.json"), scenarioPack.expectations);
  fs.writeFileSync(path.join(dir, "README.md"), `# ${config.name}\n\nOriginal v11 Noir Archive WorldPackage for ${config.description.toLowerCase()} All player-facing strings remain low-spoiler and the package reuses the certified investigation authority.\n`, "utf8");
}

for (const config of packages) buildPack(config);
console.log(JSON.stringify({ ok: true, generated: packages.map((item) => item.id), count: packages.length }));
