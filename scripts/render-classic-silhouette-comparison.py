"""Render v6/v7 source models and their saved actions under identical lights."""
from pathlib import Path
import importlib.util
import hashlib
import json
import bpy

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v7'
spec=importlib.util.spec_from_file_location('silhouette_comparison_stage',ROOT/'scripts/build-blender-classic-investigator.py')
inv=importlib.util.module_from_spec(spec);spec.loader.exec_module(inv);u=inv.u
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
inputs={};actors=[]
for version,x in [(6,-.43),(7,.43)]:
    source=ROOT/f'docs/3d-town/classic-residents-v{version}/resident-06/rb-gu-yuanshan.blend'
    inputs[source.relative_to(ROOT).as_posix()]=sha(source)
    with bpy.data.libraries.load(str(source),link=False) as (src,dst):
        dst.objects=[n for n in src.objects if n in ('rb-gu-yuanshan_skin','rb-gu-yuanshan_rig')]
        dst.actions=['Idle','Walk']
    rig=None
    for obj in dst.objects:
        bpy.context.collection.objects.link(obj)
        if obj.type=='ARMATURE':rig=obj;rig.location.x=x
    assert rig and all(dst.actions)
    actors.append((rig,list(dst.actions)))
inv.stage();u.camera('silhouette-comparison',(.3,-8,1.88),(0,0,1.34),1.88)
u.camera('walk-comparison',(.3,-8,1.55),(0,0,.97),2.95)
devices=u.configure(64,1600)
scene=bpy.context.scene;scene.render.resolution_y=1100
renders=[]
for name,action_index,frame in [('silhouette-comparison',0,1),('walk-comparison',1,7)]:
    for rig,actions in actors:
        rig.animation_data_create();rig.animation_data.action=actions[action_index]
        if actions[action_index].slots:rig.animation_data.action_slot=actions[action_index].slots[0]
    scene.frame_set(frame);bpy.context.view_layer.update()
    scene.camera=bpy.data.objects[name];scene.render.filepath=str(PACKAGE/(name+'.png'))
    stage=PACKAGE/(name+'.blend');bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(stage))
    bpy.ops.render.render(write_still=True)
    renders.append({'name':name,'clip':'Idle' if action_index==0 else 'Walk','frame':frame,
        'stageSource':stage.relative_to(ROOT).as_posix(),'stageSourceSha256':sha(stage),
        'renderPath':(PACKAGE/(name+'.png')).relative_to(ROOT).as_posix(),'renderSha256':sha(PACKAGE/(name+'.png'))})
(PACKAGE/'comparison-review.json').write_text(json.dumps({'sourceInputs':inputs,'builderSha256':sha(Path(__file__)),
    'stageSourceSha256':renders[0]['stageSourceSha256'],'renderSha256':renders[0]['renderSha256'],
    'renders':renders,'size':[1600,1100],'samples':64,'devices':devices,
    'left':'preserved v6','right':'v7 silhouette candidate','animationSource':'Actual saved Blender actions',
    'humanArtApproved':False},indent=2)+'\n',encoding='utf-8')
