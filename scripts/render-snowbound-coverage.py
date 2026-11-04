"""Correct review camera occlusion without modifying source geometry or materials."""
from pathlib import Path
from mathutils import Vector
import bpy,json,hashlib,importlib.util
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(P/'snowbound-manor.blend'))
spec=importlib.util.spec_from_file_location('u',ROOT/'scripts/build-blender-classic-railway.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
u.configure(64,1920);bpy.context.scene.view_settings.exposure=.4
overrides=[('corner-ne',(5.45,8.65,1.85),(0,4.5,1.8),10.3923),('corner-nw',(-5.45,8.65,1.85),(0,4.5,1.8),10.3923),('ceiling-up',(0,5,1.4),(0,5,4.25),5.2)]
report=json.loads((P/'renders/render-receipt.json').read_text(encoding='utf-8'));assert report['sourceSha256']==sha(P/'snowbound-manor.blend')
report['cameraOverrides']=[]
for name,pos,target,lens in overrides:
    cam=bpy.data.objects[name];cam.location=pos;cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
    bpy.context.scene.camera=cam;path=P/'renders'/(name+'.png');bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    row=next(r for r in report['renders'] if r['camera']==name);row['sha256']=sha(path);row['samples']=64
    report['cameraOverrides'].append({'camera':name,'position':pos,'target':target,'lens':lens,'reason':'Keep bookcases behind back-corner cameras; include both whole pendants in upward review.'})
    report['cameraPositions'][name]=list(pos)
report['coverageScriptSha256']=sha(Path(__file__))
(P/'renders/render-receipt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('REVIEW COVERAGE CORRECTED',flush=True)
