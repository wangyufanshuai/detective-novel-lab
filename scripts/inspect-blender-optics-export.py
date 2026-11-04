"""Inspect/export the saved lens material in isolation without mutating the candidate."""
import bpy,json
from pathlib import Path
from io_scene_gltf2.blender.exp.material.search_node_tree import get_socket_from_gltf_material_node
from io_scene_gltf2.blender.com.material_helpers import create_settings_group
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'docs/3d-rooms/candidates/blender-v7/fog-lamp-evidence-room.blend'))
mat=bpy.data.materials['Optical Glass']
for node in mat.node_tree.nodes:
    if node.type=='GROUP':print('GROUP',node.node_tree.name,[(s.name,s.default_value) for s in node.inputs],len(node.node_tree.nodes))
socket=get_socket_from_gltf_material_node(mat.node_tree,'Thickness')
print('THICKNESS',socket.socket)
bpy.ops.object.select_all(action='DESELECT');lens=bpy.data.objects['magnifier_lens'];lens.select_set(True);bpy.context.view_layer.objects.active=lens
for variant in ('original','only-group-io','with-group-io'):
    if variant=='only-group-io':
        group=next(node.node_tree for node in mat.node_tree.nodes if node.type=='GROUP')
        group.nodes.new('NodeGroupInput');group.nodes.new('NodeGroupOutput')
    if variant=='with-group-io':
        for node in list(mat.node_tree.nodes):
            if node.type=='GROUP':mat.node_tree.nodes.remove(node)
        node=mat.node_tree.nodes.new('ShaderNodeGroup');node.node_tree=create_settings_group('glTF Material Output v7 tested')
        node.inputs['Thickness'].default_value=.012
    path=ROOT/'outputs'/('lens-material-'+variant+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_materials='EXPORT')
    data=path.read_bytes();length=int.from_bytes(data[12:16],'little');doc=json.loads(data[20:20+length])
    print('ISOLATED_EXPORT='+json.dumps({'variant':variant,'materials':doc['materials']}))
