"""Export reviewed original source to a UV-preserving, batched local sample GLB."""
from collections import defaultdict
from pathlib import Path
import hashlib
import json
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/"docs/3d-town/classic-railway-v1"
OUTPUT=ROOT/"public/assets/classic-railway/v1"
def read(p):return json.loads(p.read_text(encoding="utf-8"))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def main():
    source=PACKAGE/"classic-railway.blend";identity=sha(source)
    author=read(PACKAGE/"authoring-receipt.json");function=read(PACKAGE/"function-review.json");form=read(PACKAGE/"form-review.json")
    assert author["source"]["sha256"]==identity==function["sourceSha256"]==form["sourceSha256"]
    assert function["passed"] and form["candidatePreviewEligible"]
    assert form["functionReviewSha256"]==sha(PACKAGE/"function-review.json")
    assert function["sceneContractSha256"]==sha(PACKAGE/"scene-contract.json")
    for item in author["inputs"]:assert item["sha256"]==sha(ROOT/item["path"])
    bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
    scene=read(PACKAGE/"scene-contract.json");origin=Vector((*scene["player"]["spawn"],scene["floor"]))
    collection=bpy.data.collections.new("Reviewed runtime sample export");bpy.context.scene.collection.children.link(collection)
    export_objects=[];roots={};joints={}
    for name in ("street","bookshop","inn_front","inn_shell","inn_side_cutaway","inn_upper","interior","ceiling"):
        root=bpy.data.objects.new("layer_"+name,None);collection.objects.link(root);root["layer"]=name;roots[name]=root;export_objects.append(root)
    actor=bpy.data.objects.new("sample_player",None);collection.objects.link(actor);actor.location=origin;actor["binding"]="art-sample-adult-figure-study";export_objects.append(actor)
    for part,pivot in scene["actorPivots"].items():
        if part=="body":continue
        joint=bpy.data.objects.new("sample_"+part,None);joint.parent=actor;joint.location=pivot;collection.objects.link(joint);joints[part]=joint;export_objects.append(joint)
    buckets=defaultdict(lambda:{"vertices":[],"faces":[],"uv":[],"smooth":[]})
    for obj in list(bpy.context.scene.objects):
        if obj in export_objects or obj.type not in ("MESH","FONT","CURVE"):continue
        layer=obj.get("layer");part=obj.get("part","static")
        if layer not in roots and layer!="actor":raise RuntimeError("Unclassified export object "+obj.name)
        ev=obj.evaluated_get(dg);data=ev.to_mesh();uv=data.uv_layers.active
        offset=origin+Vector(scene["actorPivots"][part]) if layer=="actor" else Vector((0,0,0))
        for mi,material in enumerate(data.materials):
            polys=[p for p in data.polygons if p.material_index==mi]
            if not polys:continue
            bucket=buckets[(layer,part,material.name)];used=sorted({vi for p in polys for vi in p.vertices});mapping={vi:len(bucket["vertices"])+i for i,vi in enumerate(used)}
            bucket["vertices"].extend(tuple(ev.matrix_world@data.vertices[vi].co-offset) for vi in used)
            for poly in polys:
                bucket["faces"].append(tuple(mapping[vi] for vi in poly.vertices));bucket["smooth"].append(poly.use_smooth)
                bucket["uv"].extend(tuple(uv.data[li].uv) if uv else (0,0) for li in poly.loop_indices)
        ev.to_mesh_clear()
    for (layer,part,mat),values in buckets.items():
        name="sample_"+layer+"_"+part+"_"+mat;data=bpy.data.meshes.new(name);data.from_pydata(values["vertices"],[],values["faces"]);data.update();data.materials.append(bpy.data.materials[mat])
        uv=data.uv_layers.new(name="UVMap")
        for loop,value in zip(uv.data,values["uv"]):loop.uv=value
        for poly,smooth in zip(data.polygons,values["smooth"]):poly.use_smooth=smooth
        obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj.parent=(actor if part=="body" else joints[part]) if layer=="actor" else roots[layer];obj["origin"]="project-local-authored";obj["layer"]=layer;export_objects.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_objects:obj.select_set(True);obj.hide_render=False
    OUTPUT.mkdir(parents=True,exist_ok=True);target=OUTPUT/"classic-railway.glb"
    bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_yup=True,export_apply=True)
    asset_sha=sha(target);scene.update({"assetSha256":asset_sha,"sourceSha256":identity})
    write(OUTPUT/"navigation.json",scene)
    manifest={"schema":"classic-railway-runtime.v1","status":"local-art-and-navigation-sample","sourceSha256":identity,"asset":{"url":"/assets/classic-railway/v1/classic-railway.glb","sha256":asset_sha,"bytes":target.stat().st_size},"navigation":{"url":"/assets/classic-railway/v1/navigation.json","sha256":sha(OUTPUT/"navigation.json")},"sourceTriangles":function["evaluatedTriangles"],"exportedMaterialMeshes":len(buckets),"lights":read(PACKAGE/"lighting.json")["fixtures"],"exporterSha256":sha(Path(__file__)),"proofs":{file:sha(PACKAGE/file) for file in ("authoring-receipt.json","render-receipt.json","function-review.json","form-review.json","scene-contract.json","lighting.json")},"worldBound":False,"humanArtApproved":False,"fontDependency":function["fontDependency"],"lighting":"runtime PBR, hemisphere/key/fixture lights and a neutral RoomEnvironment reflection probe; no baked-lightmap equivalence claim"}
    write(OUTPUT/"manifest.json",manifest);write(PACKAGE/"runtime-export.json",manifest)
    print(json.dumps({"asset":manifest["asset"],"exportedMaterialMeshes":len(buckets),"sourceTriangles":function["evaluatedTriangles"]}),flush=True)


if __name__=="__main__":main()
