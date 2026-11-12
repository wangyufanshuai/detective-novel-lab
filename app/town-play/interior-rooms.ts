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
};
export type RoomBox = { at: [number, number]; size: [number, number, number]; color: string; spot?: string; y?: number; solid?: boolean; hidden?: boolean };
export type RoomDef = {
  sceneId: string;
  title: string;
  size: [number, number];
  floor: [string, string];
  wall: string;
  wainscot: string;
  door: [number, number];
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

export const ROOMS: Record<string, RoomDef> = {
  books: {
    sceneId: "books", title: "旧书店", size: [10, 8], floor: [P.woodLight, "#94704a"], wall: P.cream, wainscot: P.green,
    door: [3.6, 3.3],
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
