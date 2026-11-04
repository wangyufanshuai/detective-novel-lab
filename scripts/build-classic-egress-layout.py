"""Reversible furniture layout candidate, retaining the authored three-room shell."""
from pathlib import Path
import bpy,hashlib,json,math
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-motion-v2/layout-01'
SOURCE=ROOT/'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
P.mkdir(parents=True,exist_ok=True);assert not (P/'room.blend').exists(),'Use a new candidate directory instead of overwriting a reviewed source.'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.scene.frame_set(1)
dg=bpy.context.evaluated_depsgraph_get();vertices=[];faces=[]
for o in bpy.context.scene.objects:
 if o.type not in ('MESH','CURVE','FONT') or o.get('layer')=='review_resident':continue
 e=o.evaluated_get(dg);m=e.to_mesh();m.calc_loop_triangles();off=len(vertices)
 vertices.extend(e.matrix_world@v.co for v in m.vertices);faces.extend(tuple(off+i for i in t.vertices)for t in m.loop_triangles);e.to_mesh_clear()
tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
new_y=1.96;wall=[]
for y in (new_y-.24,new_y+.24):
 hit=tree.ray_cast(Vector((.4,y,.84)),Vector((1,0,0)),1)[0];assert hit is not None and .99<hit.x<1.09
 wall.append(float(hit.x))
back=min(wall)-.001;new_x=back-.24
relocation=Matrix.Translation((new_x,new_y,0))@Matrix.Rotation(-math.pi/2,4,'Z')@Matrix.Translation((-.65,-5.59,0))
changed=[]
for obj in bpy.context.scene.objects:
 if obj.name.startswith(('shop_parcel_shelf','shop_parcel_bracket','shop_wrapped_parcel')):
  before=[list(row)for row in obj.matrix_world];obj.matrix_world=relocation@obj.matrix_world
  changed.append({'name':obj.name,'before':before,'after':[list(row)for row in obj.matrix_world],'purpose':'Move the wall-mounted packing shelf beside the front service area and clear the staff turning space.'})
for i,(y,support) in enumerate(zip((new_y-.24,new_y+.24),wall)):
 gap=support-back
 if gap>.003:
  bpy.ops.mesh.primitive_cube_add(size=1,location=((back+support+.001)/2,y,.84));shim=bpy.context.object
  shim.name='shop_parcel_mount_spacer_'+str(i);shim.dimensions=(gap+.001,.035,.30)
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  shim.data.materials.append(bpy.data.materials['worn_bronze']);shim['layer']='bookshop_interior';shim['part']='static'
  changed.append({'name':shim.name,'created':True,'purpose':'Bridge measured panel relief so the relocated bracket has a real backing contact.'})
prefixes=('station_counter_','station_service_writing_pad','station_booking_','station_ticket_number','station_ticket_stack','station_ticket_box','station_ticket_crank','station_ticket_slot')
station=[]
for obj in bpy.context.scene.objects:
 if obj.name.startswith(prefixes):
  before=[list(row)for row in obj.matrix_world];obj.location.y-=.30
  station.append(obj.name);changed.append({'name':obj.name,'before':before,'after':[list(row)for row in obj.matrix_world],'purpose':'Move the counter, service windows and supported contents together to open the rear staff aisle.'})
assert len(station)>35
bpy.context.view_layer.update()
for row in changed:
 if not row.get('created'):row['after']=[list(line)for line in bpy.data.objects[row['name']].matrix_world]
scene=bpy.context.scene;scene.camera=bpy.data.objects['shop-production']
source=P/'room.blend';bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
nav=json.loads((ROOT/'public/assets/classic-bookshop/v2/navigation.json').read_text(encoding='utf-8'))
for c in nav['colliders']:
 if c['id']=='shop-parcel-shelf':c.update(center=[new_x,new_y],angle=-math.pi/2)
 if c['id']=='station-ticket-counter':c['center'][1]-=.30
nav.update(sourceSha256=sha(source),assetSha256=None,status='unexported-layout-candidate')
write(P/'navigation-candidate.json',nav)
cast=json.loads((ROOT/'public/assets/classic-occupations/v2/cast.json').read_text(encoding='utf-8'))
for e in cast['entries']:
 if e['actorId']=='resident-06':e['position'][1]-=.30;e['observationPosition'][1]-=.30
 e['retreatMeters']={'resident-03':.36,'resident-06':.45,'resident-08':.48}[e['actorId']]
cast['sceneAssetSha256']=None;cast['status']='unexported-layout-candidate';write(P/'cast-candidate.json',cast)
write(P/'authoring-review.json',{'sourceSha256':sha(source),'retainedSourceSha256':sha(SOURCE),'scriptSha256':sha(Path(__file__)),
 'changedObjects':changed,'measuredShelfBackingX':wall,'shelfCenter':[new_x,new_y],'stationCounterShift':[0,-.30,0],
 'navigationSha256':sha(P/'navigation-candidate.json'),'castSha256':sha(P/'cast-candidate.json'),'humanApproved':False,'exported':False})
print(json.dumps({'source':str(source),'sourceSha256':sha(source),'stationObjectsMoved':len(station),'shelfCenter':[new_x,new_y]}),flush=True)
