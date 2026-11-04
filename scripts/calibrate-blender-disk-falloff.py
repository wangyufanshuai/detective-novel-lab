"""Independent diffuse receiver measurements for the browser's spatial disk integral."""
from pathlib import Path
import bpy,numpy as np,json,hashlib
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/3d-rooms/candidates/blender-v7'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=256;scene.cycles.use_denoising=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU';scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0
scene.render.resolution_x=64;scene.render.resolution_y=64;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='32';scene.render.image_settings.color_mode='RGB'
bpy.ops.mesh.primitive_plane_add(size=12);obj=bpy.context.object
mat=bpy.data.materials.new('White diffuse receiver');mat.use_nodes=True;obj.data.materials.append(mat)
tree=mat.node_tree;tree.nodes.clear();diffuse=tree.nodes.new('ShaderNodeBsdfDiffuse');diffuse.inputs['Color'].default_value=(1,1,1,1)
out=tree.nodes.new('ShaderNodeOutputMaterial');tree.links.new(diffuse.outputs[0],out.inputs['Surface'])
data=bpy.data.lights.new('Disk source','AREA');data.shape='DISK';data.size=2;data.energy=100;data.normalize=True
light=bpy.data.objects.new('Disk source',data);scene.collection.objects.link(light)
light.location=(0,2,2);light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Receiver camera');camera_data.type='ORTHO';camera_data.ortho_scale=.04
camera=bpy.data.objects.new('Receiver camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
records=[]
for x in (0,3,5):
    point=Vector((x,0,0));camera.location=(x,-2,2);camera.rotation_euler=(point-camera.location).to_track_quat('-Z','Y').to_euler()
    path=OUT/'calibration'/('disk-diffuse-'+str(x)+'.exr');scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    img=bpy.data.images.load(str(path),check_existing=False);values=np.empty(64*64*4,dtype=np.float32);img.pixels.foreach_get(values)
    sample=values.reshape(64,64,4)[24:40,24:40,:3]
    records.append({'receiverBlender':[x,0,0],'meanRadiance':float(sample.mean()),'samplePixels':256,
                    'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
report={'schema':'game-room.disk-diffuse-calibration.v1','blenderVersion':bpy.app.version_string,
        'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'samples':256,'records':records,
        'source':{'positionBlender':[0,2,2],'targetBlender':[0,0,0],'diameterMeters':2,'powerWatts':100},
        'passed':records[0]['meanRadiance']>records[1]['meanRadiance']>records[2]['meanRadiance']>0}
(OUT/'disk-falloff-calibration.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('DISK_FALLOFF='+json.dumps(report),flush=True)
if not report['passed']:raise RuntimeError('Diffuse receiver calibration failed.')
