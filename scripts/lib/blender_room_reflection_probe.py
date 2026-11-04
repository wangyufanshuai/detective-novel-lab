"""Render local scene radiance for rough surface reflections; no external HDRI."""
import math,time
import bpy
import numpy as np


def render_probe(base,output):
    scene=bpy.context.scene
    original_camera=scene.camera
    original_resolution=(scene.render.resolution_x,scene.render.resolution_y)
    original_settings=(scene.render.image_settings.file_format,scene.render.image_settings.color_depth,scene.render.image_settings.color_mode)
    original_filepath=scene.render.filepath
    data=bpy.data.cameras.new('Local reflection capture')
    camera=bpy.data.objects.new('Local reflection capture',data);scene.collection.objects.link(camera)
    camera.location=(0,.50,1.45)
    # Equirectangular u=.5 points toward glTF +X; increasing u points to glTF +Z.
    # Blender Z-up is exported as glTF Y-up: (x,y,z) -> (x,z,-y).
    camera.rotation_euler=(math.pi/2,0,-math.pi/2)
    data.type='PANO';data.panorama_type='EQUIRECTANGULAR'
    scene.camera=camera;scene.render.resolution_x=1024;scene.render.resolution_y=512
    settings=scene.render.image_settings
    settings.file_format='OPEN_EXR';settings.color_depth='16';settings.color_mode='RGB';settings.exr_codec='ZIP'
    path=output/'textures/room-reflection.exr';path.parent.mkdir(exist_ok=True)
    scene.render.filepath=str(path)
    started=time.perf_counter()
    try:
        bpy.ops.render.render(write_still=True)
        image=bpy.data.images.load(str(path),check_existing=False)
        values=np.empty(image.size[0]*image.size[1]*4,dtype=np.float32);image.pixels.foreach_get(values)
        rgb=values.reshape(-1,4)[:,:3]
        stats={'finite':bool(np.isfinite(rgb).all()),'min':float(rgb.min()),'max':float(rgb.max()),'mean':float(rgb.mean())}
        if not stats['finite'] or stats['max']<=1 or path.read_bytes()[:4]!=bytes((0x76,0x2f,0x31,0x01)):
            raise RuntimeError('Reflection capture must contain finite HDR scene radiance.')
        report={'schema':'game-room.local-reflection-probe.v1','path':'textures/room-reflection.exr',
                'sha256':base.sha(path),'bytes':path.stat().st_size,'size':[1024,512],'positionBlender':[0,.50,1.45],
                'positionGltf':[0,1.45,-.50],'projection':'equirectangular','centerDirectionGltf':[1,0,0],
                'encoding':'OpenEXR RGB half-float ZIP','colorSpace':'linear Rec.709','samples':scene.cycles.samples,
                'seconds':round(time.perf_counter()-started,2),'statistics':stats,'externalSource':False,
                'sourceBlendSha256':base.sha(output/'fog-lamp-evidence-room.blend'),
                'limitations':['Single static capture near the desk; no parallax correction or moving-object reflections.'],
                'humanApproval':False}
        base.write(output/'reflection-probe-receipt.json',report)
        return report
    finally:
        scene.camera=original_camera
        scene.render.resolution_x,scene.render.resolution_y=original_resolution
        settings.file_format,settings.color_depth,settings.color_mode=original_settings
        scene.render.filepath=original_filepath
        bpy.data.objects.remove(camera,do_unlink=True);bpy.data.cameras.remove(data)
