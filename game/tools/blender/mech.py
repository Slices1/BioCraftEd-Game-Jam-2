# mech.glb: compact bipedal walker ~1.1 tall. Front = -Y.
reset()
R = mat("rust", "rust", rough=0.8, metal=0.3); RD = mat("rust_dark", "rustd", metal=0.2)
T = mat("teal", "teal", metal=0.4); S = mat("steel", "steel", rough=0.5, metal=0.7)
CORE = mat("core_emit", "cyan", emit=5.0); LAMP = mat("lamp_emit", "lamp", emit=3.0)

root = empty("mech")
hips = pivot("hips", (0, 0, 0.56), root)
legs = []
for side, x in (("L", 0.2), ("R", -0.2)):
    hp = pivot(f"hip_{side}", (x, 0, 0), hips)
    box(f"thigh_{side}", (0.15, 0.17, 0.28), (0, 0, -0.13), R, hp, bevel=0.02)
    kn = pivot(f"knee_{side}", (0, 0, -0.27), hp)
    cyl(f"kneejoint_{side}", 0.07, 0.18, (0, 0, 0), S, kn, rot=(0, math.pi / 2, 0))
    box(f"shin_{side}", (0.12, 0.14, 0.24), (0, 0.02, -0.13), RD, kn, bevel=0.015)
    box(f"foot_{side}", (0.2, 0.3, 0.07), (0, -0.04, -0.255), S, kn, bevel=0.015)
    legs.append((hp, kn))
box("pelvis", (0.5, 0.26, 0.12), (0, 0, 0), S, hips, bevel=0.02)

torso = pivot("torso", (0, 0, 0.06), hips)
box("hull", (0.64, 0.5, 0.36), (0, 0, 0.22), R, torso, bevel=0.04)
box("hull_front", (0.5, 0.06, 0.24), (0, -0.26, 0.2), RD, torso, bevel=0.02)
cyl("core_emit", 0.075, 0.05, (0, -0.3, 0.22), CORE, torso, rot=(math.pi / 2, 0, 0), verts=10)
cyl("core_ring", 0.1, 0.03, (0, -0.285, 0.22), S, torso, rot=(math.pi / 2, 0, 0), verts=10)
for i, x in enumerate((-0.18, 0.18)):
    box(f"vent_{i}", (0.1, 0.02, 0.03), (x, -0.296, 0.32), S, torso)
# cradle for the crow
box("cradle_base", (0.34, 0.3, 0.05), (0, 0.02, 0.425), T, torso, bevel=0.01)
for i, (x, y, sx, sy) in enumerate(((0.16, 0.02, 0.03, 0.3), (-0.16, 0.02, 0.03, 0.3), (0, 0.16, 0.34, 0.03))):
    box(f"cradle_rim_{i}", (sx, sy, 0.08), (x, y, 0.48), T, torso)
empty("pilot_seat", (0, 0.02, 0.45), torso)
# shoulders + sockets
for side, x in (("L", 0.36), ("R", -0.36)):
    box(f"shoulder_{side}", (0.1, 0.22, 0.16), (x, 0, 0.27), S, torso, bevel=0.02)
    empty(f"arm_{side}_socket", (x + (0.05 if x > 0 else -0.05), 0, 0.24), torso)
cyl("headlamp", 0.04, 0.05, (0.22, -0.27, 0.35), LAMP, torso, rot=(math.pi / 2, 0, 0), verts=8)
box("backpack", (0.36, 0.12, 0.26), (0, 0.29, 0.2), RD, torso, bevel=0.02)
cyl("exhaust", 0.03, 0.18, (0.12, 0.32, 0.38), S, torso, verts=6)
empty("back_socket", (0, 0.36, 0.22), torso)
empty("leg_mod_socket", (0, 0.0, -0.08), hips)

(hL, kL), (hR, kR) = legs
A = 0.45
anim("idle", (1, 48), [(torso, "location", [(1, (0, 0, 0.06)), (24, (0, 0, 0.045)), (48, (0, 0, 0.06))])])
anim("walk", (1, 24), [
    (hL, "rotation_euler", [(1, (A, 0, 0)), (13, (-A, 0, 0)), (24, (A, 0, 0))]),
    (hR, "rotation_euler", [(1, (-A, 0, 0)), (13, (A, 0, 0)), (24, (-A, 0, 0))]),
    (kL, "rotation_euler", [(1, (0, 0, 0)), (7, (-0.6, 0, 0)), (13, (0, 0, 0)), (24, (0, 0, 0))]),
    (kR, "rotation_euler", [(1, (0, 0, 0)), (13, (0, 0, 0)), (19, (-0.6, 0, 0)), (24, (0, 0, 0))]),
    (hips, "location", [(1, (0, 0, 0.56)), (7, (0, 0, 0.59)), (13, (0, 0, 0.56)), (19, (0, 0, 0.59)), (24, (0, 0, 0.56))]),
    (torso, "rotation_euler", [(1, (0, 0, 0.05)), (13, (0, 0, -0.05)), (24, (0, 0, 0.05))])])
SL = [(torso, "rotation_euler", None), (hips, "location", None)]
anim("off", (1, 2), [(torso, "rotation_euler", [(1, (-0.35, 0, 0.08)), (24, (-0.37, 0, 0.08)), (48, (-0.35, 0, 0.08))]),
                     (hips, "location", [(1, (0, 0, 0.44)), (2, (0, 0, 0.44))]),
                     (kL, "rotation_euler", [(1, (-0.5, 0, 0)), (2, (-0.5, 0, 0))]),
                     (kR, "rotation_euler", [(1, (-0.5, 0, 0)), (2, (-0.5, 0, 0))]),
                     (hL, "rotation_euler", [(1, (0.5, 0, 0)), (2, (0.5, 0, 0))]),
                     (hR, "rotation_euler", [(1, (0.5, 0, 0)), (2, (0.5, 0, 0))])])
anim("boot", (1, 36), [(torso, "rotation_euler", [(1, (-0.35, 0, 0.08)), (14, (-0.3, 0, -0.06)), (28, (0.08, 0, 0)), (36, (0, 0, 0))]),
                       (hips, "location", [(1, (0, 0, 0.44)), (20, (0, 0, 0.5)), (30, (0, 0, 0.58)), (36, (0, 0, 0.56))]),
                       (kL, "rotation_euler", [(1, (-0.5, 0, 0)), (30, (0, 0, 0)), (36, (0, 0, 0))]),
                       (kR, "rotation_euler", [(1, (-0.5, 0, 0)), (30, (0, 0, 0)), (36, (0, 0, 0))]),
                       (hL, "rotation_euler", [(1, (0.5, 0, 0)), (30, (0, 0, 0)), (36, (0, 0, 0))]),
                       (hR, "rotation_euler", [(1, (0.5, 0, 0)), (30, (0, 0, 0)), (36, (0, 0, 0))])])
anim("push", (1, 24), [(torso, "rotation_euler", [(1, (0.25, 0, 0)), (12, (0.3, 0, 0)), (24, (0.25, 0, 0))]),
                       (hL, "rotation_euler", [(1, (0.35, 0, 0)), (12, (-0.2, 0, 0)), (24, (0.35, 0, 0))]),
                       (hR, "rotation_euler", [(1, (-0.2, 0, 0)), (12, (0.35, 0, 0)), (24, (-0.2, 0, 0))])])
anim("jackin", (1, 36), [(torso, "rotation_euler", [(1, (0, 0, 0)), (8, (0.15, 0, 0)), (12, (0.1, 0, 0)), (14, (0.14, 0, 0.03)), (16, (0.1, 0, -0.03)), (28, (0.12, 0, 0)), (36, (0, 0, 0))])])
anim("hop", (1, 20), [(hips, "location", [(1, (0, 0, 0.56)), (5, (0, 0, 0.42)), (10, (0, 0, 0.95)), (16, (0, 0, 0.5)), (20, (0, 0, 0.56))]),
                      (kL, "rotation_euler", [(1, (0, 0, 0)), (5, (-0.9, 0, 0)), (10, (-0.2, 0, 0)), (16, (-0.6, 0, 0)), (20, (0, 0, 0))]),
                      (kR, "rotation_euler", [(1, (0, 0, 0)), (5, (-0.9, 0, 0)), (10, (-0.2, 0, 0)), (16, (-0.6, 0, 0)), (20, (0, 0, 0))]),
                      (hL, "rotation_euler", [(1, (0, 0, 0)), (5, (0.6, 0, 0)), (10, (0.1, 0, 0)), (16, (0.4, 0, 0)), (20, (0, 0, 0))]),
                      (hR, "rotation_euler", [(1, (0, 0, 0)), (5, (0.6, 0, 0)), (10, (0.1, 0, 0)), (16, (0.4, 0, 0)), (20, (0, 0, 0))])])
result = export("mech")
