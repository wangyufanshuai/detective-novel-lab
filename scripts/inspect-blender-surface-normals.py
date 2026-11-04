"""Read-only authored-mesh volume and normal diagnosis."""
from pathlib import Path
import json
import bpy,bmesh
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'docs/3d-rooms/candidates/blender-v5/fog-lamp-evidence-room.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
deps=bpy.context.evaluated_depsgraph_get()
negative=[];details=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or obj.get('asset_origin')!='project-local-authored':continue
    mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
    bm=bmesh.new();bm.from_mesh(mesh)
    volume=bm.calc_volume(signed=True)*obj.matrix_world.to_3x3().determinant()
    if volume < -1e-12:negative.append({'name':obj.name,'signedVolume':volume})
    if any(key in obj.name for key in ['envelope','tray-felt']):
        details.append({'name':obj.name,'volume':volume,'materials':[s.material.name if s.material else None for s in obj.material_slots],
                        'faces':[{'normal':list(p.normal),'center':list(obj.matrix_world@p.center),'area':p.area,'materialIndex':p.material_index,
                                  'materialName':mesh.materials[p.material_index].name if mesh.materials[p.material_index] else None} for p in mesh.polygons if p.area>.01]})
    bm.free();bpy.data.meshes.remove(mesh)
report={'source':str(source),'negativeVolumeObjects':negative,'details':details}
(ROOT/'outputs/blender-v5-normal-diagnostic.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('SURFACE_DIAG='+json.dumps(report))
