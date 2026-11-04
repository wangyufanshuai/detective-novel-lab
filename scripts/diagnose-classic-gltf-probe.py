from pathlib import Path
import bpy,json
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-motion-v2/step-06/resident-06'
def capture(label):
 rows=[]
 for o in bpy.context.scene.objects:
  if o.type=='MESH'and (label=='import'or o.name=='rb-gu-yuanshan_skin'):
   e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();p=[e.matrix_world@v.co for v in m.vertices];rows.append({'object':o.name,'matrix':[list(r)for r in o.matrix_world],'bounds':[[min(v[a]for v in p),max(v[a]for v in p)]for a in range(3)],'parents':[x.name for x in (o.parent,o.parent.parent if o.parent else None)if x]});e.to_mesh_clear()
 print(json.dumps({'label':label,'meshes':rows,'animated':[(o.name,o.animation_data.action.name if o.animation_data.action else None)for o in bpy.context.scene.objects if o.animation_data]}),flush=True)
def pose(label,f):
 bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
 rig=bpy.data.objects['rb-gu-yuanshan_rig'];body=next(o for o in bpy.context.scene.objects if o.type=='MESH'and any(m.type=='ARMATURE'and m.object==rig for m in o.modifiers))
 return {'label':label,'frame':f,'feet':{s:list(rig.matrix_world@rig.pose.bones['foot_'+s].head)for s in ('L','R')},'morphs':{k.name:k.value for k in body.data.shape_keys.key_blocks}}
bpy.ops.wm.open_mainfile(filepath=str(P/'resident.blend'))
for obj,clip in [('rb-gu-yuanshan_rig','BackAway'),('movement_actor','BackAway_Origin')]:
 o=bpy.data.objects[obj];o.animation_data.action=bpy.data.actions[clip];o.animation_data.action_slot=bpy.data.actions[clip].slots[0]
bpy.context.scene.frame_set(1);bpy.context.view_layer.update();capture('source')
source_rows=[pose('source',f)for f in (1,22,43.125,61)]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=120;bpy.ops.import_scene.gltf(filepath=str(P/'gltf-probe/BackAway.glb'));bpy.context.scene.frame_set(0);bpy.context.view_layer.update();capture('import')
for old in source_rows:print(json.dumps({'before':old,'after':pose('import',(old['frame']-1)*4)}),flush=True)
