"""Continuous edge strips preserve sub-millimetre paper during texture baking."""
from lib.blender_room_furniture_uv import evaluated_charts as furniture_charts
from lib.blender_room_furniture_uv import swept_pipe

class InkChartPolicy:
    def __init__(self,obj):self.obj=obj;self.name=obj.name
    def get(self,key,default=None):return True if key=='furniture_v10' else self.obj.get(key,default)

def evaluated_charts(mesh,obj):
    if obj.get('patina_wire_hoop'):
        uv=mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='RoomAtlasUV')
        uv.name='RoomAtlasUV';mesh.uv_layers.active=uv;swept_pipe(mesh,uv);return
    if obj.name.startswith(('folio_ink_rule','folio_margin')):
        furniture_charts(mesh,InkChartPolicy(obj));return
    if not obj.name.startswith('folio_paper_'):
        furniture_charts(mesh,obj);return
    nx,ny=20,14;count=(nx+1)*(ny+1)
    if len(mesh.vertices)!=2*count:raise RuntimeError('Unexpected thin-paper topology: '+obj.name)
    uv=mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='RoomAtlasUV')
    uv.name='RoomAtlasUV';mesh.uv_layers.active=uv
    perimeter=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
    u={perimeter[0]:0.0}
    for a,b in zip(perimeter,perimeter[1:]):u[b]=u[a]+(mesh.vertices[b].co-mesh.vertices[a].co).length
    total=u[perimeter[-1]]+(mesh.vertices[perimeter[0]].co-mesh.vertices[perimeter[-1]].co).length
    xmin=min(v.co.x for v in mesh.vertices);ymin=min(v.co.y for v in mesh.vertices)
    for face in mesh.polygons:
        ids=[mesh.loops[i].vertex_index for i in face.loop_indices]
        if all(v<count for v in ids) or all(v>=count for v in ids):
            offset=.8 if ids[0]>=count else 0
            for loop,v in zip(face.loop_indices,ids):
                p=mesh.vertices[v].co;uv.data[loop].uv=(p.x-xmin,p.y-ymin+offset)
        else:
            seam=perimeter[-1] in [v%count for v in ids]
            for loop,v in zip(face.loop_indices,ids):
                col=v%count
                uv.data[loop].uv=(total if seam and col==perimeter[0] else u[col],1.6+(.024 if v>=count else 0))
