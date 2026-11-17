// Build the compressed delivery copy of the Riverbend town model.
//
// town.glb stays the model's identity: saved notebooks, navigation.json and
// the resident manifest all record its SHA-256, so it never changes here.
// The browser downloads town.meshopt.glb instead, a lossless meshopt copy
// (no quantization, so every node transform and vertex keeps its value).
// The script refuses to write the manifest unless every named node keeps the
// same world position and bounds.
//
// Run from the project root after re-exporting town.glb:
//   node scripts/compress-riverbend-town.mjs
//
// Tooling (local, not in git): npm i in outputs/glb-tools with
// @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "public/assets/riverbend/v1");
const source = path.join(dir, "town.glb"), target = path.join(dir, "town.meshopt.glb"), manifestPath = path.join(dir, "manifest.json");
const tools = createRequire(path.join(root, "outputs/glb-tools/package.json"));
const load = async name => import(pathToFileURL(tools.resolve(name)).href);
const [{ NodeIO }, { EXTMeshoptCompression }, { reorder }, { MeshoptEncoder }] = await Promise.all(
  ["@gltf-transform/core", "@gltf-transform/extensions", "@gltf-transform/functions", "meshoptimizer"].map(load));

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(source);
await doc.transform(reorder({ encoder: MeshoptEncoder, target: "size" }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const bytes = Buffer.from(await io.writeBinary(doc));

// Same names, same world positions, same bounds: nothing the town reads by name may move.
const parse = async buffer => (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), "")).scene;
const shape = scene => {
  scene.updateMatrixWorld(true);
  const out = new Map();
  scene.traverse(o => { if (o.name) out.set(o.name, { at: o.getWorldPosition(new THREE.Vector3()), box: new THREE.Box3().setFromObject(o) }); });
  return out;
};
const before = shape(await parse(fs.readFileSync(source))), after = shape(await parse(bytes));
if (before.size !== after.size) throw new Error(`Named nodes changed: ${before.size} -> ${after.size}`);
for (const [name, a] of before) {
  const b = after.get(name);
  if (!b) throw new Error(`Missing node ${name}`);
  const drift = Math.max(a.at.distanceTo(b.at), a.box.isEmpty() ? 0 : Math.max(a.box.min.distanceTo(b.box.min), a.box.max.distanceTo(b.box.max)));
  if (drift > 1e-6) throw new Error(`${name} moved by ${drift}`);
}

fs.writeFileSync(target, bytes);
const sha = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.asset.sha256 !== sha(fs.readFileSync(source))) throw new Error("town.glb no longer matches manifest.asset; re-export first");
manifest.delivery = {
  url: "/assets/riverbend/v1/town.meshopt.glb", sha256: sha(bytes), bytes: bytes.length,
  encoding: "EXT_meshopt_compression, lossless (no quantization)", identitySha256: manifest.asset.sha256,
  script: "scripts/compress-riverbend-town.mjs",
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`town.meshopt.glb ${(bytes.length / 1048576).toFixed(2)} MB (from ${(fs.statSync(source).size / 1048576).toFixed(2)} MB), ${before.size} named nodes unchanged`);
