import { DETECTIVE_CAMPAIGN_REGISTRY } from "./campaign-catalog";
import type { DetectiveCampaignRouteId, DetectiveCampaignVolumeId } from "./campaign-types";

export type CampaignPresentationAssetKind = "cover" | "map" | "chapter" | "finale" | "portrait" | "evidence";
export type CampaignPresentationAssetStatus = "planned" | "ready";

export type CampaignPresentationAsset = Readonly<{
  kind: CampaignPresentationAssetKind;
  path: string;
  status: CampaignPresentationAssetStatus;
  width: number;
  height: number;
  maxBytes: number;
  source: "planned-original" | "generated-original" | "licensed-original";
  license: "Project original" | "OpenAI generated original" | "OFL-compatible source";
  contentHash?: string;
}>;

export type CampaignPresentationManifest = Readonly<{
  presentationKey: string;
  volumeId: DetectiveCampaignVolumeId;
  label: string;
  districtLabel: string;
  artDirection: string;
  motifLabel: string;
  palette: Readonly<{
    ink: string;
    paper: string;
    brass: string;
    signal: string;
  }>;
  cover: CampaignPresentationAsset;
  map: CampaignPresentationAsset;
  chapters: readonly [CampaignPresentationAsset, CampaignPresentationAsset, CampaignPresentationAsset];
  finales: Readonly<Record<DetectiveCampaignRouteId, CampaignPresentationAsset>>;
  portraits: readonly CampaignPresentationAsset[];
  evidence: readonly CampaignPresentationAsset[];
}>;

export type CampaignAudioTrackKind = "theme" | "ambience" | "route-stinger" | "finale-stinger" | "sfx";

export type CampaignAudioTrack = Readonly<{
  kind: CampaignAudioTrackKind;
  label: string;
  opusPath: string;
  mp3Path: string;
  status: CampaignPresentationAssetStatus;
  maxCombinedBytes: number;
  source: "planned-original" | "generated-original" | "licensed-original";
  license: "Project original" | "OpenAI generated original" | "OFL-compatible source";
  contentHashes?: Readonly<{ opus: string; mp3: string }>;
}>;

export type CampaignAudioManifest = Readonly<{
  presentationKey: string;
  theme: CampaignAudioTrack;
  ambience: CampaignAudioTrack;
  routeStingers: Readonly<Record<DetectiveCampaignRouteId, CampaignAudioTrack>>;
  finaleStingers: Readonly<Record<DetectiveCampaignRouteId, CampaignAudioTrack>>;
}>;

type ArtDirection = Readonly<{
  districtLabel: string;
  artDirection: string;
  motifLabel: string;
  palette: CampaignPresentationManifest["palette"];
}>;

const ART_DIRECTION_BY_KEY: Readonly<Record<string, ArtDirection>> = {
  "town-reckoning": direction("Civic Records Quarter", "Rain-dark civic stone, ledger windows, municipal seals, and severe public geometry.", "ledger seal", "#071116", "#cbc1aa", "#c49a4d", "#687f89"),
  "clinic-headlines": direction("Clinic & Press Ward", "Milk-glass clinic light colliding with ink-black headlines and guarded household thresholds.", "medical index tab", "#081216", "#d6d0c3", "#c7a85c", "#7e9596"),
  "scholarly-silence": direction("Academy Quadrangle", "Lamplit cloisters, rain-polished slate, marginalia, and tightly controlled faculty archives.", "library call slip", "#091116", "#c8c0ad", "#b99550", "#697b76"),
  "memorial-trust": direction("Memorial Garden", "Fog-soft stone, trust ledgers, pressed flowers, and restrained funerary brass.", "memorial rubbing", "#0c1213", "#cec7b7", "#aa8d58", "#7e8580"),
  "harbor-testimony": direction("Harbor Tribunal", "Wet iron, cargo chalk, sodium lamps, manifests, and witness routes cut through fog.", "cargo tally", "#061218", "#c8c0ac", "#c49a4b", "#4f8592"),
  "railbound-alibi": direction("Signal Yard", "Semaphore silhouettes, soot, wet rails, timetable paper, and controlled red signals.", "railway ticket", "#071014", "#c9c0aa", "#c39b55", "#8d4b43"),
  "furnace-oath": direction("Foundry Gate", "Furnace bloom behind black steel, inspection stamps, labor ledgers, and ash-scored paper.", "inspection punch", "#120d0b", "#d0c2aa", "#bd8848", "#a44f35"),
  "floodgate-covenant": direction("River Lock District", "Floodlit concrete, dark water, gauge marks, civic maps, and oxidized machinery.", "water gauge", "#071316", "#c8c3b2", "#b89757", "#477d85"),
  "midnight-chorus": direction("Theatre Night Market", "Art-deco theatre light, rain-black cobbles, backstage velvet, playbills, and lantern haze.", "midnight playbill", "#090c12", "#d5c7ad", "#c49a51", "#8d3d45"),
  "grand-hotel-register": direction("Grand Hotel", "Geometric lobby shadows, polished brass, service passages, guest cards, and midnight blue velvet.", "guest register", "#080d12", "#d2c6ae", "#c7a354", "#5d6f89"),
  "blackout-ledger": direction("Power Station Ward", "Black glass, dead switchboards, emergency lamps, utility diagrams, and copper traces.", "breaker docket", "#050d12", "#c9c3b4", "#c09b52", "#99753b"),
  "wireless-shadows": direction("Wireless Tower District", "Radio masts in fog, tuning dials, press rooms, wave traces, and restrained electric cyan.", "frequency card", "#061016", "#c8c1b0", "#b99a59", "#4c7f88")
};

function direction(districtLabel: string, artDirection: string, motifLabel: string, ink: string, paper: string, brass: string, signal: string): ArtDirection {
  return { districtLabel, artDirection, motifLabel, palette: { ink, paper, brass, signal } };
}

const READY_PRESENTATION_PATHS = new Set<string>([
  "/noir-archive/midnight-chorus/cover.webp",
  "/noir-archive/midnight-chorus/map.webp",
  "/noir-archive/midnight-chorus/finales/baseline.webp",
  "/noir-archive/town-reckoning/cover.webp",
  "/noir-archive/town-reckoning/map.webp",
  "/noir-archive/clinic-headlines/cover.webp",
  "/noir-archive/clinic-headlines/map.webp",
  "/noir-archive/scholarly-silence/cover.webp",
  "/noir-archive/scholarly-silence/map.webp",
  "/noir-archive/memorial-trust/cover.webp",
  "/noir-archive/memorial-trust/map.webp",
  "/noir-archive/harbor-testimony/cover.webp",
  "/noir-archive/harbor-testimony/map.webp",
  "/noir-archive/railbound-alibi/cover.webp",
  "/noir-archive/railbound-alibi/map.webp",
  "/noir-archive/furnace-oath/cover.webp",
  "/noir-archive/furnace-oath/map.webp",
  "/noir-archive/floodgate-covenant/cover.webp",
  "/noir-archive/floodgate-covenant/map.webp",
  "/noir-archive/grand-hotel-register/cover.webp",
  "/noir-archive/grand-hotel-register/map.webp",
  "/noir-archive/blackout-ledger/cover.webp",
  "/noir-archive/blackout-ledger/map.webp",
  "/noir-archive/wireless-shadows/cover.webp",
  "/noir-archive/wireless-shadows/map.webp"
]);
const READY_PRESENTATION_HASHES: Readonly<Record<string, string>> = {
  "/noir-archive/midnight-chorus/cover.webp": "774408f82b67eb08d2b3724cff3fdcf61b094508b05ae66ac439806bf8a562e2",
  "/noir-archive/midnight-chorus/map.webp": "66e82fbec5de45d410c705c74c0d4686750788c8c5ef18938872ce1373d8dc75",
  "/noir-archive/midnight-chorus/finales/baseline.webp": "cd5e64092064c72589e105499fc6e3a2c455eb77b86bef99eea8972f6f6f70a2",
  "/noir-archive/town-reckoning/cover.webp": "b60f79aad16bc090d8c0cfc5316d3a2e686182a2778d21c8f12b8809d0268822",
  "/noir-archive/town-reckoning/map.webp": "b60f79aad16bc090d8c0cfc5316d3a2e686182a2778d21c8f12b8809d0268822",
  "/noir-archive/clinic-headlines/cover.webp": "40b59961d61ffcb7b52f5d844633c5212df1852a4ad9c21ce6dd4ea1f5ce1d55",
  "/noir-archive/clinic-headlines/map.webp": "40b59961d61ffcb7b52f5d844633c5212df1852a4ad9c21ce6dd4ea1f5ce1d55",
  "/noir-archive/scholarly-silence/cover.webp": "4a3c53696b2e51b9f1c27f88d3ab61a4efd47e7dd50d6085d793a56ee64759a8",
  "/noir-archive/scholarly-silence/map.webp": "4a3c53696b2e51b9f1c27f88d3ab61a4efd47e7dd50d6085d793a56ee64759a8",
  "/noir-archive/memorial-trust/cover.webp": "3f9d746cdd9ab055677c5fcd3bb076517b4e43f9f73d5c2e5fac5472fb8ac900",
  "/noir-archive/memorial-trust/map.webp": "3f9d746cdd9ab055677c5fcd3bb076517b4e43f9f73d5c2e5fac5472fb8ac900",
  "/noir-archive/harbor-testimony/cover.webp": "671b85ab6658763cdab627f9fc3a551818b5e45ccb36eaed65d29e446004bfe4",
  "/noir-archive/harbor-testimony/map.webp": "671b85ab6658763cdab627f9fc3a551818b5e45ccb36eaed65d29e446004bfe4",
  "/noir-archive/railbound-alibi/cover.webp": "4840e7deb0929036a4ef8ddb9ebfb454b8d290d326c0a96aaa8b77f1bbb6889f",
  "/noir-archive/railbound-alibi/map.webp": "4840e7deb0929036a4ef8ddb9ebfb454b8d290d326c0a96aaa8b77f1bbb6889f",
  "/noir-archive/furnace-oath/cover.webp": "7d0f4306a27f506631604b4d07aa0fa1a831625bcfbb972d8456f3edcc490362",
  "/noir-archive/furnace-oath/map.webp": "7d0f4306a27f506631604b4d07aa0fa1a831625bcfbb972d8456f3edcc490362",
  "/noir-archive/floodgate-covenant/cover.webp": "818bea0b50189cb67c7e2cd9f7ce1b86dbf1ba17cf1a582700c173760b6589e9",
  "/noir-archive/floodgate-covenant/map.webp": "818bea0b50189cb67c7e2cd9f7ce1b86dbf1ba17cf1a582700c173760b6589e9",
  "/noir-archive/grand-hotel-register/cover.webp": "c8fb1b9b98b759185712a11d1c30ada61b903573427cf771695656f3c806cb08",
  "/noir-archive/grand-hotel-register/map.webp": "c8fb1b9b98b759185712a11d1c30ada61b903573427cf771695656f3c806cb08",
  "/noir-archive/blackout-ledger/cover.webp": "97646b395cad0a601116c3093ce69eabc6535c415889d21f77bdbb15d6450d65",
  "/noir-archive/blackout-ledger/map.webp": "97646b395cad0a601116c3093ce69eabc6535c415889d21f77bdbb15d6450d65",
  "/noir-archive/wireless-shadows/cover.webp": "dfd648dc9b1d2a7de85a6a0aefe711d4b795e012ebc08695d802829a45016d72",
  "/noir-archive/wireless-shadows/map.webp": "dfd648dc9b1d2a7de85a6a0aefe711d4b795e012ebc08695d802829a45016d72"
};
const READY_AUDIO_PATHS = new Set<string>();
const READY_AUDIO_HASHES: Readonly<Record<string, Readonly<{ opus: string; mp3: string }>>> = {};

function presentationAsset(
  presentationKey: string,
  kind: CampaignPresentationAssetKind,
  filename: string,
  width: number,
  height: number,
  maxBytes: number
): CampaignPresentationAsset {
  const path = `/noir-archive/${presentationKey}/${filename}`;
  const ready = READY_PRESENTATION_PATHS.has(path);
  return Object.freeze({
    kind,
    path,
    status: ready ? "ready" : "planned",
    width,
    height,
    maxBytes,
    source: ready ? "generated-original" : "planned-original",
    license: ready ? "OpenAI generated original" : "Project original",
    ...(ready ? { contentHash: READY_PRESENTATION_HASHES[path] } : {})
  });
}

function audioTrack(presentationKey: string, kind: CampaignAudioTrackKind, filename: string, label: string, maxCombinedBytes: number): CampaignAudioTrack {
  const base = `/noir-archive/${presentationKey}/audio/${filename}`;
  const ready = READY_AUDIO_PATHS.has(base);
  return Object.freeze({
    kind,
    label,
    opusPath: `${base}.opus`,
    mp3Path: `${base}.mp3`,
    status: ready ? "ready" : "planned",
    maxCombinedBytes,
    source: ready ? "generated-original" : "planned-original",
    license: ready ? "OpenAI generated original" : "Project original",
    ...(ready ? { contentHashes: READY_AUDIO_HASHES[base] } : {})
  });
}

function buildPresentationManifest(definition: (typeof DETECTIVE_CAMPAIGN_REGISTRY)[number]): CampaignPresentationManifest {
  const key = definition.presentationKey;
  const art = ART_DIRECTION_BY_KEY[key];
  if (!art) throw new Error(`Missing Campaign art direction for ${key}`);
  return Object.freeze({
    presentationKey: key,
    volumeId: definition.volumeId,
    label: definition.label,
    ...art,
    cover: presentationAsset(key, "cover", "cover.webp", 1536, 1024, 360_000),
    map: presentationAsset(key, "map", "map.webp", 1536, 1024, 420_000),
    chapters: [1, 2, 3].map((ordinal) => presentationAsset(key, "chapter", `chapters/chapter-${ordinal}.webp`, 1536, 1024, 220_000)) as unknown as CampaignPresentationManifest["chapters"],
    finales: {
      baseline: presentationAsset(key, "finale", "finales/baseline.webp", 1536, 1024, 240_000),
      "counter-route": presentationAsset(key, "finale", "finales/counter-route.webp", 1536, 1024, 240_000)
    },
    portraits: Array.from({ length: 6 }, (_, index) => presentationAsset(key, "portrait", `portraits/portrait-${index + 1}.webp`, 768, 960, 90_000)),
    evidence: Array.from({ length: 6 }, (_, index) => presentationAsset(key, "evidence", `evidence/treatment-${index + 1}.webp`, 960, 768, 80_000))
  });
}

function buildAudioManifest(definition: (typeof DETECTIVE_CAMPAIGN_REGISTRY)[number]): CampaignAudioManifest {
  const key = definition.presentationKey;
  return Object.freeze({
    presentationKey: key,
    theme: audioTrack(key, "theme", "theme-loop", `${definition.label} theme`, 600_000),
    ambience: audioTrack(key, "ambience", "district-ambience", `${definition.label} ambience`, 450_000),
    routeStingers: {
      baseline: audioTrack(key, "route-stinger", "route-baseline", `${definition.routes[0].label} route`, 160_000),
      "counter-route": audioTrack(key, "route-stinger", "route-counter", `${definition.routes[1].label} route`, 160_000)
    },
    finaleStingers: {
      baseline: audioTrack(key, "finale-stinger", "finale-baseline", `${definition.routes[0].finaleLabel} finale`, 160_000),
      "counter-route": audioTrack(key, "finale-stinger", "finale-counter", `${definition.routes[1].finaleLabel} finale`, 160_000)
    }
  });
}

export const CAMPAIGN_PRESENTATION_MANIFESTS = Object.freeze(DETECTIVE_CAMPAIGN_REGISTRY.map(buildPresentationManifest));
export const CAMPAIGN_AUDIO_MANIFESTS = Object.freeze(DETECTIVE_CAMPAIGN_REGISTRY.map(buildAudioManifest));

const GLOBAL_AUDIO_CUE_NAMES = ["focus", "confirm", "search", "question", "challenge", "evidence-pin", "submit", "warning", "world-shift", "resolve", "complete", "replay"] as const;
export type NoirGlobalAudioCue = (typeof GLOBAL_AUDIO_CUE_NAMES)[number];
export const NOIR_GLOBAL_AUDIO_CUES = Object.freeze(GLOBAL_AUDIO_CUE_NAMES.map((cue) => audioTrack("shared", "sfx", cue, cue, 60_000)));

export function listCampaignPresentationManifests() {
  return CAMPAIGN_PRESENTATION_MANIFESTS;
}

export function getCampaignPresentationManifest(presentationKey?: string) {
  return CAMPAIGN_PRESENTATION_MANIFESTS.find((manifest) => manifest.presentationKey === presentationKey) || CAMPAIGN_PRESENTATION_MANIFESTS[0];
}

export function presentationManifestForRuntime(input: { campaignLabel?: string; presentationKey?: string }) {
  if (input.presentationKey) return getCampaignPresentationManifest(input.presentationKey);
  return CAMPAIGN_PRESENTATION_MANIFESTS.find((manifest) => manifest.label === input.campaignLabel) || CAMPAIGN_PRESENTATION_MANIFESTS[0];
}

export function listCampaignAudioManifests() {
  return CAMPAIGN_AUDIO_MANIFESTS;
}

export function flattenCampaignPresentationAssets(manifest: CampaignPresentationManifest) {
  return [manifest.cover, manifest.map, ...manifest.chapters, ...Object.values(manifest.finales), ...manifest.portraits, ...manifest.evidence] as readonly CampaignPresentationAsset[];
}

export function auditCampaignPresentationDeclarations() {
  const assets = CAMPAIGN_PRESENTATION_MANIFESTS.flatMap(flattenCampaignPresentationAssets);
  const audio = [...CAMPAIGN_AUDIO_MANIFESTS.flatMap((manifest) => [manifest.theme, manifest.ambience, ...Object.values(manifest.routeStingers), ...Object.values(manifest.finaleStingers)]), ...NOIR_GLOBAL_AUDIO_CUES];
  const assetPaths = assets.map((asset) => asset.path);
  const audioPaths = audio.flatMap((track) => [track.opusPath, track.mp3Path]);
  const issues: string[] = [];
  if (CAMPAIGN_PRESENTATION_MANIFESTS.length !== 12) issues.push("Expected 12 Campaign presentation manifests.");
  if (assets.length !== 228) issues.push("Expected 228 declared visual assets.");
  if (new Set(assetPaths).size !== assetPaths.length) issues.push("Visual asset paths must be unique.");
  if (new Set(audioPaths).size !== audioPaths.length) issues.push("Audio fallback paths must be unique.");
  if (new Set(CAMPAIGN_PRESENTATION_MANIFESTS.map((manifest) => manifest.presentationKey)).size !== 12) issues.push("Presentation keys must be unique.");
  const visualBudgetBytes = assets.reduce((sum, asset) => sum + asset.maxBytes, 0);
  const audioBudgetBytes = audio.reduce((sum, track) => sum + track.maxCombinedBytes, 0);
  if (visualBudgetBytes > 45 * 1024 * 1024) issues.push("Declared visual budget exceeds 45 MiB.");
  if (audioBudgetBytes > 28 * 1024 * 1024) issues.push("Declared audio budget exceeds 28 MiB.");
  return Object.freeze({
    ok: issues.length === 0,
    campaignCount: CAMPAIGN_PRESENTATION_MANIFESTS.length,
    visualAssetCount: assets.length,
    audioTrackCount: audio.length,
    readyVisualAssetCount: assets.filter((asset) => asset.status === "ready").length,
    readyAudioTrackCount: audio.filter((track) => track.status === "ready").length,
    visualBudgetBytes,
    audioBudgetBytes,
    issues: Object.freeze(issues)
  });
}
