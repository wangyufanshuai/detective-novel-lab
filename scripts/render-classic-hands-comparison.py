"""Render retained and articulated hand poses together under the same lights."""
from pathlib import Path
import importlib.util
import json
import hashlib
import bpy

ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-residents-v8'
spec=importlib.util.spec_from_file_location('hand_comparison_stage',ROOT/'scripts/build-blender-classic-investigator.py')
inv=importlib.util.module_from_spec(spec);spec.loader.exec_module(inv);u=inv.u
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
rows=[]
for actor in ('resident-03','resident-06','resident-08'):
    author=read(PACKAGE/actor/'authoring-review.json');profile=author['profile'];bpy.ops.wm.read_factory_settings(use_empty=True)
    u.MATS.clear();inputs=[];rigs=[]
    for source,x in [(ROOT/author['sourceInput']['path'],-.46),(PACKAGE/actor/(profile['id']+'.blend'),.46)]:
        inputs.append({'path':source.relative_to(ROOT).as_posix(),'sha256':sha(source)})
        with bpy.data.libraries.load(str(source),link=False) as (src,dst):
            dst.objects=[name for name in src.objects if name in (profile['id']+'_skin',profile['id']+'_rig')]
            dst.actions=['Idle']
        for obj in dst.objects:
            bpy.context.collection.objects.link(obj)
            if obj.type=='ARMATURE':rig=obj;rig.location.x=x
        rig.animation_data_create();rig.animation_data.action=dst.actions[0]
        if dst.actions[0].slots:rig.animation_data.action_slot=dst.actions[0].slots[0]
        rigs.append(rig)
    inv.stage();u.camera('hand-comparison',(0,-6,1.08),(0,0,.98),1.86);u.configure(48,1600)
    scene=bpy.context.scene;scene.frame_set(1);scene.render.resolution_y=850;scene.camera=bpy.data.objects['hand-comparison']
    path=PACKAGE/'comparisons'/f'{actor}.blend';path.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(path))
    output=path.with_suffix('.png');scene.render.filepath=str(output);bpy.ops.render.render(write_still=True)
    rows.append({'actorId':actor,'sourceInputs':inputs,'stage':{'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path)},
        'render':{'path':output.relative_to(ROOT).as_posix(),'sha256':sha(output)},'clip':'Idle','frame':1,
        'left':'retained source','right':'v8 articulated hands'})
(PACKAGE/'comparison-review.json').write_text(json.dumps({'schema':'classic-hands-comparison.v8','builderSha256':sha(Path(__file__)),
    'renderer':'Cycles','samples':48,'size':[1600,850],'comparisons':rows,'humanArtApproved':False},indent=2)+'\n',encoding='utf-8')
