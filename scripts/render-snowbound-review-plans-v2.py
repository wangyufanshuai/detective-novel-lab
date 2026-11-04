"""Actual-mesh monochrome floor, reflected ceiling, and aperture projections."""
from pathlib import Path
from mathutils import Vector,Matrix
import bpy,bmesh,json,hashlib

P=Path(__file__).resolve().parents[1]/'docs/3d-town/snowbound-manor-v2'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
source=P/'snowbound-manor.blend';bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
shade=scene.display.shading;shade.light='STUDIO';shade.color_type='SINGLE';shade.single_color=(.82,.82,.82)
shade.show_shadows=True;shade.show_cavity=True;shade.cavity_type='BOTH';shade.show_object_outline=True;shade.object_outline_color=(.03,.03,.03)
shade.background_type='WORLD';scene.world.color=(1,1,1)
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.resolution_percentage=100

def camera(name,position,target,scale):
    d=bpy.data.cameras.new(name);d.type='ORTHO';d.ortho_scale=scale
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=position
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

receipts=[]
for name,pos,target,scale,size in [
    ('lower-room',(0,1,25),(0,1,0),25,(1400,1400)),
    ('reflected-ceiling',(0,5,.3),(0,5,4.25),13.2,(1400,1400)),
    ('front-apertures',(0,-18,2.25),(0,0,2.25),13.2,(1600,520)),
    ('front-elevation',(0,-25,5.0),(0,3,5.0),25,(1600,900))]:
    sections=[]
    for o in bpy.data.objects:
        lay=o.get('layer');visible=False
        if name=='lower-room':visible=lay in ['hall_floor','hall_front','hall_back','hall_west','hall_east','interior','porch'] or o.name.startswith(('approach_paving','path_drift'))
        elif name=='reflected-ceiling':visible=lay=='ceiling'
        elif name=='front-apertures':visible=o.name=='front_stone_shell'
        elif name=='front-elevation':visible=lay not in ['weather','landscape','atmosphere','lights']
        o.hide_render=not visible
        if name=='lower-room' and visible and o.type=='MESH' and lay in ['hall_front','hall_back','hall_west','hall_east','porch']:
            original=o.data;matrix=o.matrix_world.copy();copy=original.copy();bm=bmesh.new();bm.from_mesh(copy);bm.transform(matrix)
            cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,2.0),plane_no=(0,0,1),clear_outer=True,clear_inner=False)
            edges=[e for e in cut['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
            if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
            bm.to_mesh(copy);bm.free();copy.update();o.data=copy;o.matrix_world=Matrix.Identity(4);sections.append((o,original,matrix,copy))
    shade.single_color=(0,0,0) if name=='front-apertures' else (.82,.82,.82)
    shade.show_shadows=name!='front-apertures';shade.show_cavity=name!='front-apertures'
    scene.camera=camera('review-'+name,pos,target,scale)
    scene.render.resolution_x,scene.render.resolution_y=size
    path=P/'plans'/(name+'.png');scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    receipts.append({'id':name,'path':path.relative_to(P).as_posix(),'sha256':sha(path),'source':'actual evaluated meshes','wallSectionHeight':2.0 if name=='lower-room' else None})
    for o,original,matrix,copy in sections:o.data=original;o.matrix_world=matrix;bpy.data.meshes.remove(copy)
(P/'plans/render-receipt.json').write_text(json.dumps({'sourceSha256':sha(source),'renders':receipts},indent=2)+'\n',encoding='utf-8')
print('REVIEW PROJECTIONS COMPLETE',flush=True)
