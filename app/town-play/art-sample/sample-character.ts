import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createCharacterGrounding } from "./character-grounding";

interface CharacterManifest {
  schema: string;
  sourceSha256: string;
  asset: { url: string; sha256: string };
  animation: { idle: string; walk: string; strideMeters: number; walkDurationSeconds: number };
  playerSpeed: number;
  actorId?: string;
  name?: string;
  role?: string;
  motionPreview?: { rootNode: string; clips: string[]; maximumGroundingLiftMeters: number };
  handArticulation?: { jointNames: string[] };
  gazeArticulation?: { jointNames: string[]; headJoint: string };
  workAction?: {
    id: string; label: string; clip: string; propClip?: string; propAnchor?: string; durationSeconds: number;
    workstation: { url: string; sha256: string };
    collider: { center: [number, number]; size: [number, number] };
  };
}

async function loadCharacter(url: string, schema: string, signal: AbortSignal, expectedManifestHash?: string) {
  const digest = async (bytes: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("侦探人物资源目录未能载入");
  const manifestBytes = await response.arrayBuffer();
  if (expectedManifestHash && await digest(manifestBytes) !== expectedManifestHash) throw new Error("居民造型版本不一致，请重新载入");
  const manifest: CharacterManifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  if (manifest.schema !== schema || manifest.animation.strideMeters <= 0 || manifest.playerSpeed <= 0) throw new Error("人物资源目录格式不正确");
  const asset = await fetch(manifest.asset.url, { signal });
  if (!asset.ok) throw new Error("侦探人物模型未能载入");
  const bytes = await asset.arrayBuffer();
  const identity = await digest(bytes);
  if (identity !== manifest.asset.sha256) throw new Error("人物模型版本校验失败，请重新载入");
  const loaded = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes, manifest.asset.url.slice(0, manifest.asset.url.lastIndexOf("/") + 1));
  if (manifest.motionPreview) {
    const node = loaded.scene.getObjectByName(manifest.motionPreview.rootNode);
    if (!node || manifest.motionPreview.clips.some(name => !loaded.animations.some(clip => clip.name === name))) throw new Error("人物出入动作不完整");
    // Position and heading come from the checked route, exactly once. The
    // remaining tracks retain the authored skeletal and garment deformation.
    loaded.animations = loaded.animations.map(clip => new THREE.AnimationClip(clip.name, clip.duration,
      clip.tracks.filter(track => !track.name.startsWith(manifest.motionPreview!.rootNode + "."))));
    node.position.set(0, 0, 0); node.quaternion.identity();
  }
  const grounding = manifest.motionPreview ? createCharacterGrounding(loaded.scene, manifest.motionPreview.maximumGroundingLiftMeters) : null;
  const idleClip = loaded.animations.find(clip => clip.name === manifest.animation.idle);
  const walkClip = loaded.animations.find(clip => clip.name === manifest.animation.walk);
  if (!idleClip || !walkClip || Math.abs(walkClip.duration - manifest.animation.walkDurationSeconds) > .001) throw new Error("人物动作资源不完整");
  const mixer = new THREE.AnimationMixer(loaded.scene);
  const idle = mixer.clipAction(idleClip).play(), walk = mixer.clipAction(walkClip).play();
  walk.setEffectiveWeight(0);
  let blend = 0;
  const joints = ["thigh_L", "shin_L", "foot_L", "thigh_R", "shin_R", "foot_R"].map(name => loaded.scene.getObjectByName(name));
  if (joints.some(joint => !joint)) throw new Error("人物骨骼资源不完整");
  const fingerNames = manifest.handArticulation?.jointNames ?? [];
  const fingerJoints = fingerNames.map(name => loaded.scene.getObjectByName(name));
  if (fingerJoints.some(joint => !(joint instanceof THREE.Bone)) || new Set(fingerNames).size !== fingerNames.length) throw new Error("人物手部动作资源不完整");
  const gazeNames = manifest.gazeArticulation ? [manifest.gazeArticulation.headJoint, ...manifest.gazeArticulation.jointNames] : [];
  const gazeJoints = gazeNames.map(name => loaded.scene.getObjectByName(name));
  if (gazeJoints.some(joint => !(joint instanceof THREE.Bone)) || new Set(gazeNames).size !== gazeNames.length) throw new Error("人物视线动作资源不完整");
  const work = manifest.workAction;
  let workstation: THREE.Group | null = null, propMixer: THREE.AnimationMixer | null = null;
  let workAction: THREE.AnimationAction | null = null, propAction: THREE.AnimationAction | null = null;
  let book: THREE.Object3D | undefined, workTime = 0, workPlaying = false, workStarts = 0, workCompletions = 0;
  if (work) {
    const clip = loaded.animations.find(item => item.name === work.clip);
    if (!clip || !Number.isFinite(work.durationSeconds) || work.durationSeconds <= 0 || Math.abs(clip.duration - work.durationSeconds) > .001) throw new Error("人物工作动作不完整");
    const response = await fetch(work.workstation.url, { signal });
    if (!response.ok) throw new Error("工作道具未能载入");
    const bytes = await response.arrayBuffer();
    if (await digest(bytes) !== work.workstation.sha256) throw new Error("工作道具版本校验失败");
    const props = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes, work.workstation.url.slice(0, work.workstation.url.lastIndexOf("/") + 1));
    const anchorName = work.propAnchor ?? (work.propClip ? "restorer_book_anchor" : undefined);
    book = anchorName ? props.scene.getObjectByName(anchorName) : undefined;
    if (anchorName && !book) throw new Error("工作道具的定位信息不完整");
    workstation = props.scene;
    if (work.propClip) {
      const propClip = props.animations.find(item => item.name === work.propClip);
      if (!propClip || Math.abs(propClip.duration - clip.duration) > .001) throw new Error("工作道具与人物动作不同步");
      propMixer = new THREE.AnimationMixer(workstation);
      propAction = propMixer.clipAction(propClip).setLoop(THREE.LoopOnce, 1).play();
      propAction.clampWhenFinished = true; propAction.paused = true;
    }
    workAction = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
    workAction.clampWhenFinished = true; workAction.paused = true; workAction.setEffectiveWeight(0);
    propMixer?.update(0);
  }
  function restoreWork() {
    workTime = 0; workPlaying = false;
    if (workAction) { workAction.time = 0; workAction.setEffectiveWeight(0); }
    if (propAction) propAction.time = 0;
    propMixer?.update(0);
  }
  const motionActions = new Map(loaded.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  let motionCurrent: { name: string; seconds: number } | null = null;
  let motionOutgoing: { name: string; seconds: number } | null = null, motionBlendTime = 0;
  function sampleMotion(name: string, seconds: number, dt: number) {
    if (!manifest.motionPreview || !motionActions.has(name)) throw new Error("人物动线动作不可用");
    if (motionCurrent?.name !== name) { motionOutgoing = motionCurrent; motionBlendTime = 0; }
    motionBlendTime += dt;
    const weight = THREE.MathUtils.smoothstep(motionBlendTime, 0, .18);
    for (const action of motionActions.values()) action.setEffectiveWeight(0);
    function bind(clipName: string, time: number, amount: number) {
      const action = motionActions.get(clipName)!;
      action.enabled = true; action.play(); action.paused = true;
      action.time = clipName === "Walk" || clipName === "Idle" ? time % action.getClip().duration : Math.min(time, action.getClip().duration);
      action.setEffectiveWeight(amount);
    }
    if (motionOutgoing && weight < 1) {
      if (motionOutgoing.name === "Walk" || motionOutgoing.name === "Idle") motionOutgoing.seconds += dt;
      bind(motionOutgoing.name, motionOutgoing.seconds, 1 - weight);
    }
    bind(name, seconds, motionOutgoing ? weight : 1);
    motionCurrent = { name, seconds }; mixer.update(0); grounding?.correct();
  }
  function reset() {
    restoreWork(); motionCurrent = null; motionOutgoing = null;
    for (const action of motionActions.values()) action.setEffectiveWeight(0);
    blend = 0; walk.time = 0; idle.time = 0; idle.enabled = true; walk.enabled = true;
    idle.paused = false; walk.paused = false; idle.setEffectiveWeight(1); walk.setEffectiveWeight(0);
    mixer.update(0); grounding?.reset(); grounding?.correct();
  }
  return {
    root: loaded.scene,
    workstation,
    work: work ? { id: work.id, label: work.label, collider: work.collider } : null,
    actorId: manifest.actorId,
    playerSpeed: manifest.playerSpeed,
    get workPlaying() { return workPlaying; },
    sampleMotion,
    startWork() {
      if (!work || !workAction || workPlaying) return false;
      restoreWork(); idle.time = 0; workPlaying = true; workStarts++; return true;
    },
    update(dt: number, distance: number) {
      if (workPlaying && work && workAction) {
        workTime = Math.min(work.durationSeconds, workTime + dt);
        const weight = THREE.MathUtils.smoothstep(workTime, 0, .3) * (1 - THREE.MathUtils.smoothstep(workTime, work.durationSeconds - .35, work.durationSeconds));
        workAction.time = workTime;
        if (propAction) propAction.time = workTime;
        workAction.setEffectiveWeight(weight); idle.setEffectiveWeight(1 - weight); walk.setEffectiveWeight(0); blend = 0;
        propMixer?.update(0); mixer.update(dt); grounding?.correct();
        if (workTime >= work.durationSeconds) { workPlaying = false; workCompletions++; workAction.setEffectiveWeight(0); }
        return;
      }
      blend = THREE.MathUtils.damp(blend, distance > .0001 ? 1 : 0, 16, dt);
      idle.setEffectiveWeight(1 - blend); walk.setEffectiveWeight(blend);
      walk.setEffectiveTimeScale(dt > 0 ? distance / dt * walkClip.duration / manifest.animation.strideMeters : 0);
      mixer.update(dt); grounding?.correct();
    },
    reset,
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(loaded.scene); propMixer?.stopAllAction(); if (workstation) propMixer?.uncacheRoot(workstation); },
    diagnostics() {
      return { assetSha256: manifest.asset.sha256, sourceSha256: manifest.sourceSha256, motionPreview: motionCurrent, grounding: grounding?.diagnostics(), strideMeters: manifest.animation.strideMeters, idleTime: idle.time, walkTime: walk.time, walkWeight: blend, work: work ? { id: work.id, playing: workPlaying, time: workTime, starts: workStarts, completions: workCompletions, duration: work.durationSeconds, propTime: propAction?.time, workstationSha256: work.workstation.sha256, bookPosition: book?.getWorldPosition(new THREE.Vector3()).toArray(), bookQuaternion: book?.getWorldQuaternion(new THREE.Quaternion()).toArray() } : null, jointQuaternions: joints.map(joint => ({ name: joint!.name, quaternion: joint!.quaternion.toArray(), worldPosition: joint!.getWorldPosition(new THREE.Vector3()).toArray() })), fingerJointQuaternions: fingerJoints.map(joint => ({ name: joint!.name, quaternion: joint!.quaternion.toArray() })), gazeJointQuaternions: gazeJoints.map(joint => ({ name: joint!.name, quaternion: joint!.quaternion.toArray() })) };
    },
  };
}

export function loadInvestigator(signal: AbortSignal) {
  return loadCharacter("/assets/classic-investigator/v1/manifest.json", "classic-investigator-runtime.v1", signal);
}

export function loadResident(url: string, manifestSha256: string, signal: AbortSignal) {
  return loadCharacter(url, "classic-resident-runtime.v1", signal, manifestSha256);
}

export type SampleCharacter = Awaited<ReturnType<typeof loadInvestigator>>;
