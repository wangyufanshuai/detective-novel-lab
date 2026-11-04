"""Measure geometry in Blender without treating a render as human acceptance."""
import itertools
import math

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def evaluated_geometry(objects):
    deps=bpy.context.evaluated_depsgraph_get()
    vertices,faces=[],[]
    for obj in objects:
        evaluated=obj.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        offset=len(vertices)
        vertices.extend([obj.matrix_world@vertex.co for vertex in mesh.vertices])
        faces.extend([tuple(offset+i for i in poly.vertices) for poly in mesh.polygons])
        evaluated.to_mesh_clear()
    return vertices,faces


def spatial_review(groups, geometry, cameras, config):
    cached={name:evaluated_geometry(objects) for name,objects in groups.items()}
    group_bounds={name:([min(v[i] for v in verts) for i in range(3)],
                        [max(v[i] for v in verts) for i in range(3)])
                  for name,(verts,_) in cached.items()}
    prop_names=[name for name in groups if name not in ('shell','ceiling-fixtures')]
    trees={name:BVHTree.FromPolygons(*cached[name]) for name in prop_names}
    collisions=[]
    for a,b in itertools.combinations(prop_names,2):
        low_a,high_a=group_bounds[a]
        low_b,high_b=group_bounds[b]
        if all(min(high_a[i],high_b[i])>max(low_a[i],low_b[i]) for i in range(3)):
            pairs=trees[a].overlap(trees[b])
            if pairs:
                collisions.append({'groups':[a,b],'surfaceIntersectionPairs':len(pairs)})
    floor_groups=[name for name in prop_names if not name.startswith('caseboard-')]
    support=[{'group':name,'gapMeters':round(group_bounds[name][0][2],6),
              'passed':-.005<=group_bounds[name][0][2]<=.005} for name in floor_groups]
    for name,sign in (('caseboard-east',1),('caseboard-west',-1)):
        low,high=group_bounds[name]
        gap=5.8-(high[0] if sign>0 else -low[0])
        support.append({'group':name,'gapMeters':round(gap,6),'passed':-.005<=gap<=.005})
    # A 1.2 m clear route may go around a lamp; it cannot squeeze through
    # the gap between the lamp and the evidence table.
    routes={
        'arrival-to-table':[(0,-4.8),(0,-1.0)],
        'east-loop':[(0,-1.0),(3.72,-1.0),(3.72,2.3),(0,2.3)],
        'west-loop':[(0,-1.0),(-3.72,-1.0),(-3.72,2.3),(0,2.3)],
    }
    obstacles=[(name,group_bounds[name]) for name in prop_names if group_bounds[name][0][2]<1.8]
    measurements=[]
    required_radius=config['minimumClearanceMeters']/2
    for name,route in routes.items():
        clearance=100
        tightest=None
        count=0
        for start,end in zip(route,route[1:]):
            steps=math.ceil(math.dist(start,end)/.04)
            for step in range(steps+1):
                p=[start[i]+(end[i]-start[i])*step/steps for i in range(2)]
                count+=1
                wall_distance=(1.2-abs(p[0])) if p[1]<-3.7 else min(5.71-abs(p[0]),3.70-p[1])
                distances=[('architecture',wall_distance)]
                for obstacle,(low,high) in obstacles:
                    distance=math.hypot(*[max(low[i]-p[i],0,p[i]-high[i]) for i in range(2)])
                    distances.append((obstacle,distance))
                limiting,local=min(distances,key=lambda pair:pair[1])
                if local<clearance:
                    clearance=local
                    tightest={'position':p,'obstacle':limiting}
        measurements.append({'route':name,'points':route,'sampleCount':count,'conservativeClearWidthMeters':round(clearance*2,4),
                             'requiredWidthMeters':required_radius*2,'passed':clearance>=required_radius,'tightest':tightest})
    # Ray-test cut wall surfaces, independently of the mere presence of a modifier.
    apertures=[]
    for name,wall_name,y,width,height,bottom in (
        ('primary-archive-door','SHELL_wall-south',-3.9,2.4,2.6,0),
        ('fog-courtyard-window','SHELL_wall-north',3.9,1.8,1.4,1.3)):
        wall=next(o for o in geometry if o.name==wall_name)
        tree=BVHTree.FromPolygons(*evaluated_geometry([wall]))
        misses=0
        for u,v in itertools.product(range(7),range(7)):
            origin=Vector(((-.45+u*.15)*width,y-.35,bottom+(.05+v*.15)*height))
            if tree.ray_cast(origin,Vector((0,1,0)),.7)[0] is None:
                misses+=1
        apertures.append({'opening':name,'unblockedWallRays':misses,'sampleCount':49,'passed':misses==49})
    # Visibility is measured against all room geometry including cabinetry.
    whole_tree=BVHTree.FromPolygons(*evaluated_geometry(geometry))
    sightlines=[]
    target=Vector((0,.45,.981))
    for name in ('production','corner-sw','corner-se','corner-nw','corner-ne'):
        origin=cameras[name].location
        delta=target-origin
        hit=whole_tree.ray_cast(origin,delta.normalized(),delta.length-.01)[0]
        sightlines.append({'view':name,'heroCenterUnoccluded':hit is None})
    return {'method':'evaluated world-space meshes, BVH surface intersections, ray probes and conservative planar route clearance',
            'independentPropBVHIntersections':collisions,'supportContact':support,'routes':measurements,
            'openingRays':apertures,'heroSightlines':sightlines,
            'passed':not collisions and all(item['passed'] for item in support+measurements+apertures)
                     and all(item['heroCenterUnoccluded'] for item in sightlines),
            'limitations':['BVH surface intersection does not prove absence of whole-object containment.',
                           'Sampled route clearance is an engineering estimate, not a live capsule sweep or a human Function decision.']}
