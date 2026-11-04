#!/usr/bin/env python3
"""Generate a richer local-authored room candidate without external assets.

This pass is intentionally separate from procedural-v1.  It fixes the asset
origin/front-axis contract and adds authored silhouette detail, while keeping
every mesh and material project-local so the license gate stays explicit.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import shutil
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial


ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts" / "generate-procedural-room-candidate.py"
SPEC = importlib.util.spec_from_file_location("procedural_base", BASE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load base generator: {BASE_PATH}")
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)

GENERATOR_VERSION = "authored-local-room-candidate.v2"

PALETTE = {
    "shell": (24, 35, 49, 255),
    "shell_trim": (48, 67, 82, 255),
    "floor": (13, 22, 31, 255),
    "ceiling": (8, 13, 22, 255),
    "walnut": (47, 27, 21, 255),
    "walnut_edge": (104, 58, 34, 255),
    "brass": (165, 112, 48, 255),
    "brass_dark": (93, 61, 29, 255),
    "felt": (22, 53, 57, 255),
    "felt_shadow": (12, 31, 35, 255),
    "paper": (215, 195, 151, 255),
    "paper_shadow": (150, 126, 90, 255),
    "warm": (245, 161, 70, 255),
    "glass": (96, 145, 153, 190),
    "rubber": (18, 20, 22, 255),
}

MATERIAL_BY_COLOR = {
    PALETTE["shell"]: ("Archive Plaster", 0.02, 0.86),
    PALETTE["shell_trim"]: ("Archive Trim", 0.03, 0.72),
    PALETTE["floor"]: ("Slate Floor", 0.05, 0.82),
    PALETTE["ceiling"]: ("Ceiling Shadow", 0.0, 0.92),
    PALETTE["walnut"]: ("Dark Walnut", 0.08, 0.72),
    PALETTE["walnut_edge"]: ("Walnut Edge", 0.10, 0.54),
    PALETTE["brass"]: ("Aged Brass", 0.72, 0.32),
    PALETTE["brass_dark"]: ("Brass Shadow", 0.62, 0.42),
    PALETTE["felt"]: ("Oxidized Teal Felt", 0.0, 0.94),
    PALETTE["felt_shadow"]: ("Felt Recess", 0.0, 0.98),
    PALETTE["paper"]: ("Evidence Paper", 0.0, 0.76),
    PALETTE["paper_shadow"]: ("Paper Edge", 0.0, 0.88),
    PALETTE["warm"]: ("Warm Bulb", 0.05, 0.28),
    PALETTE["glass"]: ("Window Glass", 0.05, 0.18),
    PALETTE["rubber"]: ("Black Rubber", 0.0, 0.9),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("docs/3d-rooms/candidates/authored-v2/input"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("docs/3d-rooms/candidates/authored-v2"),
    )
    return parser.parse_args()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def input_hash(input_root: Path) -> str:
    digest = hashlib.sha256()
    for name in ("room-brief.json", "room-layout.json", "openings.json", "props.json"):
        path = input_root / name
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def apply_material(mesh: trimesh.Trimesh, color: tuple[int, int, int, int] | None = None) -> trimesh.Trimesh:
    if color is None:
        colors = getattr(mesh.visual, "face_colors", None)
        if colors is None or len(colors) == 0:
            color = PALETTE["shell"]
        else:
            color = tuple(int(value) for value in colors[0])
    name, metallic, roughness = MATERIAL_BY_COLOR.get(tuple(color), ("Local Authored Material", 0.0, 0.82))
    mesh.visual.material = PBRMaterial(
        name=name,
        baseColorFactor=[value / 255.0 for value in color],
        metallicFactor=metallic,
        roughnessFactor=roughness,
    )
    return mesh


def paint(mesh: trimesh.Trimesh, color: tuple[int, int, int, int]) -> trimesh.Trimesh:
    mesh.visual.face_colors = np.tile(np.asarray(color, dtype=np.uint8), (len(mesh.faces), 1))
    return apply_material(mesh, color)


def box(extents, center, color, rotation_z: float = 0.0):
    mesh = BASE.box(tuple(extents), tuple(center), color)
    apply_material(mesh, color)
    if rotation_z:
        matrix = trimesh.transformations.rotation_matrix(math.radians(rotation_z), [0, 0, 1])
        matrix[:3, 3] = np.asarray(center, dtype=float)
        mesh.apply_translation(-np.asarray(center, dtype=float))
        mesh.apply_transform(matrix)
    return mesh


def cylinder(radius, height, center, color, sections: int = 24, rotation_z: float = 0.0):
    mesh = BASE.cylinder(radius, height, center, color, sections)
    apply_material(mesh, color)
    if rotation_z:
        matrix = trimesh.transformations.rotation_matrix(math.radians(rotation_z), [0, 0, 1])
        matrix[:3, 3] = np.asarray(center, dtype=float)
        mesh.apply_translation(-np.asarray(center, dtype=float))
        mesh.apply_transform(matrix)
    return mesh


def cylinder_between(start, end, radius, color, sections: int = 16):
    start_v = np.asarray(start, dtype=float)
    end_v = np.asarray(end, dtype=float)
    direction = end_v - start_v
    length = float(np.linalg.norm(direction))
    if length <= 1e-6:
        return cylinder(radius, 0.02, start, color, sections)
    transform = trimesh.geometry.align_vectors([0, 0, 1], direction / length)
    transform[:3, 3] = (start_v + end_v) / 2.0
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=sections, transform=transform)
    return paint(mesh, color)


def cone(radius, height, center, color, sections: int = 24):
    mesh = BASE.cone(radius, height, center, color, sections)
    return apply_material(mesh, color)


def sphere(radius, center, color):
    mesh = BASE.sphere(radius, center, color)
    return apply_material(mesh, color)


def scene_with_parts(parts: list[tuple[str, trimesh.Trimesh]]) -> trimesh.Scene:
    scene = trimesh.Scene()
    for name, mesh in parts:
        scene.add_geometry(mesh, geom_name=name, node_name=name)
    return scene


def add_ring(parts, name, radius, tube, center, color, sections=24):
    ring = trimesh.creation.torus(major_radius=radius, minor_radius=tube, major_sections=sections, minor_sections=8)
    ring.apply_translation(np.asarray(center, dtype=float))
    parts.append((name, paint(ring, color)))


def evidence_table() -> trimesh.Scene:
    parts: list[tuple[str, trimesh.Trimesh]] = []
    # A readable furniture silhouette: top, apron, recessed tray, four legs,
    # lower stretcher, hardware, and event-card staging.
    parts += [
        ("top-slab", box((2.70, 1.20, 0.14), (0, 0, 0.84), PALETTE["walnut"])),
        ("top-edge-front", box((2.80, 0.07, 0.11), (0, -0.61, 0.82), PALETTE["walnut_edge"])),
        ("top-edge-back", box((2.80, 0.07, 0.11), (0, 0.61, 0.82), PALETTE["walnut_edge"])),
        ("top-edge-left", box((0.07, 1.14, 0.11), (-1.365, 0, 0.82), PALETTE["walnut_edge"])),
        ("top-edge-right", box((0.07, 1.14, 0.11), (1.365, 0, 0.82), PALETTE["walnut_edge"])),
        ("tray-shadow", box((2.16, 0.78, 0.05), (0, 0.05, 0.915), PALETTE["felt_shadow"])),
        ("tray-felt", box((2.02, 0.64, 0.035), (0, 0.05, 0.946), PALETTE["felt"])),
        ("apron-front", box((2.48, 0.08, 0.40), (0, -0.53, 0.57), PALETTE["walnut"])),
        ("apron-back", box((2.48, 0.08, 0.40), (0, 0.53, 0.57), PALETTE["walnut"])),
        ("drawer-face", box((1.10, 0.035, 0.18), (0, -0.585, 0.57), PALETTE["walnut_edge"])),
        ("drawer-shadow", box((0.96, 0.02, 0.12), (0, -0.607, 0.57), PALETTE["walnut"])),
    ]
    for x in (-1.16, 1.16):
        for y in (-0.46, 0.46):
            parts.append((f"leg-{x}-{y}", box((0.18, 0.18, 0.70), (x, y, 0.35), PALETTE["walnut"])))
            parts.append((f"foot-{x}-{y}", cylinder(0.11, 0.035, (x, y, 0.017), PALETTE["brass_dark"], 16)))
    parts += [
        ("stretcher-front", box((2.10, 0.07, 0.08), (0, -0.44, 0.22), PALETTE["walnut_edge"])),
        ("stretcher-back", box((2.10, 0.07, 0.08), (0, 0.44, 0.22), PALETTE["walnut_edge"])),
        ("drawer-handle", cylinder_between((-0.18, -0.64, 0.58), (0.18, -0.64, 0.58), 0.025, PALETTE["brass"], 12)),
    ]
    for index, x in enumerate((-0.94, -0.56, -0.18, 0.20, 0.58, 0.96), start=1):
        parts.append((f"pin-socket-{index}", cylinder(0.034, 0.055, (x, -0.34, 0.985), PALETTE["brass"], 16)))
        parts.append((f"pin-head-{index}", sphere(0.043, (x, -0.34, 1.02), PALETTE["brass"])))
    cards = [
        (-0.62, 0.16, 0.22, 0.30, -7),
        (-0.10, 0.20, 0.28, 0.34, 4),
        (0.48, 0.12, 0.24, 0.31, 9),
    ]
    for index, (x, y, width, height, angle) in enumerate(cards, start=1):
        parts.append((f"evidence-card-{index}", box((width, 0.025, height), (x, y, 0.98), PALETTE["paper"], angle)))
        parts.append((f"evidence-card-shadow-{index}", box((width + 0.035, 0.012, height + 0.035), (x + 0.02, y + 0.025, 0.968), PALETTE["paper_shadow"], angle)))
    return scene_with_parts(parts)


def archive_lamp() -> trimesh.Scene:
    parts: list[tuple[str, trimesh.Trimesh]] = [
        ("base-foot", cylinder(0.17, 0.045, (0, 0, 0.022), PALETTE["rubber"], 24)),
        ("base-step", cylinder(0.15, 0.08, (0, 0, 0.085), PALETTE["brass_dark"], 24)),
        ("base-cap", cylinder(0.10, 0.035, (0, 0, 0.142), PALETTE["metal"] if "metal" in PALETTE else PALETTE["brass_dark"], 20)),
        ("stem", cylinder_between((0, 0, 0.15), (0, 0, 0.49), 0.028, PALETTE["rubber"], 16)),
        ("hinge", sphere(0.055, (0, 0, 0.50), PALETTE["brass"])),
        ("arm", cylinder_between((0, 0, 0.50), (0.12, 0, 0.61), 0.025, PALETTE["rubber"], 16)),
        ("shade-neck", cylinder(0.035, 0.07, (0.14, 0, 0.63), PALETTE["brass"], 16)),
        ("shade", cone(0.17, 0.19, (0.14, 0, 0.72), PALETTE["rubber"], 24)),
        ("shade-rim", cylinder(0.172, 0.025, (0.14, 0, 0.625), PALETTE["brass_dark"], 24)),
        ("bulb", sphere(0.055, (0.14, 0, 0.65), PALETTE["warm"])),
        ("cable-relief", cylinder_between((-0.02, 0.12, 0.13), (-0.02, 0.12, 0.39), 0.012, PALETTE["rubber"], 10)),
    ]
    add_ring(parts, "base-ring", 0.135, 0.012, (0, 0, 0.14), PALETTE["brass"])
    return scene_with_parts(parts)


def caseboard() -> trimesh.Scene:
    parts: list[tuple[str, trimesh.Trimesh]] = []
    # Local +Y is the room-facing front. The wall instances rotate +/-90° so
    # both boards face the central room rather than the exterior wall.
    parts += [
        ("felt-back", box((2.20, 0.12, 1.48), (0, 0.06, 0.74), PALETTE["felt_shadow"])),
        ("felt-front", box((2.08, 0.035, 1.36), (0, 0.14, 0.74), PALETTE["felt"])),
        ("frame-top", box((2.30, 0.20, 0.10), (0, 0.13, 1.50), PALETTE["walnut_edge"])),
        ("frame-bottom", box((2.30, 0.20, 0.10), (0, 0.13, 0.05), PALETTE["walnut_edge"])),
        ("frame-left", box((0.10, 0.20, 1.55), (-1.10, 0.13, 0.775), PALETTE["walnut_edge"])),
        ("frame-right", box((0.10, 0.20, 1.55), (1.10, 0.13, 0.775), PALETTE["walnut_edge"])),
        ("header-plaque", box((1.42, 0.035, 0.14), (0, 0.17, 1.30), PALETTE["brass_dark"])),
        ("header-inset", box((1.18, 0.018, 0.055), (0, 0.19, 1.30), PALETTE["paper"])),
    ]
    for index, z in enumerate((0.43, 0.77, 1.08), start=1):
        parts.append((f"rail-{index}", box((1.82, 0.035, 0.035), (0, 0.175, z), PALETTE["brass"])))
    card_specs = [
        (-0.72, 0.54, 0.31, 0.21, -4), (-0.25, 0.54, 0.30, 0.22, 3),
        (0.30, 0.54, 0.34, 0.20, 6), (0.73, 0.54, 0.29, 0.23, -5),
        (-0.54, 0.87, 0.26, 0.18, 5), (0.40, 0.87, 0.30, 0.18, -3),
    ]
    for index, (x, z, width, height, angle) in enumerate(card_specs, start=1):
        parts.append((f"card-shadow-{index}", box((width + 0.035, 0.012, height + 0.035), (x + 0.018, 0.19, z - 0.018), PALETTE["paper_shadow"], angle)))
        parts.append((f"card-{index}", box((width, 0.022, height), (x, 0.205, z), PALETTE["paper"], angle)))
        parts.append((f"pin-{index}", sphere(0.035, (x, 0.225, z + height * 0.28), PALETTE["brass"])))
    return scene_with_parts(parts)


def asset_scenes():
    return {"evidence-table": evidence_table(), "archive-lamp": archive_lamp(), "caseboard": caseboard()}


def add_trim(scene: trimesh.Scene, layout: dict, openings: list[dict], include_south: bool = True):
    # Architectural trim remains procedural and is kept outside the prop budget.
    trim = PALETTE["shell_trim"]
    scene.add_geometry(box((11.6, 0.10, 0.18), (0, 3.77, 0.13), trim), geom_name="TRIM_north_base", node_name="TRIM_north_base")
    if include_south:
        scene.add_geometry(box((11.6, 0.10, 0.18), (0, -3.77, 0.13), trim), geom_name="TRIM_south_base", node_name="TRIM_south_base")
    scene.add_geometry(box((0.10, 7.6, 0.18), (5.77, 0, 0.13), trim), geom_name="TRIM_east_base", node_name="TRIM_east_base")
    scene.add_geometry(box((0.10, 7.6, 0.18), (-5.77, 0, 0.13), trim), geom_name="TRIM_west_base", node_name="TRIM_west_base")
    # A shallow ceiling cove gives the upper silhouette a deliberate finish.
    scene.add_geometry(box((11.7, 0.12, 0.14), (0, 3.76, 3.92), trim), geom_name="TRIM_north_cove", node_name="TRIM_north_cove")
    if include_south:
        scene.add_geometry(box((11.7, 0.12, 0.14), (0, -3.76, 3.92), trim), geom_name="TRIM_south_cove", node_name="TRIM_south_cove")
    scene.add_geometry(box((0.12, 7.55, 0.14), (5.76, 0, 3.92), trim), geom_name="TRIM_east_cove", node_name="TRIM_east_cove")
    scene.add_geometry(box((0.12, 7.55, 0.14), (-5.76, 0, 3.92), trim), geom_name="TRIM_west_cove", node_name="TRIM_west_cove")


def scene_stats(scene: trimesh.Scene) -> dict:
    meshes = [mesh for mesh in scene.geometry.values() if isinstance(mesh, trimesh.Trimesh)]
    bounds = scene.bounds
    return {
        "meshCount": len(meshes),
        "triangleCount": int(sum(len(mesh.faces) for mesh in meshes)),
        "boundsMeters": [round(float(value), 5) for value in (bounds[1] - bounds[0])],
        "watertightMeshCount": int(sum(bool(mesh.is_watertight) for mesh in meshes)),
    }


def write_scene(scene: trimesh.Scene, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(str(path), file_type="glb")


def main():
    args = parse_args()
    input_root = args.input.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    (output / "meshes").mkdir(parents=True, exist_ok=True)
    (output / "runtime").mkdir(parents=True, exist_ok=True)
    (output / "renders").mkdir(parents=True, exist_ok=True)
    for input_name in ("room-brief.json", "room-layout.json", "openings.json", "props.json", "plan-metadata.json"):
        source_input = input_root / input_name
        if input_name == "plan-metadata.json":
            source_input = input_root.parents[2] / input_name
        shutil.copy2(source_input, output / input_name)
    source_package = input_root.parents[2]
    for support_dir in ("plans", "masks", "images"):
        source_dir = source_package / support_dir
        target_dir = output / support_dir
        if source_dir.is_dir() and not target_dir.exists():
            shutil.copytree(source_dir, target_dir)
    layout = load_json(input_root / "room-layout.json")
    openings_doc = load_json(input_root / "openings.json")
    assets = asset_scenes()
    asset_stats = {}
    for asset_id, asset_scene in assets.items():
        path = output / "meshes" / f"{asset_id}.glb"
        write_scene(asset_scene, path)
        asset_stats[asset_id] = {
            "path": path.relative_to(output).as_posix(),
            "sha256": hash_file(path),
            "dimensionsMeters": scene_stats(asset_scene)["boundsMeters"],
            "stats": scene_stats(asset_scene),
            "license": "project-local-original",
            "source": GENERATOR_VERSION,
            "status": "candidate-only",
            "originContract": "floor-centered-z-up" if asset_id != "caseboard" else "wall-back-positive-y-front",
        }

    room = trimesh.Scene()
    opening_list = openings_doc.get("openings", [])
    for surface in layout.get("surfaces", []):
        kind = surface.get("kind")
        if kind == "floor":
            BASE.add_surface(room, surface, PALETTE["floor"])
        elif kind == "ceiling":
            BASE.add_surface(room, surface, PALETTE["ceiling"])
        elif kind == "wall":
            BASE.add_wall_with_openings(room, surface, opening_list, PALETTE["shell"])
    add_trim(room, layout, opening_list)
    for instance in layout.get("instances", []):
        BASE.add_room_instance(room, assets[instance["assetId"]], instance, instance["assetId"])
    for mesh in room.geometry.values():
        apply_material(mesh)
    room_path = output / "runtime" / "authored-room-candidate.glb"
    write_scene(room, room_path)

    # A cutaway is an art-review aid only. It removes the ceiling and arrival
    # wall so a generic GLB preview camera can inspect the interior. It is never
    # used as the runtime room and carries the same candidate-only boundary.
    cutaway = trimesh.Scene()
    for surface in layout.get("surfaces", []):
        if surface.get("id") in {"ceiling", "wall-south"}:
            continue
        kind = surface.get("kind")
        if kind == "floor":
            BASE.add_surface(cutaway, surface, PALETTE["floor"])
        elif kind == "wall":
            BASE.add_wall_with_openings(cutaway, surface, opening_list, PALETTE["shell"])
    add_trim(cutaway, layout, opening_list, include_south=False)
    for instance in layout.get("instances", []):
        BASE.add_room_instance(cutaway, assets[instance["assetId"]], instance, instance["assetId"])
    for mesh in cutaway.geometry.values():
        apply_material(mesh)
    cutaway_path = output / "renders" / "authored-room-cutaway-preview.glb"
    write_scene(cutaway, cutaway_path)

    source_hash = input_hash(input_root)
    manifest = {
        "schema": "game-room.authored-candidate.v2",
        "roomId": layout["roomId"],
        "variant": "authored-local-v2",
        "generator": {"id": GENERATOR_VERSION, "inputSha256": source_hash},
        "source": {
            "inputRoot": "input",
            "artDirection": "art-direction.md",
            "licenseLedger": "license-ledger.json",
            "artAcceptanceRubric": "art-acceptance-rubric.md",
        },
        "status": "candidate-only",
        "humanApproval": False,
        "externalAssets": False,
        "meshGeneration": "local-authored-procedural-primitives",
        "assets": asset_stats,
        "room": {
            "path": room_path.relative_to(output).as_posix(),
            "sha256": hash_file(room_path),
            "stats": scene_stats(room),
            "openingsApplied": [opening["id"] for opening in opening_list],
        },
        "artReviewPreview": {
            "path": cutaway_path.relative_to(output).as_posix(),
            "sha256": hash_file(cutaway_path),
            "stats": scene_stats(cutaway),
            "runtimeEligible": False,
        },
        "gateBoundary": {
            "function": "pending-human-review",
            "form": "candidate-only-until-review-renders-and-art-approval",
            "runtime": "blocked-until-browser-capture-and-performance-receipt",
        },
    }
    (output / "authored-candidate.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    world_assets = [
        {
            "id": asset_id,
            "kind": "model",
            "path": asset_info["path"],
            "sha256": asset_info["sha256"],
            "bytes": (output / asset_info["path"]).stat().st_size,
            "license": asset_info["license"],
            "source": asset_info["source"],
            "status": "candidate-only",
            "humanApproval": False,
            "runtimeVerified": False,
            "dimensionsMeters": asset_info["dimensionsMeters"],
        }
        for asset_id, asset_info in asset_stats.items()
    ]
    world_assets.append({
        "id": "authored-room",
        "kind": "room",
        "path": room_path.relative_to(output).as_posix(),
        "sha256": hash_file(room_path),
        "bytes": room_path.stat().st_size,
        "license": "project-local-original",
        "source": GENERATOR_VERSION,
        "status": "candidate-only",
        "humanApproval": False,
        "runtimeVerified": False,
        "dimensionsMeters": manifest["room"]["stats"]["boundsMeters"],
    })
    (output / "asset-manifest.json").write_text(json.dumps({
        "schema": "world-asset-manifest.v1",
        "packageId": "fog-lamp-evidence-room",
        "version": "2.0.0-authored-candidate",
        "generatedAt": "2026-10-06T00:00:00.000Z",
        "policy": {"licenseRequired": True, "humanReviewRequired": True, "runtimeVerificationRequired": True},
        "assets": world_assets,
    }, indent=2) + "\n", encoding="utf-8")
    license_assets = []
    for asset in world_assets:
        license_assets.append({
            "id": asset["id"],
            "path": asset["path"],
            "bytes": asset["bytes"],
            "sha256": asset["sha256"],
            "dimensionsMeters": asset["dimensionsMeters"],
            "license": asset["license"],
            "source": asset["source"],
            "humanApproval": False,
            "runtimeVerified": False,
        })
    (output / "license-ledger.json").write_text(json.dumps({
        "schema": "world-asset-license-ledger.v1",
        "packageId": "fog-lamp-evidence-room",
        "variant": "authored-local-v2",
        "defaultStatus": "candidate-only",
        "externalDownloads": False,
        "assets": license_assets,
    }, indent=2) + "\n", encoding="utf-8")
    review_renders = []
    for render_name in (
        "evidence-table-preview.png",
        "archive-lamp-preview.png",
        "caseboard-preview.png",
        "authored-room-cutaway-preview.png",
    ):
        render_path = output / "renders" / render_name
        if render_path.is_file():
            review_renders.append({
                "path": render_path.relative_to(output).as_posix(),
                "sha256": hash_file(render_path),
                "status": "agent-preflight",
            })
    (output / "art-review.json").write_text(json.dumps({
        "schema": "game-room.art-review.v1",
        "roomId": "fog-lamp-evidence-room",
        "variant": "authored-local-v2",
        "reviewStatus": "candidate-only",
        "humanApproval": False,
        "reviewRenders": review_renders,
        "observations": [
            "Evidence table now has a readable hero silhouette, inset tray, hardware, cards, and four legs.",
            "Archive lamp now reads as a floor fixture with a weighted base, articulated arm, hood, bulb, and cable relief.",
            "Caseboard front face is positive-Y before wall rotation and visibly contains frame, rails, cards, and pin heads.",
            "Room cutaway preview is an art-review aid only; production camera and Blender runtime lighting still require review.",
        ],
        "blockingQuestions": [
            "Does the material hierarchy read as municipal archive rather than generic dark fantasy?",
            "Does the hero table still leave a comfortable central aisle at the intended camera and player route?",
            "Are the evidence cards and brass accents restrained enough to keep the case projection legible?",
        ],
    }, indent=2) + "\n", encoding="utf-8")
    (output / "art-acceptance-rubric.md").write_text(
        "# Art acceptance rubric — fog-lamp-evidence-room / authored-local-v2\n\n"
        "This rubric is a human sign-off sheet for a candidate GLB package. It does not grant approval by itself. "
        "The package remains `candidate-only` until every required owner and receipt is present.\n\n"
        "## A. Asset authorization\n\n"
        "- [ ] Every mesh has a row in `license-ledger.json` with a source, license, SHA-256, and byte count.\n"
        "- [ ] The reviewer confirms that the three props and the room are project-local authored geometry.\n"
        "- [ ] No downloaded mesh, texture, HDRI, Meshy task, or paid generation is introduced without a separate written license and spend approval.\n"
        "- [ ] `asset-manifest.json` remains byte/hash bound to the exact files reviewed.\n"
        "- Reviewer / date / decision: ______________________________\n\n"
        "## B. Function review — human gate\n\n"
        "- [ ] South arrival is readable and does not collide with the hero table.\n"
        "- [ ] Central aisle, evidence-table interaction space, and both investigation loops remain comfortable at the production camera.\n"
        "- [ ] The table is the evidence anchor; caseboards explain the route; lamps guide attention without competing with the evidence.\n"
        "- [ ] Caseboard fronts face the room after east/west rotations; cards and pins are legible at the intended interaction distance.\n"
        "- [ ] Room scale supports the player capsule, camera height, screen clearance, and collision plan.\n"
        "- Reviewer / date / decision: ______________________________\n\n"
        "## C. Form review — human art gate\n\n"
        "- [ ] Hero silhouettes are distinctive in a clay render and in the authored material pass.\n"
        "- [ ] Material hierarchy reads as municipal archive: mineral shell, dark walnut, oxidized teal felt, restrained aged brass, and warm paper evidence.\n"
        "- [ ] Proportions, bevel language, attachment points, normals, watertight parts, and floor/wall origins are acceptable for final Blender composition.\n"
        "- [ ] Blender review includes four corner views, a center low view, two ceiling obliques, a clay pass, and a material pass.\n"
        "- [ ] No floating, mirrored, back-facing, or inaccessible evidence elements remain.\n"
        "- Reviewer / date / decision: ______________________________\n\n"
        "## D. Runtime gate\n\n"
        "- [ ] The accepted runtime GLB is the same hash as the reviewed export and its public copy.\n"
        "- [ ] Browser capture records load time, frame-time p95, memory/asset size, interaction hit tests, reduced-motion behavior, and WebGL recovery.\n"
        "- [ ] Target desktop and mobile devices meet the agreed performance budget.\n"
        "- [ ] Runtime evidence is linked to `roomId`, `caseId`, and the reviewed asset manifest.\n"
        "- Reviewer / date / decision: ______________________________\n\n"
        "## Promotion rule\n\n"
        "Promote only when A, B, C, and D are signed, the final report is regenerated from the signed hashes, and the runtime receipt is attached. "
        "Until then, keep `humanApproval=false`, `status=candidate-only`, and keep the authored candidate separate from the v1 player route.\n",
        encoding="utf-8",
    )
    (output / "README.md").write_text(
        "# Authored local v2 room candidate\n\n"
        "This package is a richer local procedural modeling pass for `fog-lamp-evidence-room`. "
        "It fixes the floor-centered asset origin contract, makes the caseboard front face positive-Y before wall rotation, "
        "and adds authored furniture, hardware, cards, rails, trim, and material separation.\n\n"
        "All meshes are generated from local primitives. There are no downloaded models, textures, HDRIs, Meshy tasks, or external licenses. "
        "The package remains `candidate-only`: human Function/Form approval and real runtime performance evidence are still required. "
        "`renders/authored-room-cutaway-preview.glb` is an art-review aid and is never runtime eligible. "
        "Use `art-acceptance-rubric.md` as the human sign-off sheet.\n",
        encoding="utf-8",
    )
    print(json.dumps({"ok": True, "output": str(output), "inputSha256": source_hash, "room": manifest["room"]["stats"]}, separators=(",", ":")))


if __name__ == "__main__":
    main()
