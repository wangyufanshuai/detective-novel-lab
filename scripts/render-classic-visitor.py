"""Compose retained cast sources at a real observed visitor endpoint for review."""
from pathlib import Path
import bpy, hashlib, importlib.util, json
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/classic-motion-v1/visitor-review-02';P.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sources={'resident-03':ROOT/'docs/3d-town/classic-residents-v10/resident-03/rb-xu-zhiwei.blend',
 'resident-06':ROOT/'docs/3d-town/classic-occupations-v1/resident-06/gesture-09/occupation.blend',
 'resident-08':ROOT/'docs/3d-town/classic-occupations-v1/resident-08/gesture-14/occupation.blend'}
base=ROOT/'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend'
cast=read(ROOT/'public/assets/classic-occupations/v2/cast.json')['entries'];catalog=[]
for entry in cast:
 source=sources[entry['actorId']];manifest=read(ROOT/('public'+entry['manifestUrl']));assert sha(source)==manifest['sourceSha256']
 bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin']
 workplace=bpy.data.objects['restorer_workstation' if entry['actorId']=='resident-03' else 'occupation_workplace']
 names={rig.name,body.name,workplace.name,*[o.name for o in workplace.children_recursive]}
 if rig.parent:names.add(rig.parent.name)
 catalog.append((entry,manifest,source,names,rig.parent.name if rig.parent else None,workplace.name))
bpy.ops.wm.open_mainfile(filepath=str(base));scene=bpy.context.scene
for obj in scene.objects:
 if obj.get('layer') in ('actor','review_resident'):obj.hide_render=True
for entry,manifest,source,names,parent_name,workplace_name in catalog:
 with bpy.data.libraries.load(str(source),link=False) as (available,loaded):
  loaded.objects=list(names);loaded.actions=['Idle']
 objects={name:obj for name,obj in zip(names,loaded.objects)}
 for obj in loaded.objects:
  if obj and not obj.users_collection:scene.collection.objects.link(obj)
 bpy.context.view_layer.update()
 rig=objects[manifest['id']+'_rig'];body=objects[manifest['id']+'_skin'];workplace=objects[workplace_name]
 root=objects[parent_name] if parent_name else bpy.data.objects.new('resident_03_review_root',None)
 if not parent_name:
  scene.collection.objects.link(root);rig.parent=root
  if body.parent is None:body.parent=root
  root.location=(*entry['position'],.18);workplace.location+=Vector((*entry['position'],.18))
 else:
  transform=workplace.matrix_world.copy();workplace.parent=None;workplace.matrix_world=transform
 rig.animation_data_create();rig.animation_data.action=loaded.actions[0]
 if loaded.actions[0].slots:rig.animation_data.action_slot=loaded.actions[0].slots[0]
 if entry['actorId']=='resident-06':root.location=(-4.7,4.35,.18)
 for obj in [rig,body,*rig.children_recursive]:obj.hide_render=entry['actorId']=='resident-08'
scene.frame_set(1)
spec=importlib.util.spec_from_file_location('room',ROOT/'scripts/build-blender-classic-railway.py');room=importlib.util.module_from_spec(spec);spec.loader.exec_module(room)
devices=room.configure(40,1440)
views=['shop-production','shop-corner-sw','shop-corner-se','shop-corner-nw','shop-corner-ne','shop-low-entry','shop-ceiling-up','shop-ceiling-oblique-a','shop-ceiling-oblique-b']
source=P/'visitor.blend';scene.camera=bpy.data.objects['shop-production'];bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
report={'schema':'classic-visitor-renders.v1','complete':False,'scriptSha256':sha(Path(__file__)),'sourceSha256':sha(source),
 'retainedSources':{str(p.relative_to(ROOT)):sha(p) for p in [base,*sources.values()]},'devices':devices,'renders':[],
 'scope':'Blender composition of retained final assets at the observed guest endpoint. Not runtime movement or human approval.','humanApproved':False}
for view in views:
 for obj in scene.objects:
  if obj.type not in ('MESH','CURVE','FONT'):continue
  obj.visible_camera=True
  if view=='shop-production' and obj.get('layer') in ('bookshop_front','bookshop_upper','bookshop_side_cutaway','bookshop_ceiling','inn_upper','inn_front','inn_side_cutaway','ceiling','inn_neighbor_cutaway'):obj.visible_camera=False
 scene.camera=bpy.data.objects[view];target=P/(view+'.png');scene.render.filepath=str(target);bpy.ops.render.render(write_still=True)
 report['renders'].append({'view':view,'path':target.name,'sha256':sha(target)});write(P/'render-review.json',report)
report['complete']=True;write(P/'render-review.json',report)
print(json.dumps({'complete':True,'views':len(views),'sourceSha256':sha(source)}),flush=True)
