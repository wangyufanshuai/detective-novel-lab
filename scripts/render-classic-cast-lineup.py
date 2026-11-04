"""Render the three verified Blender sources together without changing them."""
from pathlib import Path
import bpy,importlib.util,json,hashlib
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-residents-v1'
spec=importlib.util.spec_from_file_location('review_stage',ROOT/'scripts/build-blender-classic-investigator.py');inv=importlib.util.module_from_spec(spec);spec.loader.exec_module(inv);u=inv.u
bpy.ops.wm.read_factory_settings(use_empty=True)
profiles={p['actorId']:p for p in json.loads((PACKAGE/'profiles.json').read_text(encoding='utf-8'))['profiles']};inputs={}
for i,actor in enumerate(['resident-03','resident-06','resident-08']):
    p=profiles[actor];source=PACKAGE/actor/(p['id']+'.blend');inputs[str(source.relative_to(ROOT)).replace('\\','/')]=hashlib.sha256(source.read_bytes()).hexdigest()
    with bpy.data.libraries.load(str(source),link=False) as (src,dst):dst.objects=[n for n in src.objects if n in [p['id']+'_skin',p['id']+'_rig']]
    for obj in dst.objects:
        bpy.context.collection.objects.link(obj)
        if obj.type=='ARMATURE':obj.location.x=(i-1)*1.0;obj.rotation_euler.z=[-.08,0,.08][i]
inv.stage();u.camera('cast-lineup',(2.3,-11,3),(0,0,.98),4.4)
devices=u.configure(64,1920);scene=bpy.context.scene;scene.render.resolution_y=1080;scene.camera=bpy.data.objects['cast-lineup']
scene.render.filepath=str(PACKAGE/'cast-lineup.png');bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(PACKAGE/'cast-lineup.blend'))
bpy.ops.render.render(write_still=True)
receipt={'sourceInputs':inputs,'stageBuilderSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'stageSourceSha256':hashlib.sha256((PACKAGE/'cast-lineup.blend').read_bytes()).hexdigest(),
    'renderSha256':hashlib.sha256((PACKAGE/'cast-lineup.png').read_bytes()).hexdigest(),
    'engine':'Cycles','samples':64,'size':[1920,1080],'devices':devices,'humanArtApproved':False}
(PACKAGE/'cast-lineup-review.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8');print('ACTUAL_BLENDER_LINEUP_RENDERED')
