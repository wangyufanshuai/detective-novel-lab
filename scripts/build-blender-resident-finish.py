"""Sixth art pass: continuous nape transition and original restrained cloth.

Imports the preserved v5 production pipeline without editing its sources.
"""
from pathlib import Path
import importlib.util
import math
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v6'
spec=importlib.util.spec_from_file_location('preserved_uniform',ROOT/'scripts/build-blender-resident-uniform.py')
uniform=importlib.util.module_from_spec(spec);spec.loader.exec_module(uniform)
portrait,base,inv,u,tail=uniform.portrait,uniform.base,uniform.inv,uniform.u,uniform.tail
for item in (uniform,portrait,base,inv,u,tail):item.PACKAGE=PACKAGE
previous_materials,previous_neck=uniform.materials,uniform.neck_subset
previous_anatomy,previous_write=portrait.anatomy,base.write
previous_clearance=uniform.animation_clearance
FINISH=[]

def materials(profile):
    previous_materials(profile)
    np=base.np;size=512;y,x=np.mgrid[0:size,0:size]/size
    # Original periodic weave, deliberately low in contrast and without the
    # broad blue stripes painted into the earlier licensed colour atlas.
    weave=np.sin(x*math.tau*128)*np.sin(y*math.tau*128)
    diagonal=np.sin((x+y)*math.tau*64)
    noise=np.random.default_rng(6109).random((size,size))-.5
    values=np.array([.190,.224,.246])*(1+weave[...,None]*.025+diagonal[...,None]*.012+noise[...,None]*.065)
    path=PACKAGE/'textures/station-fine-wool.png';path.parent.mkdir(parents=True,exist_ok=True);u.png(path,values)
    mat=portrait.assets.image_material(u,'station_fine_wool',path,.86,normal_path=uniform.DATA/'DB-suit-norm.png')
    bsdf=mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Normal'].links[0].from_node.inputs['Strength'].default_value=.25
    # The installed exporter emits tint and roughness, not the nonzero weight.
    # Encode strength into tint in both Blender and glTF to retain parity.
    bsdf.inputs['Sheen Weight'].default_value=1
    bsdf.inputs['Sheen Tint'].default_value=(.035,.035,.035,1)
    bsdf.inputs['Sheen Roughness'].default_value=.7
    u.MATS['mrt_fitted_uniform']=mat
    silk=u.material('station_claret_silk','542d2c',.56)
    silk.node_tree.nodes['Principled BSDF'].inputs['Sheen Weight'].default_value=1
    silk.node_tree.nodes['Principled BSDF'].inputs['Sheen Tint'].default_value=(.10,.10,.10,1)
    u.MATS['mrt_shirt_and_tie']=silk
    FINISH.append({'part':'wool','method':'Original 512-square periodic fine weave replaces the licensed striped colour atlas. Retains source normal atlas at 0.25 strength.',
                   'albedoPath':path.relative_to(ROOT).as_posix(),'albedoSha256':base.sha(path),'sheenTint':[.035,.035,.035]})

def neck_subset(original):
    retained=previous_neck(original)
    def make(u,inv,name,points,faces,keep,transform,weights):
        if name!='anatomical_head':return retained(u,inv,name,points,faces,keep,transform,weights)
        offsets=[];preserved=0;frontal=[]
        def continuous(p):
            nonlocal preserved
            q=transform(p);before=q.copy()
            posterior=inv.smooth((q.y-.025)/.050)
            radius=math.sqrt((q.x/.053)**2+((q.y-.009)/.055)**2)
            amount=posterior*inv.smooth((1.690-q.z)/.150)
            if radius>1 and amount>0:
                factor=1-amount+amount/radius
                q.x*=factor;q.y=.009+(q.y-.009)*factor
            if (q-before).length>1e-8:offsets.append((q-before).length)
            else:preserved+=1
            if before.y<.025 and before.z>1.565:frontal.append((q-before).length)
            return q
        obj=retained(u,inv,name,points,faces,keep,continuous,weights)
        assert frontal and max(frontal)==0
        FINISH.append({'part':'neck','method':'Gradual posterior-only transition from nape to collar. The front face and source UVs are unchanged.',
                       'adjustedVertices':len(offsets),'unchangedVertices':preserved,'maximumOffsetMeters':max(offsets,default=0),
                       'protectedFrontalVertices':len(frontal),'maximumFrontalOffsetMeters':max(frontal)})
        return obj
    return make

def anatomy(u,inv,profile):
    head,transform,joint=previous_anatomy(u,inv,profile)
    layer=head.data.attributes.new('NeckLayer','INT','POINT');layer.data.foreach_set('value',[1]*len(head.data.vertices))
    tree=BVHTree.FromPolygons([v.co for v in head.data.vertices],[f.vertices for f in head.data.polygons])
    points=[];faces=[];rows,segments=4,64
    hits=0
    for row in range(rows+1):
        t=row/rows
        for col in range(segments):
            angle=math.tau*col/segments
            front=max(0,math.cos(angle))**.6
            low=1.490+.028*(1-front);high=1.502+.047*(1-front)
            z=low*(1-t)+high*t
            origin=Vector((0,.009,z));direction=Vector((math.sin(angle),-math.cos(angle),0))
            hit=tree.ray_cast(origin,direction)[0]
            if hit is None:
                hit=origin+Vector((.047*math.sin(angle),-.048*math.cos(angle),0))
            else:hits+=1
            points.append(hit+direction*.003)
    for row in range(rows):
        for col in range(segments):
            a=row*segments+col;b=row*segments+(col+1)%segments
            faces.append((a,b,b+segments,a+segments))
    lining=u.mesh('fitted_inner_collar_stand',points,faces,'shirt',True)
    tail.active(lining);solid=lining.modifiers.new('collar_stand_thickness','SOLIDIFY');solid.thickness=.0012;solid.offset=0
    bpy.ops.object.modifier_apply(modifier=solid.name)
    inv.skin(lining,'head');lining.data.calc_loop_triangles()
    layer=lining.data.attributes.new('NeckLayer','INT','POINT');layer.data.foreach_set('value',[2]*len(lining.data.vertices))
    bm=bmesh.new();bm.from_mesh(lining.data)
    assert all(e.is_manifold for e in bm.edges)
    bm.free()
    FINISH.append({'part':'inner-collar','method':'Original fabric stand fitted around the actual neck, with 3 mm stand-off and 1.2 mm fabric thickness.',
                   'sampleRays':len(points),'neckHits':hits,'triangles':len(lining.data.loop_triangles),'closedManifold':True})
    return head,transform,joint

def clearance(body):
    report=previous_clearance(body)
    labels=body.data.attributes['NeckLayer'].data;body.data.calc_loop_triangles()
    triangles={key:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==key for i in t.vertices)] for key in (1,2)}
    # Head and stand share one rigid head bone. Still evaluate both full clips,
    # so the observation binds to the actual joined mesh and rig in this file.
    frames=[]
    for clip,count in [('Idle',90),('Walk',24)]:
        for frame in range(count+1):
            inv.pose(clip,frame/count);bpy.context.view_layer.update()
            evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
            points=[v.co.copy() for v in mesh.vertices]
            head,stand=[BVHTree.FromPolygons(points,triangles[key],all_triangles=True) for key in (1,2)]
            frames.append({'clip':clip,'frame':frame,'intersectingTrianglePairs':len(head.overlap(stand))})
            evaluated.to_mesh_clear()
    maximum=max(row['intersectingTrianglePairs'] for row in frames)
    FINISH.append({'part':'neck-clearance','scope':'Inner collar stand versus anatomical head/neck in the 116 frames of the current Idle and Walk clips.',
                   'frames':frames,'maximumIntersectingTrianglePairs':maximum})
    if maximum:
        folder=PACKAGE/'diagnostics';folder.mkdir(exist_ok=True)
        previous_write(folder/'neck-contact-failure.json',FINISH[-1])
        worst=max(frames,key=lambda row:row['intersectingTrianglePairs'])
        inv.pose(worst['clip'],worst['frame']/(90 if worst['clip']=='Idle' else 24))
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/'neck-contact-failure.blend'))
    assert maximum==0,('inner-collar-versus-neck',maximum)
    inv.pose('Idle',0)
    return report

def write(path,value):
    if Path(path).name=='authoring-review.json':
        value.update(schema='classic-resident-finish-authoring.v6',surfaceFinishing=FINISH)
        value['inputs'][Path(__file__).relative_to(ROOT).as_posix()]=base.sha(Path(__file__))
        value['fittingScope']='Preserved CC0 suit geometry with original fine wool, claret tie, continuous neck transition and fitted inner collar stand. No cloth solver.'
        value['finishMaterialExpectations']={
            'station_fine_wool':{'normalScale':.25,'roughnessFactor':.86,'sheenColorFactor':[.035]*3,'sheenRoughnessFactor':.7},
            'station_claret_silk':{'roughnessFactor':.56,'sheenColorFactor':[.10]*3,'sheenRoughnessFactor':.5}}
    previous_write(path,value)

if __name__=='__main__':
    uniform.materials,uniform.neck_subset=materials,neck_subset
    uniform.animation_clearance=clearance
    portrait.anatomy,base.write=anatomy,write
    uniform.main()
