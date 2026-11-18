"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TownCaseAction, TownPlayView } from "@/lib/town-play-contract";
import { assignTargets, type RoomBox, type RoomDef } from "./interior-rooms";
import { clockHours, easeGrade, gradeAt } from "./town-lighting";
import { weatherAt, weatherGrade, type Weather } from "./town-weather";
import type { TownContact } from "./town-interaction";
import { townSound } from "./town-sound";
import styles from "./town-play.module.css";

type Props = {
  room: RoomDef;
  view: TownPlayView;
  /** A dialog is open over the room: stop walking, keep drawing. */
  paused: boolean;
  busy: boolean;
  message: string;
  command: (action: TownCaseAction) => Promise<boolean>;
  onTalk: (person: TownContact) => void;
  onOpenBook: () => void;
  onExit: () => void;
  /** Book a room for the night (the inn's stairs). */
  onRest?: () => void;
  resting?: boolean;
  /** One line about the place, shown on the card. */
  blurb?: string;
};
type Item =
  | { id: string; kind: "spot"; name: string; at: [number, number]; spotId: string; targets: Array<{ id: string; label: string; found: boolean }>; desk: boolean; rest: boolean; idle: string }
  | { id: string; kind: "person"; name: string; at: [number, number]; person: TownContact }
  | { id: string; kind: "door"; name: string; at: [number, number] };
type Slip = { title: string; text: string; tone: "found" | "note" | "refuse" };

const REACH = 1.35, RADIUS = .3, SPEED = 2.6;
const CAMERA = new THREE.Vector3(9, 10.5, 11);
const COATS = ["#3f5868", "#7d3b2c", "#596d51", "#b78a3e", "#5b4a6e", "#a56e3e", "#2f4835", "#8f4a32"];

function figure(coat: string, accent = "#e8dcc0") {
  const g = new THREE.Group();
  const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  const part = (geo: THREE.BufferGeometry, color: string, y: number, x = 0) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, 0); m.castShadow = true; g.add(m); return m; };
  const legL = part(new THREE.BoxGeometry(.16, .78, .2), "#3a3430", .39, -.11), legR = part(new THREE.BoxGeometry(.16, .78, .2), "#3a3430", .39, .11);
  legL.geometry.translate(0, -.39, 0); legL.position.y = .78; legR.geometry.translate(0, -.39, 0); legR.position.y = .78;
  part(new THREE.BoxGeometry(.5, .72, .3), coat, 1.12);
  part(new THREE.BoxGeometry(.3, .12, .31), accent, 1.42);
  const armL = part(new THREE.BoxGeometry(.13, .62, .16), coat, 1.12, -.32), armR = part(new THREE.BoxGeometry(.13, .62, .16), coat, 1.12, .32);
  armL.geometry.translate(0, -.28, 0); armL.position.y = 1.42; armR.geometry.translate(0, -.28, 0); armR.position.y = 1.42;
  part(new THREE.SphereGeometry(.17, 16, 12), "#e2b58f", 1.66);
  const hair = part(new THREE.SphereGeometry(.18, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), "#3b2a20", 1.69);
  hair.rotation.x = -.15;
  g.userData.limbs = [legL, legR, armL, armR];
  return g;
}

/** Inside a place. Walk with the same keys; E examines what is in reach. */
export function TownInterior(props: Props) {
  const { room, view } = props;
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const nearRef = useRef<Item | null>(null);
  const live = useRef(props);
  useEffect(() => { live.current = props; }, [props]);
  const [near, setNear] = useState<Item | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => { setTouch(window.matchMedia("(pointer: coarse)").matches); }, []);

  const c = view.investigation;
  const commissionHere = !!view.commission && view.commission.openAt.includes(room.sceneId) && (!c || c.solved);
  const items: Item[] = useMemo(() => {
    const targets = c && !c.solved ? assignTargets(room, c.searchTargets) : new Map();
    const people = view.residents.filter(p => p.visibility === "observed" && p.sceneId === room.sceneId);
    return [
      ...room.spots.map(s => ({ id: `spot-${s.id}`, kind: "spot" as const, name: s.name, at: s.stand, spotId: s.id, targets: targets.get(s.id) ?? [], desk: !!s.desk, rest: !!s.rest, idle: s.idle })),
      ...people.map((p, i) => ({ id: `person-${p.actorId}`, kind: "person" as const, name: p.name, at: room.standing[i % room.standing.length], person: { actorId: p.actorId, npcId: p.npcId, name: p.name, role: p.role, sceneId: room.sceneId } })),
      { id: "door", kind: "door" as const, name: "门口", at: room.door }
    ];
  }, [room, c, view.residents]);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // A search that succeeds shows the clue it added; diff the clue list to find it.
  const pendingSearch = useRef<{ before: Set<string>; label: string } | null>(null);
  useEffect(() => {
    const pending = pendingSearch.current;
    if (!pending || !c) return;
    const added = c.clues.find(e => !pending.before.has(e.id));
    if (!added) return;
    pendingSearch.current = null;
    setSlip({ title: added.title, text: added.description, tone: "found" });
  }, [c]);

  const act = useCallback(async (item: Item | null) => {
    const p = live.current;
    if (!item || p.busy) return;
    if (item.kind === "door") { p.onExit(); return; }
    if (item.kind === "person") { p.onTalk(item.person); return; }
    if (item.rest) {
      if (p.view.rest?.open && p.onRest) { setSlip(null); p.onRest(); return; }
      setSlip({ title: item.name, text: `${item.idle}${p.view.rest && !p.view.rest.open ? p.view.rest.reason : ""}`, tone: "note" });
      return;
    }
    const vc = p.view.investigation;
    if (item.desk && p.view.commission && p.view.commission.openAt.includes(room.sceneId) && (!vc || vc.solved)) {
      const hook = p.view.commission.hook;
      if (await p.command({ kind: "case-open" })) setSlip({ title: "领取了调查手记", text: `${hook}。案件本已经打开，按 K 随时翻看。`, tone: "found" });
      else { townSound().play("refuse"); setSlip({ title: "暂时不能领取", text: live.current.message || "稍后再试。", tone: "refuse" }); }
      return;
    }
    const open = item.targets.find(t => !t.found);
    if (open && vc && !vc.solved) {
      pendingSearch.current = { before: new Set(vc.clues.map(e => e.id)), label: open.label };
      if (!await p.command({ kind: "case-search", targetId: open.id })) {
        pendingSearch.current = null;
        townSound().play("refuse");
        setSlip({ title: open.label, text: live.current.message || "现在还不能核对这里。", tone: "refuse" });
      }
      return;
    }
    if (item.targets.length) { setSlip({ title: item.name, text: `这里已经核对过：${item.targets.map(t => t.label).join("、")}。`, tone: "note" }); return; }
    setSlip({ title: item.name, text: item.idle, tone: "note" });
  }, [room.sceneId]);

  // Keys: the room listens only while no dialog is open over it.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (live.current.paused || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.matches("input, textarea, select")) return;
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) { e.preventDefault(); keys.current.add(key); setSlip(null); return; }
      if (e.repeat) return;
      if (key === "e") { e.preventDefault(); void act(nearRef.current); }
      if (key === "k" && live.current.view.investigation) { e.preventDefault(); live.current.onOpenBook(); }
      if (key === "escape") { e.preventDefault(); if (slip) setSlip(null); else live.current.onExit(); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, [act, slip]);

  // The room itself: one renderer for the visit, disposed on exit.
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setClearColor("#1f2b2e");
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", `${room.title}室内`);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 80);
    const hoursNow = () => clockHours(live.current.view.time);
    const weatherNow = (out?: Weather) => weatherAt(live.current.view.day, hoursNow(), out);
    const grade = weatherGrade(gradeAt(hoursNow()), weatherNow()), target = gradeAt(hoursNow()), w: Weather = weatherNow();
    const hemisphere = new THREE.HemisphereLight("#fff1d6", "#5e4c3a", 1.35);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(grade.sun, .6 + grade.sunI * .5);
    sun.position.set(3, 7, -9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    scene.add(sun);
    const pendant = new THREE.PointLight("#ffd59a", 9 + grade.glow * 10, 10, 1.6);
    pendant.position.set(0, 3.2, .4); scene.add(pendant);
    const lamps = room.lamps.map(([x, y, z]) => { const lamp = new THREE.PointLight("#ffcf7f", 3 + grade.glow * 4, 4, 2); lamp.position.set(x, y, z); scene.add(lamp); return lamp; });

    const roomGroup = new THREE.Group(); scene.add(roomGroup);
    const [W, D] = room.size;
    const solids: Array<{ min: [number, number]; max: [number, number] }> = [];
    const spotMeshes = new Map<string, THREE.Mesh[]>();
    const add = (b: RoomBox) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.size), new THREE.MeshStandardMaterial({ color: b.color, roughness: .85 }));
      mesh.position.set(b.at[0], (b.y ?? 0) + b.size[1] / 2, b.at[1]);
      mesh.castShadow = !b.hidden; mesh.receiveShadow = true; mesh.visible = !b.hidden;
      roomGroup.add(mesh);
      if (b.solid) solids.push({ min: [b.at[0] - b.size[0] / 2, b.at[1] - b.size[2] / 2], max: [b.at[0] + b.size[0] / 2, b.at[1] + b.size[2] / 2] });
      if (b.spot) spotMeshes.set(b.spot, [...(spotMeshes.get(b.spot) ?? []), mesh]);
      return mesh;
    };
    // Floor planks, walls with wainscot, a window that follows the clock.
    for (let i = 0, x = -W / 2; x < W / 2; i++, x += .5) add({ at: [x + .25, 0], size: [.49, .1, D], color: room.floor[i % 2], y: -.1 });
    add({ at: [0, -D / 2 - .1], size: [W, 3.2, .2], color: room.wall });
    add({ at: [-W / 2 - .1, 0], size: [.2, 3.2, D + .4], color: room.wall });
    add({ at: [0, -D / 2 + .01], size: [W, 1.0, .04], color: room.wainscot });
    add({ at: [-W / 2 + .01, 0], size: [.04, 1.0, D], color: room.wainscot });
    add({ at: [0, -D / 2 + .03], size: [W, .06, .06], color: "#2f4835", y: 1.0 });
    const panes: THREE.MeshStandardMaterial[] = [];
    const streaks: THREE.Mesh[] = [];
    const streakMaterial = new THREE.MeshBasicMaterial({ color: "#e6eef2", transparent: true, opacity: 0, depthWrite: false });
    for (const wx of room.windows) {
      add({ at: [wx, -D / 2 + .02], size: [1.6, 1.5, .06], color: "#4e3a28", y: 1.15 });
      panes.push(add({ at: [wx, -D / 2 + .05], size: [1.4, 1.3, .02], color: "#000000", y: 1.25 }).material as THREE.MeshStandardMaterial);
      add({ at: [wx, -D / 2 + .07], size: [.05, 1.3, .02], color: "#4e3a28", y: 1.25 });
      add({ at: [wx, -D / 2 + .07], size: [1.4, .05, .02], color: "#4e3a28", y: 1.88 });
      // Rain running down the glass: a few streaks per pane, only drawn while it rains.
      for (let i = 0; i < 7; i++) {
        const streak = new THREE.Mesh(new THREE.PlaneGeometry(.012, .16 + (i % 3) * .06), streakMaterial);
        streak.position.set(wx - .62 + i * .2 + (i % 2) * .05, 1.25 + ((i * .37) % 1) * 1.3, -D / 2 + .065);
        streak.userData.speed = .35 + (i % 4) * .12; streak.visible = false;
        scene.add(streak); streaks.push(streak);
      }
    }
    const warm = new THREE.Color("#ffd28a");
    const lightRoom = () => {
      hemisphere.intensity = 1.05 + (1 - grade.glow) * .3 - w.cloud * .1;
      sun.color.copy(grade.sun); sun.intensity = .6 + grade.sunI * .5;
      pendant.intensity = 9 + grade.glow * 10;
      for (const lamp of lamps) lamp.intensity = 3 + grade.glow * 4;
      for (const pane of panes) { pane.emissive.copy(grade.sky).lerp(warm, grade.glow * .2); pane.emissiveIntensity = 1.1 - grade.glow * .5 - w.rain * .25; }
      streakMaterial.opacity = Math.min(.7, w.rain * .8);
    };
    lightRoom();
    townSound().setWorld({ room: room.tone });
    add({ at: [room.door[0], room.door[1]], size: [1.3, .02, .8], color: "#6b5a3c", y: .001 });
    room.build(roomGroup, add);

    const player = figure("#2c3d4c");
    player.position.set(room.door[0], 0, room.door[1] - .2); player.rotation.y = Math.PI;
    scene.add(player);
    const people = new Map<string, THREE.Group>();
    const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .5, 32), new THREE.MeshBasicMaterial({ color: "#f5cf79", side: THREE.DoubleSide, transparent: true, opacity: .9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .02; scene.add(ring);

    let aspect = 1;
    const resize = () => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; aspect = w / h; renderer.setSize(w, h); };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    const forward = new THREE.Vector2(-CAMERA.x, -CAMERA.z).normalize(), right = new THREE.Vector2(-forward.y, forward.x);
    const focus = new THREE.Vector3(0, .6, .3);
    camera.position.copy(focus).add(CAMERA); camera.lookAt(focus);
    const projected = new THREE.Vector3();
    let frame = 0, previous = performance.now(), phase = 0, highlight = "";

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // rAF stamps the frame start, which can precede the time recorded at setup: never step backwards.
      const delta = THREE.MathUtils.clamp((now - previous) / 1000, 0, .05); previous = now;
      const p = live.current, list = itemsRef.current;
      // Residents standing in the room.
      const wanted = new Set(list.filter(i => i.kind === "person").map(i => i.id));
      for (const [id, g] of people) if (!wanted.has(id)) { scene.remove(g); people.delete(id); }
      for (const item of list) if (item.kind === "person" && !people.has(item.id)) {
        const seed = Number(item.person.actorId.slice(-2)) || 1;
        const g = figure(COATS[seed % COATS.length], seed % 2 ? "#e8dcc0" : "#c9b48a");
        g.position.set(item.at[0], 0, item.at[1]); scene.add(g); people.set(item.id, g);
      }
      // Walking, relative to the camera, held off furniture and walls.
      const k = keys.current;
      const h = Number(k.has("d") || k.has("arrowright")) - Number(k.has("a") || k.has("arrowleft"));
      const v = Number(k.has("w") || k.has("arrowup")) - Number(k.has("s") || k.has("arrowdown"));
      const dir = right.clone().multiplyScalar(h).addScaledVector(forward, v);
      const moving = !p.paused && dir.lengthSq() > 0;
      if (moving) {
        dir.normalize();
        let x = player.position.x + dir.x * SPEED * delta, z = player.position.z + dir.y * SPEED * delta;
        x = THREE.MathUtils.clamp(x, -W / 2 + .35, W / 2 - .35); z = THREE.MathUtils.clamp(z, -D / 2 + .4, D / 2 - .3);
        for (const s of solids) {
          const cx = THREE.MathUtils.clamp(x, s.min[0], s.max[0]), cz = THREE.MathUtils.clamp(z, s.min[1], s.max[1]);
          const dx = x - cx, dz = z - cz, dist = Math.hypot(dx, dz);
          if (dist < RADIUS) { if (dist > 1e-4) { x = cx + dx / dist * RADIUS; z = cz + dz / dist * RADIUS; } else { x = player.position.x; z = player.position.z; } }
        }
        for (const g of people.values()) {
          const dx = x - g.position.x, dz = z - g.position.z, dist = Math.hypot(dx, dz);
          if (dist < RADIUS * 2 && dist > 1e-4) { x = g.position.x + dx / dist * RADIUS * 2; z = g.position.z + dz / dist * RADIUS * 2; }
        }
        player.rotation.y = Math.atan2(dir.x, dir.y);
        player.position.x = x; player.position.z = z;
        phase += delta * 9;
      }
      townSound().setWorld({ moving });
      // The clock moves while you are inside (a search takes five minutes): the light and the rain follow it.
      gradeAt(hoursNow(), target); weatherNow(w); weatherGrade(target, w);
      easeGrade(grade, target, 1 - Math.exp(-delta * 1.5));
      lightRoom();
      for (const streak of streaks) {
        streak.visible = w.rain > .05;
        if (!streak.visible) continue;
        streak.position.y -= delta * streak.userData.speed;
        if (streak.position.y < 1.3) streak.position.y = 2.5;
      }
      const limbs = player.userData.limbs as THREE.Object3D[];
      limbs.forEach((limb, i) => { limb.rotation.x = moving ? Math.sin(phase + (i % 2 ? Math.PI : 0)) * (i < 2 ? .5 : -.4) : limb.rotation.x * .8; });
      // Residents face the player when close and breathe.
      for (const g of people.values()) {
        const dx = player.position.x - g.position.x, dz = player.position.z - g.position.z;
        if (Math.hypot(dx, dz) < 3.2) { const target = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(target - g.rotation.y), Math.cos(target - g.rotation.y)); g.rotation.y += diff * Math.min(1, delta * 3); }
        g.scale.y = 1 + Math.sin(now / 700 + g.position.x) * .006;
      }
      // What is in reach.
      let best: Item | null = null, bestDist = REACH;
      for (const item of list) { const d = Math.hypot(item.at[0] - player.position.x, item.at[1] - player.position.z); if (d < bestDist) { best = item; bestDist = d; } }
      if (best?.id !== nearRef.current?.id) { nearRef.current = best; setNear(best); }
      const glowId = best?.kind === "spot" ? best.spotId : "";
      if (glowId !== highlight) {
        for (const [id, meshes] of spotMeshes) for (const m of meshes) { const mat = m.material as THREE.MeshStandardMaterial; mat.emissive.set(id === glowId ? "#ffcf7f" : "#000000"); }
        highlight = glowId;
      }
      if (highlight) for (const m of spotMeshes.get(highlight) ?? []) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = .12 + Math.sin(now / 260) * .06;
      ring.visible = !!best && best.kind === "person";
      if (best?.kind === "person") ring.position.set(best.at[0], .02, best.at[1]);
      // Camera eases after the player, inside the room.
      // Portrait screens show less of the room, so the camera follows the player more closely.
      const follow = aspect < 1 ? .85 : .45;
      focus.lerp(new THREE.Vector3(THREE.MathUtils.clamp(player.position.x * follow, -3, 3), .6, THREE.MathUtils.clamp(player.position.z * follow + .3, -2, 2.4)), 1 - Math.exp(-delta * 4));
      camera.position.copy(focus).add(CAMERA); camera.lookAt(focus);
      const size = aspect < 1 ? Math.max(9.5, 8.4 / aspect) : Math.max(9.2, 13.5 / aspect);
      camera.left = -size * aspect / 2; camera.right = size * aspect / 2; camera.top = size / 2; camera.bottom = -size / 2;
      camera.updateProjectionMatrix();
      // Labels follow their anchors.
      for (const el of labels.current?.querySelectorAll<HTMLElement>("[data-anchor]") ?? []) {
        const [ax, ay, az] = el.dataset.anchor!.split(",").map(Number);
        projected.set(ax, ay, az).project(camera);
        el.style.transform = `translate(${Math.round((projected.x + 1) * container.clientWidth / 2)}px, ${Math.round((1 - projected.y) * container.clientHeight / 2)}px)`;
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); townSound().setWorld({ moving: false, room: null });
      scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [room]);

  const press = (key: string, on: boolean) => { if (on) { keys.current.add(key); setSlip(null); } else keys.current.delete(key); };
  const restOpen = !!view.rest?.open;
  const spotState = (item: Extract<Item, { kind: "spot" }>) => item.desk && commissionHere ? "commission" : item.rest && restOpen ? "rest" : item.targets.some(t => !t.found) ? "open" : item.targets.length ? "done" : "idle";
  const verb = (item: Item) => item.kind === "door" ? "出门" : item.kind === "person" ? "交谈" : spotState(item) === "commission" ? "领取调查手记" : spotState(item) === "rest" ? (props.resting ? "入睡中……" : "订房过夜") : spotState(item) === "open" ? "核对" : "查看";

  return <div className={styles.interior} aria-label={`${room.title}室内`}>
    <div ref={host} className={styles.interiorCanvas} />
    <div ref={labels} className={styles.interiorLabels} aria-hidden="true">
      {items.map(item => {
        const state = item.kind === "spot" ? spotState(item) : item.kind;
        const anchor = item.kind === "person" ? `${item.at[0]},2.2,${item.at[1]}` : item.kind === "door" ? `${item.at[0]},.4,${item.at[1]}` : `${item.at[0]},1.7,${item.at[1] - .9}`;
        if (item.kind === "spot" && state === "idle" && near?.id !== item.id) return null;
        return <div key={item.id} data-anchor={anchor} className={styles.interiorTag} data-state={state} data-near={near?.id === item.id}>
          {item.kind === "spot" && state === "open" ? <i>◆</i> : item.kind === "spot" && state === "done" ? <i>✓</i> : item.kind === "spot" && state === "commission" ? <i>!</i> : item.kind === "spot" && state === "rest" ? <i>☾</i> : null}
          <span>{item.name}</span>
        </div>;
      })}
    </div>

    <aside className={styles.interiorCard}>
      <span className={styles.eyebrow}>室内 · {room.title}</span>
      <h2>{room.title}</h2>
      {props.blurb && <p className={styles.interiorBlurb}>{props.blurb}</p>}
      <p>走到物品旁按 <kbd>E</kbd> 查看。也可以直接在下面选择。</p>
      <ul aria-label="房间里可以查看的地方">
        {items.filter(i => i.kind !== "door").map(item => <li key={item.id}>
          <button disabled={props.busy || props.paused} aria-busy={item.kind === "spot" && item.rest ? !!props.resting : undefined} onClick={() => void act(item)} data-state={item.kind === "spot" ? spotState(item) : "person"}>
            <span>{verb(item)}</span>{item.name}{item.kind === "spot" && item.targets.length > 0 && <small>{item.targets.filter(t => t.found).length}/{item.targets.length}</small>}
          </button>
        </li>)}
      </ul>
      {room.spots.some(s => s.rest) && view.rest && <p className={styles.interiorRest}>{view.rest.open ? `订一间房，睡到第 ${view.rest.wakeDay} 天早上 8 点。夜里居民各自回家，醒来时小镇已经开始新的一天。` : view.rest.reason}</p>}
      <div className={styles.interiorActions}>
        {c && <button className={styles.textButton} onClick={props.onOpenBook}>案件本 <kbd>K</kbd></button>}
        <button className={styles.primary} onClick={props.onExit}>出门 <kbd>Esc</kbd></button>
      </div>
    </aside>

    {near && !slip && <button className={styles.interiorPrompt} onClick={() => void act(near)} disabled={props.busy}><kbd>E</kbd>{verb(near)} · {near.name}</button>}
    {slip && <div className={styles.interiorSlip} data-tone={slip.tone} role="status">
      <span className={styles.eyebrow}>{slip.tone === "found" ? "记入手记" : slip.tone === "refuse" ? "还不能" : "看了看"}</span>
      <h3>{slip.title}</h3>
      <p>{slip.text}</p>
      <button className={styles.textButton} onClick={() => setSlip(null)}>收好</button>
    </div>}
    {touch && <div className={styles.touchPad} data-interior="true" aria-label="室内方向控制">
      {([["w", "↑", "向前走"], ["a", "←", "向左走"], ["s", "↓", "向后走"], ["d", "→", "向右走"]] as const).map(([key, label, name]) => <button key={key} data-key={key} aria-label={name} onPointerDown={e => { e.preventDefault(); press(key, true); }} onPointerUp={() => press(key, false)} onPointerLeave={() => press(key, false)} onPointerCancel={() => press(key, false)}>{label}</button>)}
    </div>}
  </div>;
}
