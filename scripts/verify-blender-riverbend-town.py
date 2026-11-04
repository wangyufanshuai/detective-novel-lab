"""Independent navigation, aperture and artifact checks against the saved scene."""
from collections import defaultdict
from pathlib import Path
import hashlib
import heapq
import json
import math
import sys

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/"docs/3d-town/riverbend-v1"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(obj, depsgraph):
    evaluated=obj.evaluated_get(depsgraph)
    data=evaluated.to_mesh()
    try:
        points=[evaluated.matrix_world @ v.co for v in data.vertices]
        return ([min(p[i] for p in points) for i in range(3)],
                [max(p[i] for p in points) for i in range(3)],
                sum(len(p.vertices)-2 for p in data.polygons))
    finally:
        evaluated.to_mesh_clear()


def outside_distance(x,y,b):
    return math.hypot(max(b[0]-x,0,x-b[2]),max(b[1]-y,0,y-b[3]))


def main():
    author=read(PACKAGE/"authoring-receipt.json")
    suite=read(PACKAGE/"render-receipt.json")
    layout=read(PACKAGE/"town-layout.json")
    errors=[]
    for item in author["inputs"]:
        if sha(ROOT/item["path"])!=item["sha256"]:errors.append("stale source input: "+item["path"])
    source=PACKAGE/author["source"]["path"]
    if sha(source)!=author["source"]["sha256"]:errors.append("source file hash mismatch")
    if not suite["complete"]:errors.append("required view suite incomplete")
    if suite["inputs"]!=author["inputs"]:errors.append("render/source input mismatch")
    for item in suite["renders"]:
        if sha(PACKAGE/item["path"])!=item["sha256"]:errors.append("render bytes changed: "+item["view"])
    if errors:raise RuntimeError("; ".join(errors))
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    all_bounds={}
    triangles=0
    nonfinite=[]
    for obj in bpy.context.scene.objects:
        if obj.type not in ("MESH","FONT"):continue
        lo,hi,tris=bounds(obj,dg)
        all_bounds[obj.name]=(lo,hi)
        triangles+=tris
        if not all(math.isfinite(x) for x in lo+hi):nonfinite.append(obj.name)
    radius=layout["player"]["radius"]
    collider_entries=[]
    actor_bounds=defaultdict(list)
    for obj in bpy.context.scene.objects:
        if obj.name not in all_bounds:continue
        lo,hi=all_bounds[obj.name]
        if obj.get("actor_id"):
            actor_bounds[obj["actor_id"]].append((lo,hi))
            continue
        if obj.get("semantic_group") in ("ground","water"):continue
        if hi[2]>.30 and lo[2]<1.76:
            collider_entries.append({"id":obj.name,"bounds":[lo[0],lo[1],hi[0],hi[1]],"z":[lo[2],hi[2]]})
    # Geometry-derived land and deck extents; no assumed walkability over the river.
    surfaces=[]
    for name in ("north_land","south_land","bridge_deck"):
        lo,hi=all_bounds[name]
        surfaces.append({"id":name,"bounds":[lo[0],lo[1],hi[0],hi[1]],"height":hi[2]})
    spatial=defaultdict(list)
    for entry in collider_entries:
        b=entry["bounds"]
        for ix in range(math.floor(b[0]-radius),math.floor(b[2]+radius)+1):
            for iy in range(math.floor(b[1]-radius),math.floor(b[3]+radius)+1):
                spatial[(ix,iy)].append(b)
    def valid(x,y,extra=()):
        if not any(s["bounds"][0]+radius<=x<=s["bounds"][2]-radius and
                   s["bounds"][1]<=y<=s["bounds"][3] for s in surfaces):return False
        return all(outside_distance(x,y,b)>radius+.01 for b in spatial[(math.floor(x),math.floor(y))]+list(extra))
    step=.35
    def route(start,end,extra=()):
        if not valid(*start,extra) or not valid(*end,extra):return None
        a=tuple(round(v/step) for v in start);b=tuple(round(v/step) for v in end)
        queue=[(0,a)];cost={a:0};previous={}
        visited=set()
        while queue:
            _,node=heapq.heappop(queue)
            if node in visited:continue
            visited.add(node)
            if node==b:
                nodes=[node]
                while nodes[-1] in previous:nodes.append(previous[nodes[-1]])
                nodes.reverse()
                return [start]+[[v[0]*step,v[1]*step] for v in nodes]+[end]
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                nxt=(node[0]+dx,node[1]+dy)
                if not valid(nxt[0]*step,nxt[1]*step,extra):continue
                if dx and dy and (not valid((node[0]+dx)*step,node[1]*step,extra) or
                                  not valid(node[0]*step,(node[1]+dy)*step,extra)):continue
                value=cost[node]+math.hypot(dx,dy)
                if value>=cost.get(nxt,float("inf")):continue
                cost[nxt]=value;previous[nxt]=node
                priority=value+math.hypot(nxt[0]-b[0],nxt[1]-b[1])
                heapq.heappush(queue,(priority,nxt))
        return None
    routes=[]
    spawn=layout["player"]["spawn"]
    targets=[(b["id"],b["entrance"]) for b in layout["buildings"] if b["entrance"]]
    targets.append(("south-arrival",[layout["bridge"]["x"],-23]))
    for name,end in targets:
        path=route(spawn,end)
        length=sum(math.dist(a,b) for a,b in zip(path,path[1:])) if path else None
        # Verify entire segments, not merely the A* grid vertices.
        minimum=float("inf")
        invalid_samples=[]
        if path:
            for a,b in zip(path,path[1:]):
                count=max(1,math.ceil(math.dist(a,b)/.04))
                for i in range(count+1):
                    x=a[0]+(b[0]-a[0])*i/count;y=a[1]+(b[1]-a[1])*i/count
                    if not valid(x,y):invalid_samples.append([x,y])
                    for entry in collider_entries:
                        minimum=min(minimum,outside_distance(x,y,entry["bounds"])-radius)
        routes.append({"destination":name,"passed":bool(path) and not invalid_samples,
                       "lengthMeters":round(length,3) if length is not None else None,
                       "minimumConservativeMarginMeters":round(minimum,5) if path else None,
                       "path":path,"invalidSamples":invalid_samples[:3]})
    negative_controls={
        "bridge-blocked":route(spawn,[layout["bridge"]["x"],-23],
                               [(-2,-20.4,5,-11.2)]) is None,
        "cafe-anchor-blocked":route(spawn,targets[0][1],
                                   [(-10.5,4.5,-9.5,5.5)]) is None,
        "river-is-not-ground":not valid(-10,-16)
    }
    aperture_results=[]
    for b in layout["buildings"]:
        wall=bpy.data.objects[b["id"]+"_front_wall"]
        x,y=b["center"];front=y-b["size"][1]/2
        origin=wall.matrix_world.inverted() @ Vector((x,front-1,1.5))
        direction=wall.matrix_world.inverted().to_3x3() @ Vector((0,1,0))
        hit,*_=wall.ray_cast(origin,direction,distance=2)
        aperture_results.append({"building":b["id"],"doorApertureThroughStructuralWall":not hit})
    actors=[]
    for actor,parts in actor_bounds.items():
        lo=[min(p[0][i] for p in parts) for i in range(3)]
        hi=[max(p[1][i] for p in parts) for i in range(3)]
        actors.append({"id":actor,"min":lo,"max":hi,"height":hi[2]-lo[2],
                       "standingOnPavement":abs(lo[2]-.04)<.005})
    if nonfinite:errors.append("non-finite mesh geometry")
    if triangles>500000:errors.append("scene exceeds 500k authored triangle ceiling")
    if not all(r["passed"] for r in routes):errors.append("unreachable or clipped circulation path")
    if not all(negative_controls.values()):errors.append("navigation negative control failed")
    if not all(r["doorApertureThroughStructuralWall"] for r in aperture_results):errors.append("false door aperture")
    if len(actors)!=13 or not all(a["standingOnPavement"] for a in actors):errors.append("actor count/support mismatch")
    report={"schema":"riverbend-function-review.v1","kind":"independent-local-geometry-candidate-review",
            "sourceSha256":sha(source),"builderInputs":author["inputs"],"verifierSha256":sha(Path(__file__)),
            "renderSuiteComplete":suite["complete"],"meshAndTextObjects":len(all_bounds),"triangles":triangles,
            "navigationMethod":"0.35m A* over evaluated scene bounds; capsule footprint with 0.04m segment probes",
            "collisionMethod":"conservative XY bounds of evaluated solid meshes intersecting player body height",
            "playerRadius":radius,"colliders":collider_entries,"surfaces":surfaces,"routes":routes,
            "negativeControls":negative_controls,"doorApertures":aperture_results,"actors":actors,
            "passed":not errors,"errors":errors,"humanApproval":False,"caseIntegration":False}
    (PACKAGE/"function-review.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:report[k] for k in ("passed","triangles","meshAndTextObjects","negativeControls","errors")},
                     ensure_ascii=False),flush=True)
    if errors:raise RuntimeError("; ".join(errors))


if __name__=="__main__":main()
