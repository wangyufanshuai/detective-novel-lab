import type { Point } from "./sample-navigation";

export interface SampleGround {
  schema: "classic-ground.v1";
  sourceSha256: string; assetSha256: string; navigationSha256: string;
  origin: Point; step: number; width: number; height: number;
  units: "millimetres"; heights: (number | null)[]; supportRadius: number;
}

/** The field is baked from the same evaluated Blender floor as the GLB. */
export function createGroundSampler(data: SampleGround, identity: { sourceSha256: string; assetSha256: string; navigationSha256: string }) {
  if (data.schema !== "classic-ground.v1" || data.units !== "millimetres" ||
      data.sourceSha256 !== identity.sourceSha256 || data.assetSha256 !== identity.assetSha256 || data.navigationSha256 !== identity.navigationSha256 ||
      !Array.isArray(data.origin) || data.origin.length !== 2 || !data.origin.every(Number.isFinite) ||
      !Number.isFinite(data.step) || data.step <= 0 || data.step > .1 ||
      !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 2 || data.height < 2 ||
      !Array.isArray(data.heights) || data.heights.length !== data.width * data.height ||
      data.heights.some(z => z !== null && (!Number.isInteger(z) || z < -100 || z > 300)) ||
      !Number.isFinite(data.supportRadius) || data.supportRadius < 0 || data.supportRadius > .12) throw new Error("地面与街区模型版本不一致");
  function surface(p: Point): number | null {
    if (!p.every(Number.isFinite)) return null;
    const u = (p[0] - data.origin[0]) / data.step, v = (p[1] - data.origin[1]) / data.step;
    if (u < 0 || v < 0 || u > data.width - 1 || v > data.height - 1) return null;
    const x = Math.min(Math.floor(u), data.width - 2), y = Math.min(Math.floor(v), data.height - 2);
    const corners = [data.heights[y * data.width + x], data.heights[y * data.width + x + 1],
      data.heights[(y + 1) * data.width + x], data.heights[(y + 1) * data.width + x + 1]];
    if (corners.some(z => z === null)) return null;
    const [a, b, c, d] = corners as number[], tx = u - x, ty = v - y;
    return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) / 1000;
  }
  // The sole's small support footprint bridges joints between floor boards.
  // A centre with no support never borrows a neighbour to invent a floor.
  function at(p: Point): number | null {
    const centre = surface(p);
    if (centre === null) return null;
    const r = data.supportRadius;
    return Math.max(centre, ...([[r, 0], [-r, 0], [0, r], [0, -r]] as Point[])
      .map(([x, y]) => surface([p[0] + x, p[1] + y]) ?? centre));
  }
  return { at, surface };
}
