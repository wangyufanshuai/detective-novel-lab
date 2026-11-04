"""Export a source-bound, batched local preview without modifying the authored blend."""
from collections import defaultdict
from pathlib import Path
import hashlib
import json

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/"docs/3d-town/riverbend-v1"
OUTPUT=ROOT/"public/assets/riverbend/v1"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding="utf-8")


def main():
    author=read(PACKAGE/"authoring-receipt.json")
    function=read(PACKAGE/"function-review.json")
    form=read(PACKAGE/"form-review.json")
    visual=read(PACKAGE/"visual-review.json")
    layout=read(PACKAGE/"town-layout.json")
    source=PACKAGE/author["source"]["path"]
    identity=sha(source)
    if any(review["sourceSha256"]!=identity for review in (function,form,visual)):
        raise RuntimeError("All reviews must refer to the current source")
    if not function["passed"] or not form["measuredChecksPassed"] or not visual["candidatePreviewEligible"]:
        raise RuntimeError("Complete ordered local reviews before preview export")
    for item in author["inputs"]:
        if sha(ROOT/item["path"])!=item["sha256"]:raise RuntimeError("Authoring input changed")
    if form["functionReviewSha256"]!=sha(PACKAGE/"function-review.json"):
        raise RuntimeError("Function review changed after Form")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    actor_positions={x["id"]:x["position"] for x in layout["residents"]}
    actor_positions["player"]=layout["player"]["spawn"]
    roots={};limbs={};pivot_locations={};export_objects=[]
    collection=bpy.data.collections.new("Runtime preview export")
    bpy.context.scene.collection.children.link(collection)
    for actor,pos in actor_positions.items():
        root=bpy.data.objects.new("actor_"+actor,None)
        collection.objects.link(root)
        root.location=(pos[0],pos[1],0)
        root["actorId"]=actor
        root["binding"]="original-art-placeholder" if actor!="player" else "local-exploration-player"
        roots[actor]=root;export_objects.append(root)
    for part,x,z in (("leg_left",-.13,.91),("leg_right",.13,.91),
                     ("arm_left",-.25,1.36),("arm_right",.25,1.36)):
        obj=bpy.data.objects.new("player_"+part,None)
        collection.objects.link(obj)
        obj.parent=roots["player"]
        obj.location=(x,0,z*1.72/1.90+.04)
        limbs[part]=obj;pivot_locations[part]=Vector(obj.location)
        export_objects.append(obj)
    buckets=defaultdict(lambda:{"vertices":[],"faces":[],"smooth":[]})
    for original in list(bpy.context.scene.objects):
        if original.type not in ("MESH","FONT") or original in export_objects:continue
        actor=original.get("actor_id")
        part="body"
        if actor=="player":
            if any(s in original.name for s in ("shoe","shin","thigh")):
                part="leg_left" if "-1" in original.name else "leg_right"
            elif any(s in original.name for s in ("upperarm","forearm","hand")):
                part="arm_left" if "-1" in original.name else "arm_right"
        evaluated=original.evaluated_get(dg)
        data=evaluated.to_mesh()
        try:
            origin=Vector((*actor_positions[actor],0)) if actor else Vector((0,0,0))
            if actor=="player" and part!="body":origin+=pivot_locations[part]
            for material_index,material in enumerate(data.materials):
                polys=[p for p in data.polygons if p.material_index==material_index]
                if not polys:continue
                key=(actor or "static",part,material.name)
                bucket=buckets[key]
                used=sorted({v for p in polys for v in p.vertices})
                indices={v:len(bucket["vertices"])+i for i,v in enumerate(used)}
                bucket["vertices"].extend(tuple(evaluated.matrix_world @ data.vertices[v].co-origin) for v in used)
                bucket["faces"].extend(tuple(indices[v] for v in p.vertices) for p in polys)
                bucket["smooth"].extend(p.use_smooth for p in polys)
        finally:
            evaluated.to_mesh_clear()
    for (actor,part,material),values in buckets.items():
        name="preview_"+actor+"_"+part+"_"+material
        data=bpy.data.meshes.new(name)
        data.from_pydata(values["vertices"],[],values["faces"]);data.update()
        data.materials.append(bpy.data.materials[material])
        for polygon,smooth in zip(data.polygons,values["smooth"]):polygon.use_smooth=smooth
        obj=bpy.data.objects.new(name,data);collection.objects.link(obj)
        obj["origin"]="project-local-original"
        if actor!="static":obj.parent=limbs[part] if actor=="player" and part!="body" else roots[actor]
        export_objects.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_objects:obj.select_set(True)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    target=OUTPUT/"town.glb"
    bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",use_selection=True,
                              export_extras=True,export_cameras=False,export_lights=False,
                              export_animations=False,export_yup=True,export_apply=True)
    asset_sha=sha(target)
    navigation={"schema":"riverbend-navigation.v1","sourceSha256":identity,"assetSha256":asset_sha,
                "coordinates":"Blender X/Y in metres; Three X/-Z ground", "player":layout["player"],
                "bounds":layout["bounds"],"surfaces":function["surfaces"],"colliders":function["colliders"],
                "routes":function["routes"],
                "destinations":[{k:b[k] for k in ("id","label","entrance")} for b in layout["buildings"] if b["entrance"]],
                "residents":[{"id":r["id"],"position":r["position"]} for r in layout["residents"]],
                "worldBound":False,"caseIntegrated":False}
    write(OUTPUT/"navigation.json",navigation)
    manifest={"schema":"riverbend-runtime-asset.v1","sourceSha256":identity,
              "asset":{"url":"/assets/riverbend/v1/town.glb","sha256":asset_sha,"bytes":target.stat().st_size},
              "navigation":{"url":"/assets/riverbend/v1/navigation.json","sha256":sha(OUTPUT/"navigation.json")},
              "sourceObjects":function["meshAndTextObjects"],"exportedMeshes":len(buckets),
              "authoredTriangles":function["triangles"],"exporterSha256":sha(Path(__file__)),
              "proofs":{x:sha(PACKAGE/x) for x in ("authoring-receipt.json","render-receipt.json","function-review.json","form-review.json","visual-review.json")},
              "status":"local-exploration-preview","humanArtApproved":False,
              "rights":{"geometry":"project-local-original","textures":"none","thirdPartyModels":[]},
              "lighting":"Browser directional and ambient lighting; no baked lightmap",
              "residentBinding":"unbound art placeholders","caseIntegrated":False}
    write(OUTPUT/"manifest.json",manifest)
    write(PACKAGE/"export-receipt.json",manifest)
    print(json.dumps({k:manifest[k] for k in ("asset","sourceObjects","exportedMeshes","authoredTriangles")}),flush=True)


if __name__=="__main__":main()
