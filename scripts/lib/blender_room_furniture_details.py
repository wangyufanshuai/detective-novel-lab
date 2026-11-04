"""V10 original archive worktable, with measured board and leather thicknesses."""
import math
import bpy
import bmesh
from mathutils import Vector
from .blender_room_art_details import remove

GROUP='hero-evidence-table-01'


def authored(base,obj,weight=1.5):
    obj['craft_chart']=True
    obj['authored_metric_uv']=True
    obj['atlas_texel_weight']=weight
    obj['furniture_v10']=True
    return obj


def mesh_object(base,name,vertices,faces,material,bevel=0,weight=1.5):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
    return authored(base,base.finish(obj,name,material,bevel,GROUP),weight)


def block(base,name,size,position,material,bevel=.0015,weight=1.5):
    return authored(base,base.box('furniture_'+name,size,position,material,min(bevel,min(size)*.16),GROUP),weight)


def walnut(base,name,axis,tone=1):
    mat=base.material(name,'684930',.53)
    tree=mat.node_tree;nodes=tree.nodes;links=tree.links;bsdf=nodes.get('Principled BSDF')
    coord=nodes.new('ShaderNodeTexCoord');scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY'
    axes=[34,34,34];axes[axis]=.9;scale.inputs[1].default_value=axes
    links.new(coord.outputs['Object'],scale.inputs[0])
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.4;noise.inputs['Detail'].default_value=4
    noise.inputs['Roughness'].default_value=.68;links.new(scale.outputs[0],noise.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB');rgb=base.srgb('684930')
    for element,pos,factor in [(ramp.color_ramp.elements[0],.2,.61),(ramp.color_ramp.elements[1],.82,1.15)]:
        element.position=pos;element.color=(*[v*factor*tone for v in rgb],1)
    mid=ramp.color_ramp.elements.new(.53);mid.color=(*[v*.91*tone for v in rgb],1)
    links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],bsdf.inputs['Base Color'])
    rough=nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.39;rough.inputs['To Max'].default_value=.62
    links.new(noise.outputs['Fac'],rough.inputs['Value']);links.new(rough.outputs[0],bsdf.inputs['Roughness'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.20;bump.inputs['Distance'].default_value=.00028
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bsdf.inputs['Normal'])
    return mat


def leather(base):
    mat=base.material('V10 vegetable-tanned writing leather','275448',.76)
    tree=mat.node_tree;nodes=tree.nodes;links=tree.links;bsdf=nodes.get('Principled BSDF')
    coord=nodes.new('ShaderNodeTexCoord');noise=nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=280;noise.inputs['Detail'].default_value=2
    links.new(coord.outputs['Object'],noise.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB');rgb=base.srgb('275448')
    ramp.color_ramp.elements[0].color=(*[v*.83 for v in rgb],1)
    ramp.color_ramp.elements[1].color=(*[v*1.08 for v in rgb],1)
    links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],bsdf.inputs['Base Color'])
    rough=nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.69;rough.inputs['To Max'].default_value=.84
    links.new(noise.outputs['Fac'],rough.inputs['Value']);links.new(rough.outputs[0],bsdf.inputs['Roughness'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.00013
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bsdf.inputs['Normal'])
    return mat


def rounded_points(hx,hy,radius,steps=6):
    points=[]
    for cx,cy,start in [(hx-radius,hy-radius,0),(-hx+radius,hy-radius,90),(-hx+radius,-hy+radius,180),(hx-radius,-hy+radius,270)]:
        for step in range(steps+1):
            angle=math.radians(start+step*90/steps)
            points.append((cx+radius*math.cos(angle),cy+radius*math.sin(angle)))
    return points


def leather_pad(base,surface,material):
    points=rounded_points(1.01,.32,.021)
    count=len(points);vertices=[(x,y+.50,z) for z in [surface-.003,surface] for x,y in points]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces.extend((i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count))
    return mesh_object(base,'hero-evidence-table-01__tray-felt',vertices,faces,material,0,2.2)


def rectangular_profile(base,name,hx,hy,center_z,profile,material):
    vertices=[]
    for outward,z in profile:
        vertices.extend([(x*(hx+outward),.45+y*(hy+outward),center_z+z) for x,y in [(1,1),(-1,1),(-1,-1),(1,-1)]])
    faces=[];levels=len(profile)
    for level in range(levels):
        for side in range(4):faces.append((level*4+side,level*4+(side+1)%4,((level+1)%levels)*4+(side+1)%4,((level+1)%levels)*4+side))
    return mesh_object(base,'furniture_'+name,vertices,faces,material,0,2)


def tapered_leg(base,x,y,material):
    levels=[(.014,.070),(.052,.074),(.55,.084),(.67,.090),(.9125,.090)]
    vertices=[]
    for z,h in levels:
        c=.009
        vertices.extend([(x+a,y+b,z) for a,b in [(h-c,h),(-h+c,h),(-h,h-c),(-h,-h+c),(-h+c,-h),(h-c,-h),(h,-h+c),(h,h-c)]])
    faces=[tuple(reversed(range(8))),tuple(range((len(levels)-1)*8,len(levels)*8))]
    for level in range(len(levels)-1):
        for side in range(8):faces.append((level*8+side,level*8+(side+1)%8,(level+1)*8+(side+1)%8,(level+1)*8+side))
    return mesh_object(base,f'furniture_tapered_leg_{x}_{y}',vertices,faces,material,.001,2)


def pipe(base,name,points,radius,material):
    vertices=[];sides=10
    for index,p in enumerate(points):
        tangent=(Vector(points[min(index+1,len(points)-1)])-Vector(points[max(index-1,0)])).normalized()
        u=Vector((0,1,0));v=tangent.cross(u).normalized()
        vertices.extend(Vector(p)+radius*(u*math.cos(k*2*math.pi/sides)+v*math.sin(k*2*math.pi/sides)) for k in range(sides))
    faces=[tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))]
    for i in range(len(points)-1):
        for k in range(sides):faces.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
    obj=mesh_object(base,'furniture_'+name,vertices,faces,material,0,5)
    for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4
    return obj


def hardware(base,cx,front,z,brass,shadow,index):
    for side in (-1,1):
        px=cx+side*.056
        plate=base.cylinder(f'furniture_handle_rosette_{index}_{side}',.018,.003,(px,front-.002,z),brass,GROUP,24)
        plate.rotation_euler.x=math.pi/2
        for modifier in plate.modifiers:
            if modifier.type=='BEVEL':modifier.width=.00045
        authored(base,plate,5)
        post=base.rod(f'furniture_handle_pin_{index}_{side}',(px,front-.003,z),(px,front-.033,z),.006,brass,GROUP)
        for modifier in post.modifiers:
            if modifier.type=='BEVEL':modifier.width=.0007
        authored(base,post,5)
        # A separate inset screw seat and a narrow machined slot are modeled
        # only as visible hardware relief; no mechanical fastening is claimed.
        block(base,f'screw_slot_{index}_{side}',(.010,.0005,.0014),(px,front-.034,z),shadow,.0001,7)
    points=[(cx+.056*math.cos(k*math.pi/16),front-.034,z-.040*math.sin(k*math.pi/16)) for k in range(17)]
    pipe(base,f'cast_bail_{index}',points,.0042,brass)


def refine(base,cameras):
    original=next(o for o in base.GROUPS[GROUP] if 'tray-felt' in o.name)
    surface=base.bounds([original])[1][2]
    removed=[o for o in base.GROUPS[GROUP] if o.name.startswith('hero-evidence-table-01__')]
    previous=[o.name for o in removed];remove(base,removed)
    start=len(base.GEOMETRY)
    xwood=[walnut(base,f'V10 Walnut board {i}',0,tone) for i,tone in enumerate([.90,1.00,.96,1.08,.93])]
    ywood=walnut(base,'V10 Walnut along side rails',1,.92)
    zwood=walnut(base,'V10 Walnut vertical posts',2,.91)
    maple=walnut(base,'V10 Drawer pale interior',1,1.65)
    brass=base.MATERIALS['Brushed Antique Brass'];dark=base.MATERIALS['Dark Brass']
    shadow=base.material('V10 Joinery recess','302719',.9)
    writing=leather(base)
    planks=[]
    for i,material in enumerate(xwood):
        plank=block(base,f'top_board_{i}',(2.72,.2334,.048),(0,-.0188+i*.2342,.9365),material,.0015,2.2)
        planks.append(plank)
    profile=[(0,.026),(.007,.026),(.016,.020),(.020,.010),(.014,0),(.008,-.004),(.008,-.018),(0,-.026),(-.035,-.026),(-.035,.026)]
    moulding=rectangular_profile(base,'mitered_ogee_edge',1.38,.63,.9345,profile,xwood[1])
    # Assign rail direction per side rather than stretching horizontal grain
    # around the entire rectangular frame.
    moulding.data.materials.append(ywood)
    for face in moulding.data.polygons:
        if abs(face.center.x)>1.30 and abs(face.center.y-.45)<.60:face.material_index=1
    rectangular_profile(base,'under_top_bead',1.337,.587,.9095,[(0,.004),(.008,.003),(.010,0),(.006,-.004),(-.006,-.004),(-.006,.004)],xwood[0])
    pad=leather_pad(base,surface,writing)
    # Thin edge tooling follows the leather, not a second thick green slab.
    border_mat=base.material('V10 Leather blind tooling','1c4036',.8)
    for inset in (.012,.016):
        outer=rounded_points(1.01-inset,.32-inset,.013)
        inner=rounded_points(1.01-inset-.00045,.32-inset-.00045,.01255)
        n=len(outer);vertices=[(x,y+.5,z) for points,z in [(outer,surface+.00002),(outer,surface+.00020),(inner,surface+.00020),(inner,surface+.00002)] for x,y in points]
        faces=[]
        for ring in range(4):
            for i in range(n):faces.append((ring*n+i,ring*n+(i+1)%n,((ring+1)%4)*n+(i+1)%n,((ring+1)%4)*n+i))
        mesh_object(base,'furniture_leather_tooling_'+str(inset),vertices,faces,border_mat,0,5)
    legs=[]
    for x in (-1.16,1.16):
        for y in (-.01,.91):
            leg=tapered_leg(base,x,y,zwood);legs.append(leg)
            block(base,f'foot_sole_{x}_{y}',(.164,.164,.014),(x,y,.007),dark,.003,2)
            # Small brass cuff strips leave the wooden leg visibly continuous.
            for side in (-1,1):
                block(base,f'foot_cuff_x_{x}_{y}_{side}',(.006,.154,.035),(x+side*.076,y,.0245),brass,.0008,3)
                block(base,f'foot_cuff_y_{x}_{y}_{side}',(.146,.006,.035),(x,y+side*.076,.0245),brass,.0008,3)
        block(base,f'side_apron_{x}',(.040,.78,.214),(x,.45,.8005),ywood,.003,2)
        block(base,f'side_stretcher_{x}',(.050,.77,.070),(x,.45,.267),ywood,.003,2)
    block(base,'rear_apron',(2.15,.042,.214),(0,.91,.8005),xwood[1],.003,2)
    block(base,'rear_stretcher',(2.15,.065,.070),(0,.91,.267),xwood[0],.003,2)
    for z in (.6875,.8995):block(base,'front_carcass_rail',(2.31,.047,.026),(0,-.064,z),xwood[1],.002,2)
    for x in (-.594,.594):block(base,'front_carcass_stile',(.028,.047,.186),(x,-.064,.794),zwood,.002,2)
    drawers=[]
    for index,(cx,width,opening) in enumerate([(-.88,.526,0),(0,1.127,.14),(.88,.526,0)]):
        front=-.150-opening;z=.7955;height=.183
        face=block(base,f'drawer_face_{index}',(width,.026,height),(cx,front+.013,z),xwood[index],.0025,2.4)
        # Raised perimeter around a recessed central field, with an actual gap
        # to the neighboring carcass. A false front hides the box end grain.
        for sign in (-1,1):
            block(base,f'drawer_rail_{index}_{sign}',(width-.010,.007,.017),(cx,front-.002,z+sign*.079),xwood[index],.001,3)
            block(base,f'drawer_stile_{index}_{sign}',(.017,.007,height-.039),(cx+sign*(width/2-.0135),front-.002,z),zwood,.001,3)
        box_front=front+.029;box_back=box_front+.50
        floor=block(base,f'drawer_bottom_{index}',(width-.047,.50,.008),(cx,(box_front+box_back)/2,.7195),maple,.001,1.5)
        members=[face,floor]
        for sign in (-1,1):
            side=block(base,f'drawer_box_side_{index}_{sign}',(.015,.50,.161),(cx+sign*(width/2-.028),floor.location.y,.800),maple,.001,2)
            members.append(side)
            # Fixed runners remain on the carcass while the center box is open.
            block(base,f'drawer_runner_{index}_{sign}',(.022,.50,.016),(cx+sign*(width/2-.026),.25,.7075),xwood[0],.001,1.5)
            for yy in (box_front+.025,box_back-.025):
                block(base,f'drawer_corner_block_{index}_{sign}',(.024,.024,.142),(cx+sign*(width/2-.050),yy,.797),maple,.001,1.5)
        for yy in (box_front+.0075,box_back-.0075):
            members.append(block(base,f'drawer_box_cross_{index}',(width-.067,.015,.161),(cx,yy,.800),maple,.001,2))
        handle_positions=[cx] if index!=1 else [-.27,.27]
        for h,xx in enumerate(handle_positions):hardware(base,xx,front-.006,z+.017,brass,shadow,f'{index}_{h}')
        drawers.append({'index':index,'openingMeters':opening,'front':face.name,'floor':floor.name,
                        'boxMembers':[o.name for o in members],'contentRole':'decorative empty drawer; no case state or interaction'})
    cameras['joinery-detail']=base.camera('joinery-detail',(1.36,-1.16,1.34),(.22,-.055,.795),48)
    bpy.context.view_layer.update()
    records=[]
    for obj in base.GEOMETRY[start:]:
        low,high=base.bounds([obj]);records.append({'object':obj.name,'min':low,'max':high,'material':[m.name for m in obj.data.materials]})
    low,high=base.bounds([pad])
    return {'schema':'game-room.furniture-authoring.v1','source':'original local Blender modeling','humanApproval':False,
        'removedLegacyObjects':previous,'objects':records,'drawers':drawers,'tableBoards':[o.name for o in planks],
        'legs':[o.name for o in legs],'leather':{'object':pad.name,'thicknessMeters':high[2]-low[2],'topMeters':high[2]},
        'topBoardThicknessMeters':.048,'openDrawerIsInteractive':False,
        'joineryCamera':{'location':list(cameras['joinery-detail'].location),'target':[.22,-.055,.795],'verticalFovDegrees':48},
        'scope':'Authored visible construction and material proportions; not a load-bearing engineering certification.'}
