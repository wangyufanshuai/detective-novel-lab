"""Station tailoring pass: sloped shoulders and a short-jacket hem motion.

Uses the preserved v6 authorship pipeline. Earlier source models stay intact.
"""
from pathlib import Path
import importlib.util
import math
import bpy
from mathutils import Vector, Quaternion

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v7'
spec=importlib.util.spec_from_file_location('preserved_finish',ROOT/'scripts/build-blender-resident-finish.py')
finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
uniform,portrait,base,inv,u,tail=finish.uniform,finish.portrait,finish.base,finish.inv,finish.u,finish.tail
for item in (finish,uniform,portrait,base,inv,u,tail):item.PACKAGE=PACKAGE
original_suit,original_anatomy=uniform.suit,uniform.anatomy
original_pose=tail.pose
original_write=finish.previous_write
SHAPE=[]


def suit(profile):
    original_suit(profile)
    jacket=bpy.data.objects['tailored_jacket']
    shoulder_offsets=[];hem_offsets=[]
    before=[v.co.copy() for v in jacket.data.vertices]
    for vertex in jacket.data.vertices:
        p=vertex.co
        shoulder=inv.smooth((abs(p.x)-.080)/.170)*inv.smooth((p.z-1.290)/.190)
        drop=.035*shoulder
        if drop>1e-7:
            p.z-=drop;shoulder_offsets.append(drop)
        # The short jacket needs modest front clearance, rather than being
        # driven upward by the full rotation of the forward thigh.
        ease=inv.smooth((1.020-p.z)/.130)*inv.smooth((-p.y-.018)/.055)*inv.smooth((.200-abs(p.x))/.090)
        extra=.012*ease
        if extra>1e-7:
            p.y-=extra;hem_offsets.append(extra)
    jacket.data.update()
    bands=[]
    for low,high in [(.10,.14),(.14,.18),(.18,.22),(.22,.26),(.26,.30)]:
        selected=[i for i,p in enumerate(before) if low<=abs(p.x)<high and p.z>1.32]
        bands.append({'absX':[low,high],'vertices':len(selected),
            'highestZBefore':max(before[i].z for i in selected),
            'highestZAfter':max(jacket.data.vertices[i].co.z for i in selected)})
    SHAPE.append({'part':'shoulders','method':'Lower the outer shoulder crown gradually into the sleeve while retaining the original topology, UVs and rig.',
        'adjustedVertices':len(shoulder_offsets),'maximumDropMeters':max(shoulder_offsets,default=0),'bands':bands})
    SHAPE.append({'part':'short-jacket-hem','method':'Add local front clearance beneath the hip before limiting coat-tail rotation.',
        'adjustedVertices':len(hem_offsets),'maximumFrontAllowanceMeters':max(hem_offsets,default=0)})


def anatomy(u,inv,profile):
    result=original_anatomy(u,inv,profile)
    # Apply one monotonic spatial warp to all three garment layers. Different
    # vertical offsets expose the hidden raw edge of the white source collar.
    for name in ('tailored_jacket','tailored_collar','fitted_inner_collar_stand'):
        maximum=.014
        obj=bpy.data.objects[name];offsets=[]
        for vertex in obj.data.vertices:
            p=vertex.co
            posterior=inv.smooth((p.y+.025)/.050)
            amount=inv.smooth((p.z-1.515)/.040)*posterior
            delta=maximum*amount
            if delta>1e-7:p.z-=delta;offsets.append(delta)
        obj.data.update()
        SHAPE.append({'part':name+'-neckline','method':'Apply the same posterior vertical curve to all three collar layers; the head remains unchanged.',
            'adjustedVertices':len(offsets),'maximumDropMeters':max(offsets,default=0)})
    return result


def pose(kind,phase):
    original_pose(kind,phase)
    if kind!='Walk':return
    offset=inv.RIG.pose.bones['pelvis'].head-inv.BONES['pelvis'][0]
    for side in ('L','R'):
        name='tail_'+side
        start,end=inv.BONES[name]
        bone=inv.RIG.pose.bones[name]
        delta=(end-start).rotation_difference(bone.tail-bone.head)
        target=Quaternion().slerp(delta,.42)
        if target.angle>.21:target=Quaternion(target.axis,.21)
        inv.worldbone(name,start+offset,start+offset+(target@(end-start)))


def write(path,value):
    if Path(path).name=='authoring-review.json':
        value.update(schema='classic-resident-silhouette-authoring.v7',silhouetteRefinement=SHAPE)
        value['inputs'][Path(__file__).relative_to(ROOT).as_posix()]=base.sha(Path(__file__))
        value['fittingScope']='Preserved v6 cloth and face with shoulder-crown shaping, posterior neckline adjustment and a short-jacket-specific hem pose. No cloth solver.'
        value['shortJacketAnimation']={'retainedBones':20,'retainedClips':{'Idle':3,'Walk':.8},
            'forwardThighRotationFraction':.42,'maximumTailRotationRadians':.21,
            'scope':'Authored skinned jacket motion; no runtime cloth simulation.'}
    original_write(path,value)


if __name__=='__main__':
    uniform.materials,uniform.neck_subset=finish.materials,finish.neck_subset
    uniform.animation_clearance=finish.clearance
    portrait.anatomy,base.write=finish.anatomy,finish.write
    finish.previous_write=write
    uniform.suit,uniform.anatomy=suit,anatomy
    tail.pose=pose
    uniform.main()
