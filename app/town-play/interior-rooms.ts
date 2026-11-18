import * as THREE from "three";

/**
 * Interior rooms, built from primitives in the town's palette: no model files.
 * Coordinates are metres; x runs right, z toward the camera, y up. Each room is
 * a cut-away box (back and left walls only) with furniture, a door mat, and
 * "spots": places where something can be examined. Case search targets are
 * matched to spots by keyword, so a new case needs no room changes.
 */
export type RoomSpot = {
  id: string;
  name: string;
  /** Where the player stands to examine it, and how close they must be. */
  stand: [number, number];
  /** Case search labels containing any of these words land on this spot. */
  keywords: string[];
  /** What the player sees when nothing here belongs to the case. */
  idle: string;
  /** This is where a commission's notebook is handed over. */
  desk?: boolean;
  /** Book a room for the night here (the inn's stairs). */
  rest?: boolean;
};
export type RoomTone = "books" | "cafe" | "police" | "post" | "inn" | "station";
export type RoomBox = { at: [number, number]; size: [number, number, number]; color: string; spot?: string; y?: number; solid?: boolean; hidden?: boolean };
export type RoomDef = {
  sceneId: string;
  title: string;
  size: [number, number];
  floor: [string, string];
  wall: string;
  wainscot: string;
  door: [number, number];
  /** Window centres along the back wall (x); they follow the clock and the weather. */
  windows: number[];
  /** Warm lamps that brighten as the day darkens. */
  lamps: Array<[number, number, number]>;
  /** The room's sound: what you hear inside. */
  tone: RoomTone;
  /** Where observed residents stand inside. */
  standing: Array<[number, number]>;
  spots: RoomSpot[];
  build: (room: THREE.Group, add: (box: RoomBox) => THREE.Mesh) => void;
};

const P = {
  wood: "#7a5a3c", woodDark: "#4e3a28", woodLight: "#a07a52", brass: "#ad7935", paper: "#f3ead2",
  green: "#3d5a47", red: "#8f4a32", blue: "#3f5868", ochre: "#b78a3e", cream: "#e8dcc0", glass: "#cfe3e6"
};
const SPINES = ["#7d3b2c", "#3f5868", "#596d51", "#b78a3e", "#5b4a6e", "#a56e3e", "#2f4835", "#c9b48a", "#8f4a32"];

/** Deterministic little shuffle so shelves look full but never change between visits. */
const rand = (seed: number) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

function bookshelf(room: THREE.Group, add: (b: RoomBox) => THREE.Mesh, at: [number, number], width: number, facing: "front" | "right", seed: number) {
  const depth = .55, height = 2.5;
  const [w, d] = facing === "front" ? [width, depth] : [depth, width];
  add({ at, size: [w, height, d], color: P.woodDark, solid: true, hidden: true });
  const across = (along: number, out: number): [number, number] => facing === "front" ? [at[0] + along, at[1] + out] : [at[0] + out, at[1] - along];
  const sized = (a: number, h: number, o: number): [number, number, number] => facing === "front" ? [a, h, o] : [o, h, a];
  add({ at: across(0, -depth / 2 + .03), size: sized(width, height, .06), color: P.woodDark, spot: "shelf" });
  for (const side of [-1, 1]) add({ at: across(side * (width / 2 - .03), 0), size: sized(.06, height, depth), color: P.wood, spot: "shelf" });
  for (let level = 0; level <= 4; level++) add({ at: across(0, 0), size: sized(width, .04, depth), color: P.wood, y: level === 4 ? height - .04 : .14 + level * .58, spot: "shelf" });
  const r = rand(seed);
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .85 }), 160);
  const m = new THREE.Matrix4(), color = new THREE.Color();
  let n = 0;
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = -width / 2 + .08;
    const y = .18 + shelf * .58;
    while (x < width / 2 - .12 && n < books.count) {
      const bw = .05 + r() * .07, bh = .32 + r() * .17, lean = r() < .06 ? .18 : 0;
      const local = new THREE.Vector3(x + bw / 2, y + bh / 2, 0);
      const pos = facing === "front" ? new THREE.Vector3(at[0] + local.x, local.y, at[1] + .02) : new THREE.Vector3(at[0] + .02, local.y, at[1] - local.x);
      m.compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, facing === "front" ? 0 : Math.PI / 2, lean)), new THREE.Vector3(bw, bh, .32));
      books.setMatrixAt(n, m); books.setColorAt(n, color.set(SPINES[Math.floor(r() * SPINES.length)]));
      x += bw + .006; n++;
    }
  }
  books.count = n; books.castShadow = true; books.receiveShadow = true;
  room.add(books);
}

type Add = (b: RoomBox) => THREE.Mesh;
type Facing = "front" | "right";

/** Turned shapes (cups, stools, table tops) that boxes cannot read as. */
function cylinder(room: THREE.Group, at: [number, number], radius: number, height: number, color: string, y = 0, top = radius) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, radius, height, 20), new THREE.MeshStandardMaterial({ color, roughness: .7 }));
  mesh.position.set(at[0], y + height / 2, at[1]); mesh.castShadow = true; mesh.receiveShadow = true;
  room.add(mesh);
  return mesh;
}
const glassy = (mesh: THREE.Mesh, opacity = .28) => {
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.transparent = true; material.opacity = opacity; mesh.castShadow = false;
  return mesh;
};
/** A light source in the room (fire, dial, lit hatch): keeps its glow. */
const glowing = (mesh: THREE.Mesh, color: string, intensity = 1.4) => {
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.emissive.set(color); material.emissiveIntensity = intensity; mesh.castShadow = false;
  return mesh;
};
function stool(room: THREE.Group, add: Add, at: [number, number], height = .74) {
  add({ at, size: [.42, height, .42], color: P.woodDark, solid: true, hidden: true });
  cylinder(room, at, .04, height - .05, "#2f2a26");
  cylinder(room, at, .2, .02, "#2f2a26");
  cylinder(room, at, .2, .06, P.red, height - .06);
}
function chair(add: Add, at: [number, number], back: "front" | "back" | "left" | "right", color = P.woodDark) {
  add({ at, size: [.44, .46, .44], color, solid: true });
  const offset: Record<string, [number, number, number, number]> = { front: [0, .2, .44, .06], back: [0, -.2, .44, .06], right: [.2, 0, .06, .44], left: [-.2, 0, .06, .44] };
  const [dx, dz, w, d] = offset[back];
  add({ at: [at[0] + dx, at[1] + dz], size: [w, .5, d], color, y: .46 });
}
function roundTable(room: THREE.Group, add: Add, at: [number, number]) {
  add({ at, size: [.9, .74, .9], color: P.woodDark, solid: true, hidden: true });
  cylinder(room, at, .46, .04, P.cream, .72);
  cylinder(room, at, .05, .72, "#2f2a26");
  cylinder(room, at, .26, .03, "#2f2a26");
  chair(add, [at[0] - .78, at[1]], "left");
  chair(add, [at[0] + .78, at[1]], "right");
}
/** A wall of cells (pigeonholes, lockers) facing into the room, optionally stuffed with letters. */
function cells(add: Add, at: [number, number], facing: Facing, width: number, height: number, y: number, cols: number, rows: number, line: string, seed = 0, fill?: string) {
  const across = (along: number): [number, number] => facing === "front" ? [at[0] + along, at[1]] : [at[0], at[1] - along];
  const sized = (a: number, h: number): [number, number, number] => facing === "front" ? [a, h, .05] : [.05, h, a];
  for (let c = 0; c <= cols; c++) add({ at: across(-width / 2 + c * width / cols), size: sized(.04, height), color: line, y });
  for (let r = 0; r <= rows; r++) add({ at: across(0), size: sized(width, .04), color: line, y: y + r * height / rows - .02 });
  if (!fill) return;
  const r = rand(seed + 5);
  for (let c = 0; c < cols; c++) for (let row = 0; row < rows; row++) if (r() < .55) {
    add({ at: across(-width / 2 + (c + .5) * width / cols), size: sized(width / cols * .62, height / rows * (.3 + r() * .35)), color: r() < .2 ? P.blue : fill, y: y + row * height / rows + .03 });
  }
}
function sphere(room: THREE.Group, at: [number, number, number], radius: number, color: string, stretch = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
  mesh.scale.y = stretch; mesh.position.set(...at); mesh.castShadow = true; room.add(mesh);
  return mesh;
}

export const ROOMS: Record<string, RoomDef> = {
  books: {
    sceneId: "books", title: "旧书店", size: [10, 8], floor: [P.woodLight, "#94704a"], wall: P.cream, wainscot: P.green,
    door: [3.6, 3.3], windows: [3.4], lamps: [[-1.85, 1.5, 1.85]], tone: "books",
    standing: [[-1.4, -2.0], [1.6, -1.7], [-3.4, .4], [.6, 2.6]],
    spots: [
      { id: "display", name: "展台", stand: [0, 1.25], keywords: ["展台", "封条", "原图"], idle: "玻璃展台里铺着一张旧桥测绘图的复制件，边角压着铜质镇纸。" },
      { id: "table", name: "修复桌", stand: [-2.5, 1.0], keywords: ["修复", "信件", "桌"], idle: "修复桌上摊着待补的书页、糨糊碗和一盏绿色台灯。" },
      { id: "counter", name: "柜台", stand: [2.3, -.4], keywords: ["交接", "柜台", "登记", "收据"], idle: "柜台上放着来客登记簿和一只黄铜小铃。", desk: true },
      { id: "shelf", name: "书架", stand: [-.6, -2.6], keywords: ["书架", "地图集", "旧书"], idle: "书架上多是本地旧地图集和过期的年鉴，按出版年份排着。" }
    ],
    build(room, add) {
      bookshelf(room, add, [-2.6, -3.62], 2.6, "front", 3);
      bookshelf(room, add, [.4, -3.62], 2.6, "front", 7);
      bookshelf(room, add, [-4.62, -.9], 2.4, "right", 11);
      // Glass display case with a map inside.
      add({ at: [0, 0], size: [2.1, .82, 1.1], color: P.wood, spot: "display", solid: true });
      add({ at: [0, 0], size: [2.0, .03, 1.0], color: P.paper, y: .83 });
      const glass = add({ at: [0, 0], size: [2.1, .34, 1.1], color: P.glass, y: .84 });
      (glass.material as THREE.MeshStandardMaterial).transparent = true; (glass.material as THREE.MeshStandardMaterial).opacity = .28; glass.castShadow = false;
      add({ at: [-.55, -.1], size: [.7, .012, .5], color: "#c9d8d2", y: .86 });
      add({ at: [.45, .12], size: [.5, .012, .36], color: "#d7c79d", y: .86 });
      // Restoration table, lamp, pages.
      add({ at: [-2.5, 2.1], size: [1.9, .78, .95], color: P.woodLight, spot: "table", solid: true });
      add({ at: [-2.9, 2.0], size: [.62, .01, .44], color: P.paper, y: .79 });
      add({ at: [-2.2, 2.2], size: [.4, .01, .3], color: "#efe2bf", y: .79 });
      add({ at: [-1.85, 1.85], size: [.08, .42, .08], color: P.brass, y: .78 });
      add({ at: [-1.85, 1.85], size: [.34, .14, .24], color: P.green, y: 1.18 });
      // Counter with ledger and bell.
      add({ at: [3.3, -.6], size: [1.0, 1.02, 2.6], color: P.wood, spot: "counter", solid: true });
      add({ at: [3.25, -.9], size: [.52, .05, .38], color: P.red, y: 1.03 });
      add({ at: [3.25, -.9], size: [.48, .012, .34], color: P.paper, y: 1.08 });
      add({ at: [3.3, .25], size: [.14, .1, .14], color: P.brass, y: 1.03 });
      // Rug and a chair.
      add({ at: [0, .4], size: [4.2, .015, 3.0], color: "#7d3b2c", y: .005 });
      add({ at: [0, .4], size: [3.8, .016, 2.6], color: "#a35a3c", y: .006 });
      add({ at: [-2.4, 2.95], size: [.5, .45, .5], color: P.woodDark });
      add({ at: [-2.4, 3.18], size: [.5, .55, .06], color: P.woodDark, y: .45 });
    }
  },
  cafe: {
    sceneId: "cafe", title: "河湾咖啡馆", size: [10, 8], floor: ["#ddd1b8", "#7a6650"], wall: "#efe3c8", wainscot: P.green,
    door: [3.6, 3.3], windows: [1.0, 3.4], lamps: [[-2.4, 1.7, -2.9], [.9, 1.4, 1.3]], tone: "cafe",
    standing: [[-3.6, -1.9], [-.5, 2.4], [2.7, .7], [-1.6, 2.0]],
    spots: [
      { id: "register", name: "收银台", stand: [2.0, -1.3], keywords: ["收银", "小票", "豆浆", "拿铁"], idle: "收银机旁的铁夹夹着今天的小票留底，按时间一张压一张。", desk: true },
      { id: "notes", name: "便笺板", stand: [-3.9, .3], keywords: ["便笺", "早餐", "留言"], idle: "软木板上钉着外送单、失物启事和宋棠随手写的备忘。" },
      { id: "window", name: "窗边座位", stand: [1.0, -2.3], keywords: ["窗边", "座位"], idle: "窗边的高脚凳正对广场，坐在这里看得见钟楼和花摊。" },
      { id: "bar", name: "咖啡吧台", stand: [-2.2, -2.1], keywords: ["咖啡机", "吧台", "磨豆"], idle: "铜色咖啡机还温着，磨豆机下落了一圈细粉。" }
    ],
    build(room, add) {
      // Espresso bar along the back wall, jars and a chalk menu above it.
      add({ at: [-2.4, -3.35], size: [4.4, 1.0, 1.0], color: P.wood, spot: "bar", solid: true });
      add({ at: [-2.4, -3.35], size: [4.5, .05, 1.08], color: "#2f2a26", y: 1.0 });
      add({ at: [-3.5, -3.55], size: [.95, .55, .52], color: P.brass, y: 1.05, spot: "bar" });
      add({ at: [-3.5, -3.25], size: [.66, .08, .14], color: "#3a3430", y: 1.22 });
      add({ at: [-2.55, -3.6], size: [.26, .45, .26], color: "#3a3430", y: 1.05 });
      glassy(add({ at: [-2.55, -3.6], size: [.24, .24, .24], color: "#d9c9a0", y: 1.5 }), .6);
      for (let i = 0; i < 4; i++) cylinder(room, [-1.85 + i * .2, -3.05], .045, .09, P.cream, 1.05);
      glassy(cylinder(room, [-.75, -3.3], .2, .3, P.glass, 1.05, .05), .35);
      add({ at: [-2.4, -3.88], size: [4.0, .04, .24], color: P.woodDark, y: 1.85 });
      ([["#b78a3e", .32], ["#7d3b2c", .26], ["#596d51", .3], ["#e8dcc0", .22], ["#a56e3e", .3]] as const).forEach(([c, h], i) => cylinder(room, [-4.0 + i * .75, -3.86], .09, h, c, 1.89));
      add({ at: [-2.4, -3.95], size: [1.9, .9, .04], color: "#2b322e", y: 2.15 });
      for (let i = 0; i < 4; i++) add({ at: [-2.55 + (i % 2) * .2, -3.92], size: [1.2 - (i % 2) * .4, .04, .02], color: P.cream, y: 2.82 - i * .18 });
      // Register counter on the door side.
      add({ at: [3.2, -1.4], size: [1.0, 1.05, 1.9], color: P.red, spot: "register", solid: true });
      add({ at: [3.2, -1.4], size: [1.08, .05, 1.98], color: "#2f2a26", y: 1.05 });
      add({ at: [3.25, -1.75], size: [.5, .3, .45], color: "#3a3430", y: 1.1, spot: "register" });
      add({ at: [3.25, -1.98], size: [.36, .12, .04], color: "#c9d8d2", y: 1.3 });
      cylinder(room, [3.25, -.95], .012, .22, P.brass, 1.1);
      add({ at: [3.25, -.95], size: [.16, .005, .2], color: P.paper, y: 1.2 });
      add({ at: [3.25, -.95], size: [.16, .005, .2], color: "#efe2bf", y: 1.25 });
      // Window ledge with two stools.
      add({ at: [1.0, -3.78], size: [1.9, .06, .44], color: P.woodLight, y: .98, spot: "window" });
      add({ at: [1.0, -3.85], size: [1.9, .98, .3], color: P.woodDark, solid: true });
      stool(room, add, [.55, -3.15]); stool(room, add, [1.45, -3.15]);
      cylinder(room, [.7, -3.7], .045, .09, P.cream, 1.04);
      // Two round tables, the notes board, a plant.
      roundTable(room, add, [-1.6, .6]); roundTable(room, add, [.9, 1.3]);
      cylinder(room, [-1.45, .65], .045, .08, P.cream, .76); cylinder(room, [.8, 1.2], .045, .08, P.cream, .76);
      add({ at: [-4.95, .3], size: [.05, .9, 1.3], color: "#a57d4f", y: 1.2, spot: "notes" });
      add({ at: [-4.91, -.05], size: [.02, .26, .2], color: P.paper, y: 1.5 });
      add({ at: [-4.91, .5], size: [.02, .3, .22], color: "#e9d9a8", y: 1.32 });
      add({ at: [-4.91, .7], size: [.02, .2, .25], color: P.paper, y: 1.78 });
      add({ at: [-4.91, .15], size: [.02, .18, .26], color: "#d7c79d", y: 1.28 });
      add({ at: [4.4, -3.4], size: [.5, .5, .5], color: P.red, solid: true });
      sphere(room, [4.4, .95, -3.4], .42, "#4f6b45");
    }
  },
  police: {
    sceneId: "police", title: "警务所", size: [10, 8], floor: ["#8c9188", "#7f847b"], wall: "#dfe2d4", wainscot: P.blue,
    door: [3.6, 3.3], windows: [3.4], lamps: [[1.1, 1.5, -1.0]], tone: "police",
    standing: [[1.9, -2.3], [-1.3, 2.6], [-3.2, -1.0], [-.3, .4]],
    spots: [
      { id: "desk", name: "值班桌", stand: [1.6, .3], keywords: ["巡逻", "值班", "报失"], idle: "值班桌上压着今天的巡逻本，打字机里还卡着半页报告。", desk: true },
      { id: "clock", name: "校时台", stand: [-3.5, 1.4], keywords: ["钟楼", "检修", "校时", "电波"], idle: "电波校时器的指针一格一格地跳，旁边是钟楼检修的签到本。" },
      { id: "porch", name: "门廊桌", stand: [.6, 2.1], keywords: ["门廊", "复写", "底页", "代写"], idle: "门廊桌给来访的居民写申请用，桌上放着复写纸和一盒图钉。" },
      { id: "map", name: "街区图", stand: [-1.8, -2.7], keywords: ["街区图", "告示", "地图"], idle: "墙上的街区图用红线标出巡逻路线，桥边还钉着一张寻物告示。" }
    ],
    build(room, add) {
      // Duty desk: typewriter, green lamp, patrol book, telephone; a chair behind.
      add({ at: [1.6, -.9], size: [2.2, .78, 1.0], color: P.woodDark, spot: "desk", solid: true });
      add({ at: [1.6, -.9], size: [2.28, .04, 1.08], color: P.wood, y: .78 });
      add({ at: [1.2, -1.0], size: [.55, .16, .42], color: "#2b2d2c", y: .82, spot: "desk" });
      add({ at: [1.2, -1.15], size: [.45, .22, .02], color: P.paper, y: .95 });
      add({ at: [2.0, -.7], size: [.42, .03, .3], color: P.blue, y: .82 });
      add({ at: [2.0, -.7], size: [.38, .01, .26], color: P.paper, y: .85 });
      add({ at: [2.5, -1.1], size: [.24, .1, .18], color: "#1f1f1f", y: .82 });
      add({ at: [.75, -1.2], size: [.06, .38, .06], color: P.brass, y: .82 });
      add({ at: [.75, -1.2], size: [.3, .12, .2], color: P.green, y: 1.18 });
      chair(add, [1.6, -1.9], "back");
      // Street map with the patrol route, and a lost-property notice.
      add({ at: [-1.8, -3.96], size: [2.6, 1.5, .04], color: P.cream, y: 1.1, spot: "map" });
      for (const x of [-2.5, -1.6, -.9]) add({ at: [x, -3.93], size: [.05, 1.3, .01], color: "#b9ab8a", y: 1.2 });
      for (const y of [1.45, 1.95, 2.3]) add({ at: [-1.8, -3.93], size: [2.4, .05, .01], color: "#b9ab8a", y });
      add({ at: [-1.85, -3.93], size: [2.5, .22, .01], color: "#7fa3b5", y: 1.18 });
      add({ at: [-1.6, -3.92], size: [1.6, .03, .01], color: "#b0392b", y: 1.75 });
      add({ at: [-2.2, -3.92], size: [.03, .7, .01], color: "#b0392b", y: 1.4 });
      add({ at: [-.25, -3.94], size: [.36, .46, .02], color: P.paper, y: 1.6 });
      // Filing cabinets and a visitors' bench.
      add({ at: [-4.35, -3.5], size: [1.0, 1.4, .8], color: "#5f6b66", solid: true });
      for (const y of [.3, .75, 1.2]) add({ at: [-4.35, -3.09], size: [.4, .05, .02], color: P.brass, y });
      add({ at: [.15, -3.6], size: [.8, 1.25, .7], color: "#5f6b66", solid: true });
      add({ at: [-4.55, -1.0], size: [.6, .45, 1.6], color: P.wood, solid: true });
      add({ at: [-4.82, -1.0], size: [.06, .55, 1.6], color: P.wood, y: .45 });
      // Clock-check bench: the radio clock and the tower log.
      add({ at: [-4.5, 1.4], size: [.9, .85, 1.8], color: P.woodLight, spot: "clock", solid: true });
      add({ at: [-4.55, 1.05], size: [.42, .34, .36], color: "#3a3430", y: .85, spot: "clock" });
      glowing(add({ at: [-4.33, 1.05], size: [.02, .18, .26], color: "#e9f2d8", y: .93 }), "#cfe7b4", .6);
      add({ at: [-4.45, 1.75], size: [.36, .03, .5], color: P.paper, y: .86 });
      // Porch table by the door with carbon paper; a coat stand.
      add({ at: [.6, 3.1], size: [1.4, .74, .7], color: P.wood, spot: "porch", solid: true });
      add({ at: [.45, 3.1], size: [.5, .01, .36], color: "#2f3a4a", y: .75 });
      add({ at: [.95, 3.05], size: [.42, .01, .3], color: P.paper, y: .75 });
      chair(add, [.6, 3.75], "front");
      cylinder(room, [4.5, 2.6], .04, 1.8, P.woodDark);
      add({ at: [4.5, 2.6], size: [.5, .08, .08], color: P.woodDark, y: 1.7 });
      add({ at: [4.55, 2.6], size: [.3, .7, .14], color: "#2c3d4c", y: 1.05 });
    }
  },
  post: {
    sceneId: "post", title: "邮局", size: [10, 8], floor: ["#a57f57", "#94704a"], wall: "#ecdfc4", wainscot: P.red,
    door: [3.6, 3.3], windows: [3.4], lamps: [[1.8, 1.7, -.8], [-3.0, 1.9, -1.6]], tone: "post",
    standing: [[2.7, -2.1], [-1.6, 1.6], [2.6, 1.6], [-3.9, -.3]],
    spots: [
      { id: "counter", name: "挂号柜台", stand: [1.8, .4], keywords: ["挂号", "存根", "清点", "报值"], idle: "柜台铜栏后面是挂号登记簿和一盒深蓝色的报值封套。", desk: true },
      { id: "sorter", name: "分拣机", stand: [-2.9, -1.3], keywords: ["分拣", "日志", "开机"], idle: "分拣机的滚筒停着，侧面挂着一本开机记录。" },
      { id: "archive", name: "留底柜", stand: [-3.7, 1.6], keywords: ["留底", "保密", "回条", "回执", "请求"], idle: "留底柜按月份分格，每一格都夹着寄件人的存根联。" },
      { id: "boxes", name: "信格", stand: [.8, -2.5], keywords: ["信格", "邮件", "包裹"], idle: "信格按街区分开，北街那几格塞得最满。" }
    ],
    build(room, add) {
      // Service counter across the room, a brass grille on top.
      add({ at: [1.8, -.8], size: [4.4, 1.05, .8], color: P.wood, spot: "counter", solid: true });
      add({ at: [1.8, -.8], size: [4.5, .05, .9], color: P.woodDark, y: 1.05 });
      for (let i = 0; i <= 14; i++) add({ at: [-.35 + i * .3, -.95], size: [.025, .55, .025], color: P.brass, y: 1.1 });
      add({ at: [1.8, -.95], size: [4.3, .04, .04], color: P.brass, y: 1.64 });
      add({ at: [1.2, -.62], size: [.5, .04, .36], color: P.red, y: 1.1, spot: "counter" });
      add({ at: [1.2, -.62], size: [.46, .01, .32], color: P.paper, y: 1.14 });
      add({ at: [2.3, -.6], size: [.3, .06, .2], color: "#24344a", y: 1.1 });
      add({ at: [3.3, -.65], size: [.36, .12, .3], color: "#5f6b66", y: 1.1 });
      add({ at: [3.3, -.65], size: [.3, .02, .24], color: P.brass, y: 1.24 });
      // Pigeonholes on the back wall.
      add({ at: [.8, -3.78], size: [2.8, 2.0, .42], color: P.woodDark, y: .9, spot: "boxes" });
      cells(add, [.8, -3.55], "front", 2.8, 2.0, .9, 7, 5, P.wood, 2, P.paper);
      add({ at: [.8, -3.78], size: [2.8, .9, .42], color: P.wood, solid: true });
      // Sorting machine with its drum and log book.
      add({ at: [-3.0, -2.7], size: [2.2, 1.0, 1.3], color: "#5f6b66", spot: "sorter", solid: true });
      const drum = cylinder(room, [-3.0, -2.7], .38, 1.8, "#7d8a84", 1.0); drum.rotation.z = Math.PI / 2; drum.position.y = 1.3;
      add({ at: [-3.0, -2.03], size: [1.6, .3, .04], color: "#3a3430", y: .55 });
      add({ at: [-1.88, -2.4], size: [.04, .34, .26], color: P.paper, y: .55, spot: "sorter" });
      glowing(add({ at: [-2.2, -2.02], size: [.12, .08, .02], color: "#ffd18a", y: .78 }), "#ffb75e", .9);
      // Archive cabinet on the left wall.
      add({ at: [-4.55, 1.6], size: [.8, 1.4, 1.9], color: P.woodDark, spot: "archive", solid: true });
      cells(add, [-4.13, 1.6], "right", 1.8, 1.3, .05, 4, 4, P.wood);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) add({ at: [-4.12, 1.6 + .9 - (c + .5) * .45], size: [.02, .03, .14], color: P.brass, y: .2 + r * .325 });
      // Mail sacks by the door.
      for (const [x, z, s] of [[4.3, 1.4, .42], [4.1, 2.0, .36], [4.45, 2.4, .32]] as const) sphere(room, [x, s * 1.1, z], s, "#c2ae84", 1.25);
      add({ at: [4.3, 1.9], size: [.9, .8, 1.4], color: "#c2ae84", solid: true, hidden: true });
    }
  },
  inn: {
    sceneId: "inn", title: "桥畔旅馆", size: [10, 8], floor: ["#8b5f3e", "#7b5336"], wall: "#e9d6b6", wainscot: P.woodDark,
    door: [3.6, 3.3], windows: [.2], lamps: [[2.4, 1.7, -2.4], [-4.0, .7, -.6]], tone: "inn",
    standing: [[2.4, -3.6], [-2.3, -.5], [.4, 1.9], [-.4, -1.7]],
    spots: [
      { id: "box", name: "募捐箱", stand: [4.2, -.9], keywords: ["募捐"], idle: "旧桥修缮的募捐箱摆在前台旁，铜锁扣擦得发亮。" },
      { id: "desk", name: "前台", stand: [2.2, -1.5], keywords: ["前台", "核页", "核号", "编号", "客簿", "照片"], idle: "前台摊着来客登记簿，背后的钥匙板挂着六把房门钥匙。", desk: true },
      { id: "kitchen", name: "厨房窗口", stand: [-1.6, -2.6], keywords: ["厨房", "出餐", "早饭"], idle: "出餐窗口的铁钉上插着一串今天的出餐单。" },
      { id: "porch", name: "门廊工具箱", stand: [1.4, 2.5], keywords: ["工具箱", "门廊", "凿"], idle: "门廊角落的工具箱没有上锁，旁边的伞架插满了来客的伞。" },
      { id: "stairs", name: "客房楼梯", stand: [-3.2, 2.6], keywords: [], idle: "楼梯通往二楼客房。", rest: true }
    ],
    build(room, add) {
      // Front desk, key board, ledger, bell and lamp.
      add({ at: [2.4, -2.7], size: [2.8, 1.05, .9], color: P.wood, spot: "desk", solid: true });
      add({ at: [2.4, -2.7], size: [2.9, .05, 1.0], color: P.woodDark, y: 1.05 });
      add({ at: [2.0, -2.5], size: [.55, .05, .4], color: P.red, y: 1.1, spot: "desk" });
      add({ at: [2.0, -2.5], size: [.5, .012, .36], color: P.paper, y: 1.15 });
      cylinder(room, [3.0, -2.4], .07, .06, P.brass, 1.1, .03);
      add({ at: [2.4, -3.96], size: [1.2, .6, .04], color: P.woodDark, y: 1.6 });
      for (let i = 0; i < 6; i++) add({ at: [1.95 + i * .18, -3.92], size: [.04, .14, .02], color: P.brass, y: 1.75 });
      cylinder(room, [3.5, -2.9], .05, .4, P.brass, 1.1);
      cylinder(room, [3.5, -2.9], .18, .2, "#e8c98a", 1.48, .1);
      // Donation box on a pedestal beside the desk.
      add({ at: [4.3, -1.8], size: [.55, .9, .55], color: P.woodDark, solid: true, spot: "box" });
      add({ at: [4.3, -1.8], size: [.46, .34, .36], color: P.wood, y: .9, spot: "box" });
      add({ at: [4.3, -1.8], size: [.24, .02, .04], color: "#1d1a17", y: 1.24 });
      add({ at: [4.3, -1.61], size: [.08, .1, .02], color: P.brass, y: 1.05 });
      // Kitchen hatch with the order spike.
      add({ at: [-1.6, -3.95], size: [1.6, 1.0, .05], color: "#2b2622", y: 1.0 });
      add({ at: [-1.6, -3.7], size: [1.8, 1.0, .5], color: P.woodDark, solid: true, spot: "kitchen" });
      add({ at: [-1.6, -3.68], size: [1.9, .06, .56], color: P.woodLight, y: 1.0, spot: "kitchen" });
      cylinder(room, [-1.0, -3.6], .012, .24, "#8a8478", 1.06);
      for (let i = 0; i < 3; i++) add({ at: [-1.0, -3.6], size: [.16, .005, .2], color: i % 2 ? "#efe2bf" : P.paper, y: 1.12 + i * .05 });
      glowing(add({ at: [-1.9, -3.9], size: [.6, .3, .02], color: "#ffcf7f", y: 1.4 }), "#ffb75e", .5);
      // Stone fireplace, an armchair and a rug.
      add({ at: [-4.7, -.6], size: [.6, 1.3, 1.6], color: "#8a8478", solid: true });
      add({ at: [-4.6, -.6], size: [.8, .08, 1.9], color: P.woodDark, y: 1.3 });
      add({ at: [-4.39, -.6], size: [.04, .62, .8], color: "#1d1a17", y: .15 });
      glowing(add({ at: [-4.5, -.6], size: [.28, .22, .5], color: "#ff9a4a", y: .18 }), "#ff8a3a", 2.2);
      add({ at: [-3.3, .7], size: [.8, .45, .8], color: P.green, solid: true });
      add({ at: [-3.3, 1.05], size: [.8, .6, .16], color: P.green, y: .45 });
      add({ at: [-2.6, .2], size: [3.0, .015, 2.2], color: "#7d3b2c", y: .005 });
      // Stairs up to the rooms.
      add({ at: [-4.4, 2.55], size: [1.0, 2.0, 2.6], color: P.woodDark, solid: true, hidden: true });
      for (let i = 0; i < 8; i++) add({ at: [-4.4, 3.7 - i * .3], size: [1.0, (i + 1) * .26, .3], color: i % 2 ? P.wood : P.woodLight, spot: "stairs" });
      for (let i = 0; i < 4; i++) add({ at: [-3.88, 3.55 - i * .6], size: [.05, .9, .05], color: P.woodDark, y: .3 + i * .5 });
      // Porch: an unlocked toolbox and the umbrella stand.
      add({ at: [1.4, 3.45], size: [.9, .45, .45], color: "#6b4a2e", solid: true, spot: "porch" });
      add({ at: [1.4, 3.45], size: [.4, .06, .06], color: "#3a3430", y: .5 });
      cylinder(room, [2.5, 3.55], .2, .55, P.blue);
      for (const [dx, c] of [[-.06, P.red], [.06, P.green], [0, "#2f2a26"]] as const) cylinder(room, [2.5 + dx, 3.55], .025, .9, c, .3).rotation.z = dx * 2;
    }
  },
  station: {
    sceneId: "station", title: "河湾车站", size: [10, 8], floor: ["#bdb29c", "#ada28c"], wall: "#dfe3da", wainscot: "#2f4835",
    door: [3.6, 3.3], windows: [-3.4], lamps: [[2.2, 1.8, -2.4], [-.8, 2.4, .1]], tone: "station",
    standing: [[2.2, -3.7], [-2.0, 2.4], [3.0, .6], [.4, -1.4]],
    spots: [
      { id: "counter", name: "值班柜台", stand: [2.2, -1.8], keywords: ["柜台", "交接清单", "时刻册", "签收", "木料", "值班"], idle: "柜台玻璃后是值班本、木料签收单和一叠作废的时刻表。", desk: true },
      { id: "display", name: "留言册展示夹", stand: [-.8, 1.0], keywords: ["展示夹", "纸茬", "折纸条", "留言册"], idle: "玻璃展示夹里摊着离镇留言册，翻在最新的一页。" },
      { id: "lockers", name: "寄存柜", stand: [-3.7, -1.4], keywords: ["寄存"], idle: "一排绿色寄存柜，每格贴着编号，钥匙挂在柜台后面。" },
      { id: "clock", name: "发车钟", stand: [-1.4, -2.7], keywords: ["电波钟", "时刻表", "发车"], idle: "站台电波钟和墙上的发车时刻表对得分秒不差。" }
    ],
    build(room, add) {
      // Duty counter behind glass.
      add({ at: [2.2, -3.0], size: [3.4, 1.1, .9], color: "#2f4835", spot: "counter", solid: true });
      add({ at: [2.2, -3.0], size: [3.5, .05, 1.0], color: P.woodDark, y: 1.1 });
      glassy(add({ at: [2.2, -2.58], size: [3.4, .8, .03], color: P.glass, y: 1.15 }), .22);
      for (const x of [.5, 1.65, 2.8, 3.9]) add({ at: [x, -2.58], size: [.05, .8, .05], color: P.brass, y: 1.15 });
      add({ at: [2.2, -2.58], size: [3.45, .05, .05], color: P.brass, y: 1.93 });
      add({ at: [1.6, -2.75], size: [.4, .01, .3], color: P.paper, y: 1.16, spot: "counter" });
      add({ at: [2.6, -2.8], size: [.36, .08, .26], color: "#7d3b2c", y: 1.15 });
      // Departure clock and timetable on the back wall.
      add({ at: [-1.4, -3.96], size: [1.8, 1.1, .04], color: "#2b322e", y: 1.25, spot: "clock" });
      for (let i = 0; i < 5; i++) add({ at: [-1.4, -3.93], size: [1.5, .035, .01], color: i === 0 ? P.ochre : P.cream, y: 2.15 - i * .18 });
      const rim = cylinder(room, [-1.4, -3.96], .38, .05, "#2b322e"); rim.rotation.x = Math.PI / 2; rim.position.y = 2.78;
      const face = cylinder(room, [-1.4, -3.93], .34, .03, P.cream); face.rotation.x = Math.PI / 2; face.position.y = 2.78;
      add({ at: [-1.4, -3.9], size: [.025, .22, .01], color: "#1f1f1f", y: 2.78 });
      add({ at: [-1.32, -3.9], size: [.16, .025, .01], color: "#1f1f1f", y: 2.77 });
      // The farewell book in a glass display case.
      add({ at: [-.8, 0], size: [1.3, .95, .8], color: P.woodDark, spot: "display", solid: true });
      add({ at: [-.8, 0], size: [1.0, .02, .62], color: P.paper, y: .96 });
      add({ at: [-.8, 0], size: [.02, .03, .62], color: "#b9ab8a", y: .96 });
      glassy(add({ at: [-.8, 0], size: [1.3, .3, .8], color: P.glass, y: .97 }), .25);
      // Left-luggage lockers on the left wall.
      add({ at: [-4.55, -1.4], size: [.8, 2.1, 2.6], color: P.green, spot: "lockers", solid: true });
      cells(add, [-4.13, -1.4], "right", 2.6, 2.0, .05, 4, 4, "#2f4835");
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) add({ at: [-4.12, -1.4 + 1.3 - (c + .5) * .65], size: [.02, .06, .1], color: P.brass, y: .3 + r * .5 });
      // A bench and a luggage cart.
      add({ at: [1.6, 2.0], size: [2.2, .45, .55], color: P.wood, solid: true });
      add({ at: [1.6, 2.25], size: [2.2, .5, .06], color: P.wood, y: .45 });
      add({ at: [-3.6, 2.9], size: [1.2, .2, .7], color: "#5f6b66", y: .2, solid: true });
      for (const x of [-4.05, -3.15]) { const wheel = cylinder(room, [x, 2.9], .14, .72, "#2b2d2c"); wheel.rotation.x = Math.PI / 2; wheel.position.y = .14; }
      add({ at: [-3.75, 2.9], size: [.6, .4, .45], color: "#7d3b2c", y: .4 });
      add({ at: [-3.3, 2.85], size: [.4, .3, .4], color: P.ochre, y: .4 });
    }
  }
};

export const hasInterior = (sceneId: string) => sceneId in ROOMS;

/** Assigns each case search target to a spot: by keyword, then any free spot. */
export function assignTargets<T extends { id: string; label: string }>(room: RoomDef, targets: T[]) {
  const bySpot = new Map<string, T[]>();
  const free = [...room.spots];
  for (const target of targets) {
    const spot = room.spots.find(s => s.keywords.some(k => target.label.includes(k))) ?? free.find(s => !bySpot.has(s.id)) ?? room.spots[0];
    bySpot.set(spot.id, [...(bySpot.get(spot.id) ?? []), target]);
  }
  return bySpot;
}
