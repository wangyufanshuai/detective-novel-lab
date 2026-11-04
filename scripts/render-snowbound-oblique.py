"""Move the ceiling review camera away from the arrival table lamp."""
from pathlib import Path
from mathutils import Vector
import bpy,json,hashlib,importlib.util
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(P/'snowbound-manor.blend'))
spec=importlib.util.spec_from_file_location('u',ROOT/'scripts/build-blender-classic-railway.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
u.configure(64,1920);bpy.context.scene.view_settings.exposure=.4
name='ceiling-oblique-a';pos=(-3.9,2.4,1.4);target=(2.1,7.5,3.95)
cam=bpy.data.objects[name];cam.location=pos;cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();cam.data.lens=15
bpy.context.scene.camera=cam;path=P/'renders'/(name+'.png');bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
report=json.loads((P/'renders/render-receipt.json').read_text(encoding='utf-8'));assert report['sourceSha256']==sha(P/'snowbound-manor.blend')
row=next(r for r in report['renders'] if r['camera']==name);row['sha256']=sha(path);row['samples']=64
report['cameraOverrides']=[r for r in report.get('cameraOverrides',[]) if r['camera']!=name]
report['cameraOverrides'].append({'camera':name,'position':pos,'target':target,'lens':15,'reason':'Move away from the entry lamp so the ceiling is unobstructed.'})
report['cameraPositions'][name]=list(pos);report['obliqueScriptSha256']=sha(Path(__file__))
(P/'renders/render-receipt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('CEILING OBLIQUE CORRECTED',flush=True)
