"""Compare actual saved rig/mesh data and body actions with their retained sources."""
from pathlib import Path
import importlib.util
import json
import math
import bpy

ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-residents-v8'
spec=importlib.util.spec_from_file_location('hand_authoring',ROOT/'scripts/build-blender-resident-hands.py')
hand=importlib.util.module_from_spec(spec);spec.loader.exec_module(hand)

def capture(path,profile):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    body=bpy.data.objects[profile['id']+'_skin'];rig=bpy.data.objects[profile['id']+'_rig']
    original=[b.name for b in rig.data.bones if not b.name.startswith('finger_')]
    # New hand groups retain partial palm weights; use the unchanged anatomical
    # material and wrist-side location to identify the whole hand in both files.
    skin={i for f in body.data.polygons if 'skin' in body.data.materials[f.material_index].name for i in f.vertices}
    ids={v.index for v in body.data.vertices if v.index in skin and v.co.z<1.02}
    weights=[(v.index,sorted((body.vertex_groups[g.group].name,round(g.weight,8)) for g in v.groups if g.weight>1e-6)) for v in body.data.vertices if v.index not in ids]
    result={'path':path.relative_to(ROOT).as_posix(),'sha256':hand.sha(path),'restMesh':hand.mesh_identity(body),
        'oldBoneRest':{name:[list(rig.data.bones[name].head_local),list(rig.data.bones[name].tail_local)] for name in original},
        'outsideHandWeightsSha256':hand.sha_bytes(json.dumps(weights,separators=(',',':')).encode()),
        'bones':len(rig.data.bones),'frames':{},'fingerRotations':{}}
    for kind,count in [('Idle',90),('Walk',24)]:
        hand.bind_action(rig,bpy.data.actions[kind]);frames=[];digits=[]
        for frame in range(1,count+2):
            bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
            frames.append({name:[float(c) for row in rig.pose.bones[name].matrix for c in row] for name in original})
            digits.append({b.name:list(b.rotation_quaternion) for b in rig.pose.bones if b.name.startswith('finger_')})
        result['frames'][kind]=frames;result['fingerRotations'][kind]=digits
    return result

reports=[]
for actor in ('resident-03','resident-06','resident-08'):
    folder=PACKAGE/actor;author=hand.read(folder/'authoring-review.json');profile=author['profile']
    old=capture(ROOT/author['sourceInput']['path'],profile)
    new=capture(folder/(profile['id']+'.blend'),profile)
    assert old['restMesh']==new['restMesh'] and old['oldBoneRest']==new['oldBoneRest']
    assert old['outsideHandWeightsSha256']==new['outsideHandWeightsSha256'] and new['bones']==50
    assert new['sha256']==author['sourceSha256']
    maximum=0;allowed={'Idle':['hand_L','hand_R']+(['forearm_L'] if actor in ('resident-03','resident-08') else []),'Walk':['hand_L','hand_R']}
    for kind in ('Idle','Walk'):
        for a,b in zip(old['frames'][kind],new['frames'][kind]):
            for name in a:
                if name in allowed[kind]:continue
                maximum=max(maximum,max(abs(x-y) for x,y in zip(a[name],b[name])))
    assert maximum<1e-5,(actor,'unplanned body action changed',maximum)
    finger_motion={};seams={}
    for kind,frames in new['fingerRotations'].items():
        assert len(frames[0])==30
        finger_motion[kind]={name:max(max(abs(a-b) for a,b in zip(frame[name],frames[0][name])) for frame in frames) for name in frames[0]}
        assert all(value>1e-5 for value in finger_motion[kind].values())
        seams[kind]=max(abs(a-b) for name in frames[0] for a,b in zip(frames[0][name],frames[-1][name]))
        assert seams[kind]<1e-6
    reports.append({'actorId':actor,'source':{'path':new['path'],'sha256':new['sha256']},
        'previous':{'path':old['path'],'sha256':old['sha256']},'restMesh':new['restMesh'],
        'outsideHandWeightsSha256':new['outsideHandWeightsSha256'],'maximumUnchangedBodyMatrixDifference':maximum,
        'plannedPoseChanges':allowed,'fingerMotion':finger_motion,'fingerLoopSeams':seams,'framesCompared':116,
        'checks':{'restMeshUnchanged':True,'oldBoneRestUnchanged':True,'outsideHandWeightsUnchanged':True,
            'otherBodyActionsUnchanged':True,'thirtyAnimatedFingerBones':True,'fingerLoopsClose':True}})
hand.write(PACKAGE/'saved-source-review.json',{'schema':'classic-hands-saved-source.v8','builderSha256':hand.sha(Path(__file__)),
    'residents':reports,'scope':'Actual saved source identity, body-action retention and finger animation; no claim of human art approval or object grasping.',
    'humanArtApproved':False})
print(json.dumps([{'actorId':r['actorId'],'checks':r['checks'],'maximumBodyMatrixDifference':r['maximumUnchangedBodyMatrixDifference']} for r in reports]))
