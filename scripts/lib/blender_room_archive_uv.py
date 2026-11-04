"""Unfold curved archive bindings and keep narrow casework bevels legible."""
from lib.blender_room_patina_uv import evaluated_charts as patina_charts
from lib.blender_room_furniture_uv import evaluated_charts as furniture_charts,swept_pipe


class ArchivePolicy:
    def __init__(self,obj):self.obj=obj;self.name=obj.name
    def get(self,key,default=None):return True if key=='furniture_v10' else self.obj.get(key,default)


def evaluated_charts(mesh,obj):
    if not obj.get('archive_v12'):return patina_charts(mesh,obj)
    uv=mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='RoomAtlasUV')
    uv.name='RoomAtlasUV';mesh.uv_layers.active=uv
    if obj.get('archive_pipe'):swept_pipe(mesh,uv);return
    count=obj.get('archive_profile_count')
    if not count:return furniture_charts(mesh,ArchivePolicy(obj))
    if len(mesh.vertices)!=2*count:raise RuntimeError('Archive profile topology changed: '+obj.name)
    edge=[0.0]
    for i in range(1,count):edge.append(edge[-1]+max(.012,(mesh.vertices[i].co-mesh.vertices[i-1].co).length))
    total=edge[-1]+max(.012,(mesh.vertices[count-1].co-mesh.vertices[0].co).length)
    low=[min(v.co[i] for v in mesh.vertices) for i in range(3)];high=[max(v.co[i] for v in mesh.vertices) for i in range(3)]
    height=max(.030,high[2]-low[2]);cap_y=max(.036,high[1]-low[1]);cap_x=max(.036,high[0]-low[0])
    for face in mesh.polygons:
        ids=[mesh.loops[k].vertex_index for k in face.loop_indices]
        rows=[i//count for i in ids];cols=[i%count for i in ids]
        if len(set(rows))==1:
            for loop,i in zip(face.loop_indices,ids):
                p=mesh.vertices[i].co
                uv.data[loop].uv=((p.x-low[0])/(high[0]-low[0])*cap_x,height+.04+rows[0]*(cap_y+.04)+(p.y-low[1])/(high[1]-low[1])*cap_y)
        else:
            for loop,row,col in zip(face.loop_indices,rows,cols):
                uv.data[loop].uv=(total if max(cols)==count-1 and col==0 else edge[col],row*height)
