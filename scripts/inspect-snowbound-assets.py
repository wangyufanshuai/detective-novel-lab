"""Render the actual licensed glTF meshes in Blender before room placement."""
import bpy, json, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/snowbound-manor-v1'
spec=importlib.util.spec_from_file_location('base',ROOT/'scripts/build-blender-classic-railway.py')
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
bpy.ops.wm.read_factory_settings(use_empty=True)
provenance=json.loads((P/'licensed/provenance.json').read_text(encoding='utf-8'))
data=[]
positions=[(-4,0),(0,0),(4,0),(-6,4),(-2,4),(2,4),(6,4)]
for a,(x,y) in zip([a for a in provenance['assets'] if 'gltf' in a],positions):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(P/a['gltf']))
    objects=list(set(bpy.data.objects)-before)
    bpy.context.view_layer.update()
    vs=[o.matrix_world@v.co for o in objects if o.type=='MESH' for v in o.data.vertices]
    lo=Vector([min(v[i] for v in vs) for i in range(3)])
    hi=Vector([max(v[i] for v in vs) for i in range(3)])
    offset=Vector((x,y,0))-Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z))
    for o in objects:
        if o.parent not in objects:o.matrix_world=Matrix.Translation(offset)@o.matrix_world
    data.append({'id':a['id'],'originalBounds':[list(lo),list(hi)],'dimensions':list(hi-lo),
                 'position':[x,y],'meshes':len([o for o in objects if o.type=='MESH'])})
u.material('floor','777a7e',.8)
u.box('floor',(0,2,-.1),(24,18,.2),'floor',0)
world=bpy.data.worlds.new('neutral');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.4,.4,.4,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
bpy.context.scene.world=world
for name,pos,energy,size in [('key',(-3,-4,8),1800,8),('fill',(7,4,7),1200,7)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos
    o.rotation_euler=(Vector((0,2,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera=u.camera('assets-camera',(13,-21,16),(0,2,1),scale=18.8)
u.configure(32,1800)
(P/'asset-study.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(P/'asset-study.blend'))
bpy.context.scene.render.filepath=str(P/'renders/asset-study.png')
bpy.ops.render.render(write_still=True)
print('ASSET STUDY COMPLETE',flush=True)
