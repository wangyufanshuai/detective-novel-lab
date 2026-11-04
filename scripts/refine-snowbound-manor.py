"""Non-destructive second art candidate: volumetric hearth and modeled charcoal.

The original v1 source and browser assets remain intact. No fluid simulation,
external asset generation, or paid service is required for this authored field.
"""
from pathlib import Path
import bpy, math, json, hashlib, importlib.util, argparse, sys, random
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/snowbound-manor-v1';P=ROOT/'docs/3d-town/snowbound-manor-v2'
SOURCE=P/'snowbound-manor.blend'
GENERATOR_SHA=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,data):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
spec=importlib.util.spec_from_file_location('manor_helpers',ROOT/'scripts/build-snowbound-manor.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base);u=base.u

def volume_material():
    m=bpy.data.materials.new('hearth_curling_volume');m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
    output=n.new('ShaderNodeOutputMaterial');volume=n.new('ShaderNodeVolumePrincipled')
    tex=n.new('ShaderNodeTexCoord');split=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['Generated'],split.inputs[0])
    def math_node(operation,a,b=0):
        node=n.new('ShaderNodeMath');node.operation=operation
        for i,value in enumerate((a,b)):
            if isinstance(value,(float,int)):node.inputs[i].default_value=value
            else:l.new(value,node.inputs[i])
        return node.outputs[0]
    x,y,z=(split.outputs[k] for k in ['X','Y','Z'])
    recipe=read(P/'textures/fire-field.json')
    atlas=bpy.data.images.load(str(P/'textures/hearth-density.png'));atlas.colorspace_settings.name='Non-Color'
    slice_z=math_node('MULTIPLY',z,63);lower=math_node('FLOOR',slice_z)
    def sample(index):
        tx=math_node('MODULO',index,8);ty=math_node('FLOOR',math_node('DIVIDE',index,8))
        ux=math_node('DIVIDE',math_node('ADD',tx,math_node('DIVIDE',math_node('ADD',math_node('MULTIPLY',x,127),.5),128)),8)
        uy=math_node('DIVIDE',math_node('ADD',ty,math_node('DIVIDE',math_node('ADD',math_node('MULTIPLY',y,63),.5),64)),8)
        coord=n.new('ShaderNodeCombineXYZ');l.new(ux,coord.inputs[0]);l.new(uy,coord.inputs[1])
        img=n.new('ShaderNodeTexImage');img.image=atlas;img.interpolation='Linear';img.extension='EXTEND';l.new(coord.outputs[0],img.inputs['Vector'])
        return img.outputs['Color']
    lo=sample(lower);hi=sample(math_node('MINIMUM',math_node('ADD',lower,1),63));fraction=math_node('SUBTRACT',slice_z,lower)
    heat=math_node('ADD',math_node('MULTIPLY',lo,math_node('SUBTRACT',1,fraction)),math_node('MULTIPLY',hi,fraction))
    temperature=math_node('ADD',recipe['temperature'][0],math_node('MULTIPLY',math_node('POWER',heat,.55),recipe['temperature'][1]))
    blackbody=n.new('ShaderNodeBlackbody');l.new(temperature,blackbody.inputs[0])
    l.new(math_node('MULTIPLY',heat,recipe['densityMultiplier']),volume.inputs['Density'])
    volume.inputs['Color'].default_value=(.18,.12,.06,1)
    l.new(blackbody.outputs[0],volume.inputs['Emission Color']);l.new(math_node('MULTIPLY',heat,recipe['emissionMultiplier']),volume.inputs['Emission Strength'])
    l.new(volume.outputs['Volume'],output.inputs['Volume'])
    m['description']='Original voxel density shared with WebGL; seven thin broken plumes, non-simulated art effect.'
    return m

def material_copy(name,original,tint,roughness=.9):
    m=bpy.data.materials[original].copy();m.name=name
    nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
    for link in list(p.inputs['Roughness'].links):links.remove(link)
    p.inputs['Roughness'].default_value=roughness
    for node in nodes:
        if node.type=='MIX' and node.blend_type=='MULTIPLY':node.inputs[7].default_value=(*tint,1)
    u.MATS[name]=m;return m

def irregular_log(name,a,b,radius,material,seed):
    rng=random.Random(seed);a,b=Vector(a),Vector(b);axis=(b-a).normalized()
    side=axis.cross(Vector((0,0,1))).normalized();up=axis.cross(side).normalized();verts=[]
    rings,sides=7,24
    for j in range(rings):
        t=j/(rings-1);center=a.lerp(b,t)
        for i in range(sides):
            angle=i*math.tau/sides;r=radius*(1-.14*t)*(1+.075*math.sin(i*3.2)+rng.uniform(-.035,.035))
            v=center+(side*math.cos(angle)+up*math.sin(angle))*r
            if j in (0,rings-1):v+=axis*rng.uniform(-.014,.014)
            verts.append(tuple(v))
    faces=[tuple(reversed(range(sides))),tuple((rings-1)*sides+i for i in range(sides))]
    faces += [(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(rings-1) for i in range(sides)]
    obj=u.mesh(name,verts,faces,material,True);obj['support']='firebox bed / crossed lower logs'
    return obj

def build():
    original=BASE/'snowbound-manor.blend';identity=sha(original)
    assert read(BASE/'authoring-receipt.json')['source']['sha256']==identity
    bpy.ops.wm.open_mainfile(filepath=str(original));u.MATS.update({m.name:m for m in bpy.data.materials});u.LAY='interior'
    removed=[]
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('fire_sheet','burning_log','embers')):
            removed.append(obj.name);bpy.data.objects.remove(obj,do_unlink=True)
    material_copy('charred_oak','wood',(.035,.027,.018),.94)
    u.material('ash_grey','48433a',.97);u.material('ember_crust','301b10',.94)
    for mat_name,color,power in [('ember_fissure',(1,.13,.005,1),2.4),('ember_dull',(1,.05,.002,1),.65)]:
        m=u.material(mat_name,'391c0e',.9);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=color;p.inputs['Emission Strength'].default_value=power
    rng=random.Random(1932)
    for i in range(56):
        x=rng.uniform(-.72,.72);y=rng.uniform(9.96,10.42);z=.346+rng.uniform(0,.018)
        obj=u.sphere('charcoal_fragment_'+str(i),(x,y,z),(rng.uniform(.022,.065),rng.uniform(.025,.055),rng.uniform(.012,.028)),'ember_crust' if i%5 else 'ash_grey',12)
        if i%3==0:
            base.pipe('ember_fissure_'+str(i),[(x-.021,y-.01,z+.016),(x,y+.005,z+.022),(x+.019,y+.016,z+.018)],.0018,'ember_fissure' if i%2 else 'ember_dull')
    logs=[((-.73,9.99,.43),(.14,10.35,.42),.082),((.13,9.99,.43),(.75,10.35,.42),.073),
          ((-.47,10.35,.54),(.48,10.04,.55),.073),((-.61,10.10,.54),(-.24,10.39,.59),.062)]
    for i,(a,b,r) in enumerate(logs):irregular_log('charred_log_'+str(i),a,b,r,'charred_oak',i+1932)
    firemat=volume_material();u.MATS[firemat.name]=firemat
    u.LAY='fire_volume';volume=u.box('hearth_volume',(0,10.17,.83),(1.62,.62,.92),firemat.name,0)
    volume['runtimeEffect']='volumetric-hearth-candidate';volume['support']='firebox';volume['nonColliding']=True
    u.LAY='interior'
    # A thin ash accumulation follows the actual hearth, not a floating overlay.
    for i in range(20):
        x=rng.uniform(-.83,.83);y=rng.uniform(9.91,10.48)
        u.sphere('hearth_ash_'+str(i),(x,y,.342),(.02+rng.random()*.035,.025+rng.random()*.04,.005),'ash_grey',12)
    for name,energy in [('hearth_fire',70),('firebox_bounce',48)]:bpy.data.objects[name].data.energy=energy
    # Evaluated support rays found a 25.5 mm ceiling-rose inset in v1.
    # Seat the two chain tops 3 mm into their mounting roses instead.
    for obj in bpy.data.objects:
        if str(obj.get('instance','')).startswith('chandelier'):obj.location.z-=.0225
    for name in ['chandelier3.25','chandelier7.1']:bpy.data.objects[name].location.z-=.0225
    bpy.context.view_layer.update()
    # The already-reviewed camera corrections become part of this native source.
    for name,position,target,lens in [
        ('corner-ne',(5.55,8.65,1.85),(0,4.5,1.8),10.3923),
        ('corner-nw',(-5.55,8.65,1.85),(0,4.5,1.8),10.3923),
        ('ceiling-up',(0,5,1.4),(0,5,4.25),5.2),
        ('ceiling-oblique-a',(-3.9,2.4,1.4),(2.1,7.5,3.95),15),
        ('fire-study',(0,7.5,1.12),(0,10.14,.84),40)]:
        if name in bpy.data.objects:cam=bpy.data.objects[name];cam.location=position;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
        else:u.camera(name,position,target,lens=lens)
    for name,position,target in [('manor-gate',(-11,-25,2),(0,2,4.1)),('snowbound-arrival',(15,-24,2.1),(0,3,4.2))]:
        u.camera(name,position,target,lens=36)
    scene=bpy.context.scene;scene['sample']='Cedar Hollow second art candidate; no human acceptance'
    scene.cycles.use_denoising=True;scene.cycles.max_bounces=8;scene.cycles.volume_bounces=1;scene.cycles.volume_step_rate=.5
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.file.pack_all();P.mkdir(parents=True,exist_ok=True)
    assert sha(Path(__file__))==GENERATOR_SHA
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    assert sha(original)==identity
    for file in ['openings.json','scene-contract.json','placements.json']:
        data=read(BASE/file)
        if 'sourceSha256' in data:data['sourceSha256']=sha(SOURCE)
        if file=='placements.json':
            for item in data['instances']:
                if item['id'].startswith('chandelier'):
                    item['position'][2]-=.0225
                    for corner in item['evaluatedBounds']:corner[2]-=.0225
                    item['attachment']='chain top inset 3 mm into ceiling rose'
        write(P/file,data)
    lighting=read(BASE/'lighting.json')
    for item in lighting['fixtures']:
        if item['id'] in ['hearth_fire','firebox_bounce']:item['sourceWatts']=bpy.data.objects[item['id']].data.energy
        if item['id'].startswith('chandelier'):item['position'][2]-=.0225
    lighting['additionalEmission']={'id':'hearth_volume','type':'authored-voxel-volume','field':read(P/'textures/fire-field.json'),'generatorSha256':GENERATOR_SHA}
    write(P/'lighting.json',lighting)
    write(P/'authoring-receipt.json',{'schema':'snowbound-authoring.v2','source':{'path':'snowbound-manor.blend','sha256':sha(SOURCE)},
        'parentSource':{'path':str(original.relative_to(ROOT)).replace('\\','/'),'sha256':identity},'generatorSha256':GENERATOR_SHA,
        'helperSha256':sha(ROOT/'scripts/build-snowbound-manor.py'),'licensedProvenance':{'path':'../snowbound-manor-v1/licensed/provenance.json','sha256':sha(BASE/'licensed/provenance.json')},
        'removedObjects':removed,'changes':['original voxel volume fire shared with runtime','modeled charcoal and ash','lower fire fixture energy','review camera corrections saved natively','chandelier mount inset corrected from 25.5 mm to 3 mm'],
        'humanArtApproved':False,'agentWorldBound':False})

def render(names,width,samples):
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=samples
    preferences=bpy.context.preferences.addons['cycles'].preferences
    try:
        preferences.compute_device_type='OPTIX';preferences.get_devices()
        for device in preferences.devices:device.use=device.type=='OPTIX'
        scene.cycles.device='GPU'
    except Exception:scene.cycles.device='CPU'
    scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=width;scene.render.resolution_y=round(width*9/16);scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
    previous=read(P/'renders/render-receipt.json') if (P/'renders/render-receipt.json').exists() else {}
    receipts=previous.get('renders',[]) if previous.get('sourceSha256')==sha(SOURCE) else []
    for name in names:
        path=P/'renders'/f'{name}.png';path.parent.mkdir(exist_ok=True);scene.camera=bpy.data.objects[name];scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True);receipts=[r for r in receipts if r['camera']!=name]
        receipts.append({'camera':name,'path':path.relative_to(P).as_posix(),'sha256':sha(path),'width':width,'samples':samples})
    write(P/'renders/render-receipt.json',{'sourceSha256':sha(SOURCE),'width':width,'samples':samples,'renders':receipts})

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--render-only',action='store_true');parser.add_argument('--views',nargs='+',default=['fire-study','hall']);parser.add_argument('--width',type=int,default=1280);parser.add_argument('--samples',type=int,default=64)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.render_only:build()
    render(args.views,args.width,args.samples)
    print('REFINED MANOR CANDIDATE RENDERED',flush=True)
