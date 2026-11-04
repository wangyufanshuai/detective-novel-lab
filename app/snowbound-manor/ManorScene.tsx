"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { createManorFire, type FireField } from "./ManorFire";
import { createManorWeather } from "./ManorWeather";
import { createSampleNavigator, type SampleContract, type SampleInteraction, type Point } from "../town-play/art-sample/sample-navigation";

export type ManorMode = "gate" | "hall" | "walk";
export type ManorQuality = "high" | "balanced";
type V3 = [number, number, number];
type Asset = { url: string; sha256: string; bytes: number };
type Fixture = { id: string; type: "POINT" | "AREA"; position: V3; sourceWatts: number; color: V3; size: number; target: V3 | null };
type Manifest = { sourceSha256: string; tiers: Record<ManorQuality, Asset>; navigation: Asset; fixtures: Fixture[];
  fire?: FireField; lightmap?: Asset & { intensity: number; flipY: boolean; channel: number } };
type Navigation = SampleContract & { allowedAssetSha256: string[]; runtimeGround: { exterior: number; porch: number; interior: number; porchBounds: [number, number, number, number] } };
interface Props {
  keys: RefObject<Set<string>>;
  mode: ManorMode;
  quality: ManorQuality;
  paused: boolean;
  weather: boolean;
  reset: number;
  onReady: () => void;
  onProgress: (label: string) => void;
  onError: (message: string) => void;
  onChange: (room: string, nearby: SampleInteraction | null) => void;
}

const world = (p: V3) => new THREE.Vector3(p[0], p[2], -p[1]);
const digest = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(obj => { if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
    geometries.add(obj.geometry); (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => materials.add(m));
  } });
  for (const m of materials) { for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); m.dispose(); }
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
}

export default function ManorScene(props: Props) {
  const host = useRef<HTMLDivElement>(null), live = useRef(props);
  const savedView = useRef<{ position: Point; yaw: number; pitch: number } | null>(null);
  useEffect(() => { live.current = props; }, [props]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const container: HTMLDivElement = element;
    const requestedArt = new URLSearchParams(location.search).get("art");
    const version = requestedArt === "v1" ? "v1" : requestedArt === "v3" ? "v3" : "v2";
    const storm = version === "v3";
    container.dataset.ready = "false";
    delete container.dataset.metrics;
    const abort = new AbortController();
    let disposed = false, frame = 0, loadedModel: THREE.Group | null = null;
    let hearth: ReturnType<typeof createManorFire> | null = null;
    let indirectTexture: THREE.DataTexture | null = null;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
    catch { live.current.onError("无法开启三维画面，请检查浏览器硬件加速后重试。"); return; }
    const high = props.quality === "high";
    renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.5 : 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(storm ? "#25364a" : "#516578");
    renderer.domElement.setAttribute("aria-label", "雪松山庄三维场景。步行查看时用 WASD 移动，拖动画面环顾，方向左右键转向。");
    renderer.domElement.setAttribute("tabindex", "0");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(storm ? "#455c72" : "#657b8e", storm ? 17 : 20, storm ? 82 : 95);
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, .07, 160);
    const hemisphere = new THREE.HemisphereLight("#adc7e0", "#51483d", .12); scene.add(hemisphere);
    const sky = new THREE.DirectionalLight("#b7d4f0", storm ? .18 : .28);
    sky.position.copy(world([-9, -8, 22])); sky.target.position.copy(world([0, 4, 0]));
    sky.castShadow = true; sky.shadow.mapSize.set(2048, 2048);
    Object.assign(sky.shadow.camera, { left: -26, right: 26, top: 24, bottom: -24, near: .5, far: 70 });
    sky.shadow.normalBias = .025; sky.shadow.bias = -.00008; scene.add(sky, sky.target);
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .05); scene.environment = environment.texture; scene.environmentIntensity = .035;
    room.dispose(); pmrem.dispose(); RectAreaLightUniformsLib.init();
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: high ? 4 : 2 });
    const composer = new EffectComposer(renderer, target), renderPass = new RenderPass(scene, camera), outputPass = new OutputPass();
    const ao = high ? new GTAOPass(scene, camera, 1, 1) : null;
    if (ao) { ao.updateGtaoMaterial({ radius: .45, distanceExponent: 2, thickness: .14, samples: 8 }); ao.updatePdMaterial({ samples: 8, radius: 4 }); ao.blendIntensity = .6; }
    if (ao) {
      const renderAO=ao.render.bind(ao);
      ao.render=(...args)=>{
        if(hearth)hearth.mesh.visible=false;
        const snowVisible=snow.visible;snow.visible=false;
        try { renderAO(...args); } finally { if(hearth)hearth.mesh.visible=true;snow.visible=snowVisible; }
      };
    }
    composer.addPass(renderPass); if (ao) composer.addPass(ao); composer.addPass(outputPass);
    renderer.info.autoReset = false;
    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
      ao?.setSize(Math.max(1, Math.round(w * renderer.getPixelRatio() * .7)), Math.max(1, Math.round(h * renderer.getPixelRatio() * .7)));
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let nav: ReturnType<typeof createSampleNavigator> | null = null, data: Navigation | null = null;
    let position: Point = [0, -7.8], yaw = 0, pitch = .05, mode: ManorMode | null = null, reset = props.reset;
    let drag: { id: number; x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      if (live.current.mode !== "walk" || live.current.paused || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture(event.pointerId); renderer.domElement.focus();
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      yaw += (event.clientX - drag.x) * .004; pitch = THREE.MathUtils.clamp(pitch - (event.clientY - drag.y) * .003, -.9, 1.15);
      drag.x = event.clientX; drag.y = event.clientY;
    };
    const up = () => { drag = null; };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointercancel", up);
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); live.current.onError("三维画面已中断，请重新载入场景。"); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const snowfall = createManorWeather(high, storm), snow = snowfall.points;
    scene.add(snow);
    let fire: THREE.PointLight | null = null, fireBase = 0;
    const fixtures: THREE.Light[] = [];
    const fixturesFrom = (items: Fixture[]) => {
      for (const item of items) {
        if (["storm_sky", "back_snow_sky"].includes(item.id)) continue;
        const color = new THREE.Color(...item.color);
        let light: THREE.Light;
        if (item.type === "AREA") {
          light = new THREE.RectAreaLight(color, item.sourceWatts * .03, item.size, item.id.includes("window") ? 2 : item.size);
          light.position.copy(world(item.position)); if (item.target) light.lookAt(world(item.target));
        } else {
          const point = new THREE.PointLight(color, item.sourceWatts * .12, item.id.includes("porch") ? 8 : 12, 2);
          light = point; point.position.copy(world(item.position));
          if (item.id === "chandelier7.1") {
            point.castShadow = true; point.shadow.mapSize.set(high ? 1024 : 512, high ? 1024 : 512);
            point.shadow.camera.near = .15; point.shadow.camera.far = 13; point.shadow.normalBias = .015; point.shadow.bias = -.0001;
          }
          if (item.id === "hearth_fire") { fire = point; fireBase = point.intensity; }
        }
        light.name = item.id; fixtures.push(light); scene.add(light);
      }
    };
    let loadStarted = performance.now(), loadedAt = 0, ticks = 0, last = performance.now(), lastNotice = 0, activeMs = 0;
    const durations: number[] = [];
    let lastNoticeKey = "";
    const render = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(render);
      const elapsed = now - last; last = now;
      if (!nav || !data || !loadedModel || document.hidden) return;
      const dt = Math.min(elapsed / 1000, .05), current = live.current;
      if (current.reset !== reset) { position = [...data.player.spawn]; yaw = 0; pitch = .05; reset = current.reset; }
      if (current.mode !== mode) {
        if (current.mode === "walk" && mode === "hall") { position = [4.1, 2.4]; yaw = -.55; pitch = .05; }
        mode = current.mode;
      }
      if (mode === "gate") {
        camera.fov = 31.4; camera.position.copy(world([-11, -25, 2])); camera.lookAt(world([0, 2, 4.1]));
      } else if (mode === "hall") {
        camera.fov = 44; camera.position.copy(world([5.15, 1.05, 2.05])); camera.lookAt(world([-.35, 7.2, 1.8]));
      } else {
        camera.fov = 60;
        if (!current.paused) {
          const k = current.keys.current;
          yaw += ((k.has("ArrowRight") ? 1 : 0) - (k.has("ArrowLeft") ? 1 : 0)) * dt * 1.3;
          const forward = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
          const side = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0), length = Math.hypot(forward, side) || 1;
          const speed = data.player.speed * dt / length;
          position = nav.move(position, (Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed, (Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed);
        }
        const ground = position[1] > .16 ? data.floor : position[1] > -4.9 && Math.abs(position[0]) < 2.25 ? THREE.MathUtils.lerp(.04, .30, Math.min(1, (position[1] + 4.9) / 1.2)) : .04;
        camera.position.copy(world([position[0], position[1], ground + 1.64]));
        camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))));
      }
      camera.updateProjectionMatrix();
      const indoors = mode === "hall" || mode === "walk" && nav.indoors(position);
      hemisphere.intensity = indoors ? .06 : storm ? .075 : .12;
      scene.environmentIntensity = indoors ? .035 : storm ? .05 : .07;
      snow.visible = current.weather;
      if (!current.paused && current.weather) {
        snowfall.update(dt, now / 1000, renderer.domElement.height);
      }
      if (fire) fire.intensity = fireBase * (current.weather && !current.paused ? 1 + .035 * Math.sin(now * .005) + .02 * Math.sin(now * .013) : 1);
      hearth?.update(camera,dt,current.weather && !current.paused);
      renderer.info.reset(); composer.render(); ticks++;
      if (ticks === 3) {
        // Architecture, furniture and shadow-casting fixtures are static in this sample.
        renderer.shadowMap.autoUpdate = false;
        loadedAt = now; container.dataset.ready = "true"; live.current.onReady();
      }
      if (ticks > 30 && !current.paused) { durations.push(elapsed); if (durations.length > 600) durations.shift(); activeMs += elapsed; }
      if (now - lastNotice > 250) {
        const nearby = mode === "walk" ? nav.nearest(position) : null, roomName = indoors ? "壁炉大厅" : "山庄门前";
        const key = roomName + (nearby?.id ?? ""); if (key !== lastNoticeKey) { lastNoticeKey = key; current.onChange(roomName, nearby); }
        container.dataset.position = JSON.stringify(position); container.dataset.mode = mode; container.dataset.room = indoors ? "hall" : "exterior";
        container.dataset.metrics = JSON.stringify({ frames: ticks, activeMs, sampledFrames: durations.length, meanFrameMs: durations.reduce((a,b) => a+b,0) / Math.max(1,durations.length), p95FrameMs: [...durations].sort((a,b) => a-b)[Math.floor(durations.length * .95)] ?? null, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), quality: current.quality, loadMs: loadedAt ? loadedAt - loadStarted : null });
        lastNotice = now;
      }
    };
    async function load() {
      try {
        live.current.onProgress("正在打开山庄…");
        const response = await fetch(`/assets/snowbound-manor/${version}/manifest.json`, { signal: abort.signal });
        if (!response.ok) throw new Error("山庄资源目录暂时不可用。");
        const manifest: Manifest = await response.json(), asset = manifest.tiers[props.quality];
        const files = await Promise.all([asset.url, manifest.navigation.url].map(async url => {
          const r = await fetch(url, { signal: abort.signal }); if (!r.ok) throw new Error("部分场景资源未能载入。"); return r.arrayBuffer();
        }));
        if (await digest(files[0]) !== asset.sha256 || await digest(files[1]) !== manifest.navigation.sha256) throw new Error("场景文件与通行数据不一致，请重新载入。");
        data = JSON.parse(new TextDecoder().decode(files[1]));
        if (!data || data.sourceSha256 !== manifest.sourceSha256 || !data.allowedAssetSha256.includes(asset.sha256)) throw new Error("场景版本校验失败。");
        nav = createSampleNavigator(data); position = [...(savedView.current?.position ?? data.player.spawn)];
        yaw = savedView.current?.yaw ?? 0; pitch = savedView.current?.pitch ?? .05;
        if (!nav.valid(position)) throw new Error("入口位置不可通行。");
        live.current.onProgress("正在点亮壁炉与门灯…");
        const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(files[0], `/assets/snowbound-manor/${version}/`);
        if (disposed) { disposeTree(gltf.scene); return; }
        loadedModel = gltf.scene;
        let indirect: THREE.DataTexture | null=null;
        for(const extra of [manifest.lightmap,manifest.fire]) {
          if(!extra)continue;
          const r=await fetch(extra.url,{signal:abort.signal});if(!r.ok)throw new Error("光照资源未能载入。");
          const bytes=await r.arrayBuffer();if(await digest(bytes)!==extra.sha256)throw new Error("光照资源版本不一致。");
          if(disposed){disposeTree(gltf.scene);return;}
          if(extra===manifest.lightmap){
            const parsed=new EXRLoader().parse(bytes);
            indirect=new THREE.DataTexture(parsed.data,parsed.width,parsed.height,parsed.format,parsed.type);
            indirectTexture=indirect;
            indirect.colorSpace=THREE.LinearSRGBColorSpace;indirect.flipY=manifest.lightmap.flipY;indirect.channel=manifest.lightmap.channel;
            indirect.minFilter=THREE.LinearMipmapLinearFilter;indirect.magFilter=THREE.LinearFilter;indirect.generateMipmaps=true;indirect.needsUpdate=true;
          } else if(manifest.fire) {hearth=createManorFire(manifest.fire,bytes,high);scene.add(hearth.mesh);}
        }
        loadedModel.traverse(obj => { if (obj instanceof THREE.Mesh) {
          obj.castShadow = !obj.name.toLowerCase().includes("chandelier"); obj.receiveShadow = true;
          for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
            if (material instanceof THREE.MeshStandardMaterial) {
              if(indirect && material.name.endsWith("_baked")){
                if(!obj.geometry.hasAttribute("uv1"))throw new Error("室内光照坐标缺失。");
                material.lightMap=indirect;material.lightMapIntensity=manifest.lightmap?.intensity??Math.PI;
              }
              if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
              if (["glass","flame_sheet","lamp","warm_window"].includes(material.name)) obj.castShadow = false;
              // These windows are thin panes. Screen-space refraction obscures
              // the authored room backing at this scale; use transparent glazing.
              if (material.name === "glass" && material instanceof THREE.MeshPhysicalMaterial) {
                material.transmission = 0; material.transparent = true;
                material.opacity = .17; material.depthWrite = false; material.roughness = .12;
              }
            }
          }
        } });
        scene.add(loadedModel); fixturesFrom(manifest.fixtures);
        container.dataset.sourceSha = manifest.sourceSha256; container.dataset.assetSha = asset.sha256;
        container.dataset.lightmap=String(Boolean(indirect));container.dataset.volumeFire=String(Boolean(hearth));
        const debug = renderer.getContext().getExtension("WEBGL_debug_renderer_info");
        if (debug) container.dataset.renderer = String(renderer.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL));
        await renderer.compileAsync(scene, camera);
        if (disposed) return;
        last = performance.now(); frame = requestAnimationFrame(render);
      } catch (error) { if (!disposed && !abort.signal.aborted) live.current.onError(error instanceof Error ? error.message : "场景未能打开。"); }
    }
    void load();
    return () => {
      savedView.current = { position: [...position], yaw, pitch };
      disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointercancel", up); renderer.domElement.removeEventListener("webglcontextlost", lost);
      fixtures.forEach(light => { if (light instanceof THREE.PointLight) light.shadow.dispose(); }); sky.shadow.dispose();
      hearth?.texture.dispose();
      indirectTexture?.dispose();
      if(loadedModel && !loadedModel.parent)disposeTree(loadedModel);
      disposeTree(scene); environment.dispose(); ao?.dispose(); outputPass.dispose(); composer.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.quality]);
  return <div ref={host} data-manor-scene="true" data-ready="false" style={{ position: "absolute", inset: 0, touchAction: "none" }} />;
}
