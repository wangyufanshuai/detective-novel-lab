"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createTownNavigator, type TownDestination, type TownNavigationData, type TownPoint } from "@/lib/riverbend-navigation";
import { batchTownResidents } from "./resident-batching";
import { createRefreshCadence } from "./frame-cadence";
import { createResidentMotion, RESIDENT_RADIUS } from "./resident-motion";
import { chooseTownInteraction, type TownInteraction } from "./town-interaction";
import { createResidentEncounter } from "./resident-encounter";
import type { TownPlayView } from "@/lib/town-play-contract";

export interface TownSnapshot {
  position: TownPoint;
  nearby: TownDestination | null;
  interaction: TownInteraction | null;
  moving: boolean;
  areaId: string;
}
export interface TownSceneControls { capture: () => string | null }
interface Props {
  keys: RefObject<Set<string>>;
  overview: boolean;
  paused: boolean;
  conversationActorId: string | null;
  lantern: boolean;
  quality: "high" | "balanced";
  waypoint: TownPoint | null;
  worldView: TownPlayView | null;
  restore: { key: string; sceneId: string } | null;
  onReady: (destinations: TownDestination[], controls: TownSceneControls) => void;
  onUpdate: (snapshot: TownSnapshot) => void;
  onError: (message: string) => void;
}

export default function TownScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  useEffect(() => { live.current = props; }, [props]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let stopped = false, frame = 0;
    const abort = new AbortController();
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { live.current.onError("浏览器未能开启三维画面，请启用硬件加速后重试。"); return; }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor("#abbac0");
    renderer.domElement.setAttribute("aria-label", "河湾小镇三维场景");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#abbac0", 105, 175);
    const camera = new THREE.OrthographicCamera(-20, 20, 11, -11, .1, 240);
    const hemisphere = new THREE.HemisphereLight("#e2edf4", "#b4a17e", 1.65);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight("#fff0cd", 3.0);
    sun.position.set(-25, 42, 35);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 48, bottom: -48, near: .5, far: 135 });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -.0002;
    sun.shadow.normalBias = .04;
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#dce8f7", .65);
    fill.position.set(10, 20, -30);
    scene.add(fill);
    const lamp = new THREE.PointLight("#ffce7a", 0, 7, 2);
    scene.add(lamp);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.40, .46, 40), new THREE.MeshBasicMaterial({ color: "#f5cf79", side: THREE.DoubleSide, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 5;
    scene.add(ring);
    const marker = new THREE.Mesh(new THREE.RingGeometry(.62, .74, 40), new THREE.MeshBasicMaterial({ color: "#dcaf5a", side: THREE.DoubleSide, depthTest: false }));
    marker.rotation.x = -Math.PI / 2; marker.renderOrder = 4; marker.visible = false;
    scene.add(marker);
    const contactRing = new THREE.Mesh(new THREE.RingGeometry(.65, .69, 40), new THREE.MeshBasicMaterial({ color: "#ebc980", side: THREE.DoubleSide, depthTest: false }));
    contactRing.rotation.x = -Math.PI / 2; contactRing.renderOrder = 4; contactRing.visible = false;
    scene.add(contactRing);
    let aspect = 16 / 9, quality = "";
    const resize = () => {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      aspect = width / height;
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container); resize();
    const lost = (event: Event) => {
      event.preventDefault();
      stopped = true; cancelAnimationFrame(frame);
      live.current.onError("画面暂时中断，请重新载入小镇。你的手记仍保存在本机。");
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    let model: THREE.Group | null = null;
    let residents: ReturnType<typeof batchTownResidents> | null = null;
    const query = new URLSearchParams(location.search);
    const diagnostics = query.get("diagnostics") === "1";

    async function load() {
      try {
        const [manifestResponse, residentManifestResponse] = await Promise.all([
          fetch("/assets/riverbend/v1/manifest.json", { signal: abort.signal }),
          fetch("/assets/riverbend/residents-v2/manifest.json", { signal: abort.signal })
        ]);
        if (!manifestResponse.ok || !residentManifestResponse.ok) throw new Error("场景目录未能载入");
        const manifest = await manifestResponse.json();
        const residentManifest = await residentManifestResponse.json();
        if (residentManifest.baseAssetSha256 !== manifest.asset.sha256 || residentManifest.collisionRadius !== RESIDENT_RADIUS) throw new Error("居民与街区版本不一致，请重新载入。");
        const [navResponse, assetResponse, residentResponse] = await Promise.all([
          fetch(manifest.navigation.url, { signal: abort.signal }),
          fetch(manifest.asset.url, { signal: abort.signal }),
          fetch(residentManifest.asset.url, { signal: abort.signal })
        ]);
        if (!navResponse.ok || !assetResponse.ok || !residentResponse.ok) throw new Error("小镇资源未能载入");
        const navBytes = await navResponse.arrayBuffer(), asset = await assetResponse.arrayBuffer(), residentAsset = await residentResponse.arrayBuffer();
        const digest = async (bytes: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("");
        if (await digest(asset) !== manifest.asset.sha256 || await digest(navBytes) !== manifest.navigation.sha256) throw new Error("场景与通行数据版本不一致，请重新载入。");
        if (await digest(residentAsset) !== residentManifest.asset.sha256) throw new Error("居民资源校验未通过，请重新载入。");
        const data: TownNavigationData = JSON.parse(new TextDecoder().decode(navBytes));
        if (data.assetSha256 !== manifest.asset.sha256 || data.sourceSha256 !== manifest.sourceSha256) throw new Error("场景版本不一致");
        const gltf = await new GLTFLoader().parseAsync(asset, "/assets/riverbend/v1/");
        if (stopped) { disposeModel(gltf.scene); return; }
        model = gltf.scene;
        const cast = await new GLTFLoader().parseAsync(residentAsset, "/assets/riverbend/residents-v2/");
        if (stopped) { disposeModel(cast.scene); return; }
        // Keep old geometry only for normal disposal. It has no visible or
        // batchable resident identity once the verified companion cast is loaded.
        for (let index = 1; index <= 12; index++) {
          const name = `actor_resident-${String(index).padStart(2, "0")}`;
          const legacy = model.getObjectByName(name);
          if (legacy) { legacy.name = "legacy_" + name; legacy.visible = false; delete legacy.userData.actorId; }
          if (!cast.scene.getObjectByName(name)) { disposeModel(cast.scene); throw new Error("居民模型不完整，请重新载入。"); }
        }
        model.add(cast.scene);
        model.traverse(object => {
          if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
        });
        scene.add(model);
        const multiDraw = renderer.extensions.has("WEBGL_multi_draw");
        if (multiDraw && !(diagnostics && query.get("residentBatch") === "off")) residents = batchTownResidents(model);
        const player = model.getObjectByName("actor_player");
        if (!player) throw new Error("未找到可操控角色");
        const people = new Map<string, THREE.Object3D>();
        for (let index = 1; index <= 12; index++) {
          const id = `resident-${String(index).padStart(2, "0")}`;
          const actor = model.getObjectByName(`actor_${id}`);
          if (actor) { people.set(id, actor); actor.visible = false; }
        }
        const limbs = ["leg_left", "leg_right", "arm_left", "arm_right"].map(name => model?.getObjectByName("player_" + name));
        const rest = limbs.map(limb => limb?.rotation.clone());
        const nav = createTownNavigator(data);
        const motion = createResidentMotion(people, data);
        const encounter = createResidentEncounter(people);
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
        let position: TownPoint = [...data.player.spawn];
        let areaId = "town-square", restoredKey = "", shownView: TownPlayView | null = null;
        if (!nav.valid(...position)) throw new Error("角色起点不能通行");
        const focus = new THREE.Vector3(position[0], .8, -position[1]);
        const desiredFocus = focus.clone(), desiredCamera = new THREE.Vector3();
        const offset = new THREE.Vector3(12, 27, 23);
        camera.position.copy(focus).add(offset); camera.lookAt(focus);
        const right = new THREE.Vector2(23, 12).normalize();
        const forward = new THREE.Vector2(-12, 23).normalize();
        let previous = performance.now(), lastRender = previous, lastUpdate = 0, phase = 0, verticalSize = 22, viewShift = 0;
        const cadence = createRefreshCadence();
        const stats = { frames: 0, frameMs: [] as number[], drawCalls: 0, triangles: 0, renderer: "", assetSha256: manifest.asset.sha256, residentAssetSha256: residentManifest.asset.sha256 };
        const samples: { frame: number; at: number; frameMs: number; cpuSubmitMs: number; drawCalls: number; triangles: number; moving: boolean; overview: boolean; quality: string; visibility: string }[] = [];
        const gl = renderer.getContext();
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        stats.renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : "WebGL renderer unavailable";
        let interaction: TownInteraction | null = null;
        function screenBounds(actor: THREE.Object3D, height: number) {
          const projected = [];
          for (const x of [-.63, .63]) for (const y of [0, height]) for (const z of [-.63, .63]) {
            const point = actor.position.clone().add(new THREE.Vector3(x, y, z)).project(camera);
            projected.push({ x: (point.x + 1) * container!.clientWidth / 2, y: (1 - point.y) * container!.clientHeight / 2 });
          }
          return { left: Math.min(...projected.map(p => p.x)), right: Math.max(...projected.map(p => p.x)), top: Math.min(...projected.map(p => p.y)), bottom: Math.max(...projected.map(p => p.y)) };
        }
        // Read-only diagnostics are opt-in; no player position or engine mutation hook is exposed.
        if (diagnostics) {
          Object.defineProperty(container, "townDiagnostics", { configurable: true, get: () => ({ ...stats, get frameMs() { return [...stats.frameMs]; }, get samples() { return samples.map(sample => ({ ...sample })); }, visibleResidents: [...people].filter(([, actor]) => actor.visible).map(([actorId, actor]) => ({ actorId, position: actor.position.toArray(), screenBounds: screenBounds(actor, 1.91) })), residentMotion: motion.snapshot(), interaction, playerScreenBounds: screenBounds(player!, 1.72), conversationActorId: live.current.conversationActorId, cadence: cadence.snapshot(), timeOrigin: performance.timeOrigin, position: [...position], areaId, sourceSha256: manifest.sourceSha256, multiDraw, batching: residents ? { actors: residents.actorCount, meshes: residents.sourceMeshCount, batches: residents.batchCount } : null }) });
        }
        live.current.onReady(data.destinations, {
          capture: () => {
            if (stopped) return null;
            renderer.render(scene, camera);
            return renderer.domElement.toDataURL("image/png");
          }
        });
        function tick(now: number) {
          if (stopped) return;
          frame = requestAnimationFrame(tick);
          const settings = live.current;
          if (settings.restore && settings.restore.key !== restoredKey) {
            const saved = settings.restore.sceneId === "town-square" ? data.player.spawn : data.destinations.find(place => place.id === settings.restore!.sceneId)?.entrance;
            if (!saved || !nav.valid(...saved)) { live.current.onError("上次到访的位置与这版街区不匹配，原手记已保留。"); stopped = true; return; }
            position = [...saved]; areaId = settings.restore.sceneId; restoredKey = settings.restore.key;
          }
          if (shownView !== settings.worldView) {
            shownView = settings.worldView;
            if (shownView && shownView.assetSha256 !== manifest.asset.sha256) { live.current.onError("手记与小镇模型版本不一致，原记录已保留。"); stopped = true; return; }
            motion.reconcile(shownView?.residents ?? [], position);
          }
          if (!cadence.shouldRender(now, settings.quality)) return;
          const cpuStart = diagnostics ? performance.now() : 0;
          const delta = Math.min((now - previous) / 1000, .05);
          previous = now;
          if (quality !== settings.quality) {
            quality = settings.quality;
            renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === "high" ? 1.5 : 1));
            resize();
          }
          const keys = settings.keys.current;
          const horizontal = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
          const vertical = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
          const direction = right.clone().multiplyScalar(horizontal).addScaledVector(forward, vertical);
          if (direction.lengthSq() > 0) direction.normalize();
          const speed = settings.paused || settings.overview ? 0 : data.player.speed;
          const next = motion.constrainPlayer(position, nav.move(position, direction.x * speed * delta, direction.y * speed * delta));
          const moving = Math.hypot(next[0] - position[0], next[1] - position[1]) > .001;
          position = next;
          const closest = data.destinations.map(place => ({ place, distance: Math.hypot(place.entrance[0] - position[0], place.entrance[1] - position[1]) })).sort((a, b) => a.distance - b.distance)[0];
          const currentArea = data.destinations.find(place => place.id === areaId);
          const currentDistance = currentArea ? Math.hypot(currentArea.entrance[0] - position[0], currentArea.entrance[1] - position[1]) : Infinity;
          if (closest && closest.distance < 5 && (areaId === "town-square" || closest.distance + 2 < currentDistance)) areaId = closest.place.id;
          else if (currentDistance > 8 && (!closest || closest.distance > 5)) areaId = "town-square";
          const groundHeight = nav.height(position) - .04;
          player!.position.set(position[0], groundHeight, -position[1]);
          if (moving) {
            player!.rotation.y = Math.atan2(direction.x, -direction.y);
            phase += delta * 9.5;
          }
          for (let i = 0; i < limbs.length; i++) {
            const limb = limbs[i], base = rest[i];
            if (!limb || !base) continue;
            limb.rotation.copy(base);
            limb.rotation.x += moving ? Math.sin(phase + (i % 2 ? Math.PI : 0)) * (i < 2 ? .36 : -.28) : 0;
          }
          player!.position.y += moving ? Math.abs(Math.sin(phase)) * .025 : 0;
          ring.position.set(position[0], groundHeight + .065, -position[1]);
          lamp.position.set(position[0], 2, -position[1]); lamp.intensity = settings.lantern ? 16 : 0;
          marker.visible = !!settings.waypoint;
          if (settings.waypoint) marker.position.set(settings.waypoint[0], nav.height(settings.waypoint) + .025, -settings.waypoint[1]);
          const conversationActor = settings.conversationActorId ? people.get(settings.conversationActorId) : null;
          const talking = !!conversationActor?.visible;
          desiredFocus.set(settings.overview ? 0 : talking ? (position[0] + conversationActor!.position.x) / 2 : position[0], .8, settings.overview ? -1 : talking ? (-position[1] + conversationActor!.position.z) / 2 : -position[1]);
          const follow = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 5);
          focus.lerp(desiredFocus, follow);
          desiredCamera.copy(focus).add(offset);
          camera.position.copy(desiredCamera); camera.lookAt(focus);
          const targetSize = settings.overview ? Math.max(70, 92 / aspect) : talking ? Math.max(13, 9 / aspect) : Math.max(22, 26 / aspect);
          verticalSize = THREE.MathUtils.lerp(verticalSize, targetSize, follow);
          camera.left = -verticalSize * aspect / 2; camera.right = -camera.left;
          camera.top = verticalSize / 2; camera.bottom = -camera.top;
          // Short landscape screens need a higher conversation frame so the
          // half-height speech panel leaves both characters' feet visible.
          const conversationShift = container!.clientHeight <= 560 ? .25 : container!.clientWidth <= 720 ? .18 : .13;
          const targetShift = talking && !settings.overview ? conversationShift : settings.overview && container!.clientWidth <= 1100 && container!.clientHeight > 560 ? .10 : 0;
          viewShift = THREE.MathUtils.lerp(viewShift, targetShift, follow);
          if (Math.abs(viewShift) > .0001) camera.setViewOffset(container!.clientWidth, container!.clientHeight, 0, container!.clientHeight * viewShift, container!.clientWidth, container!.clientHeight);
          else camera.clearViewOffset();
          camera.updateProjectionMatrix();
          motion.update(delta, position, settings.paused || settings.overview, reducedMotion.matches);
          encounter.update(settings.conversationActorId, position, delta, reducedMotion.matches);
          if (talking) player!.rotation.y = Math.atan2(conversationActor!.position.x - position[0], conversationActor!.position.z + position[1]);
          if (now - lastUpdate > 100) {
            const actorPositions = new Map<string, TownPoint>([...people].filter(([, actor]) => actor.visible).map(([id, actor]) => [id, [actor.position.x, -actor.position.z]]));
            interaction = chooseTownInteraction({ position, sceneId: areaId, confirmedSceneId: settings.worldView?.sceneId ?? null, residents: settings.worldView?.residents ?? [], actorPositions, nearby: nav.nearest(position), valid: nav.valid });
          }
          const highlighted = talking ? conversationActor : !settings.paused && !settings.overview && interaction?.kind === "resident" ? people.get(interaction.person.actorId) : null;
          contactRing.visible = !!highlighted?.visible;
          if (highlighted?.visible) contactRing.position.set(highlighted.position.x, highlighted.position.y + .07, highlighted.position.z);
          residents?.sync();
          renderer.render(scene, camera);
          const duration = now - lastRender; lastRender = now;
          stats.frames++; stats.drawCalls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
          if (stats.frames > 30) { stats.frameMs.push(duration); if (stats.frameMs.length > 600) stats.frameMs.shift(); }
          if (diagnostics) {
            // CPU submission timing excludes asynchronous GPU completion. Keep
            // exact frame intervals (including stalls), with no outlier filter.
            samples.push({ frame: stats.frames, at: now, frameMs: duration, cpuSubmitMs: performance.now() - cpuStart, drawCalls: stats.drawCalls, triangles: stats.triangles, moving, overview: settings.overview, quality, visibility: document.visibilityState });
            if (samples.length > 3600) samples.shift();
          }
          if (now - lastUpdate > 100) {
            lastUpdate = now;
            live.current.onUpdate({ position: [...position], nearby: nav.nearest(position), interaction, moving, areaId });
          }
        }
        frame = requestAnimationFrame(tick);
      } catch (error) {
        if (!stopped && !abort.signal.aborted) live.current.onError(error instanceof Error ? error.message : "小镇未能载入");
      }
    }
    void load();
    return () => {
      stopped = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      residents?.dispose();
      if (model) disposeModel(model);
      ring.geometry.dispose(); ring.material.dispose(); marker.geometry.dispose(); marker.material.dispose();
      contactRing.geometry.dispose(); contactRing.material.dispose();
      sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} data-town-scene style={{ position: "absolute", inset: 0 }} />;
}

function disposeModel(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  materials.forEach(material => material.dispose());
}
