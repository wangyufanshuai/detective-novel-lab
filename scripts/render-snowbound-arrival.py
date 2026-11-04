"""Eye-level arrival cameras using the unchanged native manor source."""
from pathlib import Path
from mathutils import Vector
import bpy,json,hashlib,importlib.util,sys,argparse
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ap=argparse.ArgumentParser();ap.add_argument('--width',type=int,default=1920);ap.add_argument('--samples',type=int,default=96)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.open_mainfile(filepath=str(P/'snowbound-manor.blend'))
spec=importlib.util.spec_from_file_location('u',ROOT/'scripts/build-blender-classic-railway.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
u.configure(a.samples,a.width);bpy.context.scene.view_settings.exposure=.4
poses=[('snowbound-arrival',(15,-24,2.1),(0,3,4.2),36),('manor-gate',(-11,-25,2.0),(0,2,4.1),36)]
records=[]
for name,pos,target,lens in poses:
    cam=u.camera(name,pos,target,lens=lens);cam.data.dof.use_dof=True;cam.data.dof.focus_distance=(Vector(target)-Vector(pos)).length;cam.data.dof.aperture_fstop=5.6
    bpy.context.scene.camera=cam;path=P/'renders'/(name+'.png');bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    records.append({'camera':name,'position':pos,'target':target,'lens':lens,'fStop':5.6,'path':path.relative_to(P).as_posix(),'sha256':sha(path)})
(P/'renders/arrival-render-receipt.json').write_text(json.dumps({'sourceSha256':sha(P/'snowbound-manor.blend'),'cameraScriptSha256':sha(Path(__file__)),'cameraOverrideOnly':True,'width':a.width,'samples':a.samples,'renders':records},indent=2)+'\n',encoding='utf-8')
print('EYE LEVEL ARRIVAL COMPLETE',flush=True)
