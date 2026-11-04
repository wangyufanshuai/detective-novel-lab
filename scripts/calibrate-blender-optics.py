"""Measure installed Cycles area-source radiance and panorama axes independently."""
from pathlib import Path
import hashlib,json,math
import bpy
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/3d-rooms/candidates/blender-v7/calibration'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU';scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0
scene.render.resolution_x=64;scene.render.resolution_y=64;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='32'
scene.render.image_settings.color_mode='RGB';scene.render.image_settings.exr_codec='ZIP'
cam_data=bpy.data.cameras.new('Calibration');cam=bpy.data.objects.new('Calibration',cam_data)
scene.collection.objects.link(cam);scene.camera=cam
cam.location=(0,-2,2);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO';cam_data.ortho_scale=.4
bpy.ops.mesh.primitive_plane_add(size=8);mirror=bpy.context.object
mat=bpy.data.materials.new('Unit perfect mirror');mat.use_nodes=True;mirror.data.materials.append(mat)
tree=mat.node_tree;tree.nodes.clear()
out=tree.nodes.new('ShaderNodeOutputMaterial');bsdf=tree.nodes.new('ShaderNodeBsdfGlossy')
bsdf.inputs['Color'].default_value=(1,1,1,1);bsdf.inputs['Roughness'].default_value=0
tree.links.new(bsdf.outputs[0],out.inputs['Surface'])
data=bpy.data.lights.new('Measured emitter','AREA');data.color=(1,1,1);data.normalize=True
light=bpy.data.objects.new('Measured emitter',data);scene.collection.objects.link(light)
light.location=(0,2,2);light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()

def render(name):
    path=OUT/(name+'.exr');scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    img=bpy.data.images.load(str(path),check_existing=False)
    array=np.empty(img.size[0]*img.size[1]*4,dtype=np.float32);img.pixels.foreach_get(array)
    values=array.reshape(img.size[1],img.size[0],4)[:,:,:3].copy();bpy.data.images.remove(img)
    return values,{'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

records=[];artifacts=[]
for shape,size,power in [('DISK',2,100),('DISK',1,100),('DISK',2,200),('SQUARE',2,100)]:
    data.shape=shape;data.size=size;data.energy=power
    values,item=render('mirror-'+shape+'-'+str(size)+'-'+str(power));artifacts.append(item)
    measured=float(values[28:36,28:36].mean())
    area=math.pi*(size/2)**2 if shape=='DISK' else size**2
    records.append({'shape':shape,'sizeMeters':size,'powerWatts':power,'areaMeters2':area,
                    'mirrorRadiance':measured,'radianceTimesAreaOverPower':measured*area/power})

# A camera can miss analytic emitters even while a perfect mirror sees them.
mirror.hide_render=True;cam.location=(0,0,0);cam.rotation_euler=(light.location-cam.location).to_track_quat('-Z','Y').to_euler()
values,item=render('direct-camera');artifacts.append(item)
camera_radiance=float(values[28:36,28:36].mean())
factor=float(np.median([r['radianceTimesAreaOverPower'] for r in records]))
# Validate a camera-only surrogate against the measured source radiance.
# It never contributes light or appears in secondary reflection rays.
bpy.ops.mesh.primitive_plane_add(size=data.size,location=light.location)
proxy=bpy.context.object;proxy.rotation_euler=light.rotation_euler
proxy.rotation_euler.rotate_axis('X',math.pi)
for prop in ('visible_diffuse','visible_glossy','visible_transmission','visible_volume_scatter','visible_shadow'):
    setattr(proxy,prop,False)
proxy_mat=bpy.data.materials.new('Camera-only source proxy');proxy_mat.use_nodes=True;proxy.data.materials.append(proxy_mat)
proxy_mat.cycles.emission_sampling='NONE'
proxy_tree=proxy_mat.node_tree;proxy_tree.nodes.clear()
proxy_out=proxy_tree.nodes.new('ShaderNodeOutputMaterial');emission=proxy_tree.nodes.new('ShaderNodeEmission')
emission.inputs['Strength'].default_value=data.energy/(data.size**2)*factor
proxy_tree.links.new(emission.outputs[0],proxy_out.inputs['Surface'])
values,item=render('direct-camera-proxy');artifacts.append(item)
proxy_radiance=float(values[28:36,28:36].mean())
mirror.hide_render=False;cam.location=(0,-2,2);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
values,item=render('mirror-with-camera-proxy');artifacts.append(item)
mirror_with_proxy=float(values[28:36,28:36].mean())
proxy_review={'cameraRadiance':proxy_radiance,'referenceMirrorRadiance':records[-1]['mirrorRadiance'],
              'mirrorWithProxy':mirror_with_proxy,'emissionSampling':'NONE',
              'passed':abs(proxy_radiance/records[-1]['mirrorRadiance']-1)<.001 and abs(mirror_with_proxy/records[-1]['mirrorRadiance']-1)<.001}
bpy.data.objects.remove(proxy,do_unlink=True)
bpy.data.objects.remove(light,do_unlink=True);bpy.data.objects.remove(mirror,do_unlink=True)
cam_data.type='PANO';cam_data.panorama_type='EQUIRECTANGULAR'
cam.location=(0,0,0)
cam.rotation_euler=(math.pi/2,0,-math.pi/2)
scene.render.resolution_x=512;scene.render.resolution_y=256
axis_specs=[('gltf+x',(1,0,0),(1,0,0),(.5,.5)),('gltf+z',(0,-1,0),(0,1,0),(.75,.5)),
            ('gltf-x',(-1,0,0),(0,0,1),(0,.5)),('gltf-z',(0,1,0),(1,1,0),(.25,.5)),
            ('upper+x',(1,0,1),(1,0,1),(.5,.75)),('lower+x',(1,0,-1),(0,1,1),(.5,.25))]
for name,direction,color,uv in axis_specs:
    position=Vector(direction).normalized()*4
    bpy.ops.mesh.primitive_plane_add(size=1.3,location=position);obj=bpy.context.object
    obj.rotation_euler=(-position).to_track_quat('Z','Y').to_euler()
    mat=bpy.data.materials.new(name);mat.use_nodes=True;obj.data.materials.append(mat)
    tree=mat.node_tree;tree.nodes.clear();out=tree.nodes.new('ShaderNodeOutputMaterial');emission=tree.nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value=(*color,1);emission.inputs['Strength'].default_value=1
    tree.links.new(emission.outputs[0],out.inputs['Surface'])
values,item=render('panorama-axes');artifacts.append(item);axes=[]
for name,direction,color,uv in axis_specs:
    x=int(uv[0]*512)%512;y=min(255,int(uv[1]*256))
    sample=values[y,x]
    axes.append({'direction':name,'expectedUv':list(uv),'expectedRGB':list(color),'actualRGB':sample.tolist(),
                 'passed':bool(np.max(np.abs(sample-np.array(color)))<.02)})
passed=proxy_review['passed'] and all(a['passed'] for a in axes) and factor>0 and all(abs(r['radianceTimesAreaOverPower']/factor-1)<.01 for r in records)
report={'schema':'game-room.reflection-calibration.v1','blenderVersion':bpy.app.version_string,
        'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'records':records,
        'normalizedAreaRadianceFactor':factor,'directCameraRadiance':camera_radiance,'cameraOnlyProxy':proxy_review,'axes':axes,'artifacts':artifacts,
        'passed':passed,'scope':'white normalized DISK/SQUARE sources at full spread; linear EXR and unit mirror; static probe axes',
        'humanApproval':False}
(OUT.parent/'reflection-calibration.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('OPTICS_CALIBRATION='+json.dumps(report),flush=True)
if not passed:raise RuntimeError('Reflection calibration did not pass.')
