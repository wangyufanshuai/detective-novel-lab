"""V11 original thin documents and restrained, locally authored surface wear."""
import math
import bpy,bmesh
from mathutils import Matrix,Vector
from .blender_room_art_details import remove

GROUP='hero-evidence-table-01'
CENTER=Vector((-.16,.33,0))
ROT=Matrix.Rotation(.07,3,'Z')


def closed_mesh(base,name,vertices,faces,material):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
    obj=base.finish(obj,name,material,0,GROUP);obj['patina_v11']=True
    return obj


def curl(x,y):
    return .009*max(0,(x-.16)/.13)**2*max(0,(-y-.055)/.14)**2


def document_stack(base,surface):
    cover=bpy.data.objects['folio_cover'];tab=bpy.data.objects['folio_tab']
    # Actual 0.8 mm card stock, resting 0.08 mm above the writing leather.
    for obj in (cover,tab):
        bpy.ops.object.select_all(action='DESELECT')
        obj.dimensions.z=.0008;obj.location.z=surface+.00048
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.select_set(False)
    paper_bottom=surface+.00093;thickness=.0003;gap=.00010
    old_top=surface+.0094
    remove(base,[o for o in base.GEOMETRY if o.name.startswith('folio_paper_')])
    variations=[(-.009,.003,-.024),(-.004,-.002,-.007),(.003,.005,.013),(.010,-.005,.026)]
    records=[];nx,ny=20,14
    for index,(dx,dy,angle) in enumerate(variations):
        level=paper_bottom+index*(thickness+gap);amplitude=1+.08*index
        local_rotation=Matrix.Rotation(angle,3,'Z');vertices=[]
        for side in (0,1):
            for j in range(ny+1):
                for i in range(nx+1):
                    p=local_rotation@Vector((-.27+.54*i/nx,-.1625+.325*j/ny,0))+Vector((dx,dy,0))
                    p.z=level+side*thickness+amplitude*curl(p.x,p.y)
                    vertices.append(CENTER+ROT@p)
        count=(nx+1)*(ny+1);faces=[]
        for j in range(ny):
            for i in range(nx):
                k=j*(nx+1)+i;quad=(k,k+1,k+nx+2,k+nx+1)
                # Matching diagonals on both surfaces preserve thickness on
                # a non-planar cell; independent quad tessellation does not.
                for tri in ((quad[0],quad[1],quad[2]),(quad[0],quad[2],quad[3])):
                    faces.extend((tuple(reversed(tri)),tuple(v+count for v in tri)))
        perimeter=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
        for k,a in enumerate(perimeter):
            b=perimeter[(k+1)%len(perimeter)];faces.append((a,b,b+count,a+count))
        material=base.MATERIALS['Cotton Paper'].copy();material.name=f'V11 cotton file leaf {index}'
        # Distinct paper stock, restrained enough to retain the file hierarchy.
        for node in material.node_tree.nodes:
            if node.type=='VALTORGB':
                for e in node.color_ramp.elements:
                    rgba=list(e.color);e.color=(*(v*[.97,1.0,.98,1.015][index] for v in rgba[:3]),1)
        obj=closed_mesh(base,f'folio_paper_{index}',vertices,faces,material)
        obj['document_layer']=index;obj['document_thickness_m']=thickness
        records.append({'object':obj.name,'thicknessMeters':thickness,'baseMeters':level,'offsetMeters':[dx,dy],
                        'rotationRadians':angle,'grid':[nx,ny],'bounds':[list(v) for v in base.bounds([obj])]})
    top_base=paper_bottom+3*(thickness+gap)+thickness
    dx,dy,angle=variations[-1];turn=Matrix.Rotation(angle,3,'Z')
    printed=[]
    for obj in base.GEOMETRY:
        if not obj.name.startswith(('folio_heading','folio_ink_rule','folio_margin')):continue
        inverse=obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            world=obj.matrix_world@vertex.co;p=ROT.transposed()@(world-CENTER)
            position=turn@Vector((p.x,p.y,0))+Vector((dx,dy,0))
            position.z=top_base+1.24*curl(position.x,position.y)+.00003+(world.z-old_top)*.12
            vertex.co=inverse@(CENTER+ROT@position)
        obj.data.update();printed.append(obj.name)
    for obj in base.GEOMETRY:
        if obj.name.startswith(('folio_clip_base','folio_clip_wire')):obj.location.z+=top_base-old_top+.00004
    # The legacy straight rod lost its tilt when an unevaluated world matrix
    # was copied. Model the bent handle explicitly, with two seated ends.
    remove(base,[o for o in base.GEOMETRY if o.name=='folio_clip_wire'])
    centers=[Vector((-.13+.024*math.cos(k*math.pi/16),.153,top_base+.0087+.012*math.sin(k*math.pi/16))) for k in range(17)]
    vertices=[];sides=10;radius=.0014
    for i,p in enumerate(centers):
        tangent=(centers[min(i+1,16)]-centers[max(0,i-1)]).normalized()
        u=Vector((0,1,0));v=tangent.cross(u).normalized()
        for k in range(sides):vertices.append(CENTER+ROT@(p+radius*(u*math.cos(k*2*math.pi/sides)+v*math.sin(k*2*math.pi/sides))))
    faces=[tuple(reversed(range(sides))),tuple(range(16*sides,17*sides))]
    for row in range(16):
        for k in range(sides):faces.append((row*sides+k,row*sides+(k+1)%sides,(row+1)*sides+(k+1)%sides,(row+1)*sides+k))
    handle=closed_mesh(base,'folio_clip_wire',vertices,faces,base.MATERIALS['Brushed Antique Brass'])
    handle['patina_wire_hoop']=True
    for face in handle.data.polygons:face.use_smooth=len(face.vertices)==4
    return {'leaves':records,'printedObjects':printed,'cardThicknessMeters':.0008,
            'paperThicknessMeters':thickness,'interleafGapMeters':gap,'decorativePrintIsWorldEvidence':False,
            'clipHandle':{'object':handle.name,'ends':[list(CENTER+ROT@p) for p in (centers[0],centers[-1])],'radiusMeters':radius,'staticDecorativeOnly':True}}


def op(tree,kind,*args):
    n=tree.nodes.new('ShaderNodeMath');n.operation=kind
    for i,value in enumerate(args):
        if isinstance(value,(float,int)):n.inputs[i].default_value=value
        else:tree.links.new(value,n.inputs[i])
    return n.outputs[0]


def color_scale(tree,source,factor):
    n=tree.nodes.new('ShaderNodeVectorMath');n.operation='SCALE'
    tree.links.new(source,n.inputs[0]);tree.links.new(factor,n.inputs['Scale']);return n.outputs[0]


def age_wood(base):
    records=[]
    for i in range(5):
        obj=bpy.data.objects[f'furniture_top_board_{i}'];mat=obj.data.materials[0].copy();mat.name=f'V11 contact-worn walnut board {i}'
        tree=mat.node_tree;bsdf=tree.nodes.get('Principled BSDF')
        color=bsdf.inputs['Base Color'].links[0].from_socket;rough=bsdf.inputs['Roughness'].links[0].from_socket
        coord=tree.nodes.new('ShaderNodeTexCoord');xyz=tree.nodes.new('ShaderNodeSeparateXYZ');tree.links.new(coord.outputs['Generated'],xyz.inputs[0])
        top=op(tree,'MAXIMUM',0,op(tree,'SUBTRACT',op(tree,'MULTIPLY',xyz.outputs['Z'],12),11))
        edge=op(tree,'MAXIMUM',0,op(tree,'SUBTRACT',1,op(tree,'MULTIPLY',xyz.outputs['Y'],3.2))) if i==0 else 0
        n=tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=4;n.inputs['Detail'].default_value=2
        tree.links.new(coord.outputs['Object'],n.inputs['Vector'])
        mask=op(tree,'MULTIPLY',top,op(tree,'MULTIPLY',op(tree,'ADD',.25,op(tree,'MULTIPLY',n.outputs['Fac'],.75)),edge))
        tree.links.new(color_scale(tree,color,op(tree,'ADD',1,op(tree,'MULTIPLY',mask,.18))),bsdf.inputs['Base Color'])
        tree.links.new(op(tree,'MAXIMUM',.22,op(tree,'SUBTRACT',rough,op(tree,'MULTIPLY',mask,.14))),bsdf.inputs['Roughness'])
        obj.data.materials[0]=mat;records.append({'object':obj.name,'material':mat.name,'wearAtHandContactEdge':i==0})
    return records


def age_brass(base):
    records=[]
    for obj in [o for o in base.GEOMETRY if o.name.startswith(('furniture_cast_bail_','furniture_handle_rosette_','furniture_handle_pin_'))]:
        mat=obj.data.materials[0].copy();mat.name='V11 handled brass '+obj.name
        tree=mat.node_tree;bsdf=tree.nodes.get('Principled BSDF');source=bsdf.inputs['Base Color'].links[0].from_socket
        coord=tree.nodes.new('ShaderNodeTexCoord');noise=tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=6
        noise.inputs['Detail'].default_value=2;tree.links.new(coord.outputs['Generated'],noise.inputs['Vector'])
        mix=tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX'
        tree.links.new(op(tree,'MULTIPLY',noise.outputs['Fac'],.32 if 'rosette' in obj.name else .13),mix.inputs[0])
        tree.links.new(source,mix.inputs[1]);mix.inputs[2].default_value=(*base.srgb('514b32'),1)
        tree.links.new(mix.outputs[0],bsdf.inputs['Base Color'])
        tree.links.new(op(tree,'ADD',.30 if 'bail' in obj.name else .43,op(tree,'MULTIPLY',noise.outputs['Fac'],.16)),bsdf.inputs['Roughness'])
        bsdf.inputs['Metallic'].default_value=.96
        obj.data.materials[0]=mat;records.append({'object':obj.name,'material':mat.name})
    return records


def edge_nicks(base):
    obj=bpy.data.objects['furniture_top_board_0'];deps=bpy.context.evaluated_depsgraph_get()
    mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(deps));obj.modifiers.clear();obj.data=mesh
    def volume():
        bm=bmesh.new();bm.from_mesh(obj.data);value=bm.calc_volume(signed=True);bm.free();return value
    before=volume();records=[]
    for x,sx in [(-.94,.010),(.18,.0065),(.83,.008)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(x,-.138,.961))
        cutter=bpy.context.object;cutter.scale=(sx,.005,.003)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        boolean=obj.modifiers.new('Small original edge nick','BOOLEAN');boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=cutter
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=boolean.name)
        bpy.data.objects.remove(cutter,do_unlink=True);records.append({'xMeters':x,'widthMeters':sx*2})
    obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    return {'object':obj.name,'cuts':records,'volumeBefore':before,'volumeAfter':volume(),'decorativeDamageOnly':True}


def refine(base,cameras):
    surface=base.bounds([bpy.data.objects['hero-evidence-table-01__tray-felt']])[1][2]
    paper=document_stack(base,surface);wood=age_wood(base);brass=age_brass(base);nicks=edge_nicks(base)
    camera={'location':[-.04,-.31,1.33],'target':[-.14,.31,.970],'verticalFovDegrees':46}
    cameras['paper-detail']=base.camera('Paper thickness and curl',camera['location'],camera['target'],camera['verticalFovDegrees'])
    return {'schema':'game-room.patina-authoring.v1','source':'original local Blender geometry and procedural materials',
            'documents':paper,'wood':wood,'brass':brass,'edgeNicks':nicks,'paperCamera':camera,
            'humanApproval':False,'runtimeInteractionVerified':False,'externalDownloads':False}
