#!/usr/bin/env python3
"""Build a deterministic, license-safe 3D room candidate from the room contract.

This is an authoring aid for the Function-stage room draft.  It writes candidate
GLBs under the requested output directory and never changes the authoritative
Meshy manifest, milestone reviews, or final gate report.  The generated files are
procedural engineering evidence; they are not accepted assets and cannot close
the human Function/Form/Runtime gates.

The script intentionally uses only primitive geometry and a small neutral palette
so the result can be regenerated without downloading an external model or
texture.  ``trimesh`` is an authoring dependency on the workstation; the game
runtime does not import this module.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
import trimesh


GENERATOR_VERSION = "procedural-room-candidate.v1"


PALETTE = {
    "shell": (33, 40, 49, 255),
    "floor": (17, 24, 31, 255),
    "ceiling": (11, 15, 21, 255),
    "wood": (48, 31, 24, 255),
    "wood_edge": (78, 49, 33, 255),
    "metal": (82, 91, 99, 255),
    "brass": (158, 113, 47, 255),
    "felt": (31, 45, 49, 255),
    "paper": (186, 177, 148, 255),
    "warm": (238, 157, 68, 255),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", type=Path, default=Path("docs/3d-rooms"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("docs/3d-rooms/candidates/procedural-v1"),
    )
    return parser.parse_args()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def input_hash(package: Path) -> str:
    digest = hashlib.sha256()
    for name in ("room-brief.json", "room-layout.json", "openings.json", "props.json"):
        path = package / name
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def paint(mesh: trimesh.Trimesh, color: tuple[int, int, int, int]) -> trimesh.Trimesh:
    mesh.visual.face_colors = np.tile(np.asarray(color, dtype=np.uint8), (len(mesh.faces), 1))
    return mesh


def box(
    extents: tuple[float, float, float],
    center: tuple[float, float, float],
    color: tuple[int, int, int, int],
) -> trimesh.Trimesh:
    mesh = trimesh.creation.box(extents=np.asarray(extents, dtype=float))
    mesh.apply_translation(np.asarray(center, dtype=float))
    return paint(mesh, color)


def cylinder(
    radius: float,
    height: float,
    center: tuple[float, float, float],
    color: tuple[int, int, int, int],
    sections: int = 24,
) -> trimesh.Trimesh:
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    mesh.apply_translation(np.asarray(center, dtype=float))
    return paint(mesh, color)


def cone(
    radius: float,
    height: float,
    center: tuple[float, float, float],
    color: tuple[int, int, int, int],
    sections: int = 24,
) -> trimesh.Trimesh:
    mesh = trimesh.creation.cone(radius=radius, height=height, sections=sections)
    mesh.apply_translation(np.asarray(center, dtype=float))
    return paint(mesh, color)


def sphere(radius: float, center: tuple[float, float, float], color: tuple[int, int, int, int]):
    mesh = trimesh.creation.icosphere(subdivisions=2, radius=radius)
    mesh.apply_translation(np.asarray(center, dtype=float))
    return paint(mesh, color)


def scene_with_parts(parts: list[tuple[str, trimesh.Trimesh]]) -> trimesh.Scene:
    scene = trimesh.Scene()
    for name, mesh in parts:
        scene.add_geometry(mesh, geom_name=name, node_name=name)
    return scene


def recenter(scene: trimesh.Scene) -> trimesh.Scene:
    low, high = scene.bounds
    offset = -((low + high) / 2.0)
    for mesh in scene.geometry.values():
        mesh.apply_translation(offset)
    return scene


def evidence_table() -> trimesh.Scene:
    parts: list[tuple[str, trimesh.Trimesh]] = [
        ("body", box((2.8, 1.3, 0.68), (0, 0, 0.34), PALETTE["wood"])),
        ("edge", box((2.8, 1.3, 0.10), (0, 0, 0.73), PALETTE["wood_edge"])),
        ("tray", box((2.05, 0.74, 0.07), (0, 0.05, 0.815), PALETTE["felt"])),
    ]
    for index, x in enumerate((-0.94, -0.56, -0.18, 0.20, 0.58, 0.96)):
        parts.append((f"pin-{index + 1}", cylinder(0.032, 0.05, (x, -0.35, 0.86), PALETTE["brass"], 16)))
    return recenter(scene_with_parts(parts))


def archive_lamp() -> trimesh.Scene:
    parts: list[tuple[str, trimesh.Trimesh]] = [
        ("base", cylinder(0.175, 0.08, (0, 0, 0.04), PALETTE["metal"])),
        ("stem", cylinder(0.028, 0.32, (0, 0, 0.24), PALETTE["metal"], 16)),
        ("shade", cone(0.15, 0.18, (0, 0, 0.49), PALETTE["metal"])),
        ("bulb", sphere(0.05, (0, 0, 0.60), PALETTE["warm"])),
    ]
    return recenter(scene_with_parts(parts))


def caseboard() -> trimesh.Scene:
    parts: list[tuple[str, trimesh.Trimesh]] = [
        ("board", box((2.2, 0.15, 1.5), (0, 0, 0.75), PALETTE["felt"])),
        ("header", box((1.84, 0.035, 0.08), (0, -0.095, 1.27), PALETTE["brass"])),
        ("rail-top", box((1.84, 0.035, 0.035), (0, -0.095, 0.98), PALETTE["brass"])),
        ("rail-bottom", box((1.84, 0.035, 0.035), (0, -0.095, 0.48), PALETTE["brass"])),
    ]
    for index, x in enumerate((-0.73, -0.24, 0.25, 0.74)):
        parts.append((f"card-{index + 1}", box((0.30, 0.025, 0.22), (x, -0.115, 0.76), PALETTE["paper"])))
    return recenter(scene_with_parts(parts))


def asset_scenes() -> dict[str, trimesh.Scene]:
    return {
        "evidence-table": evidence_table(),
        "archive-lamp": archive_lamp(),
        "caseboard": caseboard(),
    }


def add_surface(scene: trimesh.Scene, surface: dict, color: tuple[int, int, int, int]):
    mesh = box(tuple(surface["dimensionsMeters"]), tuple(surface["location"]), color)
    rotation = surface.get("rotationDegrees", [0, 0, 0])
    if any(rotation):
        matrix = trimesh.transformations.euler_matrix(
            *[math.radians(float(value)) for value in rotation], axes="sxyz"
        )
        mesh.apply_transform(matrix)
    scene.add_geometry(mesh, geom_name=f"SHELL_{surface['id']}", node_name=f"SHELL_{surface['id']}")


def add_wall_with_openings(
    scene: trimesh.Scene,
    surface: dict,
    openings: list[dict],
    color: tuple[int, int, int, int],
):
    surface_id = surface["id"]
    dims = tuple(float(value) for value in surface["dimensionsMeters"])
    sx, sy, sz = dims
    cx, cy, cz = (float(value) for value in surface["location"])
    relevant = [opening for opening in openings if opening.get("wall") == surface_id]
    if not relevant or sx < sy:
        add_surface(scene, surface, color)
        return
    intervals = sorted(
        (
            float(opening["positionMeters"][0]) - float(opening["widthMeters"]) / 2.0,
            float(opening["positionMeters"][0]) + float(opening["widthMeters"]) / 2.0,
            float(opening.get("sillMeters", 0.0)),
            float(opening["heightMeters"]),
            opening["id"],
        )
        for opening in relevant
    )
    wall_low, wall_high = cx - sx / 2.0, cx + sx / 2.0
    cursor = wall_low
    segment_index = 0
    for opening_low, opening_high, sill, height, opening_id in intervals:
        if opening_low > cursor:
            segment = box((opening_low - cursor, sy, sz), ((cursor + opening_low) / 2.0, cy, cz), color)
            scene.add_geometry(segment, geom_name=f"SHELL_{surface_id}_left_{segment_index}", node_name=f"SHELL_{surface_id}_left_{segment_index}")
            segment_index += 1
        if sill > 0:
            segment = box((opening_high - opening_low, sy, sill), ((opening_low + opening_high) / 2.0, cy, sill / 2.0), color)
            scene.add_geometry(segment, geom_name=f"SHELL_{surface_id}_{opening_id}_sill", node_name=f"SHELL_{surface_id}_{opening_id}_sill")
        top = sill + height
        if top < sz:
            segment = box((opening_high - opening_low, sy, sz - top), ((opening_low + opening_high) / 2.0, cy, top + (sz - top) / 2.0), color)
            scene.add_geometry(segment, geom_name=f"SHELL_{surface_id}_{opening_id}_lintel", node_name=f"SHELL_{surface_id}_{opening_id}_lintel")
        cursor = opening_high
    if cursor < wall_high:
        segment = box((wall_high - cursor, sy, sz), ((cursor + wall_high) / 2.0, cy, cz), color)
        scene.add_geometry(segment, geom_name=f"SHELL_{surface_id}_right", node_name=f"SHELL_{surface_id}_right")


def add_room_instance(
    scene: trimesh.Scene,
    asset_scene: trimesh.Scene,
    instance: dict,
    asset_id: str,
):
    rotation = trimesh.transformations.rotation_matrix(
        math.radians(float(instance["rotationDegrees"][2])), [0, 0, 1]
    )
    location = np.asarray(instance["location"], dtype=float)
    scale = np.asarray(instance.get("scale", [1, 1, 1]), dtype=float)
    for index, source in enumerate(asset_scene.geometry.values()):
        mesh = source.copy()
        mesh.apply_scale(scale)
        mesh.apply_transform(rotation)
        mesh.apply_translation(location)
        name = f"PROP_{instance['id']}__{asset_id}__{index}"
        scene.add_geometry(mesh, geom_name=name, node_name=name)


def write_scene(scene: trimesh.Scene, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(str(path), file_type="glb")


def scene_stats(scene: trimesh.Scene) -> dict:
    meshes = [mesh for mesh in scene.geometry.values() if isinstance(mesh, trimesh.Trimesh)]
    bounds = scene.bounds
    return {
        "meshCount": len(meshes),
        "triangleCount": int(sum(len(mesh.faces) for mesh in meshes)),
        "boundsMeters": [round(float(value), 5) for value in (bounds[1] - bounds[0])],
        "watertightMeshCount": int(sum(bool(mesh.is_watertight) for mesh in meshes)),
    }


def main():
    args = parse_args()
    package = args.package.resolve()
    output = args.output.resolve()
    if not (package / "room-layout.json").is_file():
        raise SystemExit(f"room package not found: {package}")
    if output.exists():
        shutil.rmtree(output)
    (output / "meshes").mkdir(parents=True)
    (output / "renders").mkdir()
    (output / "runtime").mkdir()

    layout = load_json(package / "room-layout.json")
    brief = load_json(package / "room-brief.json")
    openings_doc = load_json(package / "openings.json")
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
            "status": "procedural-candidate",
        }

    room = trimesh.Scene()
    opening_list = openings_doc.get("openings", [])
    for surface in layout.get("surfaces", []):
        kind = surface.get("kind")
        if kind == "floor":
            add_surface(room, surface, PALETTE["floor"])
        elif kind == "ceiling":
            add_surface(room, surface, PALETTE["ceiling"])
        elif kind == "wall":
            add_wall_with_openings(room, surface, opening_list, PALETTE["shell"])
        else:
            add_surface(room, surface, PALETTE["shell"])
    for instance in layout.get("instances", []):
        asset_id = instance["assetId"]
        add_room_instance(room, assets[asset_id], instance, asset_id)
    room_path = output / "runtime" / "procedural-room-candidate.glb"
    write_scene(room, room_path)

    source_hash = input_hash(package)
    manifest = {
        "schema": "game-room.procedural-candidate.v1",
        "roomId": layout["roomId"],
        "generator": {"id": GENERATOR_VERSION, "inputSha256": source_hash},
        "source": {
            "roomBrief": "../../room-brief.json",
            "roomLayout": "../../room-layout.json",
            "openings": "../../openings.json",
            "authoritativeProps": "../../props.json",
        },
        "status": "candidate-only",
        "humanApproval": False,
        "externalAssets": False,
        "meshGeneration": "procedural-primitives",
        "assets": asset_stats,
        "room": {
            "path": room_path.relative_to(output).as_posix(),
            "sha256": hash_file(room_path),
            "stats": scene_stats(room),
            "openingsApplied": [opening["id"] for opening in opening_list],
        },
        "gateBoundary": {
            "function": "pending-human-review",
            "form": "blocked-until-approved-glb-and-review-renders",
            "runtime": "blocked-until-browser-capture-and-performance-receipt",
        },
    }
    (output / "procedural-candidate.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    readme = f"""# Procedural room candidate\n\nThis directory is generated from `docs/3d-rooms` input hash `{source_hash}` using `{GENERATOR_VERSION}`. It contains primitive-only GLB geometry for authoring and scale review.\n\nThe candidate is deliberately separate from `props.json`, `milestone-reviews.json`, and `final-report.json`: it has no human approval, no Meshy task, no licensed external asset, and no runtime performance receipt. It must not be promoted to `acceptedMesh` or used to claim a closed Build 3D gate.\n\nThe room shell applies the scheduled south door and north window cutouts. The evidence table, paired archive lamps, and mirrored case boards are authored as separate candidate assets and then placed from `room-layout.json`.\n"""
    (output / "README.md").write_text(readme, encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(output), "inputSha256": source_hash, "room": manifest["room"]["stats"]}, separators=(",", ":")))


if __name__ == "__main__":
    main()
