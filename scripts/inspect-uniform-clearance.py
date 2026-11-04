"""Locate actual jacket/trouser intersections in a saved diagnostic source."""
import bpy
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree

body = bpy.data.objects['rb-gu-yuanshan_skin']
labels = body.data.attributes['UniformPart'].data
body.data.calc_loop_triangles()
triangles = {label: [tuple(tri.vertices) for tri in body.data.loop_triangles
                    if all(labels[i].value == label for i in tri.vertices)] for label in (1, 3)}
evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
mesh = evaluated.to_mesh(); points = [v.co.copy() for v in mesh.vertices]
shirt = BVHTree.FromPolygons(points, triangles[1], all_triangles=True)
cape = BVHTree.FromPolygons(points, triangles[3], all_triangles=True)
pairs = shirt.overlap(cape)
print(json.dumps({'pairs':len(pairs), 'jacketCenters':[[round(c,5) for c in sum((points[i] for i in triangles[3][j]),Vector())/3] for _,j in pairs]}))
details = []
for j in sorted({j for _, j in pairs}):
    vertices = []
    for i in triangles[3][j]:
        hit, normal, _, distance = shirt.find_nearest(points[i])
        vertices.append({'point':list(points[i]), 'nearestDistance':distance, 'signedDistance':(points[i]-hit).dot(normal)})
    details.append(vertices)
print(json.dumps({'intersectingJacketTriangleVertices':details}))
evaluated.to_mesh_clear()
