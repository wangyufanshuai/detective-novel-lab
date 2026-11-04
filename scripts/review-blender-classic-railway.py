"""Source-bound Function checks for the original railway art sample."""
from collections import deque
from pathlib import Path
import hashlib
import json
import math
import time
import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/"docs/3d-town/classic-railway-v1"
def read(p):return json.loads(p.read_text(encoding="utf-8"))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def main():
    source=PACKAGE/"classic-railway.blend";author=read(PACKAGE/"authoring-receipt.json");render=read(PACKAGE/"render-receipt.json")
    identity=sha(source)
    assert identity==author["source"]["sha256"]==render["sourceSha256"]
    assert render["complete"]
    for item in author["inputs"]:assert sha(ROOT/item["path"])==item["sha256"]
    for item in render["renders"]:assert sha(PACKAGE/item["path"])==item["sha256"]
    bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update()
    scene=read(PACKAGE/"scene-contract.json");r=scene["player"]["radius"]
    def valid(x,y):
        b=scene["bounds"]
        if not(b[0]+r<=x<=b[1]-r and b[2]+r<=y<=b[3]-r):return False
        for c in scene["colliders"]:
            dx=x-c["center"][0];dy=y-c["center"][1];a=c["angle"]
            xx=math.cos(a)*dx+math.sin(a)*dy;yy=-math.sin(a)*dx+math.cos(a)*dy
            if math.hypot(max(abs(xx)-c["size"][0]/2,0),max(abs(yy)-c["size"][1]/2,0))<=r+.012:return False
        return True
    spawn=scene["player"]["spawn"];step=.12
    start=tuple(round(v/step) for v in spawn)
    queue=deque([start]);parents={start:None}
    while queue:
        x,y=queue.popleft()
        for nxt in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if nxt not in parents and valid(nxt[0]*step,nxt[1]*step):parents[nxt]=(x,y);queue.append(nxt)
    routes=[]
    targets=scene["interactions"]+[{"id":"interior-entry","position":[3.65,1.40]},{"id":"back-aisle","position":[3.65,5.35]}]
    for entry in targets:
        target=min(parents,key=lambda q:math.hypot(q[0]*step-entry["position"][0],q[1]*step-entry["position"][1]))
        distance=math.hypot(target[0]*step-entry["position"][0],target[1]*step-entry["position"][1])
        path=[];node=target
        while node is not None:path.append([round(node[0]*step,3),round(node[1]*step,3)]);node=parents[node]
        path.reverse();routes.append({"id":entry["id"],"targetValid":valid(*entry["position"]),"reachable":distance<.20,"endErrorMeters":distance,"path":path})
    apertures=[];manifolds=[]
    for item in read(PACKAGE/"openings.json")["openings"]:
        obj=bpy.data.objects[item["wall"]]
        p=Vector(item["center"]);axis=Vector((0,1,0) if item["axis"]=="y" else (1,0,0))
        hit=obj.ray_cast(p-axis*1.3,axis,distance=2.6)[0]
        apertures.append({"id":item["id"],"wall":obj.name,"clearCenterRay":not hit,"clearWidth":item["clearWidth"],"clearHeight":item["clearHeight"],"booleanApplied":item["booleanApplied"]})
    for obj in bpy.data.objects:
        if obj.get("structuralShell"):
            bm=bmesh.new();bm.from_mesh(obj.data);bad=sum(not edge.is_manifold for edge in bm.edges);bm.free()
            manifolds.append({"wall":obj.name,"nonManifoldEdges":bad})
    triangles=0;mesh_count=0;dg=bpy.context.evaluated_depsgraph_get()
    for obj in bpy.data.objects:
        if obj.type not in ("MESH","FONT","CURVE"):continue
        ev=obj.evaluated_get(dg);data=ev.to_mesh();data.calc_loop_triangles();triangles+=len(data.loop_triangles);mesh_count+=1;ev.to_mesh_clear()
    actor=[o for o in bpy.data.objects if o.get("layer")=="actor"]
    points=[o.matrix_world@Vector(v) for o in actor for v in o.bound_box]
    actor_floor=min(v.z for v in points);actor_top=max(v.z for v in points)
    passed=valid(*spawn) and all(i["targetValid"] and i["reachable"] for i in routes) and all(i["clearCenterRay"] and i["booleanApplied"] for i in apertures) and all(i["nonManifoldEdges"]==0 for i in manifolds) and abs(actor_floor-scene["floor"])<.01
    report={"schema":"classic-function-review.v1","sourceSha256":identity,"sceneContractSha256":sha(PACKAGE/"scene-contract.json"),"renderReceiptSha256":sha(PACKAGE/"render-receipt.json"),"reviewerScriptSha256":sha(Path(__file__)),"createdAtUnix":time.time(),"passed":passed,"scope":"Measured source opening rays, wall manifoldness, source actor support and capsule routes against authored conservative collision envelopes. Not comprehensive mesh-BVH furniture collision or human approval.","playerRadius":r,"spawnValid":valid(*spawn),"reachableGridNodes":len(parents),"gridMeters":step,"routes":routes,"apertures":apertures,"wallManifoldChecks":manifolds,"actorSupport":{"floor":scene["floor"],"minZ":actor_floor,"maxZ":actor_top,"height":actor_top-actor_floor,"distance":actor_floor-scene["floor"]},"sourceMeshesAndCurves":mesh_count,"evaluatedTriangles":triangles,"humanFunctionApproved":False,"fontDependency":{"name":"Georgia Regular","source":"Installed Windows font, converted to sign outlines in the GLB; packed in local authoring source by Blender","licenseReview":"not reviewed for distribution; this delivery is a local art sample"}}
    write(PACKAGE/"function-review.json",report)
    print(json.dumps({k:report[k] for k in ("passed","spawnValid","reachableGridNodes","evaluatedTriangles","actorSupport")}),flush=True)
    if not passed:
        print(json.dumps({"badRoutes":[r["id"] for r in routes if not(r["reachable"] and r["targetValid"])],"badApertures":[a for a in apertures if not a["clearCenterRay"]],"badManifolds":[m for m in manifolds if m["nonManifoldEdges"]]}),flush=True)
        raise RuntimeError("Function candidate checks failed")


if __name__=="__main__":main()
