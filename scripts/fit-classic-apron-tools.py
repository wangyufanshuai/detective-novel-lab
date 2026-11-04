"""Seat the retained apron tools against the settled cloth and share its morph field."""
from pathlib import Path
import bpy,json,hashlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2';source=BASE/'step-12/resident-03/resident.blend';out=BASE/'step-13/resident-03';out.mkdir(parents=True,exist_ok=True);target=out/'resident.blend';assert not target.exists()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def smooth(t):t=max(0.,min(1.,t));return t*t*(3-2*t)
meta=read(source.parent/'authoring-review.json');assert sha(source)==meta['sourceSha256'];correction=read(source.parent/'garment-correctives.json');assert correction['sourceSha256']==sha(source)
bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects['rb-xu-zhiwei_skin'];mesh=body.data;mesh.calc_loop_triangles();tails={v.index for v in mesh.vertices if sum(g.weight for g in v.groups if body.vertex_groups[g.group].name.startswith('tail_'))>.05}
tris=[tuple(t.vertices)for t in mesh.loop_triangles];mats=[mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles];apron=[t for t,m in zip(tris,mats)if m.startswith('accent')and all(i in tails for i in t)];tools={i for t,m in zip(tris,mats)if m.startswith('leather')for i in t if i in tails and .7<mesh.vertices[i].co.z<1.02};assert len(tools)==88
tree=BVHTree.FromPolygons([v.co.copy()for v in mesh.vertices],apron,all_triangles=True);groups={name:[i for i in tools if test(mesh.vertices[i].co.x)]for name,test in [('left_brush',lambda x:x<0),('right_brush',lambda x:0<x<.08),('book_spine',lambda x:x>.08)]};shifts={};patch=[]
for name,indices in groups.items():
 bounds=[]
 for i in indices:
  v=mesh.vertices[i].co;hit=tree.ray_cast(Vector((v.x,-1,v.z)),Vector((0,1,0)),2)[0];assert hit is not None
  bounds.append(hit.y-v.y-.002)
 shift=min(bounds);assert 0<shift<.08;shifts[name]=shift
 for i in indices:
  before=list(mesh.vertices[i].co);mesh.vertices[i].co.y+=shift;after=list(mesh.vertices[i].co);patch.append({'index':i,'before':before,'after':after})
  for key in mesh.shape_keys.key_blocks:key.data[i].co=mesh.vertices[i].co
for yside,label in [(-1,'Front'),(1,'Back')]:
 for side,suffix in [(-1,'L'),(1,'R')]:
  key=mesh.shape_keys.key_blocks['Skirt_'+label+'_'+suffix]
  for i in tools:
   x,y,z=mesh.vertices[i].co;amount=.22*smooth((1.01-z)/.36)*smooth(.5+yside*y/.12)*smooth(.5+side*x/.18);key.data[i].co.y+=yside*amount
mesh.update();bpy.context.scene.frame_set(1);bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
assert not(set(p['index']for p in correction['staticPatch'])&tools);correction['staticPatch']+=patch;correction['inputSourceSha256']=sha(source);correction['sourceSha256']=sha(target);correction['accessoryBuilderSha256']=sha(Path(__file__));correction['accessoryFit']={'vertices':len(tools),'rigidStaticYShifts':shifts,'minimumRestSurfaceGapMeters':.002,'dynamicMethod':'same spatial morph field as apron; not rigid-body simulation'};write(out/'garment-correctives.json',correction)
meta['inputSourceSha256']=sha(source);meta['sourceSha256']=sha(target);meta['correctiveReportSha256']=sha(out/'garment-correctives.json');meta['accessoryBuilderSha256']=sha(Path(__file__));write(out/'authoring-review.json',meta);(out/'garment-builder.py').write_bytes((source.parent/'garment-builder.py').read_bytes());(out/'accessory-builder.py').write_bytes(Path(__file__).read_bytes());print(json.dumps({'saved':True,'sha256':sha(target),'shifts':shifts,'vertices':len(tools)}),flush=True)
