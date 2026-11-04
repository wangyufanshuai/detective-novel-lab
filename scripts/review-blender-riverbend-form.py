"""Measure the saved town before preparing a browser preview; not human art approval."""
from pathlib import Path
import hashlib
import json
import math

import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/"docs/3d-town/riverbend-v1"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    author=json.loads((PACKAGE/"authoring-receipt.json").read_text(encoding="utf-8"))
    function=json.loads((PACKAGE/"function-review.json").read_text(encoding="utf-8"))
    suite=json.loads((PACKAGE/"render-receipt.json").read_text(encoding="utf-8"))
    source=PACKAGE/author["source"]["path"]
    if not function["passed"] or function["sourceSha256"]!=sha(source):
        raise RuntimeError("The current saved scene must pass Function first")
    if suite["sourceSha256"]!=sha(source) or not suite["complete"]:
        raise RuntimeError("Current render suite is missing")
    for item in author["inputs"]:
        if sha(ROOT/item["path"])!=item["sha256"]:raise RuntimeError("Stale authoring input")
    for view in suite["renders"]:
        if sha(PACKAGE/view["path"])!=view["sha256"]:raise RuntimeError("Stale image "+view["view"])
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.context.view_layer.update()
    checked=set(); open_meshes=[]; inward_meshes=[]; geometry_count=0
    for obj in bpy.context.scene.objects:
        if obj.type!="MESH" or obj.data.name in checked:continue
        checked.add(obj.data.name);geometry_count+=1
        bm=bmesh.new();bm.from_mesh(obj.data)
        if any(not edge.is_manifold for edge in bm.edges):open_meshes.append(obj.name)
        if bm.calc_volume(signed=True)<-1e-7:inward_meshes.append(obj.name)
        bm.free()
    seating=[]
    for name,table_name in [("cafe_inside_chair0","cafe_inside0"),("cafe_inside_chair1","cafe_inside1"),
                           ("terrace_chair0","terrace_table0"),("terrace_chair1","terrace_table1"),
                           ("terrace_chair_b0","terrace_table0"),("terrace_chair_b1","terrace_table1")]:
        seat=bpy.data.objects[name+"_seat"].location
        back=bpy.data.objects[name+"_backrest"].location
        table=bpy.data.objects[table_name+"_top"].location
        facing=Vector((seat.x-back.x,seat.y-back.y)).normalized()
        toward=Vector((table.x-seat.x,table.y-seat.y)).normalized()
        seating.append({"chair":name,"facingDot":round(facing.dot(toward),6),"facesTable":facing.dot(toward)>.95})
    glass=[]
    for obj in bpy.context.scene.objects:
        if obj.type!="MESH" or not obj.name.endswith("_glass") or "window" not in obj.name:continue
        # Window panes were authored with 30 mm overlap on each cutout edge.
        glass.append({"name":obj.name,"dimensions":list(obj.dimensions),"positiveThickness":min(obj.dimensions)>.03})
    errors=[]
    if open_meshes:errors.append("Non-manifold source meshes")
    if inward_meshes:errors.append("Inward-facing closed source meshes")
    if not all(x["facesTable"] for x in seating):errors.append("Seating faces away from table")
    if not all(x["positiveThickness"] for x in glass):errors.append("Invalid glass thickness")
    report={"schema":"riverbend-form-review.v1","kind":"local-measured-review",
            "sourceSha256":sha(source),"functionReviewSha256":sha(PACKAGE/"function-review.json"),
            "renderReceiptSha256":sha(PACKAGE/"render-receipt.json"),"verifierSha256":sha(Path(__file__)),
            "uniqueMeshGeometries":geometry_count,"nonManifoldMeshes":open_meshes,"inwardMeshes":inward_meshes,
            "seating":seating,"glassPanelCount":len(glass),"glass":glass,
            "measuredChecksPassed":not errors,"errors":errors,
            "humanArtApproved":False,"artDirectionSelected":False,
            "remainingArtWork":["architectural variety and rear facades","distinctive resident designs and animation",
                                "original material texture work","detailed playable interiors","lighting parity in browser"]}
    (PACKAGE/"form-review.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:report[k] for k in ("measuredChecksPassed","uniqueMeshGeometries","nonManifoldMeshes","inwardMeshes","errors")}),flush=True)
    if errors:raise RuntimeError("; ".join(errors))


if __name__=="__main__":main()
