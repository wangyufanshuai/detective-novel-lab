"""Adjust only the low studio camera; retain the evaluated model and source."""
from pathlib import Path
import bpy,json,hashlib,shutil
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];F=ROOT/'docs/3d-town/classic-residents-v9/resident-03';source=F/'rb-xu-zhiwei.blend'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def model_identity():
    h=hashlib.sha256()
    def add(x):h.update(repr(x).encode())
    for obj in sorted(bpy.data.objects,key=lambda o:o.name):
        if obj.type not in ('MESH','ARMATURE','EMPTY'):continue
        add((obj.name,obj.type,list(obj.location),list(obj.rotation_euler),list(obj.rotation_quaternion),list(obj.scale),obj.parent.name if obj.parent else None))
        if obj.type=='MESH':
            add([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in obj.data.vertices]);add([(tuple(p.vertices),p.material_index) for p in obj.data.polygons]);add([(l.name,[tuple(d.uv) for d in l.data]) for l in obj.data.uv_layers]);add([m.name for m in obj.data.materials])
        if obj.type=='ARMATURE':add([(b.name,[tuple(row) for row in b.matrix_local],b.parent.name if b.parent else None) for b in obj.data.bones])
    for action in sorted(bpy.data.actions,key=lambda a:a.name):
        add(action.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:add((curve.data_path,curve.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in curve.keyframe_points]))
    return h.hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source));old=sha(source);identity=model_identity()
backup=F/'source-before-low-camera-02.blend';assert not backup.exists();shutil.copy2(source,backup)
prior_amendment=F/'camera-amendment-01.json';shutil.copy2(F/'camera-amendment.json',prior_amendment)
camera=bpy.data.objects['final-low'];camera.location=(2,-3,.9);camera.rotation_euler=(Vector((0,-.15,1.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.55
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.wm.open_mainfile(filepath=str(source));assert model_identity()==identity
new=sha(source);scene=bpy.context.scene;scene.camera=bpy.data.objects['final-low'];scene.frame_set(111);scene.render.filepath=str(F/'renders/low.png');bpy.ops.render.render(write_still=True)
amend={'scope':'Only final-low camera location, orientation and orthographic size changed. Meshes, weights, rest bones, object placement and every action key/handle are identical after reopening.',
    'previousSource':{'path':backup.relative_to(ROOT).as_posix(),'sha256':old},'sourceSha256':new,'modelIdentityBefore':identity,'modelIdentityAfter':model_identity(),
    'priorAmendment':{'path':prior_amendment.relative_to(ROOT).as_posix(),'sha256':sha(prior_amendment)},
    'camera':{'position':list(scene.camera.location),'rotation':list(scene.camera.rotation_euler),'orthoScale':scene.camera.data.ortho_scale},'builderSha256':sha(Path(__file__))}
# model_identity includes animated object transforms, so compare at the source's
# saved frame, rather than a different rendering frame.
scene.frame_set(111);assert amend['modelIdentityAfter']==identity
write(F/'camera-amendment.json',amend)
for name in ('saved-contact-review.json','raw-export.json','render-review.json'):
    d=read(F/name);assert d['sourceSha256']==old;d['sourceSha256']=new;d['cameraOnlyAmendment']={'path':'camera-amendment.json','sha256':sha(F/'camera-amendment.json')};d.setdefault('originalEvaluatedOrExportedSourceSha256',old)
    if name=='render-review.json':
        for r in d['renders']:
            if r['name']=='low':r['renderedFromSourceSha256']=new
            else:r.setdefault('renderedFromSourceSha256',old)
            if r['name']=='low':r['sha256']=sha(F/r['path'])
    write(F/name,d)
print(json.dumps({'previousSource':old,'sourceSha256':new,'modelIdentityUnchanged':True}))
