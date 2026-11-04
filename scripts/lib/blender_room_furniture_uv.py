"""Keep narrow furniture bevel bands separate from large coplanar faces."""
from lib.blender_room_craft_uv import evaluated_charts as craft_charts
import math


def swept_ring(mesh,uv,count):
    rows=len(mesh.vertices)//count
    perimeter=[0.0]
    for i in range(1,count):perimeter.append(perimeter[-1]+(mesh.vertices[i].co-mesh.vertices[i-1].co).length)
    total=perimeter[-1]+(mesh.vertices[count-1].co-mesh.vertices[0].co).length
    cross=[0.0]
    for i in range(1,rows):cross.append(cross[-1]+max(.012,(mesh.vertices[i*count].co-mesh.vertices[(i-1)*count].co).length))
    cross_total=cross[-1]+max(.012,(mesh.vertices[(rows-1)*count].co-mesh.vertices[0].co).length)
    for face in mesh.polygons:
        ids=[mesh.loops[i].vertex_index for i in face.loop_indices]
        row_ids=[i//count for i in ids];cols=[i%count for i in ids]
        for loop,row,col in zip(face.loop_indices,row_ids,cols):
            u=total if max(cols)==count-1 and col==0 else perimeter[col]
            v=cross_total if max(row_ids)==rows-1 and row==0 else cross[row]
            uv.data[loop].uv=(u,v)


def cylindrical(mesh,uv):
    low=[min(v.co[i] for v in mesh.vertices) for i in range(3)]
    high=[max(v.co[i] for v in mesh.vertices) for i in range(3)]
    cx=(low[0]+high[0])/2;cy=(low[1]+high[1])/2
    radius=max(math.hypot(v.co.x-cx,v.co.y-cy) for v in mesh.vertices)
    height=high[2]-low[2];uv_height=max(.030,height)
    for face in mesh.polygons:
        points=[mesh.vertices[mesh.loops[i].vertex_index].co for i in face.loop_indices]
        if abs(face.normal.z)>.999:
            cap=face.normal.z>0
            for loop,p in zip(face.loop_indices,points):uv.data[loop].uv=(p.x-cx+radius,p.y-cy+radius+uv_height+.03+cap*(radius*2+.03))
        else:
            angles=[math.atan2(p.y-cy,p.x-cx)%(2*math.pi) for p in points]
            if max(angles)-min(angles)>math.pi:angles=[v+2*math.pi if v<math.pi else v for v in angles]
            for loop,p,angle in zip(face.loop_indices,points,angles):uv.data[loop].uv=(angle*radius,(p.z-low[2])/height*uv_height)


def swept_pipe(mesh,uv,sides=10):
    rows=len(mesh.vertices)//sides
    centers=[sum((mesh.vertices[row*sides+k].co for k in range(sides)),mesh.vertices[0].co*0)/sides for row in range(rows)]
    length=[0.0]
    for row in range(1,rows):length.append(length[-1]+(centers[row]-centers[row-1]).length)
    radius=(mesh.vertices[0].co-centers[0]).length
    circumference=max(.036,2*math.pi*radius)
    for face in mesh.polygons:
        ids=[mesh.loops[i].vertex_index for i in face.loop_indices]
        rows_used=[i//sides for i in ids];columns=[i%sides for i in ids]
        if len(set(rows_used))==1:
            # Independent circular caps; side strip remains continuous.
            offset=length[-1]+.03+rows_used[0]/(rows-1)*.066
            for loop,col in zip(face.loop_indices,columns):
                angle=2*math.pi*col/sides
                uv.data[loop].uv=(offset+.018*(1+math.cos(angle)),.018*(1+math.sin(angle)))
        else:
            for loop,row,col in zip(face.loop_indices,rows_used,columns):
                v=circumference if max(columns)==sides-1 and col==0 else col/sides*circumference
                uv.data[loop].uv=(length[row],v)


def evaluated_charts(mesh,obj):
    if not obj.get('furniture_v10'):return craft_charts(mesh,obj)
    uv=mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='RoomAtlasUV')
    uv.name='RoomAtlasUV';mesh.uv_layers.active=uv
    if obj.name.startswith('furniture_leather_tooling_'):
        swept_ring(mesh,uv,28);return
    if obj.name in ('furniture_under_top_bead','furniture_mitered_ogee_edge'):
        swept_ring(mesh,uv,4);return
    if obj.name.startswith('furniture_cast_bail_'):
        swept_pipe(mesh,uv);return
    if obj.name.startswith(('furniture_tapered_leg_','furniture_handle_rosette_','furniture_handle_pin_')):
        cylindrical(mesh,uv);return
    keys={};parents={};edges={};groups={}
    for face in mesh.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]))
        # A bevel whose dominant axis matches a broad board is still a separate
        # band. Quantized full normals preserve that distinction at packing.
        keys[face.index]=(axis,face.normal[axis]>=0,tuple(round(v*4) for v in face.normal))
        parents[face.index]=face.index
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for face in mesh.polygons:
        for edge in face.edge_keys:
            key=(keys[face.index],tuple(sorted(edge)))
            if key in edges:parents[find(face.index)]=find(edges[key])
            else:edges[key]=face.index
    for face in mesh.polygons:groups.setdefault((keys[face.index],find(face.index)),[]).append(face)
    offset=0
    for ((axis,positive,normal_key),component),faces in sorted(groups.items()):
        axes=[i for i in range(3) if i!=axis]
        points=[mesh.vertices[mesh.loops[i].vertex_index].co for face in faces for i in face.loop_indices]
        low=[min(v[i] for v in points) for i in axes];high=[max(v[i] for v in points) for i in axes]
        spans=[high[i]-low[i] for i in range(2)];expanded=[max(.036,s) for s in spans]
        for face in faces:
            for index in face.loop_indices:
                v=mesh.vertices[mesh.loops[index].vertex_index].co
                uv.data[index].uv=(offset+(v[axes[0]]-low[0])/max(spans[0],1e-9)*expanded[0],
                                   (v[axes[1]]-low[1])/max(spans[1],1e-9)*expanded[1])
        offset+=expanded[0]+.03
