"""Read-only render probe: remove visible light cards and fog exclusion silhouette."""
from pathlib import Path
import bpy,importlib.util
P=Path(__file__).resolve().parents[1]/'docs/3d-town/snowbound-manor-v1'
source=P/'snowbound-manor.blend';bpy.ops.wm.open_mainfile(filepath=str(source))
spec=importlib.util.spec_from_file_location('u',Path(__file__).resolve().parents[1]/'scripts/build-blender-classic-railway.py')
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
for o in bpy.data.objects:
    if o.type=='LIGHT' and o.data.type=='AREA':
        o.visible_camera=False;o.visible_glossy=False;o.visible_transmission=False
old=bpy.data.objects.get('continuous_outdoor_haze')
mat=old.data.materials[0];bpy.data.objects.remove(old,do_unlink=True)
u.MATS['haze']=mat;u.LAY='atmosphere'
u.box('continuous_outdoor_haze',(0,20,25),(220,220,65),'haze',0)
mat.node_tree.nodes.get('Principled Volume').inputs['Density'].default_value=.002
u.configure(32,1200);bpy.context.scene.view_settings.exposure=.4
out=P/'calibration';out.mkdir(exist_ok=True)
for name in ['hall','exterior']:
    bpy.context.scene.camera=bpy.data.objects[name];bpy.context.scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
print('CAMERA LIGHT PROBE COMPLETE',flush=True)
