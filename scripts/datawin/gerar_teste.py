"""Gera um data.win de teste (GMS 2.3 / bytecode 17, ou GMS 1.4 / bytecode 16 com --gms1) para testar a extensão data.win.

Uso: python3 scripts/datawin/gerar_teste.py build/teste-data.win [--gms1]
"""
import bz2, io, struct, sys, zlib
GMS1 = '--gms1' in sys.argv
sys.argv = [a for a in sys.argv if a != '--gms1']

# ------------------------------------------------------------------ imagens
def png(w, h, px):
    raw = b''.join(b'\x00' + bytes(sum((px(x, y) for x in range(w)), ())) for y in range(h))
    def ch(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + \
        ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')

def qoi_gm(w, h, px):
    """QOI do GameMaker: só operações COLOR e RUN_8 (válidas no decodificador)."""
    out = bytearray()
    prev = (0, 0, 0, 255)
    run = 0
    pixels = [px(x, y) for y in range(h) for x in range(w)]
    i = 0
    for p in pixels:
        if p == prev and i > 0:
            run += 1
            if run == 32:
                out.append(0x40 | 31); run = 0
            i += 1
            continue
        if run:
            out.append(0x40 | (run - 1)); run = 0
        out.append(0xf0 | 0xf)
        out += bytes(p)
        prev = p
        i += 1
    if run:
        out.append(0x40 | (run - 1))
    # o primeiro pixel tem que ser escrito (prev começa como 0,0,0,255)
    return b'fioq' + struct.pack('<HHI', w, h, len(out)) + bytes(out)

def tex0(x, y):
    # 64x64: jogador (0,0)-(15,15) quadro 1 azul, (16..31,0..15) quadro 2 azul claro, moeda (32..39,0..7),
    # parede (48..63,0..15) cinza, tileset em (0,16)-(31,31): tile0 vazio, tile1 verde (16..31)
    if y < 16 and x < 16: return (40, 90, 230, 255) if not (5 <= x <= 6 and 4 <= y <= 6) else (255, 255, 255, 255)
    if y < 16 and 16 <= x < 32: return (90, 160, 255, 255)
    if y < 8 and 32 <= x < 40: return (255, 210, 40, 255)
    if y < 16 and 48 <= x < 64: return (120, 120, 120, 255)
    if 16 <= y < 32 and 16 <= x < 32: return (60, 180, 70, 255)
    return (0, 0, 0, 0)

def tex1(x, y):
    return (200, 40, 40, 255) if ((x // 8) + (y // 8)) % 2 == 0 else (250, 240, 230, 255)

# ------------------------------------------------------------------ escritor
class W:
    def __init__(self):
        self.b = bytearray()
        self.patches = []  # (pos, label)
        self.labels = {}
    def pos(self): return len(self.b)
    def u8(self, v): self.b += struct.pack('<B', v)
    def u16(self, v): self.b += struct.pack('<H', v & 0xffff)
    def i16(self, v): self.b += struct.pack('<h', v)
    def u32(self, v): self.b += struct.pack('<I', v & 0xffffffff)
    def i32(self, v): self.b += struct.pack('<i', v)
    def f32(self, v): self.b += struct.pack('<f', v)
    def f64(self, v): self.b += struct.pack('<d', v)
    def raw(self, d): self.b += d
    def ptr(self, label): self.patches.append((self.pos(), label)); self.u32(0)
    def mark(self, label): self.labels[label] = self.pos()
    def align(self, n):
        while len(self.b) % n: self.b.append(0)
    def resolve(self):
        for p, l in self.patches:
            struct.pack_into('<I', self.b, p, self.labels[l] if l is not None else 0)

w = W()
strings = []
def S(s):
    if s not in strings: strings.append(s)
    return 'str:' + s

# ------------------------------------------------------------------ montador GML
VARS = []   # (nome, instType)
FUNCS = []
def var(nome, inst=-1):
    k = (nome, inst)
    if k not in VARS: VARS.append(k)
    return VARS.index(k)
def func(nome):
    if nome not in FUNCS: FUNCS.append(nome)
    return FUNCS.index(nome)

T = dict(d=0, f=1, i=2, l=3, b=4, v=5, s=6, e=15)
class Asm:
    def __init__(self, nome):
        self.nome = nome; self.ws = []; self.refs = []; self.labels = {}; self.jumps = []
    def w(self, x): self.ws.append(x & 0xffffffff)
    def label(self, n): self.labels[n] = len(self.ws)
    def pushi(self, v): self.w((0x84 << 24) | (15 << 16) | (v & 0xffff))
    def push_d(self, v):
        self.w((0xC0 << 24) | (0 << 16)); d = struct.pack('<d', v); self.w(struct.unpack('<I', d[:4])[0]); self.w(struct.unpack('<I', d[4:])[0])
    def push_s(self, s):
        if s not in strings: strings.append(s)
        self.w((0xC0 << 24) | (6 << 16)); self.w(strings.index(s))
    def pushv(self, nome, inst=-1, op=0xC0, vt=0xA0, varinst=None):
        vid = var(nome, inst if varinst is None else varinst)
        self.w((op << 24) | (5 << 16) | (inst & 0xffff)); self.refs.append((len(self.ws), 'v', vid, vt)); self.w(0)
    def pushglb(self, nome): self.pushv(nome, -5, 0xC2)
    def popv(self, nome, inst=-1, t1='v', t2='v', vt=0xA0, varinst=None):
        vid = var(nome, inst if varinst is None else varinst)
        self.w((0x45 << 24) | ((T[t2] << 4 | T[t1]) << 16) | (inst & 0xffff)); self.refs.append((len(self.ws), 'v', vid, vt)); self.w(0)
    def op2(self, op, t1, t2): self.w((op << 24) | ((T[t2] << 4 | T[t1]) << 16))
    def add(self, t1='v', t2='v'): self.op2(0x0C, t1, t2)
    def sub(self, t1='v', t2='v'): self.op2(0x0D, t1, t2)
    def mul(self, t1='v', t2='v'): self.op2(0x08, t1, t2)
    def conv(self, a, b): self.op2(0x07, a, b)
    def cmp(self, c, t1='v', t2='v'): self.w((0x15 << 24) | ((T[t2] << 4 | T[t1]) << 16) | (c << 8))
    def br(self, op, lab): self.jumps.append((len(self.ws), lab, op)); self.w(op << 24)
    def b(self, lab): self.br(0xB6, lab)
    def bt(self, lab): self.br(0xB7, lab)
    def bf(self, lab): self.br(0xB8, lab)
    def pushenv(self, lab): self.br(0xBA, lab)
    def popenv(self, lab): self.br(0xBB, lab)
    def call(self, nome, argc):
        fid = func(nome); self.w((0xD9 << 24) | (2 << 16) | argc); self.refs.append((len(self.ws), 'f', fid, 0)); self.w(0)
    def popz(self): self.w((0x9E << 24) | (5 << 16))
    def dup(self, t='v', n=0): self.w((0x86 << 24) | (T[t] << 16) | n)
    def ret(self): self.w((0x9C << 24) | (5 << 16))
    def exit(self): self.w((0x9D << 24) | (2 << 16))
    def fim(self):
        for i, lab, op in self.jumps:
            off = self.labels[lab] - i
            self.ws[i] = (op << 24) | (off & 0x7fffff)
        return self

OBJ = {'obj_player': 0, 'obj_coin': 1, 'obj_wall': 2}
codes = []

# script função dobro(n) = n * 2 (GMS 2.3: código gml_Script_scr_dobro)
a = Asm('gml_Script_scr_dobro')
a.pushv('argument0', -1); a.pushi(2); a.mul('i', 'v'); a.ret(); codes.append(a.fim())

# obj_player Create
a = Asm('gml_Object_obj_player_Create_0')
a.pushi(3); a.popv('velocidade', -1, 'v', 'i')
a.pushi(0); a.popv('coins', -5, 'v', 'i')
a.pushi(0); a.popv('contador', -5, 'v', 'i')
# with (obj_coin) global.contador += 1
a.pushi(OBJ['obj_coin']); a.pushenv('fimwith'); a.label('corpo')
a.pushglb('contador'); a.pushi(1); a.add('i', 'v'); a.popv('contador', -5)
a.label('fimwith'); a.popenv('corpo')
# global.dobro = scr_dobro(21)
a.pushi(21); a.conv('i', 'v'); a.call('gml_Script_scr_dobro', 1); a.popv('dobro', -5)
# arr[0] = 10; arr[1] = 20; global.soma = arr[0] + arr[1]
for k, val in ((0, 10), (1, 20)):
    a.pushi(val); a.conv('i', 'v'); a.pushi(-1); a.pushi(k); a.popv('arr', -1, 'v', 'v', vt=0x00)
a.pushi(-1); a.pushi(0); a.pushv('arr', -1, vt=0x00); a.pushi(-1); a.pushi(1); a.pushv('arr', -1, vt=0x00); a.add(); a.popv('soma', -5)
# global.texto = "Moedas: " + string(5)
a.push_s('Moedas: '); a.pushi(5); a.conv('i', 'v'); a.call('string', 1); a.add('v', 's'); a.popv('texto', -5)
codes.append(a.fim())

# obj_player Step: if keyboard_check(vk_right) x += velocidade ; if global.coins >= 3 room_goto(1)
a = Asm('gml_Object_obj_player_Step_0')
a.pushi(39); a.conv('i', 'v'); a.call('keyboard_check', 1); a.conv('v', 'b'); a.bf('semdir')
a.pushv('x'); a.pushv('velocidade'); a.add(); a.popv('x')
a.label('semdir')
a.pushglb('coins'); a.pushi(3); a.cmp(5, 'i', 'v'); a.bf('fim')
a.pushi(1); a.conv('i', 'v'); a.call('room_goto', 1); a.popz()
a.label('fim'); codes.append(a.fim())

# obj_player colisão com obj_coin: global.coins += 1; with (other) instance_destroy()
a = Asm('gml_Object_obj_player_Collision_obj_coin')
a.pushglb('coins'); a.pushi(1); a.add('i', 'v'); a.popv('coins', -5)
a.pushi(-2); a.pushenv('f2'); a.label('c2')
a.call('instance_destroy', 0); a.popz()
a.label('f2'); a.popenv('c2'); codes.append(a.fim())

# obj_player Draw: draw_self(); draw_text(4, 4, "Moedas: " + string(global.coins))
a = Asm('gml_Object_obj_player_Draw_0')
a.call('draw_self', 0); a.popz()
a.pushi(0); a.conv('i', 'v'); a.call('draw_set_font', 1); a.popz()
a.push_s('Moedas: '); a.pushglb('coins'); a.call('string', 1); a.add('v', 's')
a.pushi(4); a.conv('i', 'v'); a.pushi(4); a.conv('i', 'v'); a.call('draw_text', 3); a.popz()
codes.append(a.fim())

# obj_coin Step: image_angle += 5
a = Asm('gml_Object_obj_coin_Step_0')
a.pushv('image_angle'); a.pushi(5); a.add('i', 'v'); a.popv('image_angle'); codes.append(a.fim())

# sala 2: código de criação: global.fim = 1
a = Asm('gml_Room_rm_fim_Create')
a.pushi(1); a.popv('fim', -5, 'v', 'i'); codes.append(a.fim())

CODE = {c.nome: i for i, c in enumerate(codes)}

# ------------------------------------------------------------------ arquivo
w.raw(b'FORM'); w.u32(0)
chunks = []
def chunk(nome):
    w.raw(nome.encode()); p = w.pos(); w.u32(0); chunks.append((nome, p))
    return p
def fecha(p):
    struct.pack_into('<I', w.b, p, w.pos() - p - 4)

# GEN8
p = chunk('GEN8')
w.u8(1); w.u8(16 if GMS1 else 17); w.u16(0)
w.ptr(S('teste')); w.ptr(S('Default')); w.u32(100100); w.u32(10000000); w.u32(1234)
w.raw(b'\0' * 16); w.ptr(S('teste')); [w.u32(v) for v in ((1, 4, 1804, 0) if GMS1 else (2, 0, 0, 0))]
w.u32(320); w.u32(240); w.u32(0); w.u32(0); w.raw(b'\0' * 16); w.raw(b'\0' * 8)
w.ptr(S('Jogo de Teste')); w.raw(b'\0' * 8); w.raw(b'\0' * 8); w.i32(0); w.u32(0)
w.u32(2); w.u32(0); w.u32(1)  # ordem das salas
if not GMS1:
    w.raw(b'\0' * 40); w.f32(30.0); w.u32(0); w.raw(b'\0' * 16)
fecha(p)

# OPTN (vazio de propósito) e SEQN (marca 2.3)
if not GMS1:
    p = chunk('SEQN'); w.u32(0); fecha(p)

# TXTR
img0 = png(64, 64, tex0)
img1 = qoi_gm(32, 32, tex1)
qoi_bz = bz2.compress(img1)
img1b = b'2zoq' + struct.pack('<HH', 32, 32) + struct.pack('<I', len(img1)) + qoi_bz
p = chunk('TXTR'); w.u32(2); w.ptr('tx0'); w.ptr('tx1')
for k in range(2):
    w.mark(f'tx{k}'); w.u32(0); w.u32(0); w.ptr(f'txd{k}')
w.align(128); w.mark('txd0'); w.raw(img0); w.align(128); w.mark('txd1'); w.raw(img1b)
fecha(p)

# TPAG
TP = [  # sx, sy, sw, sh, tx, ty, tw, th, bw, bh, tex
    (0, 0, 16, 16, 0, 0, 16, 16, 16, 16, 0),
    (16, 0, 16, 16, 0, 0, 16, 16, 16, 16, 0),
    (32, 0, 8, 8, 0, 0, 8, 8, 8, 8, 0),
    (48, 0, 16, 16, 0, 0, 16, 16, 16, 16, 0),
    (0, 16, 32, 16, 0, 0, 32, 16, 32, 16, 0),   # tileset (2 tiles)
    (0, 0, 32, 32, 0, 0, 32, 32, 32, 32, 1),    # fundo xadrez (textura qoi+bz2)
]
p = chunk('TPAG'); w.u32(len(TP))
for k in range(len(TP)): w.ptr(f'tp{k}')
for k, t in enumerate(TP):
    w.mark(f'tp{k}'); [w.u16(v) for v in t[:10]]; w.i16(t[10])
w.align(4); fecha(p)

# SPRT
SP = [('spr_player', 16, 16, 8, 8, [0, 1]), ('spr_coin', 8, 8, 4, 4, [2]), ('spr_wall', 16, 16, 0, 0, [3]),
      ('spr_bg', 32, 32, 0, 0, [5])]
p = chunk('SPRT'); w.u32(len(SP))
for k in range(len(SP)): w.ptr(f'sp{k}')
for k, (nome, sw, sh, ox, oy, tps) in enumerate(SP):
    w.mark(f'sp{k}'); w.ptr(S(nome)); w.u32(sw); w.u32(sh); w.i32(0); w.i32(sw - 1); w.i32(sh - 1); w.i32(0)
    w.u32(1); w.u32(0); w.u32(0); w.u32(2); w.u32(0); w.i32(ox); w.i32(oy)
    if not GMS1:
        w.i32(-1); w.u32(1); w.u32(0); w.f32(1.0); w.u32(1)  # GMS2 v1: velocidade 1 quadro/frame
    w.u32(len(tps)); [w.ptr(f'tp{t}') for t in tps]
    w.u32(0)  # sem máscaras
fecha(p)

# BGND (tileset)
if GMS1:
    p = chunk('BGND'); w.u32(2); w.ptr('bg0'); w.ptr('bg1')
    w.mark('bg0'); w.ptr(S('bg_tiles')); w.u32(0); w.u32(0); w.u32(0); w.ptr('tp4')
    w.mark('bg1'); w.ptr(S('bg_xadrez')); w.u32(0); w.u32(0); w.u32(0); w.ptr('tp5')
    fecha(p)
else:
    p = chunk('BGND'); w.u32(1); w.ptr('bg0')
    w.mark('bg0'); w.ptr(S('ts_grama')); w.u32(0); w.u32(0); w.u32(0); w.ptr('tp4')
    w.u32(2); w.u32(16); w.u32(16); w.u32(0); w.u32(0); w.u32(2); w.u32(1); w.u32(2); w.raw(b'\0' * 8)
    w.u32(0); w.u32(1)
    fecha(p)

# OBJT
EVS = {
    'obj_player': {0: [(0, 'gml_Object_obj_player_Create_0')], 3: [(0, 'gml_Object_obj_player_Step_0')],
                   4: [(1, 'gml_Object_obj_player_Collision_obj_coin')], 8: [(0, 'gml_Object_obj_player_Draw_0')]},
    'obj_coin': {3: [(0, 'gml_Object_obj_coin_Step_0')]},
    'obj_wall': {},
}
OBJS = [('obj_player', 0, False), ('obj_coin', 1, False), ('obj_wall', 2, True)]
p = chunk('OBJT'); w.u32(len(OBJS))
for k in range(len(OBJS)): w.ptr(f'ob{k}')
for k, (nome, spr, solido) in enumerate(OBJS):
    w.mark(f'ob{k}'); w.ptr(S(nome)); w.i32(spr); w.u32(1); w.u32(int(solido)); w.i32(0); w.u32(0); w.i32(-100); w.i32(-1)
    w.u32(0); w.u32(0); w.u32(1); w.f32(0.5); w.f32(0.1); w.u32(0); w.f32(0.1); w.f32(0.1); w.i32(0); w.f32(0.2); w.u32(1); w.u32(0)
    w.u32(15)
    for t in range(15): w.ptr(f'ob{k}t{t}')
    for t in range(15):
        evs = EVS[nome].get(t, [])
        w.mark(f'ob{k}t{t}'); w.u32(len(evs))
        for j in range(len(evs)): w.ptr(f'ob{k}t{t}e{j}')
        for j, (sub, cod) in enumerate(evs):
            w.mark(f'ob{k}t{t}e{j}'); w.u32(sub); w.u32(1); w.ptr(f'ob{k}t{t}e{j}a')
            w.mark(f'ob{k}t{t}e{j}a'); w.u32(1); w.u32(603); w.u32(7); w.u32(0); w.u32(0); w.u32(1); w.u32(2)
            w.ptr(S('')); w.i32(CODE[cod]); w.u32(1); w.i32(-1); w.u32(0); w.u32(0); w.u32(0)
fecha(p)

# ROOM
SALAS = [
    ('rm_teste', 320, 240, [(100001, 0, 40, 120), (100002, 1, 80, 120), (100003, 1, 120, 120), (100004, 1, 160, 120),
                            (100005, 2, 200, 100)], -1),
    ('rm_fim', 320, 240, [], CODE['gml_Room_rm_fim_Create']),
]
p = chunk('ROOM'); w.u32(len(SALAS))
for k in range(len(SALAS)): w.ptr(f'rm{k}')
for k, (nome, rw, rh, insts, cc) in enumerate(SALAS):
    w.mark(f'rm{k}'); w.ptr(S(nome)); w.ptr(S('')); w.u32(rw); w.u32(rh); w.u32(30); w.u32(0); w.u32(0x402010); w.u32(1)
    w.i32(cc); w.u32(1 if (GMS1 and k == 0) else 0x30000)
    w.ptr(f'rm{k}b'); w.ptr(f'rm{k}v'); w.ptr(f'rm{k}o'); w.ptr(f'rm{k}t')
    w.u32(0); w.u32(0); w.u32(0); w.u32(rw); w.u32(rh); w.f32(0); w.f32(20); w.f32(0.1)
    if not GMS1:
        w.ptr(f'rm{k}l'); w.ptr(f'rm{k}s')
    if GMS1 and k == 0:
        w.mark(f'rm{k}b'); w.u32(1); w.ptr(f'rm{k}b0')
        w.mark(f'rm{k}b0'); w.u32(1); w.u32(0); w.i32(1); w.i32(0); w.i32(0); w.i32(1); w.i32(1); w.i32(1); w.i32(0); w.u32(0)
        w.mark(f'rm{k}v'); w.u32(1); w.ptr(f'rm{k}v0')
        w.mark(f'rm{k}v0'); w.u32(1); w.i32(0); w.i32(0); w.i32(160); w.i32(120); w.i32(0); w.i32(0); w.i32(320); w.i32(240)
        w.u32(64); w.u32(32); w.i32(-1); w.i32(-1); w.i32(0)
    else:
        w.mark(f'rm{k}b'); w.u32(0)
        w.mark(f'rm{k}v'); w.u32(0)
    w.mark(f'rm{k}o'); w.u32(len(insts))
    for j in range(len(insts)): w.ptr(f'rm{k}o{j}')
    for j, (iid, obj, x, y) in enumerate(insts):
        w.mark(f'rm{k}o{j}'); w.i32(x); w.i32(y); w.i32(obj); w.u32(iid); w.i32(-1); w.f32(1); w.f32(1)
        if not GMS1:
            w.f32(1); w.i32(0)
        w.u32(0xffffffff); w.f32(0); w.i32(-1)
    if GMS1 and k == 0:
        w.mark(f'rm{k}t'); w.u32(20)
        for j in range(20): w.ptr(f'rm{k}t{j}')
        for j in range(20):
            w.mark(f'rm{k}t{j}'); w.i32(j * 16); w.i32(208); w.i32(0); w.i32(16); w.i32(0); w.u32(16); w.u32(16); w.i32(500)
            w.u32(10000000 + j); w.f32(1); w.f32(1); w.u32(0xffffffff)
    else:
        w.mark(f'rm{k}t'); w.u32(0)
    layers = []
    if k == 0 and not GMS1:
        layers = [('Fundo', 1, 1000), ('Tiles', 4, 500), ('Instances', 2, 0)]
    if GMS1:
        continue
    w.mark(f'rm{k}l'); w.u32(len(layers))
    for j in range(len(layers)): w.ptr(f'rm{k}l{j}')
    for j, (ln, lt, ld) in enumerate(layers):
        w.mark(f'rm{k}l{j}'); w.ptr(S(ln)); w.u32(j + 1); w.u32(lt); w.i32(ld); w.f32(0); w.f32(0); w.f32(0); w.f32(0); w.u32(1)
        if lt == 1:
            w.u32(1); w.u32(0); w.i32(3); w.u32(1); w.u32(1); w.u32(0); w.u32(0xffffffff); w.f32(0); w.f32(15); w.u32(0)
        elif lt == 4:
            tx, ty = 20, 15
            w.i32(0); w.u32(tx); w.u32(ty)
            for yy in range(ty):
                for xx in range(tx):
                    w.u32(1 if yy >= 12 else 0)
        elif lt == 2:
            w.u32(len(insts)); [w.u32(iid) for iid, *_ in insts]
    w.mark(f'rm{k}s'); w.u32(0)
fecha(p)

# FONT
GLIFOS = [ord(c) for c in 'Moedas: 0123456789']
p = chunk('FONT'); w.u32(1); w.ptr('fn0')
w.mark('fn0'); w.ptr(S('fnt_teste')); w.ptr(S('Arial')); w.u32(8); w.u32(0); w.u32(0); w.u16(32); w.u8(0); w.u8(1); w.u32(127)
w.ptr('tp2'); w.f32(1); w.f32(1)
if not GMS1: w.i32(0)
w.u32(len(GLIFOS))
for j in range(len(GLIFOS)): w.ptr(f'fn0g{j}')
for j, c in enumerate(GLIFOS):
    w.mark(f'fn0g{j}'); w.u16(c); w.u16(0); w.u16(0); w.u16(6 if c != 32 else 0); w.u16(8 if c != 32 else 0); w.i16(7); w.i16(0); w.u16(0)
fecha(p)

# SCPT
p = chunk('SCPT'); w.u32(1); w.ptr('sc0'); w.mark('sc0'); w.ptr(S('scr_dobro')); w.i32(CODE['gml_Script_scr_dobro']); fecha(p)

# GLOB
p = chunk('GLOB'); w.u32(0); fecha(p)

# CODE: entradas e depois os blobs
p = chunk('CODE'); w.u32(len(codes))
for k in range(len(codes)): w.ptr(f'cd{k}')
blob_pos = {}
for k, c in enumerate(codes):
    blob_pos[k] = w.pos()
    for x in c.ws: w.u32(x)
for k, c in enumerate(codes):
    w.mark(f'cd{k}'); w.ptr(S(c.nome)); w.u32(len(c.ws) * 4); w.u16(0); w.u16(0)
    campo = w.pos(); w.i32(blob_pos[k] - campo); w.u32(0)
fecha(p)

# referências: variáveis e funções (cadeias de ocorrências)
ocv = {i: [] for i in range(len(VARS))}
ocf = {i: [] for i in range(len(FUNCS))}
for k, c in enumerate(codes):
    for (wi, tipo, idx, vt) in c.refs:
        addr = blob_pos[k] + (wi - 1) * 4  # endereço da instrução (palavra antes do operando)
        (ocv if tipo == 'v' else ocf)[idx].append((addr, blob_pos[k] + wi * 4, vt))
def encadear(lista, comTipo):
    lista.sort()
    for n, (addr, opnd, vt) in enumerate(lista):
        prox = lista[n + 1][0] - addr if n + 1 < len(lista) else 0
        struct.pack_into('<I', w.b, opnd, ((vt << 24) if comTipo else 0) | (prox & 0x07ffffff))
for i in ocv: encadear(ocv[i], True)
for i in ocf: encadear(ocf[i], False)

p = chunk('VARI'); w.u32(len(VARS)); w.u32(len(VARS)); w.u32(1)
for i, (nome, inst) in enumerate(VARS):
    w.ptr(S(nome)); w.i32(inst); w.i32(i); w.u32(len(ocv[i])); w.i32(min(ocv[i])[0] if ocv[i] else -1)
fecha(p)
p = chunk('FUNC'); w.u32(len(FUNCS))
for i, nome in enumerate(FUNCS):
    # GMS 2.3+: o primeiro endereço das funções aponta para o operando (+4)
    w.ptr(S(nome)); w.u32(len(ocf[i])); w.i32((min(ocf[i])[0] + (0 if GMS1 else 4)) if ocf[i] else -1)
w.u32(0)
fecha(p)

# STRG por último (os ponteiros apontam para o conteúdo)
p = chunk('STRG'); w.u32(len(strings))
for k in range(len(strings)): w.ptr(f'se{k}')
for k, s in enumerate(strings):
    w.align(4); w.mark(f'se{k}'); e = s.encode(); w.u32(len(e)); w.mark('str:' + s); w.raw(e + b'\0')
fecha(p)

w.resolve()
struct.pack_into('<I', w.b, 4, len(w.b) - 8)
open(sys.argv[1] if len(sys.argv) > 1 else 'data.win', 'wb').write(w.b)
print('ok', len(w.b), 'bytes', len(codes), 'códigos', len(VARS), 'variáveis', len(FUNCS), 'funções')
