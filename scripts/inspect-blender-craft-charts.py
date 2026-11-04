from pathlib import Path
import bpy,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.blender_room_craft_uv import evaluated_charts
OUT=ROOT/'docs/3d-rooms/candidates/blender-v9'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'fog-lamp-evidence-room.blend'))
coverage=json.loads((OUT/'prop-bake-coverage.json').read_text())['objects'];records=[]
for name,record in coverage.items():
    if not record['blackSamples']:continue
    obj=bpy.data.objects[name];mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    evaluated_charts(mesh,obj);mesh.calc_loop_triangles();uv=mesh.uv_layers['RoomAtlasUV'].data
    bad=[]
    for tri in mesh.loop_triangles:
        a,b,c=[uv[i].uv for i in tri.loops];area=abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2
        if area<1e-10:bad.append({'index':tri.index,'worldArea':tri.area,'uvArea':area,'normal':list(tri.normal)})
    records.append({'object':name,'collapsedTriangles':bad,'blackSamples':record['blackSamples']})
print('CHART_DIAG='+json.dumps(records),flush=True)
(ROOT/'outputs/blender-v9-chart-diagnostic.json').write_text(json.dumps(records,indent=2))
