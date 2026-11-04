"""Measure original articulated cast, then export only that cast after ordered review."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "docs/3d-town/riverbend-residents-v2"
PUBLIC = ROOT / "public/assets/riverbend/residents-v2"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    author = read(PACKAGE / "authoring-receipt.json")
    source = PACKAGE / author["source"]["path"]
    assert sha(source) == author["source"]["sha256"]
    for item in author["inputs"]:
        assert sha(ROOT / item["path"]) == item["sha256"]
    function = read(PACKAGE / "function-review.json")
    assert function["passed"] and function["sourceSha256"] == sha(source)
    for item in function["inputs"]:
        assert sha(ROOT / item["path"]) == item["sha256"], "Function input changed"
    assert function["renderReceiptSha256"] == sha(PACKAGE / "render-receipt.json")
    renders = read(PACKAGE / "render-receipt.json")
    assert renders["complete"]
    for render in renders["renders"]:
        assert sha(PACKAGE / render["path"]) == render["sha256"]
    bpy.ops.wm.open_mainfile(filepath=str(source))
    actors = [o for o in bpy.data.objects if str(o.get("actorId", "")).startswith("resident-")]
    assert len(actors) == 12
    measured = []
    for actor in sorted(actors, key=lambda o:o["actorId"]):
        joints = [o for o in actor.children_recursive if "joint" in o]
        assert len(joints) == 7 and len({o["joint"] for o in joints}) == 7
        meshes = [o for o in actor.children_recursive if o.type == "MESH"]
        assert meshes and all(o.get("origin") == "project-local-original" for o in meshes)
        bpy.context.view_layer.update()
        inverse = actor.matrix_world.inverted()
        vertices = [inverse @ obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
        bounds = [[min(v[axis] for v in vertices),max(v[axis] for v in vertices)] for axis in range(3)]
        radius = 0
        min_z = 10
        for step in range(32):
            phase = step * math.tau / 32
            for joint in joints:
                name = joint["joint"]
                stride = math.sin(phase + (math.pi if name.endswith("right") else 0))
                joint.rotation_euler.x = stride * .30 if name.startswith("leg_") else -max(0,-stride)*.42 if name.startswith("knee_") else -stride*.23 if name.startswith("arm_") else 0
            bpy.context.view_layer.update()
            for obj in meshes:
                transform = inverse @ obj.matrix_world
                for vertex in obj.data.vertices:
                    point = transform @ vertex.co
                    radius = max(radius, math.hypot(point.x,point.y))
                    min_z = min(min_z, point.z)
        for joint in joints:
            joint.rotation_euler = (0,0,0)
        assert 1.50 < bounds[2][1] < 1.91, (actor.name,bounds)
        assert radius < function["residentRadius"], (actor.name,"Walking envelope exceeds collision radius",radius)
        assert min_z >= -.012, (actor.name,"Foot penetrates ground",min_z)
        materials = sorted({mat.name for obj in meshes for mat in obj.data.materials})
        for obj in meshes:
            obj.data.calc_loop_triangles()
        measured.append({"actorId":actor["actorId"],"joints":len(joints),"sourceMeshes":len(meshes),
                         "triangles":sum(len(o.data.loop_triangles) for o in meshes),"bounds":bounds,
                         "walkingRadius":round(radius,5),"minimumWalkingZ":round(min_z,5),"materials":materials})
    bpy.context.view_layer.update()
    form = {"schema":"riverbend-resident-form.v2","passed":True,"sourceSha256":sha(source),
            "functionReceiptSha256":sha(PACKAGE / "function-review.json"),"exporterSha256":sha(Path(__file__)),
            "actors":measured,"checks":["12 identities","7 independent joints each","original geometry provenance","32 walking-envelope poses","ground contact tolerance","scale and material inventory"],
            "scope":"Geometry measurements; visual judgment and human art approval remain separate"}
    if not args.export:
        write(PACKAGE / "form-review.json", form)
        print("RESIDENT_FORM=" + json.dumps({"passed":True,"actors":12,"triangles":sum(a["triangles"] for a in measured),"maxRadius":max(a["walkingRadius"] for a in measured)}))
        return
    assert read(PACKAGE / "form-review.json") == form, "Form measurements changed"
    visual = read(PACKAGE / "visual-review.json")
    assert visual["eligibleForLocalPreview"] and not visual["humanArtApproved"]
    assert visual["sourceSha256"] == sha(source) and visual["formReceiptSha256"] == sha(PACKAGE / "form-review.json")
    assert visual["renderReceiptSha256"] == sha(PACKAGE / "render-receipt.json")
    # Collapse only parts with the same joint and material. Joint transforms stay editable.
    selected = []
    for actor in actors:
        selected.extend([actor] + [o for o in actor.children_recursive if o.type == "EMPTY"])
        groups = {}
        meshes = [o for o in actor.children_recursive if o.type == "MESH"]
        for obj in meshes:
            assert len(obj.data.materials) == 1
            key = (obj.parent.name, obj.data.materials[0].name)
            bucket = groups.setdefault(key, {"vertices":[],"faces":[],"smooth":[]})
            transform = obj.parent.matrix_world.inverted() @ obj.matrix_world
            offset = len(bucket["vertices"])
            bucket["vertices"].extend(tuple(transform @ v.co) for v in obj.data.vertices)
            bucket["faces"].extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons)
            bucket["smooth"].extend(p.use_smooth for p in obj.data.polygons)
        for (parent_name, mat_name), bucket in groups.items():
            mesh = bpy.data.meshes.new(parent_name + "_" + mat_name + "_export")
            mesh.from_pydata(bucket["vertices"],[],bucket["faces"])
            mesh.materials.append(bpy.data.materials[mat_name])
            for polygon, smooth in zip(mesh.polygons,bucket["smooth"]): polygon.use_smooth = smooth
            obj = bpy.data.objects.new(mesh.name, mesh)
            bpy.context.collection.objects.link(obj)
            obj.parent = bpy.data.objects[parent_name]
            obj["origin"] = "project-local-original"
            selected.append(obj)
        for obj in meshes: bpy.data.objects.remove(obj,do_unlink=True)
    for actor in actors: actor.location = (0,0,0)  # placement comes only from the observed public view
    bpy.ops.object.select_all(action="DESELECT")
    for obj in selected: obj.select_set(True)
    PUBLIC.mkdir(parents=True,exist_ok=True)
    asset = PUBLIC / "residents.glb"
    bpy.ops.export_scene.gltf(filepath=str(asset),export_format="GLB",use_selection=True,
                             export_yup=True,export_extras=True,export_animations=False,export_texcoords=False,
                             export_normals=True,export_materials="EXPORT",export_cameras=False,export_lights=False)
    manifest = {"schema":"riverbend-resident-runtime.v2","baseAssetSha256":read(PACKAGE / "brief.json")["baseAssetSha256"],
                "sourceSha256":sha(source),"asset":{"url":"/assets/riverbend/residents-v2/residents.glb","sha256":sha(asset),"bytes":asset.stat().st_size},
                "actors":12,"jointsPerActor":7,"collisionRadius":function["residentRadius"],"humanArtApproved":False,
                "rights":{"geometry":"project-local-original","textures":"none","thirdPartyModels":[]},
                "proofs":{name:sha(PACKAGE / name) for name in ["authoring-receipt.json","render-receipt.json","function-review.json","form-review.json","visual-review.json"]}}
    write(PUBLIC / "manifest.json",manifest)
    write(PACKAGE / "export-receipt.json",{"schema":"riverbend-resident-export.v2","sourceSha256":sha(source),"assetSha256":sha(asset),
          "exporterSha256":sha(Path(__file__)),"manifestSha256":sha(PUBLIC / "manifest.json"),"bytes":asset.stat().st_size,
          "meshes":sum(o.type=="MESH" for o in selected),"baseAssetUnchanged":sha(ROOT/"public/assets/riverbend/v1/town.glb")==manifest["baseAssetSha256"]})
    print("RESIDENT_EXPORT=" + json.dumps(manifest["asset"]))


if __name__ == "__main__":
    main()
