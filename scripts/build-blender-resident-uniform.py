"""Fit preserved CC0 tailoring to the original station resident and skeleton.

Only data from the licensed suit are read. The landmark transformation and
game skinning are authored here; earlier character packages remain intact.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v5'
DATA=PACKAGE/'licensed/mrt-suit'
spec=importlib.util.spec_from_file_location('preserved_portrait',ROOT/'scripts/build-blender-resident-portraits.py')
portrait=importlib.util.module_from_spec(spec);spec.loader.exec_module(portrait)
base,inv,u,tail=portrait.base,portrait.inv,portrait.u,portrait.tail
for item in (portrait,base,inv,u,tail):item.PACKAGE=PACKAGE
old_legs=base.legs
PARTS=[]
FINISHING=[]

def materials(profile):
    portrait.materials(profile)
    for name,tint in [('mrt_fitted_uniform',(.46,.56,.62,1)),('mrt_shirt_and_tie',(1,.93,.82,1))]:
        mat=portrait.assets.image_material(u,name,DATA/'DB-suit.png',.79,normal_path=DATA/'DB-suit-norm.png')
        tree=mat.node_tree;bsdf=tree.nodes['Principled BSDF']
        bsdf.inputs['Normal'].links[0].from_node.inputs['Strength'].default_value=.18
        texture=bsdf.inputs['Base Color'].links[0].from_node
        mix=tree.nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY'
        mix.inputs[0].default_value=1;mix.inputs[7].default_value=tint
        tree.links.new(texture.outputs['Color'],mix.inputs[6]);tree.links.new(mix.outputs[2],bsdf.inputs['Base Color'])
        mat['expectedBaseColorFactor']=tint

def transforms(joint):
    neck,pelvis=joint('neck'),joint('pelvis')
    axis=lambda p:Vector((p.x,-p.z,p.y))
    def body(p):
        return Vector((p.x*.109,-(p.z-.22)*.104,.94+(p.y-pelvis.y)*.61/(neck.y-pelvis.y)))
    def upper(p):
        s=1 if p.x>0 else -1;src='l' if s>0 else 'r'
        a,b,c=[axis(joint(src+'-'+n)) for n in ('shoulder','elbow','hand')]
        aa,bb,cc=[Vector(q) for q in [(s*.223,.006,1.465),(s*.283,-.016,1.192),(s*.278,-.025,.953)]]
        q=axis(p)
        def segment(a,b,aa,bb):
            d=b-a;t=(q-a).dot(d)/d.length_squared
            return aa+(bb-aa)*t+(d.rotation_difference(bb-aa)@(q-a-d*t))*.105
        t=inv.smooth(((q-b).dot((c-b).normalized())+.40)/.80)
        arm=segment(a,b,aa,bb)*(1-t)+segment(b,c,bb,cc)*t
        edge=max(1.25,3.1-(p.y-1.7)*.8)
        amount=inv.smooth((abs(p.x)-edge)/.70)
        if p.y>neck.y-.4:amount*=inv.clamp((neck.y+.05-p.y)/.45)
        return body(p)*(1-amount)+arm*amount
    def lower(p):
        s=1 if p.x>0 else -1;src='l' if s>0 else 'r'
        knee,ankle=joint(src+'-knee'),joint(src+'-ankle')
        if p.y>=knee.y:
            t=(p.y-knee.y)/(pelvis.y-knee.y)
            height=.515+t*(.94-.515)
            cx=knee.x*(1-t)+s*1.10*t;cz=knee.z*(1-t)+pelvis.z*t
            dest_y=-.030*(1-t)
        else:
            t=(p.y-ankle.y)/(knee.y-ankle.y)
            height=.115+t*(.515-.115)
            cx=ankle.x*(1-t)+knee.x*t;cz=ankle.z*(1-t)+knee.z*t
            dest_y=-.030*t
        limb=Vector((s*.102+(p.x-cx)*.104,dest_y-(p.z-cz)*.104,height))
        trunk=body(p);trunk.z=height
        amount=inv.smooth((pelvis.y-p.y)/1.25)*inv.smooth(abs(p.x)/.8)
        return trunk*(1-amount)+limb*amount
    return upper,lower

def suit(profile):
    source,_,joint=base.anatomy.read_source(profile)
    points,uvs,faces,uvfaces=portrait.assets.fitted_proxy(DATA/'toigo_male_double-breasted_suit.mhclo',source)
    upper,lower=transforms(joint)
    # Component ranges were read from the pinned OBJ connectivity; none are
    # inferred from atlas colours. Each keeps its exact source corner UVs.
    groups=[('trousers',0,1717,lower,1),('buttons',1717,2367,upper,0),
            ('jacket',2367,4061,upper,1),('tie',4061,4541,upper,0),
            ('shirt',4541,4671,upper,0),('collar',4671,5201,upper,1),
            ('cuffs',5201,5393,upper,0)]
    for label,start,end,transform,subdivision in groups:
        selected=[i for i,f in enumerate(faces) if all(start<=v<end for v in f)]
        assert selected and not any(any(start<=v<end for v in f) and not all(start<=v<end for v in f) for f in faces)
        used=sorted({v for i in selected for v in faces[i]});mapping={v:i for i,v in enumerate(used)}
        material='brass' if label=='buttons' else 'shirt' if label in ('collar','shirt','cuffs') else 'mrt_shirt_and_tie' if label=='tie' else 'mrt_fitted_uniform'
        obj=u.mesh('tailored_'+label,[transform(points[i]) for i in used],
                   [tuple(mapping[v] for v in faces[i]) for i in selected],material,True)
        portrait.assets.assign_uv(obj,uvs,[uvfaces[i] for i in selected])
        if label in ('jacket','collar'):
            for vertex in obj.data.vertices:
                p=vertex.co
                if p.z>1.505:
                    metric=math.sqrt((p.x/.052)**2+((p.y-.009)/.055)**2)
                    amount=inv.smooth((p.z-1.505)/.045)
                    if metric>1:
                        factor=1-amount+amount/metric
                        p.x*=factor;p.y=.009+(p.y-.009)*factor
        if subdivision:
            tail.active(obj);mod=obj.modifiers.new('tailored_surface_curvature','SUBSURF');mod.levels=subdivision
            bpy.ops.object.modifier_apply(modifier=mod.name)
        if label=='jacket':
            for vertex in obj.data.vertices:
                p=vertex.co
                if p.z<1.045:
                    outward=Vector((p.x,(p.y-.006)*1.25,0)).normalized()
                    p+=outward*(.018*inv.smooth((1.045-p.z)/.15))
        def weights(p):
            if label=='trousers':
                leg=inv.leg_weight('R' if p.x>0 else 'L')(p)
                amount=inv.smooth((p.z-.80)/.20)
                return {**{k:v*(1-amount) for k,v in leg.items()},'pelvis':amount}
            side='R' if p.x>0 else 'L'
            amount=inv.smooth((abs(p.x)-.165)/.07)
            trunk=inv.coat_weight(p) if label=='jacket' else inv.torso(p)
            result={k:v*(1-amount) for k,v in trunk.items()}
            for k,v in inv.arm_weight(side)(p).items():result[k]=result.get(k,0)+v*amount
            return result
        inv.skin(obj,weights)
        attr=obj.data.attributes.new('UniformPart','INT','POINT')
        attr.data.foreach_set('value',[groups.index((label,start,end,transform,subdivision))+1]*len(obj.data.vertices))
        obj['assetOrigin']='Margaret Toigo / MRT double-breasted suit, CC0-1.0'
        obj['adaptation']='Preserved barycentric attachments and UVs; independent anatomical landmark fitting to Riverbend skeleton'
        obj.data.calc_loop_triangles()
        PARTS.append({'name':label,'sourceVertexRange':[start,end],'sourceFaces':len(selected),'subdivision':subdivision,
                      'vertices':len(obj.data.vertices),'triangles':len(obj.data.loop_triangles),
                      'bounds':[[min(v.co[k] for v in obj.data.vertices),max(v.co[k] for v in obj.data.vertices)] for k in range(3)]})
        if label=='jacket':pockets(obj)

def pockets(jacket):
    mesh=jacket.data;mesh.calc_loop_triangles()
    triangles=list(mesh.loop_triangles);uv=mesh.uv_layers.active
    tree=BVHTree.FromPolygons([v.co for v in mesh.vertices],[t.vertices for t in triangles],all_triangles=True)
    for side in (-1,1):
        points=[];coords=[];faces=[];rows,cols=4,16
        for row in range(rows+1):
            t=row/rows
            for col in range(cols+1):
                x=side*(.062+col/cols*.084);z=1.080+.013*col/cols-.014*t
                hit,normal,index,_=tree.ray_cast(Vector((x,-.7,z)),Vector((0,1,0)))
                assert hit is not None,(side,row,col,x,z)
                triangle=triangles[index]
                tex=barycentric_transform(hit,*[mesh.vertices[i].co for i in triangle.vertices],
                    *[Vector((*uv.data[i].uv,0)) for i in triangle.loops])
                ease=math.sin(math.pi*col/cols)**.6
                points.append(hit+normal*(.001+.0035*math.sin(math.pi*t)*ease))
                coords.append(tuple(tex[:2]))
        for row in range(rows):
            for col in range(cols):
                a=row*(cols+1)+col;faces.append((a,a+1,a+cols+2,a+cols+1))
        obj=u.mesh('curved_welt_pocket_'+str(side),points,faces,'mrt_fitted_uniform',True)
        portrait.assets.assign_uv(obj,coords,faces);inv.skin(obj,inv.coat_weight)
        obj.data.calc_loop_triangles()
        PARTS.append({'name':obj.name,'authorship':'Original curved welt following the fitted jacket; UVs sampled from the actual underlying source surface',
                      'vertices':len(obj.data.vertices),'triangles':len(obj.data.loop_triangles)})

def clothes(profile):
    portrait.clothes(profile)
    tail.remove_skin_prefix('anatomically_fitted_garment','linen_cuff_','standing_linen_collar',
        'shirt_front','collar_leaf','jacket_notched_lapel','jacket_pocket','tie','jacket_button')
    suit(profile)

def legs(profile):
    old_legs(profile);tail.remove_skin_prefix('pressed_trousers_')

def neck_subset(original):
    def make(u,inv,name,points,faces,keep,transform,weights):
        if name=='anatomical_head':
            # The old head stops at the old high collar. Retain more of the
            # actual source neck, with its original UVs, beneath the new collar.
            cutoff=min(p.y for p in points if keep(p))-.85
            keep=lambda p:p.y>cutoff
        return original(u,inv,name,points,faces,keep,transform,weights)
    return make

def anatomy(u,inv,profile):
    head,transform,joint=portrait.anatomy(u,inv,profile)
    tree=BVHTree.FromPolygons([v.co for v in head.data.vertices],[f.vertices for f in head.data.polygons])
    collar=bpy.data.objects['tailored_collar'];shifts=[]
    for vertex in collar.data.vertices:
        p=vertex.co
        if p.z<=1.515:continue
        origin=Vector((0,.009,p.z));direction=(p-origin).normalized()
        hit=tree.ray_cast(origin,direction)[0]
        if hit is not None:
            target=hit+direction*.003
            if (target-origin).length<(p-origin).length:
                amount=inv.smooth((p.z-1.515)/.035)
                delta=(target-p)*amount;p+=delta;shifts.append(delta.length)
    collar.data.update()
    next(p for p in PARTS if p['name']=='collar')['boundsAfterFitting']=[
        [min(v.co[k] for v in collar.data.vertices),max(v.co[k] for v in collar.data.vertices)] for k in range(3)]
    FINISHING.append({'part':'collar','method':'Conform upper collar to actual source neck with 3 mm radial allowance',
                      'adjustedVertices':len(shifts),'maximumOffsetMeters':max(shifts,default=0)})
    return head,transform,joint

def animation_clearance(body):
    labels=body.data.attributes['UniformPart'].data;body.data.calc_loop_triangles()
    triangles={label:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==label for i in t.vertices)] for label in (1,3)}
    rows=[]
    for clip,count in [('Idle',90),('Walk',24)]:
        for frame in range(count+1):
            inv.pose(clip,frame/count);bpy.context.view_layer.update()
            evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
            points=[v.co.copy() for v in mesh.vertices]
            a,b=[BVHTree.FromPolygons(points,triangles[label],all_triangles=True) for label in (1,3)]
            rows.append({'clip':clip,'frame':frame,'intersectingTrianglePairs':len(a.overlap(b))})
            evaluated.to_mesh_clear()
    worst=max(rows,key=lambda r:r['intersectingTrianglePairs'])
    result={'scope':'Evaluated jacket versus trousers in every authored Idle and Walk frame; excludes other parts and future motions.',
            'frames':rows,'maximumIntersectingTrianglePairs':worst['intersectingTrianglePairs']}
    if worst['intersectingTrianglePairs']:
        folder=PACKAGE/'diagnostics';folder.mkdir(exist_ok=True)
        base.write(folder/'jacket-trouser-contact.json',result)
        inv.pose(worst['clip'],worst['frame']/(90 if worst['clip']=='Idle' else 24))
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/'jacket-trouser-contact.blend'))
    inv.pose('Idle',0)
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--views',default='three-quarter,portrait,face-front,front,profile,back,walk-contact,walk-passing,hands')
    parser.add_argument('--width',type=int,default=1100);parser.add_argument('--samples',type=int,default=48)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for ledger in (DATA/'provenance.json',portrait.DATA/'provenance.json'):
        for row in json.loads(ledger.read_text())['files']:assert base.sha(ROOT/row['path'])==row['sha256']
    base.materials,base.clothes,base.legs=materials,clothes,legs
    source_subset=portrait.assets.source_subset(portrait.original_subset,base.anatomy.DATA/'3dobjs/base.obj')
    base.anatomy.subset_mesh=neck_subset(source_subset)
    base.anatomy.anatomy,base.anatomy.hair,inv.pose=anatomy,portrait.hair,tail.pose
    profile=next(p for p in json.loads((portrait.FIRST/'profiles.json').read_text(encoding='utf-8'))['profiles'] if p['actorId']=='resident-06')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    u.MATS.clear();u.CONTACTS.clear();portrait.PARTS.clear();portrait.CONTEXT.clear();PARTS.clear();FINISHING.clear()
    body,rig,clips=base.make(profile)
    body['origin']='CC0 MRT tailoring independently fitted to original Riverbend station resident; preserved CC0 anatomy and portrait; project cap, shoes, skeleton and animation'
    report=base.review(body,rig)
    clearance=animation_clearance(body)
    assert clearance['maximumIntersectingTrianglePairs']==0
    assert report['triangles']<60000 and report['materials']<=14,report['triangles']
    base.setup_stage();scale=profile['height']/1.802
    for name,loc,target,size in [('face-front',(0,-3,1.684*scale),(0,-.015,1.684*scale),.405*scale),
        ('portrait',(1.1,-2.8,1.90*scale),(0,-.015,1.565*scale),.64*scale),('front',(0,-5,1.28),(0,0,1.02),2.18)]:
        camera=bpy.data.objects[name];camera.location=loc
        camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=size
    devices=u.configure(args.samples,args.width)
    scene=bpy.context.scene;scene.render.resolution_y=args.width;scene.camera=bpy.data.objects['three-quarter']
    folder=PACKAGE/profile['actorId'];folder.mkdir(parents=True,exist_ok=True);(folder/'renders').mkdir(exist_ok=True)
    source=folder/(profile['id']+'.blend')
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source));identity=base.sha(source)
    images=[]
    for im in bpy.data.images:
        if im.source!='FILE' or not im.filepath:continue
        path=Path(bpy.path.abspath(im.filepath)).resolve();assert path.is_file() and im.packed_file
        digest=hashlib.sha256(bytes(im.packed_file.data)).hexdigest();assert digest==base.sha(path)
        images.append({'path':path.relative_to(ROOT).as_posix(),'sha256':digest,'dimensions':list(im.size),'packedBytes':len(im.packed_file.data)})
    inputs=[Path(__file__),ROOT/'scripts/build-blender-resident-portraits.py',ROOT/'scripts/classic-resident-portrait-assets.py',
        ROOT/'scripts/build-blender-resident-tailoring.py',ROOT/'scripts/build-blender-classic-residents.py',
        ROOT/'scripts/classic-resident-anatomy.py',ROOT/'scripts/build-blender-classic-investigator.py',ROOT/'scripts/build-blender-classic-railway.py',
        portrait.FIRST/'profiles.json',ROOT/'docs/3d-town/classic-residents-v3/portrait-assets.json',
        portrait.DATA/'provenance.json',base.anatomy.DATA/'provenance.json',DATA/'provenance.json']
    report.update({'schema':'classic-resident-uniform-authoring.v5','sourceSha256':identity,'profile':profile,
        'inputs':{p.relative_to(ROOT).as_posix():base.sha(p) for p in inputs},'devices':devices,'uniformParts':PARTS,
        'portraitParts':portrait.PARTS,'packedTextures':images,'jacketTrouserClearance':clearance,'finishing':FINISHING,
        'materialExpectations':{m.name:{'baseColorFactor':list(m['expectedBaseColorFactor'])} for m in body.data.materials if 'expectedBaseColorFactor' in m},
        'runtimeCloth':False,'humanArtApproved':False})
    base.write(folder/'authoring-review.json',report)
    renders=[]
    if args.views!='none':
        for view in args.views.split(','):
            scene.camera=bpy.data.objects['three-quarter' if view.startswith('walk') else view]
            inv.pose('Walk' if view.startswith('walk') else 'Idle',.25 if view=='walk-passing' else 0)
            scene.render.filepath=str(folder/'renders'/(view+'.png'));bpy.ops.render.render(write_still=True)
            renders.append({'view':view,'path':'renders/'+view+'.png','sha256':base.sha(Path(scene.render.filepath))})
    base.write(folder/'render-review.json',{'sourceSha256':identity,'engine':'Cycles','samples':args.samples,'renders':renders,'humanArtApproved':False})
    inv.pose('Idle',0);bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
    raw=folder/(profile['id']+'-raw.glb')
    bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,
        export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,
        export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
    base.write(folder/'raw-export.json',{'sourceSha256':identity,'rawSha256':base.sha(raw),'bytes':raw.stat().st_size})
    print(json.dumps({'sourceSha256':identity,'triangles':report['triangles'],'materials':report['materials'],'renderCount':len(renders)}),flush=True)

if __name__=='__main__':main()
