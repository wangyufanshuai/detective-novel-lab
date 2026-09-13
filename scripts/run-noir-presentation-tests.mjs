import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "noir-presentation-runtime");

function webpDimensions(buffer) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF", "WebP asset has a RIFF container");
  assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP", "WebP asset has a WEBP signature");
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const kind = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (kind === "VP8X" && data + 10 <= buffer.length) {
      const width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16);
      const height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16);
      return { width, height, format: "webp" };
    }
    if (kind === "VP8L" && data + 5 <= buffer.length) {
      assert.equal(buffer[data], 0x2f, "lossless WebP has the VP8L signature");
      const width = 1 + buffer[data + 1] + ((buffer[data + 2] & 0x3f) << 8);
      const height = 1 + ((buffer[data + 2] & 0xc0) >> 6) + (buffer[data + 3] << 2) + ((buffer[data + 4] & 0x0f) << 10);
      return { width, height, format: "webp" };
    }
    if (kind === "VP8 " && data + 10 <= buffer.length) {
      assert.equal(buffer.subarray(data + 3, data + 6).toString("hex"), "9d012a", "lossy WebP has the VP8 key-frame signature");
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff, format: "webp" };
    }
    offset = data + size + (size % 2);
  }
  throw new Error("WebP asset has no supported VP8 dimension chunk");
}

async function listAssetFiles(directory, prefix = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return listAssetFiles(path.join(directory, entry.name), relative);
    return entry.isFile() && /\.(?:webp|opus|mp3)$/i.test(entry.name) ? [relative] : [];
  }))).flat().sort();
}

async function collectTsFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }))).flat();
}

await fs.rm(runtimeDir, { recursive: true, force: true });
await fs.mkdir(runtimeDir, { recursive: true });
for (const file of await collectTsFiles(sourceDir)) {
  const source = await fs.readFile(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText.replace(/require\("(\.{1,2}\/.*?)"\)/g, 'require("$1.cjs")');
  const target = path.join(runtimeDir, path.relative(sourceDir, file).replace(/\.ts$/, ".cjs"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output, "utf8");
}

const engine = await import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?noir=${Date.now()}`);
const manifests = engine.listCampaignPresentationManifests();
const audio = engine.listCampaignAudioManifests();
const audit = engine.auditCampaignPresentationDeclarations();

assert.equal(audit.ok, true, audit.issues.join("\n"));
assert.equal(manifests.length, 12, "every Campaign owns one presentation manifest");
assert.equal(audio.length, 12, "every Campaign owns one audio manifest");
assert.equal(audit.visualAssetCount, 228, "the visual pipeline declares the complete 228-asset target");
assert.equal(audit.audioTrackCount, 84, "the audio pipeline declares six Campaign tracks per Campaign and twelve shared cues");
assert.ok(audit.visualBudgetBytes <= 45 * 1024 * 1024, "visual declarations stay inside 45 MiB");
assert.ok(audit.audioBudgetBytes <= 28 * 1024 * 1024, "audio declarations stay inside 28 MiB");
assert.equal(new Set(manifests.map((manifest) => manifest.presentationKey)).size, 12, "presentation keys are unique");
assert.equal(new Set(manifests.flatMap((manifest) => engine.flattenCampaignPresentationAssets(manifest).map((asset) => asset.path))).size, 228, "asset paths are unique");
for (const manifest of manifests) {
  const assets = engine.flattenCampaignPresentationAssets(manifest);
  assert.equal(assets.length, 19, `${manifest.label} declares cover, map, chapters, finales, portraits, and evidence`);
  assert.equal(assets.every((asset) => asset.path.startsWith(`/noir-archive/${manifest.presentationKey}/`) && asset.path.endsWith(".webp")), true, `${manifest.label} uses local WebP paths only`);
  assert.equal(assets.every((asset) => ["planned", "ready"].includes(asset.status) && asset.maxBytes > 0 && asset.width > 0 && asset.height > 0), true, `${manifest.label} assets are bounded and status-explicit`);
}

const publicJson = JSON.stringify({ manifests, audio, audit });
assert.doesNotMatch(publicJson, /(?:world|case|session|npc|location|evidence|source|event)Id|hiddenTruth|rawBody|culprit|victim|[A-Za-z]:[\\/]/i, "presentation declarations expose no runtime authority or absolute paths");

const readyAssets = manifests.flatMap(engine.flattenCampaignPresentationAssets).filter((asset) => asset.status === "ready");
const plannedAssets = manifests.flatMap(engine.flattenCampaignPresentationAssets).filter((asset) => asset.status === "planned");
const audioTracks = [
  ...audio.flatMap((manifest) => [manifest.theme, manifest.ambience, ...Object.values(manifest.routeStingers), ...Object.values(manifest.finaleStingers)]),
  ...engine.NOIR_GLOBAL_AUDIO_CUES
];
const readyAudioTracks = audioTracks.filter((track) => track.status === "ready");
const plannedAudioTracks = audioTracks.filter((track) => track.status === "planned");
const licenseRegister = await fs.readFile(path.join(root, "public", "noir-archive", "ASSET-LICENSES.md"), "utf8");
const licenseRows = new Map([...licenseRegister.matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| `([a-f0-9]{64})` \| ([^|]+) \|$/gm)]
  .map((match) => [match[1], { source: match[2].trim(), license: match[3].trim(), hash: match[4], notes: match[5].trim() }]));
for (const asset of readyAssets) {
  const diskPath = path.join(root, "public", ...asset.path.split("/").filter(Boolean));
  const stat = await fs.stat(diskPath);
  const bytes = await fs.readFile(diskPath);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  const dimensions = webpDimensions(bytes);
  const relativePath = asset.path.replace(/^\/noir-archive\//, "");
  const registered = licenseRows.get(relativePath);
  assert.ok(stat.size <= asset.maxBytes, `${asset.path} stays within its declared byte budget`);
  assert.match(asset.contentHash || "", /^[a-f0-9]{64}$/, `${asset.path} has a registered SHA-256`);
  assert.equal(digest, asset.contentHash, `${asset.path} bytes match the manifest SHA-256`);
  assert.deepEqual(dimensions, { width: asset.width, height: asset.height, format: "webp" }, `${asset.path} is a real WebP with the declared dimensions`);
  assert.ok(registered, `${asset.path} is present in the asset license register`);
  assert.equal(registered.hash, digest, `${asset.path} license register hash matches disk`);
  assert.equal(registered.license, asset.license, `${asset.path} license register agrees with the manifest`);
  assert.ok(registered.source.length > 0 && registered.notes.includes(`${asset.width}×${asset.height}`), `${asset.path} license row retains source and dimension notes`);
}
for (const asset of plannedAssets) {
  const diskPath = path.join(root, "public", ...asset.path.split("/").filter(Boolean));
  await assert.rejects(fs.stat(diskPath), { code: "ENOENT" }, `${asset.path} cannot exist while declared planned`);
}
for (const track of plannedAudioTracks) {
  for (const publicPath of [track.opusPath, track.mp3Path]) {
    const diskPath = path.join(root, "public", ...publicPath.split("/").filter(Boolean));
    await assert.rejects(fs.stat(diskPath), { code: "ENOENT" }, `${publicPath} cannot exist while declared planned`);
  }
  assert.equal(track.contentHashes, undefined, `${track.label} cannot carry ready hashes while planned`);
}
for (const track of readyAudioTracks) {
  assert.match(track.contentHashes?.opus || "", /^[a-f0-9]{64}$/, `${track.label} Opus has a registered SHA-256`);
  assert.match(track.contentHashes?.mp3 || "", /^[a-f0-9]{64}$/, `${track.label} MP3 has a registered SHA-256`);
  let combinedBytes = 0;
  for (const [format, publicPath] of [["opus", track.opusPath], ["mp3", track.mp3Path]]) {
    const diskPath = path.join(root, "public", ...publicPath.split("/").filter(Boolean));
    const bytes = await fs.readFile(diskPath);
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    const relativePath = publicPath.replace(/^\/noir-archive\//, "");
    const registered = licenseRows.get(relativePath);
    combinedBytes += bytes.length;
    assert.equal(digest, track.contentHashes[format], `${publicPath} bytes match the manifest SHA-256`);
    if (format === "opus") {
      assert.equal(bytes.subarray(0, 4).toString("ascii"), "OggS", `${publicPath} uses an Ogg container`);
      assert.ok(bytes.subarray(0, Math.min(bytes.length, 256)).includes(Buffer.from("OpusHead")), `${publicPath} contains an Opus header`);
    } else {
      const mp3Header = bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      assert.equal(mp3Header, true, `${publicPath} contains an MP3 header`);
    }
    assert.ok(registered, `${publicPath} is present in the asset license register`);
    assert.equal(registered.hash, digest, `${publicPath} license register hash matches disk`);
    assert.equal(registered.license, track.license, `${publicPath} license register agrees with the manifest`);
  }
  assert.ok(combinedBytes <= track.maxCombinedBytes, `${track.label} dual-format audio stays within its combined byte budget`);
}
const playerArtFiles = (await listAssetFiles(path.join(root, "public", "noir-archive")))
  .filter((file) => file.startsWith("portraits/") || file.startsWith("evidence/"));
const declaredReadyFiles = [
  ...readyAssets.map((asset) => asset.path.replace(/^\/noir-archive\//, "")),
  ...readyAudioTracks.flatMap((track) => [track.opusPath, track.mp3Path].map((value) => value.replace(/^\/noir-archive\//, ""))),
  // Player-facing portraits and discovered-object stills are declared by the
  // stable presentation mapping rather than the campaign engine manifest.
  ...playerArtFiles
].sort();
const diskAssetFiles = await listAssetFiles(path.join(root, "public", "noir-archive"));
assert.deepEqual(diskAssetFiles, declaredReadyFiles, "Noir archive contains no orphan files or planned-file drift");
assert.deepEqual([...licenseRows.keys()].sort(), declaredReadyFiles, "asset license register exactly matches ready on-disk assets");

const modelSource = await fs.readFile(path.join(root, "app", "audio", "noir-audio-model.ts"), "utf8");
const modelOutput = ts.transpileModule(modelSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
await fs.writeFile(path.join(runtimeDir, "noir-audio-model.cjs"), modelOutput, "utf8");
const model = await import(`${pathToFileURL(path.join(runtimeDir, "noir-audio-model.cjs")).href}?audio=${Date.now()}`);
assert.deepEqual(model.normalizeNoirAudioSettings({ formatVersion: 1, muted: false, master: 4, music: -2, ambience: .4, sfx: .8, lowSensory: true }), { formatVersion: 1, muted: false, master: 1, music: 0, ambience: .4, sfx: .8, lowSensory: true }, "audio values clamp deterministically");
assert.deepEqual(Object.keys(JSON.parse(model.serializeNoirAudioSettings(model.DEFAULT_NOIR_AUDIO_SETTINGS))).sort(), ["ambience", "formatVersion", "lowSensory", "master", "music", "muted", "sfx"], "audio persistence contains only the seven safe settings fields");
assert.equal(model.normalizeNoirAudioSettings({ formatVersion: 99, muted: true }), model.DEFAULT_NOIR_AUDIO_SETTINGS, "unknown audio versions fail closed");

const directorSource = await fs.readFile(path.join(root, "app", "audio", "noir-audio-director.ts"), "utf8");
const hookSource = await fs.readFile(path.join(root, "app", "hooks", "useNoirAudioDirector.ts"), "utf8");
assert.match(directorSource, /document\.addEventListener\("visibilitychange"/, "AudioDirector listens for visibility changes on the correct Document target");
assert.match(directorSource, /document\.removeEventListener\("visibilitychange"/, "AudioDirector removes the Document visibility listener");
assert.doesNotMatch(directorSource, /async unlock\(\)\s*\{\s*if \(this\.settings\.(?:muted|lowSensory)/, "muted and Low Sensory sessions still unlock during the user gesture so later essential cues can work");
assert.match(directorSource, /activeCue/, "AudioDirector enforces one primary SFX");
assert.match(directorSource, /track\.status !== "ready"/, "AudioDirector cannot play a cue until its real dual-format track is ready");
assert.doesNotMatch(directorSource, /createOscillator|CUE_FREQUENCIES/, "planned audio is never substituted with synthesized placeholder tones");
assert.match(hookSource, /runtimeMode !== "server"/, "Static Runtime never initializes audio storage or playback");
assert.match(hookSource, /settingsRef/, "audio setting mutations read one normalized current snapshot instead of stale render closures");
assert.match(hookSource, /normalizeNoirAudioSettings/, "hook state mirrors normalized director settings");
assert.doesNotMatch(`${directorSource}\n${hookSource}`, /\/api\//, "audio presentation never requests an API endpoint");

console.log(JSON.stringify({ ok: true, suite: "noir-presentation", campaigns: audit.campaignCount, visualAssets: audit.visualAssetCount, readyVisualAssets: audit.readyVisualAssetCount, audioTracks: audit.audioTrackCount, readyAudioTracks: audit.readyAudioTrackCount }));
