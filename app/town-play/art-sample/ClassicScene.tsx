"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createSampleNavigator, type Point, type SampleContract, type SampleInteraction, type SampleMode, type SampleRoom } from "./sample-navigation";
import { loadInvestigator, loadResident, type SampleCharacter } from "./sample-character";
import { createCutawayShadows } from "./sample-cutaway-shadows";
import type { TownPlayView } from "@/lib/town-play-contract";
import { CLASSIC_LIVING_ACTORS, classicWorldScene } from "@/lib/classic-living-contract";
import { classicResidentPresence, residentSceneAnchor, validClassicLivingView } from "./living-presentation";
import { createObservedMotionPlayback } from "./living-motion";
import type { TownObservedMotion } from "@/packages/engine/src/town/observed-passages";
import { createMotionPreviewPlayback } from "./motion-preview";

interface CastEntry {
  actorId: string; name: string; role: string; manifestUrl: string; manifestSha256: string;
  roomId: string; position: Point; observationPosition: Point; yaw: number; appearanceDescription: string;
}

interface Props {
  keys: RefObject<Set<string>>;
  mode: SampleMode;
  paused: boolean;
  reset: number;
  focusActorId?: string;
  workRequest?: { actorId: string; serial: number };
  motionPreview?: boolean;
  previewRequest?: { actorId: string; serial: number };
  onPreviewChange?: (actorId: string | null) => void;
  onCastReady?: (entries: SampleInteraction[]) => void;
  living?: { view: TownPlayView | null; restore: { key: string; sceneId: string } | null; motion?: TownObservedMotion | null };
  onMotionComplete?: (id: string) => void;
  onPositionRestored?: (key: string, room: SampleRoom | null) => void;
  onWorkChange: (actorId: string | null) => void;
  onReady: () => void;
  onChange: (room: SampleRoom | null, nearby: SampleInteraction | null) => void;
  onError: (message: string) => void;
}

export default function ClassicScene(props: Props) {
  const host = useRef<HTMLDivElement>(null), live = useRef(props);
  useEffect(() => { live.current = props; }, [props]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const abort = new AbortController();
    let disposed = false, frame = 0, model: THREE.Group | null = null, envTarget: THREE.WebGLRenderTarget | null = null;
    let character: SampleCharacter | null = null;
    const residents: { entry: CastEntry; character: SampleCharacter; group: THREE.Group; boundWorkId: string | null }[] = [];
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
    catch { live.current.onError("无法开启三维画面，请检查浏览器硬件加速。"); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor("#8e9c9e");
    renderer.domElement.setAttribute("aria-label", props.living ? "车站、旧书店与旅馆三维街区，可用方向键或 WASD 探索居民日常" : "车站、旧书店与旅馆三维美术样板，可用方向键或 WASD 探索");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cutawayShadows = createCutawayShadows(renderer, scene);
    scene.fog = new THREE.Fog("#8e9c9e", 48, 92);
    const camera = new THREE.OrthographicCamera(-14, 14, 8, -8, .06, 130);
    const hemisphere = new THREE.HemisphereLight("#cbd5d5", "#625547", .85);
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight("#fff0d4", 3.0);
    key.position.set(-6, 16, 9); key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: .1, far: 55 });
    key.shadow.mapSize.set(2048, 2048); key.shadow.normalBias = .027; key.shadow.bias = -.00015;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#b4cfe6", .40);
    fill.position.set(8, 9, -10); scene.add(fill);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    envTarget = pmrem.fromScene(room, .05); scene.environment = envTarget.texture; scene.environmentIntensity = .24;
    room.dispose(); pmrem.dispose();
    const ring = new THREE.Mesh(new THREE.RingGeometry(.30, .324, 48), new THREE.MeshBasicMaterial({ color: "#d9be8c", transparent: true, opacity: .68, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; scene.add(ring);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    const renderPass = new RenderPass(scene, camera), aoPass = new GTAOPass(scene, camera, 1, 1), outputPass = new OutputPass();
    aoPass.updateGtaoMaterial({ radius: .55, distanceExponent: 2, thickness: .12, samples: 8 });
    aoPass.updatePdMaterial({ samples: 8, radius: 4 }); aoPass.blendIntensity = .75;
    composer.addPass(renderPass); composer.addPass(aoPass); composer.addPass(outputPass);
    renderer.info.autoReset = false;
    let aspect = 16 / 9;
    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      if (w && h) {
        aspect = w / h; renderer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
        aoPass.setSize(Math.max(1, Math.round(w * renderer.getPixelRatio() * .75)), Math.max(1, Math.round(h * renderer.getPixelRatio() * .75)));
      }
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    const lost = (e: Event) => { e.preventDefault(); disposed = true; cancelAnimationFrame(frame); live.current.onError("三维画面已中断，请重新载入此样板。"); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    function disposeModel(root: THREE.Object3D) {
      const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
      root.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => materials.add(m)); } if (obj instanceof THREE.SkinnedMesh) skeletons.add(obj.skeleton); });
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      for (const texture of textures) texture.dispose();
      for (const skeleton of skeletons) skeleton.dispose();
    }
    async function load() {
      try {
        const res = await fetch(props.motionPreview ? "/assets/classic-motion/v2-step16-cape/manifest.json" : props.living ? "/assets/classic-occupations/v2/manifest.json" : "/assets/classic-bookshop/v2/manifest.json", { signal: abort.signal });
        if (!res.ok) throw new Error("街角资源目录尚未就绪");
        const manifest = await res.json();
        const files = await Promise.all([manifest.asset.url, manifest.navigation.url].map(async (url: string) => {
          const response = await fetch(url, { signal: abort.signal });
          if (!response.ok) throw new Error("街角场景资源未能载入");
          return response.arrayBuffer();
        }));
        const digest = async (bytes: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("");
        if (await digest(files[0]) !== manifest.asset.sha256 || await digest(files[1]) !== manifest.navigation.sha256) throw new Error("模型与通行数据版本不一致，请重新载入。");
        const data: SampleContract = JSON.parse(new TextDecoder().decode(files[1]));
        if (data.sourceSha256 !== manifest.sourceSha256 || data.assetSha256 !== manifest.asset.sha256) throw new Error("样板来源校验失败");
        let preview: ReturnType<typeof createMotionPreviewPlayback> | null = null;
        if (props.motionPreview) {
          if (props.living || !manifest.motionPreview) throw new Error("动线观察入口不一致");
          const response = await fetch(manifest.motionPreview.url, { signal: abort.signal });
          if (!response.ok) throw new Error("动线样板未能载入");
          const bytes = await response.arrayBuffer();
          if (await digest(bytes) !== manifest.motionPreview.sha256) throw new Error("动线样板版本不一致");
          preview = createMotionPreviewPlayback(JSON.parse(new TextDecoder().decode(bytes)), manifest.asset.sha256);
        }
        const loaded = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(files[0], "/assets/classic-bookshop/v2/");
        if (disposed) { disposeModel(loaded.scene); return; }
        model = loaded.scene;
        character = await loadInvestigator(abort.signal);
        if (disposed) { character.dispose(); disposeModel(character.root); return; }
        const previousActor = model.getObjectByName("sample_player");
        if (!previousActor) throw new Error("原样板的人物节点未能载入");
        previousActor.visible = false;
        const actor = new THREE.Group(); actor.name = "playable_investigator";
        actor.add(character.root); model.add(actor);
        if (!manifest.residentCast?.url || !manifest.residentCast?.sha256) throw new Error("居民造型目录尚未就绪");
        const castResponse = await fetch(manifest.residentCast.url, { signal: abort.signal });
        if (!castResponse.ok) throw new Error("居民造型目录未能载入");
        const castBytes = await castResponse.arrayBuffer();
        if (await digest(castBytes) !== manifest.residentCast.sha256) throw new Error("居民造型目录版本不一致，请重新载入。");
        const cast: { schema: string; sceneAssetSha256: string; worldBound: boolean; entries: CastEntry[] } = JSON.parse(new TextDecoder().decode(castBytes));
        if (cast.schema !== "classic-resident-cast.v1" || cast.worldBound || cast.sceneAssetSha256 !== manifest.asset.sha256 || cast.entries.length !== 3) throw new Error("居民造型与场景版本不一致");
        for (const entry of cast.entries) {
          const resident = await loadResident(entry.manifestUrl, entry.manifestSha256, abort.signal);
          if (disposed) { resident.dispose(); disposeModel(resident.root); if (resident.workstation) disposeModel(resident.workstation); return; }
          if (resident.actorId !== entry.actorId) { resident.dispose(); disposeModel(resident.root); if (resident.workstation) disposeModel(resident.workstation); throw new Error("居民造型身份不一致"); }
          const group = new THREE.Group(); group.name = "art_" + entry.actorId;
          group.position.set(entry.position[0], data.floor, -entry.position[1]); group.rotation.y = entry.yaw;
          group.add(resident.root); model.add(group); residents.push({ entry, character: resident, group, boundWorkId: null });
          if (resident.workstation && resident.work) {
            // A workplace is a sibling of its resident, so later actor movement
            // cannot drag the furniture through the room.
            const workplace = new THREE.Group(); workplace.name = "workplace_" + entry.actorId;
            workplace.position.copy(group.position); workplace.rotation.y = entry.yaw;
            workplace.add(resident.workstation); model.add(workplace);
            const collider = resident.work.collider, angle = -entry.yaw;
            data.colliders.push({ id: workplace.name, size: collider.size, angle,
              center: [entry.position[0] + Math.cos(angle) * collider.center[0] - Math.sin(angle) * collider.center[1],
                entry.position[1] + Math.sin(angle) * collider.center[0] + Math.cos(angle) * collider.center[1]] });
          }
          data.colliders.push({ id: "art_" + entry.actorId, center: entry.position, size: [.62, .44], angle: -entry.yaw });
          data.interactions.push({ id: "art_" + entry.actorId, actorId: entry.actorId, label: "观察" + entry.name,
            position: entry.observationPosition, roomId: entry.roomId, workLabel: resident.work?.label,
            description: entry.appearanceDescription + (live.current.living ? "" : " 这是人物造型样板，尚未接入居民的自主行动与案件。") });
        }
        model.traverse(obj => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true; obj.receiveShadow = true;
            for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
              if (mat instanceof THREE.MeshStandardMaterial) {
                if (mat.map) mat.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                if (mat.name === "glass") { mat.depthWrite = false; obj.castShadow = false; }
              }
            }
          }
        });
        scene.add(model);
        for (const item of manifest.lights) {
          const light = new THREE.PointLight(item.color, item.runtimeIntensity, item.distance, 2);
          light.position.set(item.position[0], item.position[2], -item.position[1]); scene.add(light);
        }
        const nav = createSampleNavigator(data);
        const overview = data.camera?.overview;
        const overviewFocus = overview ? new THREE.Vector3(overview.target[0], overview.target[2], -overview.target[1]) : new THREE.Vector3(1.1, 3.1, -.2);
        const overviewOffset = overview ? new THREE.Vector3(overview.offset[0], overview.offset[2], -overview.offset[1]) : new THREE.Vector3(15.9, 12.9, 24.2);
        if (overview) {
          key.target.position.set(overview.target[0], 0, -overview.target[1]);
          key.position.add(key.target.position); scene.add(key.target);
          Object.assign(key.shadow.camera, { left: -23, right: 23 }); key.shadow.camera.updateProjectionMatrix();
        }
        let position: Point = [...data.player.spawn], reset = live.current.reset, inside = false, roomId = "", nearId = "", lastUI = 0;
        let lastWorkRequest = live.current.workRequest?.serial ?? 0;
        let lastRestoreKey = "", lastPresence = "", bindingError = false;
        let motion: ReturnType<typeof createObservedMotionPlayback> | null = null, motionId = "", completedMotionId = "";
        const fixedColliders = data.colliders.filter(collider => !collider.id.startsWith("art_"));
        const actorInteractions = data.interactions.filter(item => item.actorId);
        live.current.onCastReady?.(actorInteractions);
        let lastPreviewRequest = live.current.previewRequest?.serial ?? 0;
        function stopPreview() {
          const resident = residents.find(r => r.entry.actorId === preview?.actorId);
          if (resident) { resident.character.reset(); resident.group.position.set(resident.entry.position[0], data.floor, -resident.entry.position[1]); resident.group.rotation.y = resident.entry.yaw; }
          preview?.stop(); live.current.onPreviewChange?.(null);
        }
        const cutawayLayers = [...new Set(nav.rooms.flatMap(room => room.cutawayLayers))];
        if (!nav.valid(position)) throw new Error("样板起点不可通行");
        const focus = overviewFocus.clone(), desired = new THREE.Vector3(), cameraOffset = new THREE.Vector3();
        camera.position.copy(focus).add(overviewOffset); camera.lookAt(focus);
        let vertical = Math.max(overview?.verticalSize ?? 17.4, (overview?.horizontalSize ?? 29) / aspect), previous = performance.now();
        const stats = { frames: 0, frameMs: [] as number[], calls: 0, triangles: 0, loaded: true, assetSha256: manifest.asset.sha256, sourceSha256: manifest.sourceSha256, renderer: "" };
        const gl = renderer.getContext(), debug = gl.getExtension("WEBGL_debug_renderer_info");
        stats.renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "not reported";
        const diagnostics = new URLSearchParams(location.search).get("diagnostics") === "1";
        if (diagnostics) Object.defineProperty(container, "sampleDiagnostics", { configurable: true, get: () => ({ ...stats, frameMs: [...stats.frameMs], preview: preview?.diagnostics(), position: [...position], inside, roomId, mode: live.current.mode, focusActorId: live.current.focusActorId ?? null, nearby: nearId, world: live.current.living ? { bindingRevision: live.current.living.view?.bindingRevision, worldRevision: live.current.living.view?.worldRevision, time: live.current.living.view?.time, sceneId: live.current.living.view?.sceneId } : null, motion: motion?.diagnostics() ?? null, completedMotionId, character: character!.diagnostics(), residents: residents.map(r => ({ actorId: r.entry.actorId, roomId: r.entry.roomId, position: [r.group.position.x, -r.group.position.z], yaw: r.group.rotation.y, visible: r.group.visible, authoritativeWorkId: r.boundWorkId, ...r.character.diagnostics() })), hiddenLayers: cutawayLayers.filter(name => !model!.getObjectByName("layer_" + name)?.visible), cutawayShadows: cutawayShadows.diagnostics(), ready: true }) });
        live.current.onReady();
        function tick(now: number) {
          if (disposed) return;
          frame = requestAnimationFrame(tick);
          const dt = Math.min((now - previous) / 1000, .045), frameMs = now - previous; previous = now;
          const settings = live.current;
          if (!settings.living?.motion) motion = null;
          else if (settings.living.motion.id !== motionId) {
            motionId = settings.living.motion.id;
            motion = createObservedMotionPlayback(data, residents.map(r => r.entry), settings.living.motion);
          }
          if (settings.living?.view && !validClassicLivingView(settings.living.view)) {
            if (!bindingError) settings.onError("这份日程与当前街区版本不一致，请重新连接。");
            bindingError = true;
          }
          if (settings.living?.restore && settings.living.restore.key !== lastRestoreKey) {
            lastRestoreKey = settings.living.restore.key;
            const binding = CLASSIC_LIVING_ACTORS.find(item => item.sceneId === settings.living!.restore!.sceneId);
            const place = residents.find(item => item.entry.actorId === binding?.actorId);
            const restored: Point = place ? [...place.entry.observationPosition] : [...data.player.spawn];
            if (nav.valid(restored)) { position = restored; actor.rotation.y = 0; character!.reset(); settings.onPositionRestored?.(lastRestoreKey, nav.roomAt(position)); }
            else { bindingError = true; settings.onError("上次停留的位置暂时无法恢复，请重新连接。"); }
          }
          if (settings.reset !== reset) {
            stopPreview();
            reset = settings.reset; position = [...data.player.spawn]; actor.rotation.y = 0; character!.reset();
            for (const resident of residents) resident.character.reset();
            lastWorkRequest = settings.workRequest?.serial ?? lastWorkRequest; settings.onWorkChange(null);
          }
          if (preview?.actorId && settings.focusActorId !== preview.actorId) stopPreview();
          if (preview && settings.previewRequest && settings.previewRequest.serial !== lastPreviewRequest) {
            lastPreviewRequest = settings.previewRequest.serial; stopPreview();
            const target = residents.find(r => r.entry.actorId === settings.previewRequest!.actorId);
            if (target && settings.focusActorId === target.entry.actorId) {
              target.character.reset(); preview.start(target.entry.actorId); settings.onWorkChange(null); settings.onPreviewChange?.(target.entry.actorId);
            }
          }
          if (settings.workRequest && settings.workRequest.serial !== lastWorkRequest) {
            stopPreview();
            lastWorkRequest = settings.workRequest.serial;
            const target = residents.find(r => r.entry.actorId === settings.workRequest!.actorId);
            if (target && settings.focusActorId === target.entry.actorId && target.character.startWork()) settings.onWorkChange(target.entry.actorId);
          }
          const keys = settings.keys.current;
          const horizontal = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
          const forward = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
          const old: Point = [...position];
          if (!settings.paused && !bindingError && (horizontal || forward)) {
            const norm = Math.hypot(horizontal, forward), ox = 9 / Math.hypot(9, 14), oy = 14 / Math.hypot(9, 14);
            const dx = (horizontal * oy - forward * ox) / norm * character!.playerSpeed * dt;
            const dy = (horizontal * ox + forward * oy) / norm * character!.playerSpeed * dt;
            position = nav.move(position, dx, dy);
            if (settings.living?.motion && classicWorldScene(nav.roomAt(position)?.id) !== settings.living.motion.sceneId) position = old;
          }
          const movement = Math.hypot(position[0] - old[0], position[1] - old[1]);
          actor.position.set(position[0], data.floor, -position[1]);
          if (movement > .0001) {
            const yaw = Math.atan2(position[0] - old[0], -(position[1] - old[1]));
            const delta = Math.atan2(Math.sin(yaw - actor.rotation.y), Math.cos(yaw - actor.rotation.y));
            actor.rotation.y += delta * (1 - Math.exp(-dt * 18));
          }
          character!.update(dt, movement);
          if (motion && !bindingError) {
            try {
              const done = motion.update(dt, position, residents.filter(r => r.group.visible).map(r => ({ actorId: r.entry.actorId, position: [r.group.position.x, -r.group.position.z] as Point })));
              if (done && completedMotionId !== motionId) { completedMotionId = motionId; settings.onMotionComplete?.(motionId); }
            } catch (error) { bindingError = true; settings.onError(error instanceof Error ? error.message : "居民行走未能继续，请重新连接。"); }
          }
          for (const resident of residents) {
            if (preview?.actorId === resident.entry.actorId) {
              try {
                const pose = preview.update(document.visibilityState === "visible" ? dt : 0)!;
                resident.group.position.set(pose.position[0], data.floor, -pose.position[1]); resident.group.rotation.y = pose.yaw;
                resident.character.sampleMotion(pose.clip, pose.seconds, dt);
                if (!preview.actorId) { resident.character.reset(); settings.onPreviewChange?.(null); }
              } catch (error) { stopPreview(); settings.onError(error instanceof Error ? error.message : "动线样板未能继续"); }
              continue;
            }
            if (settings.living) {
              const crossing = motion?.poses.get(resident.entry.actorId);
              if (crossing) {
                resident.group.visible = !bindingError && crossing.visible;
                resident.group.position.set(crossing.position[0], data.floor, -crossing.position[1]); resident.group.rotation.y = crossing.yaw;
                if (resident.boundWorkId || resident.character.workPlaying) resident.character.reset();
                resident.boundWorkId = null; resident.character.update(dt, crossing.frameDistance);
                continue;
              }
              const presence = classicResidentPresence(settings.living.view, resident.entry.actorId);
              resident.group.visible = !bindingError && !!presence && classicWorldScene(nav.roomAt(position)?.id) === presence.sceneId;
              const place = presence ? residentSceneAnchor(resident.entry, presence.sceneId) : resident.entry.position;
              if (place) resident.group.position.set(place[0], data.floor, -place[1]);
              resident.group.rotation.y = resident.entry.yaw;
              const item = actorInteractions.find(item => item.actorId === resident.entry.actorId)!;
              item.position = presence?.workplace ? resident.entry.observationPosition : place ?? resident.entry.position;
              item.roomId = presence ? nav.rooms.find(room => classicWorldScene(room.id) === presence.sceneId)?.id ?? null : null;
              const workId = resident.group.visible ? presence?.workingActionId ?? null : null;
              if (resident.boundWorkId !== workId) { resident.character.reset(); resident.boundWorkId = workId; }
              // A repeated clip expresses the committed activity. Its local
              // completion counter never advances the authoritative world.
              if (workId && !resident.character.workPlaying) resident.character.startWork();
              resident.character.update(resident.group.visible && !motion ? dt : 0, 0);
              continue;
            }
            const wasPlaying = resident.character.workPlaying;
            resident.character.update(settings.paused && !wasPlaying ? 0 : dt, 0);
            if (wasPlaying && !resident.character.workPlaying) settings.onWorkChange(null);
          }
          if (settings.living || preview) {
            const signature = residents.map(item => `${item.entry.actorId}:${item.group.visible}:${item.group.position.x}:${item.group.position.z}:${item.group.rotation.y}`).join("|");
            if (signature !== lastPresence) {
              lastPresence = signature;
              data.colliders = [...fixedColliders, ...residents.filter(item => item.group.visible).map(item => ({ id: "art_" + item.entry.actorId, center: [item.group.position.x, -item.group.position.z] as Point, size: [.62, .44] as Point, angle: -item.group.rotation.y }))];
            }
          }
          ring.position.set(position[0], data.floor + .036, -position[1]);
          const viewedResident = props.motionPreview ? residents.find(r => r.entry.actorId === settings.focusActorId) : undefined;
          const room = viewedResident ? nav.rooms.find(r => r.id === viewedResident.entry.roomId) ?? null : nav.roomAt(position);
          const nearby = nav.nearest(position, item => !settings.living || !item.actorId || (!motion && residents.some(resident => resident.entry.actorId === item.actorId && resident.group.visible)));
          if ((room?.id ?? "") !== roomId) {
            roomId = room?.id ?? ""; inside = !!room;
            for (const name of cutawayLayers) { const layer = model!.getObjectByName("layer_" + name); if (layer) layer.visible = !room?.cutawayLayers.includes(name); }
          }
          // Complete-shell shadowing is preserved separately from the visual
          // cutaway. Ambient and practical lights retain the indoor balance.
          hemisphere.intensity = THREE.MathUtils.damp(hemisphere.intensity, inside ? .48 : .85, 5, dt);
          key.intensity = THREE.MathUtils.damp(key.intensity, inside ? 1.45 : 3.0, 5, dt);
          fill.intensity = THREE.MathUtils.damp(fill.intensity, inside ? .24 : .40, 5, dt);
          scene.environmentIntensity = THREE.MathUtils.damp(scene.environmentIntensity, inside ? .18 : .24, 5, dt);
          if (now - lastUI > 120 || nearId !== (nearby?.id ?? "")) { lastUI = now; nearId = nearby?.id ?? ""; live.current.onChange(room, nearby); }
          const focusedResident = residents.find(r => r.entry.actorId === settings.focusActorId && r.group.visible);
          const stationWorkView = focusedResident?.entry.actorId === "resident-06" && !!focusedResident.character.work;
          const innWorkView = focusedResident?.entry.actorId === "resident-08" && !!focusedResident.character.work;
          actor.visible = !focusedResident;
          ring.visible = !focusedResident;
          if (focusedResident) {
            desired.copy(focusedResident.group.position).add(new THREE.Vector3(0, .97, 0));
            // Look over the ticket machine so the timetable and both hands
            // remain readable without hiding physical station furniture.
            if (stationWorkView) cameraOffset.set(.60, 2.15, 2.65);
            else if (innWorkView) cameraOffset.set(.72, 1.45, 2.70);
            else cameraOffset.set(1.0, .50, 3.5);
            cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), focusedResident.entry.yaw);
          }
          else if (settings.mode === "overview") { desired.copy(overviewFocus); cameraOffset.copy(overviewOffset); }
          else { desired.set(position[0], inside ? .82 : 1.0, -position[1]); cameraOffset.set(9, settings.mode === "detail" ? 8 : 13, 14); }
          focus.lerp(desired, 1 - Math.exp(-dt * 4));
          const targetVertical = focusedResident ? (preview?.actorId ? 3.7 : stationWorkView ? 2.55 : innWorkView ? 2.45 : 2.35) : settings.mode === "overview" ? Math.max(overview?.verticalSize ?? 17.4, (overview?.horizontalSize ?? 29) / aspect) : settings.mode === "detail" ? 6.4 : inside ? 8.1 : 9.8;
          vertical = THREE.MathUtils.damp(vertical, targetVertical, 5, dt);
          camera.position.lerp(focus.clone().add(cameraOffset), 1 - Math.exp(-dt * 4)); camera.lookAt(focus);
          camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2; camera.top = vertical / 2; camera.bottom = -vertical / 2; camera.updateProjectionMatrix();
          renderer.info.reset();
          cutawayShadows.update(cutawayLayers.flatMap(name => { const root = model!.getObjectByName("layer_" + name); return root ? [root] : []; }));
          composer.render();
          if (diagnostics && document.visibilityState === "visible") {
            stats.frames++; stats.frameMs.push(frameMs); if (stats.frameMs.length > 7200) stats.frameMs.shift();
            stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
          }
        }
        frame = requestAnimationFrame(tick);
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) live.current.onError(error instanceof Error ? error.message : "画面未能载入");
      }
    }
    void load();
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      delete (container as HTMLDivElement & { sampleDiagnostics?: unknown }).sampleDiagnostics;
      character?.dispose();
      for (const resident of residents) resident.character.dispose();
      if (model) disposeModel(model);
      ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); envTarget?.dispose(); key.shadow.map?.dispose(); cutawayShadows.dispose();
      renderPass.dispose(); aoPass.dispose(); outputPass.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div ref={host} data-classic-scene style={{ width: "100%", height: "100%" }} />;
}
