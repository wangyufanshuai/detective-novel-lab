"""Archive identity, controlled wear and lighting refinements for v5."""
import math
import bpy
from .blender_room_art_details import type_mesh


def refine(base):
    mat=base.MATERIALS
    # Pointiness adds modest wear to existing bevels, without scattering props.
    for material in list(bpy.data.materials):
        if 'Grain' not in material.name:
            continue
        tree=material.node_tree
        bsdf=tree.nodes.get('Principled BSDF')
        original=bsdf.inputs['Base Color'].links[0].from_socket
        geometry=tree.nodes.new('ShaderNodeNewGeometry')
        amount=tree.nodes.new('ShaderNodeMapRange')
        amount.inputs['From Min'].default_value=.49
        amount.inputs['From Max'].default_value=.61
        amount.inputs['To Min'].default_value=0
        amount.inputs['To Max'].default_value=.14
        tree.links.new(geometry.outputs['Pointiness'],amount.inputs['Value'])
        mix=tree.nodes.new('ShaderNodeMixRGB'); mix.blend_type='SCREEN'
        mix.inputs[2].default_value=(*base.srgb('806443'),1)
        tree.links.new(amount.outputs['Result'],mix.inputs[0]); tree.links.new(original,mix.inputs[1])
        tree.links.new(mix.outputs[0],bsdf.inputs['Base Color'])
        for node in tree.nodes:
            if node.type=='MAP_RANGE' and node!=amount:
                node.inputs['To Min'].default_value=.46
                node.inputs['To Max'].default_value=.73
    felt=base.material('Archive Felt v5','24584f',.92,texture='felt')
    for obj in base.GEOMETRY:
        if 'tray-felt' in obj.name:
            obj.data.materials[0]=felt
    base.material('Plan Ink','b3ac8c',.96)
    base.material('Plan Board','29474b',.91)
    base.material('Tag Stock','ae9c70',.86)
    attached=[]

    def wall_box(name,dimensions,location,material,bevel=.003):
        obj=base.box(name,dimensions,location,material,bevel)
        obj['review_group']='architecture'
        obj['decorative_only']=True
        return obj

    # These are original decorative archive patterns, never case evidence.
    for x,title in [(-3.35,'PORT / ARCHIVE'),(3.35,'INDEX / RETURN')]:
        start=len(base.GEOMETRY)
        width=1.90; height=1.08; z=2.08
        backing=wall_box('arrival_panel_back',(width,.04,height),(x,-3.782,z),mat['Walnut Grain 0'])
        wall_box('arrival_panel_field',(width-.09,.009,height-.09),(x,-3.756,z),mat['Plan Board'])
        for sign in (-1,1):
            wall_box('arrival_panel_stile',(.045,.03,height),(x+sign*(width/2-.023),-3.747,z),mat['Walnut Edge Grain 2'])
            wall_box('arrival_panel_rail',(width,.03,.045),(x,-3.747,z+sign*(height/2-.023)),mat['Walnut Edge Grain 0'])
        type_mesh(base,'arrival_panel_title',title,(x,-3.729,z+.34),.085,mat['Brushed Antique Brass'],None,(math.pi/2,0,math.pi))
        if x<0:
            # A quiet diagram of quay geometry; no source-backed names or events.
            for k in range(5):
                px=x-.61+k*.30
                wall_box('quay_diagram_pier',(.003,.001,.38),(px,-3.749,z-.05),mat['Plan Ink'],0)
                wall_box('quay_diagram_cap',(.17,.001,.003),(px+.083,-3.749,z+.14),mat['Plan Ink'],0)
            wall_box('quay_diagram_baseline',(1.5,.001,.004),(x,-3.749,z-.24),mat['Plan Ink'],0)
            for k in range(3):
                wall_box('quay_water_line',(1.4,.001,.0015),(x,-3.749,z-.32-k*.035),mat['Plan Ink'],0)
        else:
            for row in range(3):
                zz=z+.10-row*.19
                wall_box('register_row',(1.50,.001,.002),(x,-3.749,zz),mat['Plan Ink'],0)
                for column in range(3):
                    wall_box('register_tab',(.31,.003,.083),(x-.51+column*.51,-3.746,zz+.055),mat['Tag Stock'],.001)
        attached.append({'feature':title,'backObject':backing.name,'wall':'SHELL_wall-south','supportY':-3.8,
                         'members':[o.name for o in base.GEOMETRY[start:]],'contentRole':'decorative archive wayfinding; not evidence'})
    # An archive emblem above the open passage, with actual relief and rim.
    start=len(base.GEOMETRY)
    emblem=base.cylinder('arrival_archive_seal',.265,.055,(0,-3.776,3.12),mat['Dark Brass'],None,64)
    emblem.rotation_euler=(math.pi/2,0,0)
    face=base.cylinder('arrival_archive_seal_face',.242,.009,(0,-3.742,3.12),mat['Plan Board'],None,64)
    face.rotation_euler=(math.pi/2,0,0)
    for angle in (0,math.pi/4,math.pi/2,3*math.pi/4):
        length=.31 if angle in (0,math.pi/2) else .23
        bar=wall_box('arrival_compass_bar',(.007,.006,length),(0,-3.733,3.12),mat['Brushed Antique Brass'],.001)
        bar.rotation_euler.y=angle
    attached.append({'feature':'archive emblem','backObject':emblem.name,'wall':'SHELL_wall-south','supportY':-3.8,
                     'members':[o.name for o in base.GEOMETRY[start:]],'contentRole':'decorative emblem; no clock or time semantics'})
    for obj in base.GEOMETRY[start:]:obj['decorative_only']=True
    for side,title in [(-1,'REGISTER A'),(1,'REGISTER B')]:
        group='rear_archive_'+str(side)
        base.box('archive_class_plate',(.57,.008,.09),(side*3.5,3.184,2.372),mat['Dark Brass'],.003,group)
        type_mesh(base,'archive_class_title',title,(side*3.5,3.177,2.372),.047,mat['Brushed Antique Brass'],group,(math.pi/2,0,0))
    power={'courtyard_key':750,'arrival_bounce':75,'archive-lamp-left_light':135,'archive-lamp-right_light':105,
           'ceiling_light_-1.7':115,'ceiling_light_1.7':145}
    for fixture in base.LIGHTS:
        if fixture['id'] in power:
            fixture['powerWatts']=power[fixture['id']]
            bpy.data.objects[fixture['id']].data.energy=fixture['powerWatts']
    bpy.context.view_layer.update()
    contacts=[]
    for item in attached:
        low,high=base.bounds([bpy.data.objects[item['backObject']]])
        gap=low[1]-item['supportY']
        contacts.append({**item,'supportGapMeters':round(gap,6),'passed':-.005<=gap<=.005})
    return {'schema':'game-room.v5-dressing.v1','wallAttachments':contacts,'passed':all(c['passed'] for c in contacts),
            'symmetry':'bilateral panel masses; intentionally different decorative contents','externalAssets':False,'humanApproval':False}
