"""Split the Sayyed House GLB into per-floor nodes so the website can isolate,
explode and highlight single floors. Output: website/private/models/sahil_floors.glb
(uncompressed; compress afterwards with gltf-transform).

Node naming: <LEVEL>_<Category>, LEVEL in {B (basement), G (ground), F01..F22, T (terrace)}.
"""
import json, sys
import numpy as np, trimesh

SRC = sys.argv[1] if len(sys.argv) > 1 else '../sayyed_house_full.glb'   # source model (kept outside the web repo)
OUT_CORE = 'private/models/sahil_core.glb'      # exterior shell, loaded first
OUT_DETAIL = 'private/models/sahil_detail.glb'  # interiors / structure, loaded when idle
CORE = {'ArchWalls', 'Glass', 'WindowFrames', 'Chajja', 'Slabs', 'Parapets', 'Terrace',
        'TerraceWalls', 'TerraceCore', 'OverheadTank', 'LMR', 'Plot', 'Water'}
spec = json.load(open(sys.argv[2] if len(sys.argv) > 2 else '../building_spec.json'))
lv = spec['model_summary']['levels_m']
levels = [('G', lv['GF'])] + [('F%02d' % i, lv[str(i)]) for i in range(1, 23)] + [('T', lv['TERR'])]

def level_of(y):
    """Return level key for a centroid height y (glTF Y-up, metres, ground = 0)."""
    if y < lv['GF'] - 0.16:
        return 'B'
    for i, (k, z) in enumerate(levels):
        nxt = levels[i + 1][1] if i + 1 < len(levels) else 1e9
        if z - 0.16 <= y < nxt - 0.16:
            return k
    return 'T'

# Full-height elements (core walls, lift shaft) must be cut at the floor planes rather
# than bucketed by centroid, otherwise a 60 m wall lands in one floor's node.
SLICE = {'ShearWalls_300', 'ShearWalls_230', 'LiftShaft'}
cuts = sorted(z - 0.16 for _, z in levels)          # plane heights between floors

def slice_by_floors(mesh):
    """Return list of submesh pieces of mesh cut at every floor plane. Each piece is cut
    from the original mesh (two planes), so cap triangles never accumulate."""
    pieces = []
    bounds = [-1e3] + cuts + [1e3]
    ymin, ymax = mesh.bounds[0][1], mesh.bounds[1][1]
    for lo_z, hi_z in zip(bounds[:-1], bounds[1:]):
        if hi_z <= ymin or lo_z >= ymax:
            continue
        piece = mesh
        if lo_z > ymin:
            piece = trimesh.intersections.slice_mesh_plane(piece, plane_normal=[0, 1, 0], plane_origin=[0, lo_z, 0], cap=True)
        if piece is None or piece.is_empty:
            continue
        if hi_z < ymax:
            piece = trimesh.intersections.slice_mesh_plane(piece, plane_normal=[0, -1, 0], plane_origin=[0, hi_z, 0], cap=True)
        if piece is not None and not piece.is_empty and len(piece.faces):
            pieces.append(piece)
    return pieces

scene = trimesh.load(SRC, force='scene')
core, detail = trimesh.Scene(), trimesh.Scene()
counts = {}
for name, geom in scene.geometry.items():
    if not isinstance(geom, trimesh.Trimesh):
        continue
    # geometry names in the file match node names
    cat = name
    if cat in SLICE:
        geom = trimesh.util.concatenate(slice_by_floors(geom))
    cent = geom.triangles_center[:, 1]
    keys = np.array([level_of(y) for y in cent])
    for k in np.unique(keys):
        sub = geom.submesh([np.where(keys == k)[0]], append=True)
        sub.visual = trimesh.visual.ColorVisuals()  # drop vertex colours; materials set in three.js
        sub.merge_vertices()
        nname = f'{k}_{cat}'
        (core if cat in CORE else detail).add_geometry(sub, node_name=nname, geom_name=nname)
        counts[nname] = len(sub.faces)
core.export(OUT_CORE)
detail.export(OUT_DETAIL)
print('nodes', len(counts), 'tris', sum(counts.values()))
for k in sorted(counts):
    print(k, counts[k])
