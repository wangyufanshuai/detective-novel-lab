"""Rebuild the cape on its retained UV sheet, with a coherent inner lining."""
from pathlib import Path
import argparse, bpy, hashlib, json, math, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--trial',default='cape-09');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[])
SOURCE=BASE/'step-16/cape-08/resident-08/resident.blend';OUT=BASE/'step-16'/args.trial/'resident-08';OUT.mkdir(parents=True,exist_ok=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();source_hash=sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));body=bpy.data.objects['rb-lin-ali_skin'];mesh=body.data;keys=mesh.shape_keys.key_blocks
old=json.loads((SOURCE.parent/'cape-sculpt.json').read_text());patches=old['patches'];labels=mesh.attributes['ArtClothLayer'].data
cape=sorted(v.index for v in mesh.vertices if labels[v.index].value==2);half=len(cape)//2;outer=cape[:half];inner=cape[half:];outside=set(outer);inside=set(inner);pair=dict(zip(outer,inner))
assert half==2813
outer_faces=[tuple(p.vertices)for p in mesh.polygons if set(p.vertices)<=outside]
inner_faces={tuple(sorted(p.vertices))for p in mesh.polygons if set(p.vertices)<=inside}
assert {tuple(sorted(pair[i]for i in f))for f in outer_faces}==inner_faces,'Verify shell pairing from topology'
before=[v.co.copy()for v in keys[0].data];old_weights=[{body.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.vertices]
uv={};layer=mesh.uv_layers.active
for face in mesh.polygons:
 if set(face.vertices)<=outside:
  for loop in face.loop_indices:
   i=mesh.loops[loop].vertex_index;q=layer.data[loop].uv.copy()
   if i in uv:assert(uv[i]-q).length<1e-5
   uv[i]=q
assert len(uv)==half
mesh.calc_loop_triangles();blouse_faces=[tuple(t.vertices)for t in mesh.loop_triangles if all(labels[i].value==1 for i in t.vertices)]
blouse=BVHTree.FromPolygons(before,blouse_faces,all_triangles=True)
target={}
for i in outer:
 u,t=uv[i].x/3.5,uv[i].y/2.3
 assert -.0001<=u<=1.0001 and -.0001<=t<=1.0001
 u=max(0,min(1,u));t=max(0,min(1,t));angle=.105+(math.tau-.21)*u
 fold=.002*math.sin(angle*10+t*.8)*t*t
 x=(.080+.245*t+fold)*math.sin(angle);y=.009-(.075+.115*t+fold)*math.cos(angle)
 z=1.548-(.244+.018*max(0,math.cos(angle)))*t**1.45+.095*t**1.7*math.sin(angle)**4
 hit=blouse.ray_cast(Vector((x,y,2)),Vector((0,0,-1)),2)[0]
 if hit is not None:z=max(z,hit.z+.012)
 target[i]=Vector((x,y,z))
normals={i:Vector()for i in outer};graph={i:set()for i in outer};edge_use={}
for f in outer_faces:
 for a,b in zip(f,f[1:]+f[:1]):
  graph[a].add(b);graph[b].add(a);key=tuple(sorted((a,b)));edge_use[key]=edge_use.get(key,0)+1
 normal=(target[f[1]]-target[f[0]]).cross(target[f[2]]-target[f[0]])
 for i in f:normals[i]+=normal
for i in outer:normals[i].normalize();target[pair[i]]=target[i]-normals[i]*.0015
# A single field drives both sides of the fabric, preventing the lining from
# crossing its corresponding outer sheet when the upper arm moves.
names=sorted({n for i in outer for n in old_weights[i]});local={i:j for j,i in enumerate(outer)}
values=np.array([[old_weights[i].get(n,0)for n in names]for i in outer]);initial=values.copy()
a=np.array([local[i]for i in outer for j in graph[i]],dtype=np.int32);b=np.array([local[j]for i in outer for j in graph[i]],dtype=np.int32)
w=np.array([1/max((target[i]-target[j]).length,.003)for i in outer for j in graph[i]]);total=np.bincount(a,weights=w,minlength=half)
pin=np.array([uv[i].y/2.3<.10 for i in outer])
for _ in range(8):
 mean=np.column_stack([np.bincount(a,weights=w*values[b,n],minlength=half)/total for n in range(len(names))]);values=.5*values+.5*mean;values[pin]=initial[pin]
weights={}
for row,i in enumerate(outer):
 keep=sorted(range(len(names)),key=lambda n:-values[row,n])[:4];s=sum(values[row,n]for n in keep)
 result={names[n]:float(values[row,n]/s)for n in keep if values[row,n]>1e-8};weights[i]=result;weights[pair[i]]=result
# The existing integrated hem has four vertices per boundary point. Align its
# cyclic order to the retained sheet boundary, then transport the small tube.
boundary_graph={}
for(a,b),count in edge_use.items():
 if count==1:boundary_graph.setdefault(a,[]).append(b);boundary_graph.setdefault(b,[]).append(a)
assert all(len(v)==2 for v in boundary_graph.values())
boundary=[];current=min(boundary_graph);previous=None
while True:
 boundary.append(current);following=next(i for i in boundary_graph[current]if i!=previous);previous,current=current,following
 if current==boundary[0]:break
assert len(boundary)==248
trim=sorted(set(r['index']for r in patches)-set(cape));assert len(trim)==992
trim_set=set(trim);trim_edges={i:set()for i in trim}
for edge in mesh.edges:
 a,b=edge.vertices
 if a in trim_set and b in trim_set:trim_edges[a].add(b);trim_edges[b].add(a)
ring_options=[]
for candidate_rings in [[trim[i:i+4]for i in range(0,len(trim),4)],[[trim[k+j*248]for j in range(4)]for k in range(248)]]:
 if not all(all(len(trim_edges[i]&set(ring))==2 for i in ring)for ring in candidate_rings):continue
 ring_of={i:k for k,ring in enumerate(candidate_rings)for i in ring}
 if not all({ring_of[j]for j in trim_edges[i]if j not in ring}=={(k-1)%248,(k+1)%248}for k,ring in enumerate(candidate_rings)for i in ring):continue
 candidate_centers=[sum((before[i]for i in ring),Vector())/4 for ring in candidate_rings]
 distances=[(before[i]-c).length for ring,c in zip(candidate_rings,candidate_centers)for i in ring]
 ring_options.append((sum(d*d for d in distances),max(distances),candidate_rings,candidate_centers))
assert ring_options,'No validated four-vertex tube cycles'
_,ring_radius,rings,centers=min(ring_options,key=lambda row:row[0])
ring_radii=[max((before[i]-c).length for i in ring)for ring,c in zip(rings,centers)]
assert .0005<float(np.median(ring_radii))<.0012,'Validate majority tube radius'
# Older per-vertex fits have stretched a minority of tube cross sections by
# centimetres. Rebuild every verified topological ring at its intended 0.8 mm
# radius; retain those outlier measurements instead of treating them as valid.
options=[]
for order in [boundary,list(reversed(boundary))]:
 for shift in range(len(order)):
  alignment=order[shift:]+order[:shift];distances=[(c-before[i]).length for c,i in zip(centers,alignment)]
  options.append((float(np.median(distances)),sum(d*d for d in distances),max(distances),alignment))
hem_median,_,hem_error,alignment=min(options,key=lambda x:(x[0],x[1]))
assert hem_median<.004,('Majority hem alignment',hem_median,hem_error)
print(json.dumps({'hemMedianAlignmentMeters':hem_median,'hemMaximumAlignmentMeters':hem_error,'oldDeformedRings':sum(r>.002 for r in ring_radii)}),flush=True)
for k,(ring,i)in enumerate(zip(rings,alignment)):
 old_tangent=(centers[(k+1)%len(rings)]-centers[k-1]).normalized()
 new_tangent=(target[alignment[(k+1)%len(rings)]]-target[alignment[k-1]]).normalized()
 rotation=old_tangent.rotation_difference(new_tangent);center=target[i]+normals[i]*.0003
 for j in ring:
  offset=rotation@(before[j]-centers[k]);offset-=new_tangent*offset.dot(new_tangent)
  target[j]=center+offset.normalized()*.0008;weights[j]=weights[i]
assert set(target)==set(r['index']for r in patches)
for patch in patches:
 i=patch['index']
 for key in keys:key.data[i].co=target[i]
 mesh.vertices[i].co=target[i]
 for g in list(mesh.vertices[i].groups):body.vertex_groups[g.group].remove([i])
 for name,value in weights[i].items():body.vertex_groups[name].add([i],value,'REPLACE')
 patch['after']=list(target[i]);patch['weightsAfter']=weights[i];patch['displacementMeters']=(target[i]-Vector(patch['before'])).length
mesh.shape_keys.update_tag();mesh.update();body.update_tag();bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0
destination=OUT/'resident.blend';bpy.ops.wm.save_as_mainfile(filepath=str(destination),compress=True);assert sha(SOURCE)==source_hash
report={'complete':True,'sourceSha256':sha(destination),'inputSourceSha256':old['inputSourceSha256'],'parentSourceSha256':source_hash,'capeVertices':len(cape),'trimVertices':len(trim),'patches':patches,'widthBefore':old['widthBefore'],'widthAfter':max(q.x for q in target.values())-min(q.x for q in target.values()),'maximumDisplacementMeters':max(r['displacementMeters']for r in patches),'liningThicknessMeters':.0015,'hemAlignmentMaximumMeters':hem_error,'oldHemMaximumRadiusMeters':ring_radius,'oldHemRingsOver2mm':sum(r>.002 for r in ring_radii),'rebuiltHemRadiusMeters':.0008,'functionPassed':False,'formPassed':False,'humanApproved':False,'method':'Retained UV/topology 29 by 97 cape sheet reconstructed as a continuous shoulder pattern. Vertical blouse clearance, 1.5 mm inward lining with identical paired binding, transported integrated hem. Existing skeleton, material and non-cape geometry retained.'}
report['hemAlignmentMedianMeters']=hem_median
(OUT/'cape-sculpt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
meta=json.loads((SOURCE.parent/'authoring-review.json').read_text());meta.update(sourceSha256=sha(destination),parentSourceSha256=source_hash,capeTrial=args.trial,builderSha256=sha(Path(__file__)),humanArtApproved=False)
(OUT/'authoring-review.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({k:v for k,v in report.items()if k!='patches'}),flush=True)
