"""Stilizuota seimos figurele (mama, sunus, dukra, tetis, susikibe rankomis) -> STL.
Matmenys mm. Paleidimas: python3 make_figurine.py [isvesties.stl]
"""
import sys
import numpy as np
from skimage import measure
import trimesh

VOX = 0.4
xs = np.arange(-72.13, 72 + VOX, VOX, dtype=np.float32)
ys = np.arange(-23.17, 23 + VOX, VOX, dtype=np.float32)
zs = np.arange(-1.11, 105 + VOX, VOX, dtype=np.float32)
X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij", sparse=True)


def capsule(a, b, r, sx=1.0):
    """Kapsule nuo a iki b; sx>1 isplecia x kryptimi (a.x == b.x)."""
    a = np.array(a, np.float32); b = np.array(b, np.float32)
    px = (X - a[0]) / sx; py = Y - a[1]; pz = Z - a[2]
    ba = b - a; ba[0] /= sx
    h = np.clip((px * ba[0] + py * ba[1] + pz * ba[2]) / float(ba @ ba), 0, 1)
    return np.sqrt((px - ba[0] * h) ** 2 + (py - ba[1] * h) ** 2 + (pz - ba[2] * h) ** 2) - r


def ellipsoid(c, r):
    k = np.sqrt(((X - c[0]) / r[0]) ** 2 + ((Y - c[1]) / r[1]) ** 2 + ((Z - c[2]) / r[2]) ** 2)
    return (k - 1) * min(r)


def cone(cx, cy, z0, r0, z1, r1, ysq=0.8, rnd=1.0):
    """Vertikalus nupjautas kugis (suknele): z0 apacia (r0), z1 virsus (r1)."""
    t = np.clip((Z - z0) / (z1 - z0), 0, 1)
    R = r0 + (r1 - r0) * t - rnd
    rad = np.sqrt((X - cx) ** 2 + ((Y - cy) / ysq) ** 2)
    d = np.maximum(rad - R, np.abs(Z - (z0 + z1) / 2) - (z1 - z0) / 2 + rnd)
    return d - rnd


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def union(parts, k):
    d = parts[0]
    for p in parts[1:]:
        d = smin(d, p, k)
    return d


def arm(sh, hand, r, elbow=None):
    pts = [sh] + ([elbow] if elbow else []) + [hand]
    segs = [capsule(pts[i], pts[i + 1], r) for i in range(len(pts) - 1)]
    segs.append(ellipsoid(hand, (r * 1.25,) * 3))
    return segs


def legs(cx, hipz, r, dx, shoe):
    out = []
    for s in (-1, 1):
        out.append(capsule((cx + s * dx, 0, hipz), (cx + s * dx * 1.15, 0, 1.0 + r), r))
        out.append(capsule((cx + s * dx * 1.15, 1, 1.2 + shoe), (cx + s * dx * 1.2, -r - 3.5, 1.2 + shoe), shoe))
    return out


# rankų susikibimo taškai
A = (-29, -2, 43)   # mama - sunus
B = (0.5, -2, 29)   # sunus - dukra
C = (27, -2, 42)    # dukra - tetis

figs = []

# --- MAMA (ilgi plaukai, suknele iki keliu) ---
cx = -44
p = legs(cx, 40, 4.0, 4.5, 3.0)
p += [cone(cx, 0, 33, 15.5, 60, 8.5),
      capsule((cx, 0, 57), (cx, 0, 68), 8.0, sx=1.2),
      capsule((cx - 9, 0, 71), (cx + 9, 0, 71), 4.2),
      capsule((cx, 0, 72), (cx, 0, 78), 3.2),
      ellipsoid((cx, 0, 83.5), (6.8, 7.5, 8.5)),
      ellipsoid((cx, 1.2, 84.8), (7.7, 8.2, 8.3)),          # plauku kepure
      ellipsoid((cx, 5.5, 70), (9.5, 4.5, 17)),             # plaukai ant nugaros
      capsule((cx - 6.8, -0.5, 82), (cx - 8.5, -5.0, 61), 2.6),
      capsule((cx + 6.8, -0.5, 82), (cx + 8.5, -5.0, 61), 2.6)]
p += arm((cx - 10.5, 0, 70.5), (cx - 13.5, -2, 42), 3.0, elbow=(cx - 13.5, 1, 56))
p += arm((cx + 10.5, 0, 70.5), A, 3.0, elbow=(cx + 14, 1, 56))
mom = union(p, 1.5)
# veidas - isimti plaukus is priekio
face = ellipsoid((cx, -4.5, 82.5), (5.6, 5.0, 7.0))
figs.append(mom)

# --- TETIS (polo, kelnes, trumpi plaukai) ---
cx = 43
p = legs(cx, 48, 5.2, 5.5, 3.6)
p += [capsule((cx, 0, 51), (cx, 0, 73), 9.6, sx=1.3),
      capsule((cx - 11, 0, 77.5), (cx + 11, 0, 77.5), 5.2),
      capsule((cx, 0, 79), (cx, 0, 85), 3.8),
      ellipsoid((cx, 0, 91), (7.3, 8.0, 9.0)),
      ellipsoid((cx, 1.0, 92.6), (7.7, 8.3, 8.0)),          # trumpi plaukai
      capsule((cx - 3.5, -8.5, 80.5), (cx + 3.5, -8.5, 80.5), 1.3)]  # apykakle
p += arm((cx + 13, 0, 77), (cx + 16, -2, 45), 3.7, elbow=(cx + 16.5, 1, 61))
p += arm((cx - 13, 0, 77), C, 3.7, elbow=(cx - 16.5, 1, 60))
figs.append(union(p, 1.5))

# --- SUNUS (marskineliai, sortai) ---
cx = -15
p = legs(cx, 20, 3.5, 3.6, 2.6)
p += [capsule((cx, 0, 21), (cx, 0, 31.5), 6.6, sx=1.15),
      cone(cx, 0, 15, 8.2, 22, 7.2, ysq=0.85, rnd=0.8),      # sortai
      capsule((cx - 5, 0, 35), (cx + 5, 0, 35), 3.2),
      capsule((cx, 0, 35), (cx, 0, 39), 2.6),
      ellipsoid((cx, 0, 44.8), (6.3, 6.8, 7.2)),
      ellipsoid((cx, 0.8, 46.0), (6.7, 7.1, 6.6))]
p += arm((cx - 7, 0, 35), A, 2.4, elbow=(cx - 12.5, 0, 34))
p += arm((cx + 7, 0, 35), B, 2.4)
figs.append(union(p, 1.1))

# --- DUKRA (garbanos, puri suknele) ---
cx = 15
p = legs(cx, 14, 2.8, 3.0, 2.3)
p += [cone(cx, 0, 11, 11.5, 25, 5.5, ysq=0.9),
      capsule((cx, 0, 21), (cx, 0, 26), 5.4, sx=1.1),
      capsule((cx - 4.3, 0, 28.5), (cx + 4.3, 0, 28.5), 2.9),
      capsule((cx, 0, 28), (cx, 0, 32), 2.3),
      ellipsoid((cx, 0, 37.2), (6.0, 6.4, 6.8))]
rng = np.random.default_rng(3)
for th in np.linspace(0, 2 * np.pi, 13)[:-1]:           # garbanos
    for ph in (0.25, 0.75, 1.2):
        d = np.array([np.cos(th) * np.cos(ph), np.sin(th) * np.cos(ph), np.sin(ph)])
        if d[1] < -0.45 and ph < 1.0:
            continue  # veidas lieka atviras
        c = np.array([cx, 0.5, 37.6]) + d * np.array([6.4, 6.8, 7.0]) + rng.normal(0, 0.35, 3)
        p.append(ellipsoid(tuple(c), (2.5,) * 3))
p.append(ellipsoid((cx, 0.5, 44.2), (2.6,) * 3))
p += arm((cx - 6, 0, 28.5), B, 2.2)
p += arm((cx + 6, 0, 28.5), C, 2.2, elbow=(cx + 10, 0, 33))
figs.append(union(p, 0.9))

# --- PAGRINDAS ---
qx = np.abs(X) - 47.0
base2d = np.sqrt(np.maximum(qx, 0) ** 2 + Y ** 2) - 19.0
base = np.maximum(base2d, np.abs(Z - 1.5) - 1.5) 
base = np.maximum(base, base2d + (Z - 2.2) * 0.9)        # nuozulna virsuje

sdf = base + 0 * X
for f in figs:
    sdf = smin(sdf, f, 0.8)
sdf = np.maximum(sdf, -Z)  # plokscias dugnas z=0

verts, faces, _, _ = measure.marching_cubes(sdf, 0.0, spacing=(VOX,) * 3)
verts += np.array([xs[0], ys[0], zs[0]])
m = trimesh.Trimesh(verts, faces, process=True)
m = max(m.split(only_watertight=False), key=lambda c: len(c.faces))  # tik pagrindinis kunas
import fast_simplification
v, f = fast_simplification.simplify(m.vertices, m.faces, target_count=300000)
m = trimesh.Trimesh(v, f, process=True)
m.update_faces(m.nondegenerate_faces()); m.remove_unreferenced_vertices()
trimesh.repair.fill_holes(m); trimesh.repair.fix_normals(m)
out = sys.argv[1] if len(sys.argv) > 1 else "seimos_figurele.stl"
m.export(out)
print(out, "faces", len(m.faces), "watertight", m.is_watertight, "bodies", m.body_count,
      "size", m.extents.round(1), "vol cm3", round(m.volume / 1000, 1))
