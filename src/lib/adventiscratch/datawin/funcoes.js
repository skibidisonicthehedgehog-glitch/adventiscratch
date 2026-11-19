/**
 * Funções nativas do GML usadas pelos jogos (matemática, textos, instâncias, colisão, desenho, som,
 * teclado, estruturas de dados, arquivos .ini/.txt). As que faltam devolvem undefined e aparecem
 * na lista "funções não suportadas".
 */
import {Struct, Metodo, num, paraInt, verdade, igual, INST} from './vm.js';
import {corCss} from './desenho.js';

const F = {};
const rad = g => g * Math.PI / 180;
const grau = r => r * 180 / Math.PI;
const texto = (m, v) => m.texto(v);
const eu = q => (q.self && q.self.ehInstancia ? q.self : null);

// ---------------------------------------------------------------- aleatório (com semente)
let semente = 1;
const aleat = () => {
    // mulberry32
    semente = (semente + 0x6d2b79f5) | 0;
    let t = semente;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
semente = (Date.now() & 0x7fffffff) | 0;

// ---------------------------------------------------------------- matemática
Object.assign(F, {
    abs: (m, a) => Math.abs(num(a[0])),
    sign: (m, a) => Math.sign(num(a[0])),
    round: (m, a) => {
        // arredonda metade para o par (como o GameMaker)
        const x = num(a[0]);
        const r = Math.round(x);
        return (Math.abs(x % 1) === 0.5 && r % 2 !== 0) ? r - 1 : r;
    },
    floor: (m, a) => Math.floor(num(a[0])),
    ceil: (m, a) => Math.ceil(num(a[0])),
    frac: (m, a) => num(a[0]) % 1,
    sqrt: (m, a) => Math.sqrt(num(a[0])),
    sqr: (m, a) => num(a[0]) * num(a[0]),
    power: (m, a) => Math.pow(num(a[0]), num(a[1])),
    exp: (m, a) => Math.exp(num(a[0])),
    ln: (m, a) => Math.log(num(a[0])),
    log2: (m, a) => Math.log2(num(a[0])),
    log10: (m, a) => Math.log10(num(a[0])),
    logn: (m, a) => Math.log(num(a[1])) / Math.log(num(a[0])),
    sin: (m, a) => Math.sin(num(a[0])),
    cos: (m, a) => Math.cos(num(a[0])),
    tan: (m, a) => Math.tan(num(a[0])),
    arcsin: (m, a) => Math.asin(num(a[0])),
    arccos: (m, a) => Math.acos(num(a[0])),
    arctan: (m, a) => Math.atan(num(a[0])),
    arctan2: (m, a) => Math.atan2(num(a[0]), num(a[1])),
    dsin: (m, a) => Math.sin(rad(num(a[0]))),
    dcos: (m, a) => Math.cos(rad(num(a[0]))),
    dtan: (m, a) => Math.tan(rad(num(a[0]))),
    darcsin: (m, a) => grau(Math.asin(num(a[0]))),
    darccos: (m, a) => grau(Math.acos(num(a[0]))),
    darctan: (m, a) => grau(Math.atan(num(a[0]))),
    darctan2: (m, a) => grau(Math.atan2(num(a[0]), num(a[1]))),
    degtorad: (m, a) => rad(num(a[0])),
    radtodeg: (m, a) => grau(num(a[0])),
    min: (m, a) => Math.min(...a.map(num)),
    max: (m, a) => Math.max(...a.map(num)),
    mean: (m, a) => a.reduce((x, y) => x + num(y), 0) / Math.max(1, a.length),
    median: (m, a) => {
        const v = a.map(num).sort((x, y) => x - y);
        return v.length ? v[Math.floor((v.length - 1) / 2)] : 0;
    },
    clamp: (m, a) => Math.max(num(a[1]), Math.min(num(a[2]), num(a[0]))),
    lerp: (m, a) => num(a[0]) + ((num(a[1]) - num(a[0])) * num(a[2])),
    point_distance: (m, a) => Math.hypot(num(a[2]) - num(a[0]), num(a[3]) - num(a[1])),
    point_distance_3d: (m, a) => Math.hypot(num(a[3]) - num(a[0]), num(a[4]) - num(a[1]), num(a[5]) - num(a[2])),
    point_direction: (m, a) => {
        let d = grau(Math.atan2(-(num(a[3]) - num(a[1])), num(a[2]) - num(a[0])));
        if (d < 0) d += 360;
        return d;
    },
    lengthdir_x: (m, a) => num(a[0]) * Math.cos(rad(num(a[1]))),
    lengthdir_y: (m, a) => -num(a[0]) * Math.sin(rad(num(a[1]))),
    angle_difference: (m, a) => ((((num(a[0]) - num(a[1])) % 360) + 540) % 360) - 180,
    dot_product: (m, a) => (num(a[0]) * num(a[2])) + (num(a[1]) * num(a[3])),
    random: (m, a) => aleat() * num(a[0]),
    random_range: (m, a) => num(a[0]) + (aleat() * (num(a[1]) - num(a[0]))),
    irandom: (m, a) => Math.floor(aleat() * (paraInt(a[0]) + 1)),
    irandom_range: (m, a) => {
        const lo = Math.min(paraInt(a[0]), paraInt(a[1]));
        const hi = Math.max(paraInt(a[0]), paraInt(a[1]));
        return lo + Math.floor(aleat() * (hi - lo + 1));
    },
    choose: (m, a) => a[Math.floor(aleat() * a.length)],
    randomize: () => {
        semente = (Date.now() & 0x7fffffff) | 0;
        return semente;
    },
    randomise: () => {
        semente = (Date.now() & 0x7fffffff) | 0;
        return semente;
    },
    random_set_seed: (m, a) => {
        semente = paraInt(a[0]) | 0;
    },
    random_get_seed: () => semente,
    math_set_epsilon: () => {},
    is_nan: (m, a) => (typeof a[0] === 'number' && Number.isNaN(a[0]) ? 1 : 0),
    is_infinity: (m, a) => (typeof a[0] === 'number' && !Number.isFinite(a[0]) && !Number.isNaN(a[0]) ? 1 : 0)
});

// ---------------------------------------------------------------- tipos e conversão
Object.assign(F, {
    'real': (m, a) => (typeof a[0] === 'string' ? (parseFloat(a[0]) || 0) : num(a[0])),
    'string': (m, a) => {
        if (typeof a[0] === 'string' && a.length > 1) {
            // string("{0} e {1}", x, y) do 2.3
            return a[0].replace(/\{(\d+)\}/g, (t, k) => texto(m, a[Number(k) + 1]));
        }
        return texto(m, a[0]);
    },
    '@@string@@': (m, a) => texto(m, a[0]),
    'int64': (m, a) => Math.trunc(num(a[0])),
    'bool': (m, a) => (verdade(a[0]) ? 1 : 0),
    'ptr': (m, a) => a[0],
    'is_string': (m, a) => (typeof a[0] === 'string' ? 1 : 0),
    'is_real': (m, a) => (typeof a[0] === 'number' ? 1 : 0),
    'is_numeric': (m, a) => (typeof a[0] === 'number' ? 1 : 0),
    'is_bool': (m, a) => (typeof a[0] === 'boolean' ? 1 : 0),
    'is_int32': (m, a) => (Number.isInteger(a[0]) ? 1 : 0),
    'is_int64': (m, a) => (Number.isInteger(a[0]) ? 1 : 0),
    'is_undefined': (m, a) => (a[0] === undefined ? 1 : 0),
    'is_array': (m, a) => (Array.isArray(a[0]) ? 1 : 0),
    'is_struct': (m, a) => (a[0] instanceof Struct ? 1 : 0),
    'is_method': (m, a) => (a[0] instanceof Metodo ? 1 : 0),
    'is_callable': (m, a) => (a[0] instanceof Metodo || typeof a[0] === 'number' ? 1 : 0),
    'is_ptr': () => 0,
    'typeof': (m, a) => {
        const v = a[0];
        if (typeof v === 'number') return 'number';
        if (typeof v === 'string') return 'string';
        if (typeof v === 'boolean') return 'bool';
        if (v === undefined) return 'undefined';
        if (Array.isArray(v)) return 'array';
        if (v instanceof Metodo) return 'method';
        if (v instanceof Struct) return 'struct';
        return 'unknown';
    },
    'instanceof': (m, a) => (a[0] instanceof Struct ? a[0].construtor || 'struct' : 'undefined')
});

// ---------------------------------------------------------------- textos (posições começam em 1)
Object.assign(F, {
    string_length: (m, a) => texto(m, a[0]).length,
    string_byte_length: (m, a) => new TextEncoder().encode(texto(m, a[0])).length,
    string_char_at: (m, a) => {
        const t = texto(m, a[0]);
        const i = paraInt(a[1]);
        return t.charAt(Math.max(0, i - 1)) || (i <= 0 ? t.charAt(0) : '');
    },
    string_ord_at: (m, a) => {
        const t = texto(m, a[0]);
        const c = t.codePointAt(Math.max(0, paraInt(a[1]) - 1));
        return c === undefined ? -1 : c;
    },
    string_copy: (m, a) => {
        const t = texto(m, a[0]);
        const i = Math.max(1, paraInt(a[1]));
        return t.substr(i - 1, Math.max(0, paraInt(a[2])));
    },
    string_delete: (m, a) => {
        const t = texto(m, a[0]);
        const i = paraInt(a[1]);
        if (i < 1) return t;
        return t.slice(0, i - 1) + t.slice(i - 1 + Math.max(0, paraInt(a[2])));
    },
    string_insert: (m, a) => {
        const t = texto(m, a[1]);
        const i = Math.max(1, paraInt(a[2]));
        return t.slice(0, i - 1) + texto(m, a[0]) + t.slice(i - 1);
    },
    string_pos: (m, a) => texto(m, a[1]).indexOf(texto(m, a[0])) + 1,
    string_pos_ext: (m, a) => texto(m, a[1]).indexOf(texto(m, a[0]), paraInt(a[2])) + 1,
    string_last_pos: (m, a) => texto(m, a[1]).lastIndexOf(texto(m, a[0])) + 1,
    string_count: (m, a) => {
        const sub = texto(m, a[0]);
        return sub ? texto(m, a[1]).split(sub).length - 1 : 0;
    },
    string_replace: (m, a) => texto(m, a[0]).replace(texto(m, a[1]), () => texto(m, a[2])),
    string_replace_all: (m, a) => texto(m, a[0]).split(texto(m, a[1]))
        .join(texto(m, a[2])),
    string_upper: (m, a) => texto(m, a[0]).toUpperCase(),
    string_lower: (m, a) => texto(m, a[0]).toLowerCase(),
    string_repeat: (m, a) => texto(m, a[0]).repeat(Math.max(0, paraInt(a[1]))),
    string_letters: (m, a) => texto(m, a[0]).replace(/[^A-Za-z]/g, ''),
    string_digits: (m, a) => texto(m, a[0]).replace(/[^0-9]/g, ''),
    string_lettersdigits: (m, a) => texto(m, a[0]).replace(/[^A-Za-z0-9]/g, ''),
    string_trim: (m, a) => texto(m, a[0]).trim(),
    string_trim_start: (m, a) => texto(m, a[0]).trimStart(),
    string_trim_end: (m, a) => texto(m, a[0]).trimEnd(),
    string_starts_with: (m, a) => (texto(m, a[0]).startsWith(texto(m, a[1])) ? 1 : 0),
    string_ends_with: (m, a) => (texto(m, a[0]).endsWith(texto(m, a[1])) ? 1 : 0),
    string_split: (m, a) => texto(m, a[0]).split(texto(m, a[1])),
    string_join: (m, a) => a.slice(1).map(x => texto(m, x))
        .join(texto(m, a[0])),
    string_concat: (m, a) => a.map(x => texto(m, x)).join(''),
    string_format: (m, a) => {
        const v = num(a[0]);
        const tot = paraInt(a[1]);
        const dec = paraInt(a[2]);
        return v.toFixed(Math.max(0, dec)).padStart(tot + (dec > 0 ? dec + 1 : 0), ' ');
    },
    string_hash_to_newline: (m, a) => texto(m, a[0]).replace(/#/g, '\n'),
    ord: (m, a) => {
        const t = texto(m, a[0]);
        return t.length ? t.codePointAt(0) : 0;
    },
    chr: (m, a) => String.fromCodePoint(Math.max(0, paraInt(a[0]))),
    ansi_char: (m, a) => String.fromCharCode(paraInt(a[0]) & 0xff),
    string_width: (m, a) => m.d.larguraTexto(texto(m, a[0])),
    string_height: (m, a) => m.d.alturaTexto(texto(m, a[0])),
    string_width_ext: (m, a) => Math.min(num(a[2]) > 0 ? num(a[2]) : Infinity, m.d.larguraTexto(texto(m, a[0]))),
    string_height_ext: (m, a) => m.d.alturaTexto(texto(m, a[0]))
});

// ---------------------------------------------------------------- arrays e structs
Object.assign(F, {
    array_length: (m, a) => (Array.isArray(a[0]) ? a[0].length : 0),
    array_length_1d: (m, a) => {
        if (!Array.isArray(a[0])) return 0;
        let n = 0;
        while (n < a[0].length && n < 32000) n++;
        return n;
    },
    array_length_2d: (m, a) => {
        const v = Array.isArray(a[0]) ? a[0][paraInt(a[1])] : null;
        return Array.isArray(v) ? v.length : 0;
    },
    array_height_2d: (m, a) => (Array.isArray(a[0]) ? a[0].length : 0),
    array_create: (m, a) => new Array(Math.max(0, paraInt(a[0]))).fill(a.length > 1 ? a[1] : 0),
    array_copy: (m, a) => {
        const dest = a[0];
        const src = a[2];
        if (!Array.isArray(dest) || !Array.isArray(src)) return;
        const di = paraInt(a[1]);
        const si = paraInt(a[3]);
        const n = paraInt(a[4]);
        for (let i = 0; i < n; i++) dest[di + i] = src[si + i];
    },
    array_equals: (m, a) => (Array.isArray(a[0]) && Array.isArray(a[1]) && a[0].length === a[1].length &&
        a[0].every((x, i) => igual(x, a[1][i])) ? 1 : 0),
    array_push: (m, a) => {
        if (Array.isArray(a[0])) a[0].push(...a.slice(1));
    },
    array_pop: (m, a) => (Array.isArray(a[0]) ? a[0].pop() : undefined),
    array_insert: (m, a) => {
        if (Array.isArray(a[0])) a[0].splice(paraInt(a[1]), 0, ...a.slice(2));
    },
    array_delete: (m, a) => {
        if (Array.isArray(a[0])) a[0].splice(paraInt(a[1]), paraInt(a[2]));
    },
    array_resize: (m, a) => {
        if (!Array.isArray(a[0])) return;
        const n = paraInt(a[1]);
        while (a[0].length < n) a[0].push(0);
        a[0].length = n;
    },
    array_sort: (m, a) => {
        if (!Array.isArray(a[0])) return;
        if (a[1] instanceof Metodo) {
            a[0].sort((x, y) => num(m.vm.chamarValor({self: undefined, other: undefined}, a[1], [x, y], undefined)));
        } else {
            const asc = verdade(a[1]);
            a[0].sort((x, y) => {
                const r = (typeof x === 'string' && typeof y === 'string') ? x.localeCompare(y) : num(x) - num(y);
                return asc ? r : -r;
            });
        }
    },
    array_contains: (m, a) => (Array.isArray(a[0]) && a[0].some(x => igual(x, a[1])) ? 1 : 0),
    array_get_index: (m, a) => (Array.isArray(a[0]) ? a[0].findIndex(x => igual(x, a[1])) : -1),
    array_get: (m, a) => (Array.isArray(a[0]) ? a[0][paraInt(a[1])] : undefined),
    array_set: (m, a) => {
        if (Array.isArray(a[0])) a[0][paraInt(a[1])] = a[2];
    },
    array_first: (m, a) => (Array.isArray(a[0]) ? a[0][0] : undefined),
    array_last: (m, a) => (Array.isArray(a[0]) ? a[0][a[0].length - 1] : undefined),
    array_shuffle: (m, a) => {
        const r = Array.isArray(a[0]) ? a[0].slice() : [];
        for (let i = r.length - 1; i > 0; i--) {
            const j = Math.floor(aleat() * (i + 1));
            [r[i], r[j]] = [r[j], r[i]];
        }
        return r;
    },
    array_reverse: (m, a) => (Array.isArray(a[0]) ? a[0].slice().reverse() : []),
    variable_struct_get: (m, a) => (a[0] instanceof Struct ? a[0].vars.get(texto(m, a[1])) : undefined),
    variable_struct_set: (m, a) => {
        if (a[0] instanceof Struct) a[0].vars.set(texto(m, a[1]), a[2]);
    },
    variable_struct_exists: (m, a) => (a[0] instanceof Struct && a[0].vars.has(texto(m, a[1])) ? 1 : 0),
    variable_struct_remove: (m, a) => {
        if (a[0] instanceof Struct) a[0].vars.delete(texto(m, a[1]));
    },
    variable_struct_get_names: (m, a) => (a[0] instanceof Struct ? Array.from(a[0].vars.keys()) : []),
    variable_struct_names_count: (m, a) => (a[0] instanceof Struct ? a[0].vars.size : 0),
    struct_get: (m, a) => F.variable_struct_get(m, a),
    struct_set: (m, a) => F.variable_struct_set(m, a),
    struct_exists: (m, a) => F.variable_struct_exists(m, a),
    struct_remove: (m, a) => F.variable_struct_remove(m, a),
    struct_get_names: (m, a) => F.variable_struct_get_names(m, a),
    struct_names_count: (m, a) => F.variable_struct_names_count(m, a),
    method_get_self: (m, a) => (a[0] instanceof Metodo ? a[0].self : undefined),
    method_get_index: (m, a) => (a[0] instanceof Metodo ? a[0] : undefined)
});

// ---------------------------------------------------------------- variáveis por nome
const donoDe = (m, q, v) => {
    if (v instanceof Struct) return v;
    if (v && v.ehInstancia) return v;
    return m.vm.alvoUnico(q, v);
};
Object.assign(F, {
    variable_global_get: (m, a) => m.lerVar(m.global, texto(m, a[0])),
    variable_global_set: (m, a) => m.escreverVar(m.global, texto(m, a[0]), a[1]),
    variable_global_exists: (m, a) => (m.global.vars.has(texto(m, a[0])) ? 1 : 0),
    variable_instance_get: (m, a, q) => m.lerVar(donoDe(m, q, a[0]), texto(m, a[1])),
    variable_instance_set: (m, a, q) => m.escreverVar(donoDe(m, q, a[0]), texto(m, a[1]), a[2]),
    variable_instance_exists: (m, a, q) => {
        const d = donoDe(m, q, a[0]);
        return d && d.vars && d.vars.has(texto(m, a[1])) ? 1 : 0;
    },
    variable_instance_get_names: (m, a, q) => {
        const d = donoDe(m, q, a[0]);
        return d && d.vars ? Array.from(d.vars.keys()) : [];
    },
    script_exists: (m, a) => (m.dw.scripts[paraInt(a[0])] ? 1 : 0),
    script_get_name: (m, a) => (m.dw.scripts[paraInt(a[0])] || {}).nome || '',
    asset_get_index: (m, a) => {
        const n = texto(m, a[0]);
        for (const lista of [m.dw.objetos, m.dw.sprites, m.dw.sons, m.dw.salas, m.dw.fundos, m.dw.fontes, m.dw.scripts]) {
            const i = lista.findIndex(x => x.nome === n);
            if (i >= 0) return i;
        }
        return -1;
    }
});

// ---------------------------------------------------------------- instâncias
const instDe = (m, q, v) => {
    if (v && v.ehInstancia) return v.destruida ? [] : [v];
    return m.vm.alvos(q, v);
};
const criarInstancia = (m, q, obj, x, y, opcoes = {}) => {
    const o = paraInt(obj);
    if (o < 0 || o >= m.dw.objetos.length) return INST.NOONE;
    const i = m.criar(o, num(x), num(y), opcoes);
    return i.id;
};
const camadaPorNome = (m, v) => {
    if (typeof v === 'string') return m.camadas.find(c => c.nome === v);
    return m.camadas.find(c => c.id === paraInt(v));
};
Object.assign(F, {
    instance_create: (m, a, q) => criarInstancia(m, q, a[2], a[0], a[1]),
    instance_create_depth: (m, a, q) => criarInstancia(m, q, a[3], a[0], a[1], {
        profundidade: num(a[2]),
        ajustar: i => {
            if (a[4] instanceof Struct) a[4].vars.forEach((v, k) => m.escreverVar(i, k, v));
        }
    }),
    instance_create_layer: (m, a, q) => {
        const c = camadaPorNome(m, a[2]);
        return criarInstancia(m, q, a[3], a[0], a[1], {
            profundidade: c ? c.prof : 0,
            camada: c ? c.id : -1,
            ajustar: i => {
                if (a[4] instanceof Struct) a[4].vars.forEach((v, k) => m.escreverVar(i, k, v));
            }
        });
    },
    instance_destroy: (m, a, q) => {
        const lista = a.length ? instDe(m, q, a[0]) : (eu(q) ? [eu(q)] : []);
        const comEvento = a.length < 2 || verdade(a[1]);
        for (const i of lista) m.destruir(i, comEvento);
    },
    instance_exists: (m, a, q) => (instDe(m, q, a[0]).length ? 1 : 0),
    instance_number: (m, a, q) => instDe(m, q, a[0]).length,
    instance_find: (m, a, q) => {
        const l = instDe(m, q, a[0]);
        const i = l[paraInt(a[1])];
        return i ? i.id : INST.NOONE;
    },
    instance_nearest: (m, a, q) => {
        let melhor = null;
        let d = Infinity;
        for (const i of instDe(m, q, a[2])) {
            const dd = Math.hypot(i.x - num(a[0]), i.y - num(a[1]));
            if (dd < d) {
                d = dd;
                melhor = i;
            }
        }
        return melhor ? melhor.id : INST.NOONE;
    },
    instance_furthest: (m, a, q) => {
        let melhor = null;
        let d = -1;
        for (const i of instDe(m, q, a[2])) {
            const dd = Math.hypot(i.x - num(a[0]), i.y - num(a[1]));
            if (dd > d) {
                d = dd;
                melhor = i;
            }
        }
        return melhor ? melhor.id : INST.NOONE;
    },
    instance_change: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        if (verdade(a[1])) m.evento(i, 1, 0);
        i.objeto = paraInt(a[0]);
        const o = m.dw.objetos[i.objeto];
        if (o) {
            i.sprite_index = o.sprite;
            i.mask_index = o.mascara;
        }
        if (verdade(a[1])) m.evento(i, 0, 0);
    },
    instance_copy: (m, a, q) => {
        const i = eu(q);
        if (!i) return INST.NOONE;
        const c = m.criar(i.objeto, i.x, i.y, {ajustar: n => {
            i.vars.forEach((v, k) => n.vars.set(k, v));
            ['image_index', 'image_speed', 'image_xscale', 'image_yscale', 'image_angle', 'image_alpha',
                'image_blend', 'sprite_index', 'depth', 'hs', 'vs', 'dir'].forEach(k => {
                n[k] = i[k];
            });
        }});
        return c.id;
    },
    instance_deactivate_all: (m, a, q) => {
        for (const i of m.instancias) if (!verdade(a[0]) || i !== eu(q)) i.desativada = true;
    },
    instance_deactivate_object: (m, a, q) => {
        for (const i of instDe(m, q, a[0])) i.desativada = true;
    },
    instance_activate_all: m => {
        for (const i of m.instancias) i.desativada = false;
    },
    instance_activate_object: (m, a) => {
        const n = paraInt(a[0]);
        for (const i of m.instancias) {
            if (i.id === n || m.ehFilho(i.objeto, n) || n === INST.ALL) i.desativada = false;
        }
    },
    instance_deactivate_region: () => {},
    instance_activate_region: m => {
        for (const i of m.instancias) i.desativada = false;
    },
    object_get_name: (m, a) => (m.dw.objetos[paraInt(a[0])] || {}).nome || '<undefined>',
    object_get_sprite: (m, a) => (m.dw.objetos[paraInt(a[0])] || {sprite: -1}).sprite,
    object_get_parent: (m, a) => (m.dw.objetos[paraInt(a[0])] || {pai: -100}).pai,
    object_get_depth: (m, a) => (m.dw.objetos[paraInt(a[0])] || {prof: 0}).prof,
    object_get_visible: (m, a) => ((m.dw.objetos[paraInt(a[0])] || {}).visivel ? 1 : 0),
    object_get_solid: (m, a) => ((m.dw.objetos[paraInt(a[0])] || {}).solido ? 1 : 0),
    object_get_persistent: (m, a) => ((m.dw.objetos[paraInt(a[0])] || {}).persistente ? 1 : 0),
    object_exists: (m, a) => (m.dw.objetos[paraInt(a[0])] ? 1 : 0),
    object_is_ancestor: (m, a) => (paraInt(a[0]) !== paraInt(a[1]) && m.ehFilho(paraInt(a[0]), paraInt(a[1])) ? 1 : 0),
    event_inherited: (m, a, q) => {
        if (eu(q)) m.eventoHerdado(eu(q), q.other);
    },
    event_user: (m, a, q) => {
        if (eu(q)) m.evento(eu(q), 7, 10 + paraInt(a[0]), q.other);
    },
    event_perform: (m, a, q) => {
        if (eu(q)) m.evento(eu(q), paraInt(a[0]), paraInt(a[1]), q.other);
    },
    event_perform_object: (m, a, q) => {
        if (eu(q)) m.evento(eu(q), paraInt(a[1]), paraInt(a[2]), q.other, paraInt(a[0]));
    }
});

// ---------------------------------------------------------------- movimento e colisão
const caixaEm = (i, x, y) => i.caixa(x, y);
const sobre = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const contemPonto = (c, x, y) => c && x >= c.l && x < c.r && y >= c.t && y < c.b;
const candidatos = (m, q, alvo) => {
    if (alvo === undefined) return m.instancias.filter(i => !i.destruida && !i.desativada);
    return instDe(m, q, alvo);
};
const lugar = (m, q, x, y, alvo, filtro) => {
    const i = eu(q);
    if (!i) return null;
    const c = caixaEm(i, num(x), num(y));
    if (!c) return null;
    for (const o of candidatos(m, q, alvo)) {
        if (o === i || (filtro && !filtro(o))) continue;
        if (sobre(c, o.caixa())) return o;
    }
    return null;
};
const segmentoNaCaixa = (x1, y1, x2, y2, c) => {
    if (!c) return false;
    let t0 = 0;
    let t1 = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (const [p, qq] of [[-dx, x1 - c.l], [dx, c.r - x1], [-dy, y1 - c.t], [dy, c.b - y1]]) {
        if (p === 0) {
            if (qq < 0) return false;
        } else {
            const r = qq / p;
            if (p < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
        }
    }
    return true;
};
Object.assign(F, {
    place_meeting: (m, a, q) => (lugar(m, q, a[0], a[1], a[2]) ? 1 : 0),
    instance_place: (m, a, q) => {
        const o = lugar(m, q, a[0], a[1], a[2]);
        return o ? o.id : INST.NOONE;
    },
    place_free: (m, a, q) => (lugar(m, q, a[0], a[1], undefined, o => o.solid) ? 0 : 1),
    place_empty: (m, a, q) => (lugar(m, q, a[0], a[1], a[2]) ? 0 : 1),
    position_meeting: (m, a, q) => (candidatos(m, q, a[2]).some(o => contemPonto(o.caixa(), num(a[0]), num(a[1]))) ? 1 : 0),
    position_empty: (m, a) => (m.instancias.some(o => !o.destruida && contemPonto(o.caixa(), num(a[0]), num(a[1]))) ? 0 : 1),
    instance_position: (m, a, q) => {
        const o = candidatos(m, q, a[2]).find(x => contemPonto(x.caixa(), num(a[0]), num(a[1])));
        return o ? o.id : INST.NOONE;
    },
    collision_point: (m, a, q) => {
        const me = verdade(a[4]) ? eu(q) : null;
        const o = candidatos(m, q, a[2]).find(x => x !== me && contemPonto(x.caixa(), num(a[0]), num(a[1])));
        return o ? o.id : INST.NOONE;
    },
    collision_rectangle: (m, a, q) => {
        const me = verdade(a[6]) ? eu(q) : null;
        const c = {
            l: Math.min(num(a[0]), num(a[2])),
            r: Math.max(num(a[0]), num(a[2])),
            t: Math.min(num(a[1]), num(a[3])),
            b: Math.max(num(a[1]), num(a[3]))
        };
        const o = candidatos(m, q, a[4]).find(x => x !== me && sobre(c, x.caixa()));
        return o ? o.id : INST.NOONE;
    },
    collision_circle: (m, a, q) => {
        const me = verdade(a[5]) ? eu(q) : null;
        const cx = num(a[0]);
        const cy = num(a[1]);
        const r = num(a[2]);
        const o = candidatos(m, q, a[3]).find(x => {
            const c = x.caixa();
            if (!c || x === me) return false;
            const px = Math.max(c.l, Math.min(cx, c.r));
            const py = Math.max(c.t, Math.min(cy, c.b));
            return Math.hypot(px - cx, py - cy) <= r;
        });
        return o ? o.id : INST.NOONE;
    },
    collision_line: (m, a, q) => {
        const me = verdade(a[6]) ? eu(q) : null;
        const o = candidatos(m, q, a[4]).find(x => x !== me &&
            segmentoNaCaixa(num(a[0]), num(a[1]), num(a[2]), num(a[3]), x.caixa()));
        return o ? o.id : INST.NOONE;
    },
    point_in_rectangle: (m, a) => (num(a[0]) >= num(a[2]) && num(a[0]) <= num(a[4]) &&
        num(a[1]) >= num(a[3]) && num(a[1]) <= num(a[5]) ? 1 : 0),
    point_in_circle: (m, a) => (Math.hypot(num(a[0]) - num(a[2]), num(a[1]) - num(a[3])) <= num(a[4]) ? 1 : 0),
    rectangle_in_rectangle: (m, a) => {
        const c1 = {l: num(a[0]), t: num(a[1]), r: num(a[2]), b: num(a[3])};
        const c2 = {l: num(a[4]), t: num(a[5]), r: num(a[6]), b: num(a[7])};
        if (c1.l >= c2.l && c1.r <= c2.r && c1.t >= c2.t && c1.b <= c2.b) return 1;
        return c1.l <= c2.r && c2.l <= c1.r && c1.t <= c2.b && c2.t <= c1.b ? 2 : 0;
    },
    distance_to_point: (m, a, q) => {
        const i = eu(q);
        const c = i && i.caixa();
        if (!c) return 0;
        const dx = Math.max(c.l - num(a[0]), 0, num(a[0]) - c.r);
        const dy = Math.max(c.t - num(a[1]), 0, num(a[1]) - c.b);
        return Math.hypot(dx, dy);
    },
    distance_to_object: (m, a, q) => {
        const i = eu(q);
        const c = i && i.caixa();
        if (!c) return 0;
        let d = 1e6;
        for (const o of instDe(m, q, a[0])) {
            const c2 = o.caixa();
            if (!c2 || o === i) continue;
            const dx = Math.max(c2.l - c.r, 0, c.l - c2.r);
            const dy = Math.max(c2.t - c.b, 0, c.t - c2.b);
            d = Math.min(d, Math.hypot(dx, dy));
        }
        return d;
    },
    motion_set: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        i.dir = ((num(a[0]) % 360) + 360) % 360;
        i.speed = num(a[1]);
    },
    motion_add: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        i.hs += num(a[1]) * Math.cos(rad(num(a[0])));
        i.vs -= num(a[1]) * Math.sin(rad(num(a[0])));
    },
    move_towards_point: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        let d = grau(Math.atan2(-(num(a[1]) - i.y), num(a[0]) - i.x));
        if (d < 0) d += 360;
        i.dir = d;
        i.speed = num(a[2]);
    },
    move_snap: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        if (num(a[0]) > 0) i.x = Math.round(i.x / num(a[0])) * num(a[0]);
        if (num(a[1]) > 0) i.y = Math.round(i.y / num(a[1])) * num(a[1]);
    },
    place_snapped: (m, a, q) => {
        const i = eu(q);
        return i && i.x % num(a[0]) === 0 && i.y % num(a[1]) === 0 ? 1 : 0;
    },
    move_wrap: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        const mg = num(a[2]);
        if (verdade(a[0])) {
            if (i.x < -mg) i.x += m.room_width + mg;
            else if (i.x > m.room_width + mg) i.x -= m.room_width + mg;
        }
        if (verdade(a[1])) {
            if (i.y < -mg) i.y += m.room_height + mg;
            else if (i.y > m.room_height + mg) i.y -= m.room_height + mg;
        }
    },
    move_contact_solid: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        const dir = rad(num(a[0]));
        const max = num(a[1]) > 0 ? num(a[1]) : 1000;
        for (let k = 0; k < max; k++) {
            const nx = i.x + Math.cos(dir);
            const ny = i.y - Math.sin(dir);
            if (lugar(m, q, nx, ny, undefined, o => o.solid)) break;
            i.x = nx;
            i.y = ny;
        }
    },
    move_outside_solid: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        const dir = rad(num(a[0]));
        const max = num(a[1]) > 0 ? num(a[1]) : 1000;
        for (let k = 0; k < max && lugar(m, q, i.x, i.y, undefined, o => o.solid); k++) {
            i.x += Math.cos(dir);
            i.y -= Math.sin(dir);
        }
    },
    move_bounce_solid: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        if (lugar(m, q, i.x + i.hs, i.y, undefined, o => o.solid)) i.hs = -i.hs;
        if (lugar(m, q, i.x, i.y + i.vs, undefined, o => o.solid)) i.vs = -i.vs;
    },
    move_bounce_all: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        if (lugar(m, q, i.x + i.hs, i.y)) i.hs = -i.hs;
        if (lugar(m, q, i.x, i.y + i.vs)) i.vs = -i.vs;
    }
});

// ---------------------------------------------------------------- salas e jogo
Object.assign(F, {
    room_goto: (m, a) => m.irPara(paraInt(a[0])),
    room_goto_next: m => {
        const i = m.dw.ordemSalas.indexOf(m.sala);
        if (i >= 0 && i + 1 < m.dw.ordemSalas.length) m.irPara(m.dw.ordemSalas[i + 1]);
    },
    room_goto_previous: m => {
        const i = m.dw.ordemSalas.indexOf(m.sala);
        if (i > 0) m.irPara(m.dw.ordemSalas[i - 1]);
    },
    room_restart: m => m.irPara(m.sala),
    room_next: (m, a) => {
        const i = m.dw.ordemSalas.indexOf(paraInt(a[0]));
        return i >= 0 && i + 1 < m.dw.ordemSalas.length ? m.dw.ordemSalas[i + 1] : -1;
    },
    room_previous: (m, a) => {
        const i = m.dw.ordemSalas.indexOf(paraInt(a[0]));
        return i > 0 ? m.dw.ordemSalas[i - 1] : -1;
    },
    room_exists: (m, a) => (m.dw.salas[paraInt(a[0])] ? 1 : 0),
    room_get_name: (m, a) => (m.dw.salas[paraInt(a[0])] || {}).nome || '',
    room_set_persistent: () => {},
    game_end: m => {
        m.terminou = true;
    },
    game_restart: m => {
        for (const i of m.instancias) i.destruida = true;
        m.limparDestruidas();
        m.porId.clear();
        m.global = new Struct();
        m.sala = -1;
        m.iniciar();
    },
    show_debug_message: (m, a) => console.log('[jogo]', texto(m, a[0])), // eslint-disable-line no-console
    show_message: (m, a) => console.log('[jogo]', texto(m, a[0])), // eslint-disable-line no-console
    show_error: (m, a) => m.erro(texto(m, a[0])),
    get_timer: m => Math.floor((performance.now() - m.tempoInicio) * 1000),
    date_current_datetime: () => (Date.now() / 86400000) + 25569,
    date_get_year: () => new Date().getFullYear(),
    os_get_language: () => 'pt',
    os_get_region: () => 'BR',
    os_get_config: () => 'Default',
    os_is_paused: () => 0,
    parameter_count: () => 0,
    parameter_string: () => '',
    environment_get_variable: () => '',
    window_get_width: m => m.canvas.width,
    window_get_height: m => m.canvas.height,
    window_get_x: () => 0,
    window_get_y: () => 0,
    window_get_fullscreen: () => 0,
    window_set_fullscreen: () => {},
    window_set_size: () => {},
    window_set_position: () => {},
    window_center: () => {},
    window_set_caption: () => {},
    window_get_caption: m => m.dw.info.nomeExibido,
    window_set_cursor: () => {},
    window_has_focus: () => 1,
    window_set_color: () => {},
    window_set_colour: () => {},
    display_get_width: () => 1920,
    display_get_height: () => 1080,
    display_get_gui_width: m => m.gui.w || m.canvas.width,
    display_get_gui_height: m => m.gui.h || m.canvas.height,
    display_set_gui_size: (m, a) => {
        m.gui.w = Math.max(0, num(a[0]));
        m.gui.h = Math.max(0, num(a[1]));
    },
    display_set_gui_maximize: () => {},
    display_reset: () => {},
    display_get_frequency: () => 60,
    game_set_speed: (m, a) => {
        m.room_speed = paraInt(a[1]) === 1 ? Math.round(1e6 / Math.max(1, num(a[0]))) : Math.max(1, num(a[0]));
    },
    game_get_speed: m => m.room_speed,
    application_surface_draw_enable: () => {},
    application_surface_enable: () => {},
    application_get_position: m => [0, 0, m.canvas.width, m.canvas.height],
    gc_collect: () => {},
    gc_enable: () => {},
    steam_initialised: () => 0,
    steam_is_overlay_activated: () => 0,
    gamepad_is_connected: () => 0,
    gamepad_is_supported: () => 0,
    gamepad_get_device_count: () => 0,
    gamepad_button_check: () => 0,
    gamepad_button_check_pressed: () => 0,
    gamepad_button_check_released: () => 0,
    gamepad_axis_value: () => 0,
    gamepad_set_axis_deadzone: () => {},
    joystick_exists: () => 0,
    joystick_check_button: () => 0,
    joystick_xpos: () => 0,
    joystick_ypos: () => 0,
    joystick_zpos: () => 0,
    joystick_direction: () => 101,
    joystick_has_pov: () => 0,
    joystick_pov: () => -1,
    joystick_buttons: () => 0,
    joystick_axes: () => 0,
    joystick_name: () => '',
    gamepad_axis_count: () => 0,
    gamepad_button_count: () => 0,
    gamepad_get_description: () => '',
    gamepad_button_value: () => 0,
    font_add_sprite: () => -1,
    font_add_sprite_ext: () => -1,
    font_exists: (m, a) => (m.dw.fontes[paraInt(a[0])] ? 1 : 0),
    font_get_name: (m, a) => (m.dw.fontes[paraInt(a[0])] || {}).nome || '',
    texture_set_interpolation: () => {},
    gpu_set_texfilter: () => {},
    gpu_set_alphatestenable: () => {},
    gpu_set_alphatestref: () => {},
    gpu_set_ztestenable: () => {},
    gpu_set_zwriteenable: () => {},
    gpu_set_cullmode: () => {},
    gpu_set_colorwriteenable: () => {},
    gpu_set_colourwriteenable: () => {},
    shader_set: () => {},
    shader_reset: () => {},
    shader_is_compiled: () => 0,
    shaders_are_supported: () => 0,
    shader_get_uniform: () => -1,
    shader_get_sampler_index: () => -1,
    shader_set_uniform_f: () => {},
    shader_set_uniform_i: () => {},
    shader_set_uniform_f_array: () => {},
    d3d_start: () => {},
    d3d_end: () => {},
    d3d_set_fog: () => {},
    d3d_set_projection_ortho: () => {},
    draw_enable_alphablend: () => {},
    draw_texture_flush: () => {},
    draw_flush: () => {},
    vertex_format_begin: () => {},
    sprite_set_offset: (m, a) => {
        const sp = m.dw.sprites[paraInt(a[0])];
        if (sp) {
            sp.origemX = num(a[1]);
            sp.origemY = num(a[2]);
        }
    }
});

// ---------------------------------------------------------------- sprites e fundos
const spr = (m, v) => m.dw.sprites[paraInt(v)];
Object.assign(F, {
    sprite_exists: (m, a) => (spr(m, a[0]) ? 1 : 0),
    sprite_get_name: (m, a) => (spr(m, a[0]) || {}).nome || '<undefined>',
    sprite_get_width: (m, a) => (spr(m, a[0]) || {largura: 0}).largura,
    sprite_get_height: (m, a) => (spr(m, a[0]) || {altura: 0}).altura,
    sprite_get_number: (m, a) => ((spr(m, a[0]) || {quadros: []}).quadros.length),
    sprite_get_xoffset: (m, a) => (spr(m, a[0]) || {origemX: 0}).origemX,
    sprite_get_yoffset: (m, a) => (spr(m, a[0]) || {origemY: 0}).origemY,
    sprite_get_bbox_left: (m, a) => (spr(m, a[0]) || {margemEsq: 0}).margemEsq,
    sprite_get_bbox_right: (m, a) => (spr(m, a[0]) || {margemDir: 0}).margemDir,
    sprite_get_bbox_top: (m, a) => (spr(m, a[0]) || {margemCima: 0}).margemCima,
    sprite_get_bbox_bottom: (m, a) => (spr(m, a[0]) || {margemBaixo: 0}).margemBaixo,
    sprite_get_speed: (m, a) => (spr(m, a[0]) || {velocidade: 1}).velocidade,
    sprite_get_speed_type: (m, a) => (spr(m, a[0]) || {tipoVelocidade: 0}).tipoVelocidade,
    sprite_set_speed: (m, a) => {
        const sp = spr(m, a[0]);
        if (sp) {
            sp.velocidade = num(a[1]);
            sp.tipoVelocidade = paraInt(a[2]);
        }
    },
    background_get_width: (m, a) => {
        const b = m.dw.fundos[paraInt(a[0])];
        return b && b.pagina ? b.pagina.bw : 0;
    },
    background_get_height: (m, a) => {
        const b = m.dw.fundos[paraInt(a[0])];
        return b && b.pagina ? b.pagina.bh : 0;
    },
    background_exists: (m, a) => (m.dw.fundos[paraInt(a[0])] ? 1 : 0),
    background_get_name: (m, a) => (m.dw.fundos[paraInt(a[0])] || {}).nome || ''
});

// ---------------------------------------------------------------- desenho
const D = m => m.d;
const alvoCtx = m => (m.alvoSuperficie.length ? m.alvoSuperficie[m.alvoSuperficie.length - 1].ctx : m.ctx);
const comCtx = (m, fn) => {
    const ctx = alvoCtx(m);
    const antes = m.d.ctx;
    m.d.ctx = ctx;
    try {
        return fn(ctx);
    } finally {
        m.d.ctx = antes;
    }
};
const preencher = (m, ctx, contorno, cor, alpha = m.d.alpha) => {
    ctx.globalAlpha = alpha;
    if (contorno) {
        ctx.strokeStyle = corCss(cor);
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        ctx.fillStyle = corCss(cor);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
};
const fundo = (m, v) => {
    const b = m.dw.fundos[paraInt(v)];
    return b && b.pagina;
};
Object.assign(F, {
    draw_self: (m, a, q) => comCtx(m, () => {
        if (eu(q)) m.desenharSelf(eu(q));
    }),
    draw_sprite: (m, a, q) => comCtx(m, () => {
        const i = eu(q);
        const sub = num(a[1]) < 0 && i ? i.image_index : num(a[1]);
        D(m).sprite(paraInt(a[0]), sub, num(a[2]), num(a[3]), 1, 1, 0, 0xffffff, m.d.alpha);
    }),
    draw_sprite_ext: (m, a, q) => comCtx(m, () => {
        const i = eu(q);
        const sub = num(a[1]) < 0 && i ? i.image_index : num(a[1]);
        D(m).sprite(paraInt(a[0]), sub, num(a[2]), num(a[3]), num(a[4]), num(a[5]), num(a[6]), paraInt(a[7]), num(a[8]));
    }),
    draw_sprite_stretched: (m, a) => comCtx(m, () => {
        const sp = spr(m, a[0]);
        if (!sp || !sp.quadros.length) return;
        const it = sp.quadros[((paraInt(a[1]) % sp.quadros.length) + sp.quadros.length) % sp.quadros.length];
        D(m).item(it, num(a[2]), num(a[3]), 0, 0, num(a[4]) / sp.largura, num(a[5]) / sp.altura, 0, 0xffffff, m.d.alpha);
    }),
    draw_sprite_stretched_ext: (m, a) => comCtx(m, () => {
        const sp = spr(m, a[0]);
        if (!sp || !sp.quadros.length) return;
        const it = sp.quadros[((paraInt(a[1]) % sp.quadros.length) + sp.quadros.length) % sp.quadros.length];
        D(m).item(it, num(a[2]), num(a[3]), 0, 0, num(a[4]) / sp.largura, num(a[5]) / sp.altura, 0, paraInt(a[6]), num(a[7]));
    }),
    draw_sprite_part: (m, a) => comCtx(m, () => {
        const sp = spr(m, a[0]);
        if (!sp || !sp.quadros.length) return;
        const it = sp.quadros[((paraInt(a[1]) % sp.quadros.length) + sp.quadros.length) % sp.quadros.length];
        D(m).parte(it, num(a[2]), num(a[3]), num(a[4]), num(a[5]), num(a[6]), num(a[7]), 1, 1, 0xffffff, m.d.alpha);
    }),
    draw_sprite_part_ext: (m, a) => comCtx(m, () => {
        const sp = spr(m, a[0]);
        if (!sp || !sp.quadros.length) return;
        const it = sp.quadros[((paraInt(a[1]) % sp.quadros.length) + sp.quadros.length) % sp.quadros.length];
        D(m).parte(it, num(a[2]), num(a[3]), num(a[4]), num(a[5]), num(a[6]), num(a[7]), num(a[8]), num(a[9]),
            paraInt(a[10]), num(a[11]));
    }),
    draw_sprite_tiled: (m, a) => comCtx(m, () => {
        const sp = spr(m, a[0]);
        if (!sp || !sp.quadros.length) return;
        const w = sp.largura;
        const h = sp.altura;
        const x0 = ((num(a[2]) % w) + w) % w - w;
        const y0 = ((num(a[3]) % h) + h) % h - h;
        for (let x = x0; x < m.room_width; x += w) {
            for (let y = y0; y < m.room_height; y += h) D(m).sprite(paraInt(a[0]), num(a[1]), x + sp.origemX, y + sp.origemY);
        }
    }),
    draw_background: (m, a) => comCtx(m, () => D(m).item(fundo(m, a[0]), num(a[1]), num(a[2]), 0, 0, 1, 1, 0, 0xffffff, m.d.alpha)),
    draw_background_ext: (m, a) => comCtx(m, () => D(m).item(fundo(m, a[0]), num(a[1]), num(a[2]), 0, 0, num(a[3]),
        num(a[4]), num(a[5]), paraInt(a[6]), num(a[7]))),
    draw_background_stretched: (m, a) => comCtx(m, () => {
        const it = fundo(m, a[0]);
        if (it) D(m).item(it, num(a[1]), num(a[2]), 0, 0, num(a[3]) / it.bw, num(a[4]) / it.bh, 0, 0xffffff, m.d.alpha);
    }),
    draw_background_part: (m, a) => comCtx(m, () => D(m).parte(fundo(m, a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]),
        num(a[5]), num(a[6]), 1, 1, 0xffffff, m.d.alpha)),
    draw_background_part_ext: (m, a) => comCtx(m, () => D(m).parte(fundo(m, a[0]), num(a[1]), num(a[2]), num(a[3]),
        num(a[4]), num(a[5]), num(a[6]), num(a[7]), num(a[8]), paraInt(a[9]), num(a[10]))),
    draw_set_color: (m, a) => {
        m.d.cor = paraInt(a[0]);
    },
    draw_set_colour: (m, a) => {
        m.d.cor = paraInt(a[0]);
    },
    draw_get_color: m => m.d.cor,
    draw_get_colour: m => m.d.cor,
    draw_set_alpha: (m, a) => {
        m.d.alpha = Math.max(0, Math.min(1, num(a[0])));
    },
    draw_get_alpha: m => m.d.alpha,
    draw_set_font: (m, a) => {
        m.d.fonte = paraInt(a[0]);
    },
    draw_get_font: m => m.d.fonte,
    draw_set_halign: (m, a) => {
        m.d.halign = paraInt(a[0]);
    },
    draw_set_valign: (m, a) => {
        m.d.valign = paraInt(a[0]);
    },
    draw_get_halign: m => m.d.halign,
    draw_get_valign: m => m.d.valign,
    draw_text: (m, a) => comCtx(m, () => D(m).texto(num(a[0]), num(a[1]), texto(m, a[2]))),
    draw_text_ext: (m, a) => comCtx(m, () => D(m).texto(num(a[0]), num(a[1]), texto(m, a[2]), {sep: num(a[3]), largura: num(a[4])})),
    draw_text_transformed: (m, a) => comCtx(m, () => D(m).texto(num(a[0]), num(a[1]), texto(m, a[2]),
        {xs: num(a[3]), ys: num(a[4]), ang: num(a[5])})),
    draw_text_ext_transformed: (m, a) => comCtx(m, () => D(m).texto(num(a[0]), num(a[1]), texto(m, a[2]),
        {sep: num(a[3]), largura: num(a[4]), xs: num(a[5]), ys: num(a[6]), ang: num(a[7])})),
    draw_text_color: (m, a) => comCtx(m, () => D(m).texto(num(a[0]), num(a[1]), texto(m, a[2]),
        {cor: paraInt(a[3]), alpha: num(a[7])})),
    draw_text_colour: (m, a) => F.draw_text_color(m, a),
    draw_text_transformed_color: (m, a) => comCtx(m, () => D(m).texto(num(a[0]), num(a[1]), texto(m, a[2]),
        {xs: num(a[3]), ys: num(a[4]), ang: num(a[5]), cor: paraInt(a[6]), alpha: num(a[10])})),
    draw_text_transformed_colour: (m, a) => F.draw_text_transformed_color(m, a),
    draw_text_ext_color: (m, a) => comCtx(m, () => D(m).texto(num(a[0]), num(a[1]), texto(m, a[2]),
        {sep: num(a[3]), largura: num(a[4]), cor: paraInt(a[5]), alpha: num(a[9])})),
    draw_text_ext_colour: (m, a) => F.draw_text_ext_color(m, a),
    draw_rectangle: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        const x1 = Math.min(num(a[0]), num(a[2]));
        const y1 = Math.min(num(a[1]), num(a[3]));
        const w = Math.abs(num(a[2]) - num(a[0])) + 1;
        const h = Math.abs(num(a[3]) - num(a[1])) + 1;
        if (verdade(a[4])) ctx.rect(x1 + 0.5, y1 + 0.5, w - 1, h - 1);
        else ctx.rect(x1, y1, w, h);
        preencher(m, ctx, verdade(a[4]), m.d.cor);
    }),
    draw_rectangle_color: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.rect(Math.min(num(a[0]), num(a[2])), Math.min(num(a[1]), num(a[3])), Math.abs(num(a[2]) - num(a[0])) + 1,
            Math.abs(num(a[3]) - num(a[1])) + 1);
        preencher(m, ctx, verdade(a[8]), paraInt(a[4]));
    }),
    draw_rectangle_colour: (m, a) => F.draw_rectangle_color(m, a),
    draw_roundrect: (m, a) => F.draw_rectangle(m, a),
    draw_clear: (m, a) => comCtx(m, ctx => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = corCss(paraInt(a[0]));
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }),
    draw_clear_alpha: (m, a) => comCtx(m, ctx => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (num(a[1]) > 0) {
            ctx.fillStyle = corCss(paraInt(a[0]), num(a[1]));
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        ctx.restore();
    }),
    draw_line: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.moveTo(num(a[0]) + 0.5, num(a[1]) + 0.5);
        ctx.lineTo(num(a[2]) + 0.5, num(a[3]) + 0.5);
        preencher(m, ctx, true, m.d.cor);
    }),
    draw_line_width: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.moveTo(num(a[0]), num(a[1]));
        ctx.lineTo(num(a[2]), num(a[3]));
        ctx.lineWidth = num(a[4]);
        ctx.globalAlpha = m.d.alpha;
        ctx.strokeStyle = corCss(m.d.cor);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }),
    draw_line_color: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.moveTo(num(a[0]), num(a[1]));
        ctx.lineTo(num(a[2]), num(a[3]));
        preencher(m, ctx, true, paraInt(a[4]));
    }),
    draw_line_colour: (m, a) => F.draw_line_color(m, a),
    draw_point: (m, a) => comCtx(m, ctx => {
        ctx.globalAlpha = m.d.alpha;
        ctx.fillStyle = corCss(m.d.cor);
        ctx.fillRect(num(a[0]), num(a[1]), 1, 1);
        ctx.globalAlpha = 1;
    }),
    draw_circle: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.arc(num(a[0]), num(a[1]), Math.max(0, num(a[2])), 0, Math.PI * 2);
        preencher(m, ctx, verdade(a[3]), m.d.cor);
    }),
    draw_circle_color: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.arc(num(a[0]), num(a[1]), Math.max(0, num(a[2])), 0, Math.PI * 2);
        preencher(m, ctx, verdade(a[5]), paraInt(a[3]));
    }),
    draw_circle_colour: (m, a) => F.draw_circle_color(m, a),
    draw_ellipse: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.ellipse((num(a[0]) + num(a[2])) / 2, (num(a[1]) + num(a[3])) / 2, Math.abs(num(a[2]) - num(a[0])) / 2,
            Math.abs(num(a[3]) - num(a[1])) / 2, 0, 0, Math.PI * 2);
        preencher(m, ctx, verdade(a[4]), m.d.cor);
    }),
    draw_triangle: (m, a) => comCtx(m, ctx => {
        ctx.beginPath();
        ctx.moveTo(num(a[0]), num(a[1]));
        ctx.lineTo(num(a[2]), num(a[3]));
        ctx.lineTo(num(a[4]), num(a[5]));
        ctx.closePath();
        preencher(m, ctx, verdade(a[6]), m.d.cor);
    }),
    draw_healthbar: (m, a) => comCtx(m, ctx => {
        const x1 = num(a[0]);
        const y1 = num(a[1]);
        const x2 = num(a[2]);
        const y2 = num(a[3]);
        const v = Math.max(0, Math.min(100, num(a[4]))) / 100;
        ctx.globalAlpha = m.d.alpha;
        if (verdade(a[10])) {
            ctx.fillStyle = corCss(paraInt(a[5]));
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        }
        ctx.fillStyle = corCss(v > 0.5 ? paraInt(a[7]) : paraInt(a[6]));
        ctx.fillRect(x1, y1, (x2 - x1) * v, y2 - y1);
        if (verdade(a[11])) {
            ctx.strokeStyle = '#000';
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        }
        ctx.globalAlpha = 1;
    }),
    gpu_set_blendmode: (m, a) => {
        const b = paraInt(a[0]);
        m.blend = b === 1 ? 'lighter' : (b === 3 ? 'destination-out' : 'source-over');
        alvoCtx(m).globalCompositeOperation = m.blend;
    },
    draw_set_blend_mode: (m, a) => F.gpu_set_blendmode(m, a),
    gpu_set_blendmode_ext: () => {},
    draw_set_blend_mode_ext: () => {},
    make_color_rgb: (m, a) => (paraInt(a[0]) & 0xff) | ((paraInt(a[1]) & 0xff) << 8) | ((paraInt(a[2]) & 0xff) << 16),
    make_colour_rgb: (m, a) => F.make_color_rgb(m, a),
    make_color_hsv: (m, a) => {
        const h = num(a[0]) / 255 * 6;
        const sat = num(a[1]) / 255;
        const v = num(a[2]) / 255;
        const i = Math.floor(h) % 6;
        const f = h - Math.floor(h);
        const p = v * (1 - sat);
        const qq = v * (1 - (f * sat));
        const t = v * (1 - ((1 - f) * sat));
        const [r, g, b] = [[v, t, p], [qq, v, p], [p, v, t], [p, qq, v], [t, p, v], [v, p, qq]][i];
        return Math.round(r * 255) | (Math.round(g * 255) << 8) | (Math.round(b * 255) << 16);
    },
    make_colour_hsv: (m, a) => F.make_color_hsv(m, a),
    color_get_red: (m, a) => paraInt(a[0]) & 0xff,
    color_get_green: (m, a) => (paraInt(a[0]) >> 8) & 0xff,
    color_get_blue: (m, a) => (paraInt(a[0]) >> 16) & 0xff,
    colour_get_red: (m, a) => paraInt(a[0]) & 0xff,
    colour_get_green: (m, a) => (paraInt(a[0]) >> 8) & 0xff,
    colour_get_blue: (m, a) => (paraInt(a[0]) >> 16) & 0xff,
    merge_color: (m, a) => {
        const c1 = paraInt(a[0]);
        const c2 = paraInt(a[1]);
        const t = Math.max(0, Math.min(1, num(a[2])));
        let r = 0;
        for (let k = 0; k < 24; k += 8) {
            const x = (c1 >> k) & 0xff;
            const y = (c2 >> k) & 0xff;
            r |= (Math.round(x + ((y - x) * t)) & 0xff) << k;
        }
        return r;
    },
    merge_colour: (m, a) => F.merge_color(m, a)
});

// ---------------------------------------------------------------- superfícies (canvas extras)
let proxSup = 1;
Object.assign(F, {
    surface_create: (m, a) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, paraInt(a[0]));
        c.height = Math.max(1, paraInt(a[1]));
        const id = proxSup++;
        m.superficies.set(id, {canvas: c, ctx: c.getContext('2d')});
        return id;
    },
    surface_exists: (m, a) => (m.superficies.has(paraInt(a[0])) ? 1 : 0),
    surface_free: (m, a) => m.superficies.delete(paraInt(a[0])),
    surface_get_width: (m, a) => {
        const sp = m.superficies.get(paraInt(a[0]));
        return sp ? sp.canvas.width : m.canvas.width;
    },
    surface_get_height: (m, a) => {
        const sp = m.superficies.get(paraInt(a[0]));
        return sp ? sp.canvas.height : m.canvas.height;
    },
    surface_resize: (m, a) => {
        const sp = m.superficies.get(paraInt(a[0]));
        if (sp) {
            sp.canvas.width = Math.max(1, paraInt(a[1]));
            sp.canvas.height = Math.max(1, paraInt(a[2]));
        }
    },
    surface_set_target: (m, a) => {
        const sp = m.superficies.get(paraInt(a[0]));
        if (!sp) return 0;
        m.alvoSuperficie.push(sp);
        sp.ctx.setTransform(1, 0, 0, 1, 0, 0);
        return 1;
    },
    surface_reset_target: m => {
        m.alvoSuperficie.pop();
        return 1;
    },
    surface_get_target: () => -1,
    draw_surface: (m, a) => comCtx(m, ctx => {
        const sp = m.superficies.get(paraInt(a[0]));
        if (!sp) return;
        ctx.globalAlpha = m.d.alpha;
        ctx.drawImage(sp.canvas, num(a[1]), num(a[2]));
        ctx.globalAlpha = 1;
    }),
    draw_surface_ext: (m, a) => comCtx(m, ctx => {
        const sp = m.superficies.get(paraInt(a[0]));
        if (!sp) return;
        ctx.save();
        ctx.globalAlpha = num(a[7]);
        ctx.translate(num(a[1]), num(a[2]));
        ctx.rotate(-rad(num(a[5])));
        ctx.scale(num(a[3]), num(a[4]));
        ctx.drawImage(sp.canvas, 0, 0);
        ctx.restore();
    }),
    draw_surface_stretched: (m, a) => comCtx(m, ctx => {
        const sp = m.superficies.get(paraInt(a[0]));
        if (sp) ctx.drawImage(sp.canvas, num(a[1]), num(a[2]), num(a[3]), num(a[4]));
    }),
    draw_surface_part: (m, a) => comCtx(m, ctx => {
        const sp = m.superficies.get(paraInt(a[0]));
        if (sp) ctx.drawImage(sp.canvas, num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5]), num(a[6]), num(a[3]), num(a[4]));
    })
});

// ---------------------------------------------------------------- câmeras (GMS 2)
let proxCam = 8;
const cam = (m, v) => {
    const id = paraInt(v);
    if (id >= 0 && id < 8) {
        const V = m.vistas;
        return {
            get x () {
                return V.xview[id];
            },
            set x (n) {
                V.xview[id] = n;
            },
            get y () {
                return V.yview[id];
            },
            set y (n) {
                V.yview[id] = n;
            },
            get w () {
                return V.wview[id];
            },
            set w (n) {
                V.wview[id] = n;
            },
            get h () {
                return V.hview[id];
            },
            set h (n) {
                V.hview[id] = n;
            },
            get ang () {
                return V.angle[id];
            },
            set ang (n) {
                V.angle[id] = n;
            },
            get alvo () {
                return V.object[id];
            },
            set alvo (n) {
                V.object[id] = n;
            }
        };
    }
    return m.camerasExtras.get(id) || null;
};
Object.assign(F, {
    camera_create: m => {
        const id = proxCam++;
        m.camerasExtras.set(id, {x: 0, y: 0, w: m.canvas.width, h: m.canvas.height, ang: 0, alvo: -4});
        return id;
    },
    camera_create_view: (m, a) => {
        const id = proxCam++;
        m.camerasExtras.set(id, {x: num(a[0]), y: num(a[1]), w: num(a[2]), h: num(a[3]), ang: num(a[4]), alvo: paraInt(a[5])});
        return id;
    },
    camera_destroy: (m, a) => m.camerasExtras.delete(paraInt(a[0])),
    camera_get_view_x: (m, a) => (cam(m, a[0]) || {x: 0}).x,
    camera_get_view_y: (m, a) => (cam(m, a[0]) || {y: 0}).y,
    camera_get_view_width: (m, a) => (cam(m, a[0]) || {w: 0}).w,
    camera_get_view_height: (m, a) => (cam(m, a[0]) || {h: 0}).h,
    camera_get_view_angle: (m, a) => (cam(m, a[0]) || {ang: 0}).ang,
    camera_get_view_target: (m, a) => (cam(m, a[0]) || {alvo: -4}).alvo,
    camera_set_view_pos: (m, a) => {
        const c = cam(m, a[0]);
        if (c) {
            c.x = num(a[1]);
            c.y = num(a[2]);
        }
    },
    camera_set_view_size: (m, a) => {
        const c = cam(m, a[0]);
        if (c) {
            c.w = num(a[1]);
            c.h = num(a[2]);
        }
    },
    camera_set_view_angle: (m, a) => {
        const c = cam(m, a[0]);
        if (c) c.ang = num(a[1]);
    },
    camera_set_view_target: (m, a) => {
        const c = cam(m, a[0]);
        if (c) c.alvo = paraInt(a[1]);
    },
    camera_set_view_border: () => {},
    camera_set_view_speed: () => {},
    camera_get_active: m => m.vistas.camera[m.view_current],
    camera_get_default: () => 0,
    view_get_camera: (m, a) => m.vistas.camera[paraInt(a[0])],
    view_set_camera: (m, a) => {
        m.vistas.camera[paraInt(a[0])] = paraInt(a[1]);
    },
    view_get_visible: (m, a) => m.vistas.visible[paraInt(a[0])],
    view_set_visible: (m, a) => {
        m.vistas.visible[paraInt(a[0])] = verdade(a[1]) ? 1 : 0;
    },
    view_get_wport: (m, a) => m.vistas.wport[paraInt(a[0])],
    view_get_hport: (m, a) => m.vistas.hport[paraInt(a[0])],
    view_set_wport: (m, a) => {
        m.vistas.wport[paraInt(a[0])] = num(a[1]);
        m.ajustarTela();
    },
    view_set_hport: (m, a) => {
        m.vistas.hport[paraInt(a[0])] = num(a[1]);
        m.ajustarTela();
    },
    layer_get_id: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        return c ? c.id : -1;
    },
    layer_exists: (m, a) => (camadaPorNome(m, a[0]) ? 1 : 0),
    layer_get_depth: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        return c ? c.prof : 0;
    },
    layer_set_visible: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        if (c) c.visivel = verdade(a[1]);
    },
    layer_get_visible: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        return c && c.visivel ? 1 : 0;
    },
    layer_x: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        if (c) c.x = num(a[1]) - c.dx;
    },
    layer_y: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        if (c) c.y = num(a[1]) - c.dy;
    },
    layer_get_x: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        return c ? c.x + c.dx : 0;
    },
    layer_get_y: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        return c ? c.y + c.dy : 0;
    },
    layer_hspeed: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        if (c) c.vx = num(a[1]);
    },
    layer_vspeed: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        if (c) c.vy = num(a[1]);
    },
    layer_depth: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        if (c) c.prof = num(a[1]);
    },
    layer_create: (m, a) => {
        const id = 1e6 + m.camadas.length;
        m.camadas.push({nome: typeof a[1] === 'string' ? a[1] : `camada_${id}`,
            id,
            tipo: 2,
            prof: num(a[0]),
            dx: 0,
            dy: 0,
            vx: 0,
            vy: 0,
            x: 0,
            y: 0,
            visivel: true});
        return id;
    },
    layer_background_get_id: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        return c && c.fundo ? c.id : -1;
    },
    layer_background_blend: (m, a) => {
        const c = m.camadas.find(x => x.id === paraInt(a[0]));
        if (c && c.fundo) c.fundo.cor = (c.fundo.cor & 0xff000000) | (paraInt(a[1]) & 0xffffff);
    },
    layer_background_change: (m, a) => {
        const c = m.camadas.find(x => x.id === paraInt(a[0]));
        if (c && c.fundo) c.fundo.sprite = paraInt(a[1]);
    },
    layer_background_visible: (m, a) => {
        const c = m.camadas.find(x => x.id === paraInt(a[0]));
        if (c && c.fundo) c.fundo.visivel = verdade(a[1]);
    },
    layer_tilemap_get_id: (m, a) => {
        const c = camadaPorNome(m, a[0]);
        return c && c.mapa ? c.id : -1;
    },
    tilemap_get_at_pixel: (m, a) => {
        const c = m.camadas.find(x => x.id === paraInt(a[0]));
        if (!c || !c.mapa) return 0;
        const ts = m.dw.fundos[c.mapa.fundo];
        if (!ts || !ts.tw) return 0;
        const tx = Math.floor((num(a[1]) - c.dx - c.x) / ts.tw);
        const ty = Math.floor((num(a[2]) - c.dy - c.y) / ts.th);
        if (tx < 0 || ty < 0 || tx >= c.mapa.tx || ty >= c.mapa.ty) return 0;
        return c.mapa.dados[(ty * c.mapa.tx) + tx];
    },
    tile_get_index: (m, a) => paraInt(a[0]) & 0x7ffff,
    tile_layer_hide: (m, a) => {
        for (const t of m.tiles) if (t.prof === num(a[0])) t.visivel = false;
    },
    tile_layer_show: (m, a) => {
        for (const t of m.tiles) if (t.prof === num(a[0])) t.visivel = true;
    },
    tile_layer_shift: (m, a) => {
        for (const t of m.tiles) {
            if (t.prof === num(a[0])) {
                t.x += num(a[1]);
                t.y += num(a[2]);
            }
        }
    },
    tile_layer_delete: (m, a) => {
        m.tiles = m.tiles.filter(t => t.prof !== num(a[0]));
    },
    tile_layer_depth: (m, a) => {
        for (const t of m.tiles) if (t.prof === num(a[0])) t.prof = num(a[1]);
    }
});

// ---------------------------------------------------------------- teclado e mouse
const tecla = (m, v) => paraInt(v);
Object.assign(F, {
    keyboard_check: (m, a) => {
        const k = tecla(m, a[0]);
        if (k === 1) return m.teclas.size ? 1 : 0;
        if (k === 0) return m.teclas.size ? 0 : 1;
        return m.teclas.has(k) ? 1 : 0;
    },
    keyboard_check_pressed: (m, a) => {
        const k = tecla(m, a[0]);
        if (k === 1) return m.apertadas.size ? 1 : 0;
        return m.apertadas.has(k) ? 1 : 0;
    },
    keyboard_check_released: (m, a) => {
        const k = tecla(m, a[0]);
        if (k === 1) return m.soltas.size ? 1 : 0;
        return m.soltas.has(k) ? 1 : 0;
    },
    keyboard_check_direct: (m, a) => (m.teclas.has(tecla(m, a[0])) ? 1 : 0),
    keyboard_clear: (m, a) => {
        const k = tecla(m, a[0]);
        m.teclas.delete(k);
        m.apertadas.delete(k);
        m.soltas.delete(k);
    },
    io_clear: m => {
        m.teclas.clear();
        m.apertadas.clear();
        m.soltas.clear();
    },
    keyboard_set_map: () => {},
    keyboard_unset_map: () => {},
    mouse_check_button: (m, a) => (m.mouse.botoes.has(paraInt(a[0])) || (paraInt(a[0]) === -1 && m.mouse.botoes.size) ? 1 : 0),
    mouse_check_button_pressed: (m, a) => (m.mouse.apertados.has(paraInt(a[0])) ? 1 : 0),
    mouse_check_button_released: (m, a) => (m.mouse.soltos.has(paraInt(a[0])) ? 1 : 0),
    mouse_clear: m => m.mouse.botoes.clear(),
    device_mouse_x_to_gui: m => m.mouse.guiX || 0,
    device_mouse_y_to_gui: m => m.mouse.guiY || 0,
    window_mouse_get_x: m => m.mouse.guiX || 0,
    window_mouse_get_y: m => m.mouse.guiY || 0
});

// ---------------------------------------------------------------- som
let proxVoz = 200000;
// arquivos extras (músicas .ogg, audiogroupN.dat): guardados como File e lidos só quando precisa
const lerExtra = async (m, nome) => {
    const e = m.extras.get(nome);
    if (!e) return null;
    if (!e.dados && e.arquivo) e.dados = await e.arquivo.arrayBuffer();
    return e.dados || null;
};
const lerGrupo = async (m, nomeArq) => {
    // audiogroupN.dat: um FORM com o bloco AUDO
    const e = m.extras.get(nomeArq);
    if (!e) return null;
    if (e.audos) return e.audos;
    const buf = await lerExtra(m, nomeArq);
    if (!buf) return null;
    const d = new Uint8Array(buf);
    const dv = new DataView(buf);
    let p = 8;
    const lista = [];
    while (p + 8 <= d.length) {
        const nome = String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]);
        const t = dv.getUint32(p + 4, true);
        if (nome === 'AUDO') {
            const n = dv.getUint32(p + 8, true);
            for (let i = 0; i < n; i++) {
                const q = dv.getUint32(p + 12 + (i * 4), true);
                lista.push({ini: q + 4, tam: dv.getUint32(q, true), dados: d});
            }
        }
        p += 8 + t;
    }
    e.audos = lista;
    return lista;
};
const nomeArquivoDoSom = so => (so.externo || (so.arquivo || '').split(/[\\/]/).pop()).toLowerCase();
const bytesDoSom = async (m, idx) => {
    const so = m.dw.sons[idx];
    if (!so) return null;
    if (!so.externo && so.audio >= 0 && so.grupo > 0) {
        const lista = await lerGrupo(m, `audiogroup${so.grupo}.dat`);
        const a = lista && lista[so.audio];
        return a ? a.dados.subarray(a.ini, a.ini + a.tam) : null;
    }
    if (!so.externo && so.audio >= 0 && (so.flags & 1)) {
        const a = m.dw.audios[so.audio];
        return a ? m.dw.bytes.subarray(a.ini, a.ini + a.tam) : null;
    }
    // música em arquivo separado (ex.: mus_story.ogg na pasta do jogo)
    const nome = nomeArquivoDoSom(so);
    const achado = m.extras.has(nome) ? nome : `${so.nome}.ogg`.toLowerCase();
    const buf = await lerExtra(m, achado);
    if (!buf) {
        if (!m.musicasFaltando.has(nome)) {
            m.musicasFaltando.add(nome);
            m.erro(`música não encontrada: ${nome} (abra a pasta do jogo junto com o data.win)`);
        }
        return null;
    }
    return new Uint8Array(buf);
};
const buffer = (m, idx) => {
    if (m.buffers.has(idx)) return m.buffers.get(idx);
    const p = (async () => {
        if (!m.audio) return null;
        const bytes = await bytesDoSom(m, idx);
        if (!bytes) return null;
        try {
            return await m.audio.ctx.decodeAudioData(bytes.slice().buffer);
        } catch (e) {
            m.erro(`não consegui tocar o som ${(m.dw.sons[idx] || {}).nome}: ${e.message || e}`);
            return null;
        }
    })();
    m.buffers.set(idx, p);
    return p;
};
// ganho/tom definidos no próprio som (audio_sound_gain com o índice do som) valem para as próximas vezes
const ganhoDoSom = so => (so.ganhoAsset === undefined ? 1 : so.ganhoAsset);
const tomDoSom = so => (so.tomAsset === undefined ? 1 : so.tomAsset);
const tocar = (m, snd, loop, ganho = 1, tom = 1) => {
    const idx = paraInt(snd);
    const so = m.dw.sons[idx];
    if (!so || !m.audio) return -1;
    const id = ++proxVoz;
    const voz = {id,
        som: idx,
        loop,
        ganho: ganho * ganhoDoSom(so),
        base: so.volume > 0 ? so.volume : 1,
        tom: tom * tomDoSom(so),
        fonte: null,
        no: null,
        inicio: 0,
        pausada: false,
        acabou: false};
    m.vozes.set(id, voz);
    buffer(m, idx).then(buf => {
        if (!buf || voz.acabou || !m.rodando) {
            m.vozes.delete(id);
            return;
        }
        const ctx = m.audio.ctx;
        const g = ctx.createGain();
        g.gain.value = voz.pausada ? 0 : voz.ganho * voz.base;
        g.connect(m.audio.destino);
        const f = ctx.createBufferSource();
        f.buffer = buf;
        f.loop = loop;
        f.playbackRate.value = voz.pausada ? 0.0001 : voz.tom;
        f.connect(g);
        f.onended = () => {
            if (!voz.pausada) {
                voz.acabou = true;
                m.vozes.delete(id);
            }
        };
        f.start();
        voz.inicio = ctx.currentTime;
        voz.fonte = f;
        voz.no = g;
    });
    return id;
};
const vozesDe = (m, v) => {
    const n = paraInt(v);
    if (m.vozes.has(n)) return [m.vozes.get(n)];
    return Array.from(m.vozes.values()).filter(x => x.som === n);
};
const pararVoz = (m, voz) => {
    voz.acabou = true;
    try {
        if (voz.fonte) voz.fonte.stop();
    } catch (e) {
        // já parou
    }
    m.vozes.delete(voz.id);
};
Object.assign(F, {
    audio_play_sound: (m, a) => tocar(m, a[0], verdade(a[2]), a[3] === undefined ? 1 : num(a[3]), a[5] === undefined ? 1 : num(a[5])),
    audio_play_sound_at: (m, a) => tocar(m, a[0], verdade(a[8])),
    audio_play_sound_on: (m, a) => tocar(m, a[1], verdade(a[2])),
    audio_play_music: (m, a) => tocar(m, a[0], verdade(a[1])),
    sound_play: (m, a) => tocar(m, a[0], false),
    sound_loop: (m, a) => tocar(m, a[0], true),
    sound_stop: (m, a) => vozesDe(m, a[0]).forEach(v => pararVoz(m, v)),
    sound_isplaying: (m, a) => (vozesDe(m, a[0]).length ? 1 : 0),
    sound_volume: (m, a) => F.audio_sound_gain(m, [a[0], a[1], 0]),
    audio_stop_sound: (m, a) => vozesDe(m, a[0]).forEach(v => pararVoz(m, v)),
    audio_stop_all: m => Array.from(m.vozes.values()).forEach(v => pararVoz(m, v)),
    audio_stop_music: m => Array.from(m.vozes.values()).forEach(v => pararVoz(m, v)),
    audio_is_playing: (m, a) => (vozesDe(m, a[0]).some(v => !v.pausada) ? 1 : 0),
    audio_is_paused: (m, a) => (vozesDe(m, a[0]).some(v => v.pausada) ? 1 : 0),
    audio_exists: (m, a) => (m.dw.sons[paraInt(a[0])] ? 1 : 0),
    audio_get_name: (m, a) => (m.dw.sons[paraInt(a[0])] || {}).nome || '',
    audio_sound_gain: (m, a) => {
        const so = m.dw.sons[paraInt(a[0])];
        if (so && !m.vozes.has(paraInt(a[0]))) so.ganhoAsset = num(a[1]);
        for (const v of vozesDe(m, a[0])) {
            v.ganho = num(a[1]);
            if (v.no && !v.pausada) {
                const t = m.audio.ctx.currentTime;
                const dur = Math.max(0, num(a[2])) / 1000;
                v.no.gain.cancelScheduledValues(t);
                v.no.gain.setValueAtTime(v.no.gain.value, t);
                if (dur > 0) v.no.gain.linearRampToValueAtTime(v.ganho * v.base, t + dur);
                else v.no.gain.setValueAtTime(v.ganho * v.base, t);
            }
        }
    },
    audio_sound_get_gain: (m, a) => {
        const v = vozesDe(m, a[0])[0];
        if (v) return v.ganho;
        const so = m.dw.sons[paraInt(a[0])];
        return so ? ganhoDoSom(so) : 1;
    },
    audio_sound_pitch: (m, a) => {
        const so = m.dw.sons[paraInt(a[0])];
        if (so && !m.vozes.has(paraInt(a[0]))) so.tomAsset = num(a[1]);
        for (const v of vozesDe(m, a[0])) {
            v.tom = num(a[1]);
            if (v.fonte && !v.pausada) v.fonte.playbackRate.value = v.tom;
        }
    },
    audio_sound_get_pitch: (m, a) => {
        const v = vozesDe(m, a[0])[0];
        if (v) return v.tom;
        const so = m.dw.sons[paraInt(a[0])];
        return so ? tomDoSom(so) : 1;
    },
    audio_pause_sound: (m, a) => {
        for (const v of vozesDe(m, a[0])) {
            v.pausada = true;
            if (v.fonte) v.fonte.playbackRate.value = 0.0001;
            if (v.no) v.no.gain.value = 0;
        }
    },
    audio_resume_sound: (m, a) => {
        for (const v of vozesDe(m, a[0])) {
            v.pausada = false;
            if (v.fonte) v.fonte.playbackRate.value = v.tom;
            if (v.no) v.no.gain.value = v.ganho * v.base;
        }
    },
    audio_pause_all: m => Array.from(m.vozes.keys()).forEach(id => F.audio_pause_sound(m, [id])),
    audio_resume_all: m => Array.from(m.vozes.keys()).forEach(id => F.audio_resume_sound(m, [id])),
    audio_sound_get_track_position: (m, a) => {
        const v = vozesDe(m, a[0])[0];
        if (!v || !v.fonte || !v.fonte.buffer) return 0;
        const d = v.fonte.buffer.duration;
        const t = (m.audio.ctx.currentTime - v.inicio) * v.tom;
        return v.loop ? t % d : Math.min(d, t);
    },
    audio_sound_set_track_position: () => {},
    audio_sound_length: (m, a) => {
        const v = vozesDe(m, a[0])[0];
        return v && v.fonte && v.fonte.buffer ? v.fonte.buffer.duration : 0;
    },
    audio_master_gain: () => {},
    audio_set_master_gain: () => {},
    audio_channel_num: () => {},
    audio_falloff_set_model: () => {},
    audio_listener_orientation: () => {},
    audio_listener_position: () => {},
    audio_group_load: () => 1,
    audio_group_is_loaded: () => 1,
    audio_group_set_gain: () => {},
    audio_group_stop_all: m => Array.from(m.vozes.values()).forEach(v => pararVoz(m, v)),
    audio_create_stream: (m, a) => {
        const nome = texto(m, a[0]).split(/[\\/]/)
            .pop()
            .toLowerCase();
        m.dw.sons.push({nome, flags: 0, tipo: '.ogg', arquivo: nome, volume: 1, tom: 1, grupo: 0, audio: -1, externo: nome});
        return m.dw.sons.length - 1;
    },
    audio_destroy_stream: () => {},
    audio_emitter_create: () => 1,
    audio_emitter_free: () => {},
    audio_emitter_gain: () => {},
    audio_emitter_pitch: () => {},
    audio_emitter_position: () => {}
});

// ---------------------------------------------------------------- estruturas de dados
const ds = (m, tipo) => {
    if (!m.ds[tipo]) m.ds[tipo] = {prox: 0, itens: new Map()};
    return m.ds[tipo];
};
const novoDs = (m, tipo, valor) => {
    const d = ds(m, tipo);
    const id = d.prox++;
    d.itens.set(id, valor);
    return id;
};
const pegaDs = (m, tipo, id) => ds(m, tipo).itens.get(paraInt(id));
const chaveMapa = v => (typeof v === 'string' ? `s:${v}` : `n:${num(v)}`);
const valorChave = k => (k.startsWith('s:') ? k.slice(2) : Number(k.slice(2)));
Object.assign(F, {
    ds_list_create: m => novoDs(m, 'lista', []),
    ds_list_destroy: (m, a) => ds(m, 'lista').itens.delete(paraInt(a[0])),
    ds_list_exists: (m, a) => (pegaDs(m, 'lista', a[0]) ? 1 : 0),
    ds_list_add: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        if (l) l.push(...a.slice(1));
    },
    ds_list_set: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        if (l) l[paraInt(a[1])] = a[2];
    },
    ds_list_insert: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        if (l) l.splice(paraInt(a[1]), 0, a[2]);
    },
    ds_list_delete: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        if (l) l.splice(paraInt(a[1]), 1);
    },
    ds_list_find_value: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        return l ? l[paraInt(a[1])] : undefined;
    },
    ds_list_find_index: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        return l ? l.findIndex(x => igual(x, a[1])) : -1;
    },
    ds_list_size: (m, a) => (pegaDs(m, 'lista', a[0]) || []).length,
    ds_list_empty: (m, a) => ((pegaDs(m, 'lista', a[0]) || []).length ? 0 : 1),
    ds_list_clear: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        if (l) l.length = 0;
    },
    ds_list_shuffle: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        if (!l) return;
        for (let i = l.length - 1; i > 0; i--) {
            const j = Math.floor(aleat() * (i + 1));
            [l[i], l[j]] = [l[j], l[i]];
        }
    },
    ds_list_sort: (m, a) => {
        const l = pegaDs(m, 'lista', a[0]);
        if (l) l.sort((x, y) => (verdade(a[1]) ? 1 : -1) * (typeof x === 'string' ? String(x).localeCompare(y) : num(x) - num(y)));
    },
    ds_list_copy: (m, a) => {
        const d = pegaDs(m, 'lista', a[0]);
        const o = pegaDs(m, 'lista', a[1]);
        if (d && o) d.splice(0, d.length, ...o);
    },
    ds_map_create: m => novoDs(m, 'mapa', new Map()),
    ds_map_destroy: (m, a) => ds(m, 'mapa').itens.delete(paraInt(a[0])),
    ds_map_exists: (m, a) => (pegaDs(m, 'mapa', a[0]) && pegaDs(m, 'mapa', a[0]).has(chaveMapa(a[1])) ? 1 : 0),
    ds_map_add: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        if (d && !d.has(chaveMapa(a[1]))) d.set(chaveMapa(a[1]), a[2]);
    },
    ds_map_set: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        if (d) d.set(chaveMapa(a[1]), a[2]);
    },
    ds_map_replace: (m, a) => F.ds_map_set(m, a),
    ds_map_find_value: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        return d ? d.get(chaveMapa(a[1])) : undefined;
    },
    ds_map_delete: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        if (d) d.delete(chaveMapa(a[1]));
    },
    ds_map_size: (m, a) => (pegaDs(m, 'mapa', a[0]) || new Map()).size,
    ds_map_empty: (m, a) => ((pegaDs(m, 'mapa', a[0]) || new Map()).size ? 0 : 1),
    ds_map_clear: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        if (d) d.clear();
    },
    ds_map_find_first: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        const k = d && d.keys().next();
        return k && !k.done ? valorChave(k.value) : undefined;
    },
    ds_map_find_next: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        if (!d) return undefined;
        const ks = Array.from(d.keys());
        const i = ks.indexOf(chaveMapa(a[1]));
        return i >= 0 && i + 1 < ks.length ? valorChave(ks[i + 1]) : undefined;
    },
    ds_map_keys_to_array: (m, a) => Array.from((pegaDs(m, 'mapa', a[0]) || new Map()).keys()).map(valorChave),
    ds_grid_create: (m, a) => novoDs(m, 'grade', {w: paraInt(a[0]),
        h: paraInt(a[1]),
        c: new Array(Math.max(0, paraInt(a[0]) * paraInt(a[1]))).fill(0)}),
    ds_grid_destroy: (m, a) => ds(m, 'grade').itens.delete(paraInt(a[0])),
    ds_grid_width: (m, a) => (pegaDs(m, 'grade', a[0]) || {w: 0}).w,
    ds_grid_height: (m, a) => (pegaDs(m, 'grade', a[0]) || {h: 0}).h,
    ds_grid_get: (m, a) => {
        const g = pegaDs(m, 'grade', a[0]);
        const x = paraInt(a[1]);
        const y = paraInt(a[2]);
        return g && x >= 0 && y >= 0 && x < g.w && y < g.h ? g.c[(y * g.w) + x] : undefined;
    },
    ds_grid_set: (m, a) => {
        const g = pegaDs(m, 'grade', a[0]);
        const x = paraInt(a[1]);
        const y = paraInt(a[2]);
        if (g && x >= 0 && y >= 0 && x < g.w && y < g.h) g.c[(y * g.w) + x] = a[3];
    },
    ds_grid_clear: (m, a) => {
        const g = pegaDs(m, 'grade', a[0]);
        if (g) g.c.fill(a[1]);
    },
    ds_grid_resize: (m, a) => {
        const g = pegaDs(m, 'grade', a[0]);
        if (!g) return;
        const w = paraInt(a[1]);
        const h = paraInt(a[2]);
        const c = new Array(w * h).fill(0);
        for (let y = 0; y < Math.min(h, g.h); y++) {
            for (let x = 0; x < Math.min(w, g.w); x++) c[(y * w) + x] = g.c[(y * g.w) + x];
        }
        Object.assign(g, {w, h, c});
    },
    ds_stack_create: m => novoDs(m, 'pilha', []),
    ds_stack_destroy: (m, a) => ds(m, 'pilha').itens.delete(paraInt(a[0])),
    ds_stack_push: (m, a) => {
        const p = pegaDs(m, 'pilha', a[0]);
        if (p) p.push(...a.slice(1));
    },
    ds_stack_pop: (m, a) => (pegaDs(m, 'pilha', a[0]) || []).pop(),
    ds_stack_top: (m, a) => {
        const p = pegaDs(m, 'pilha', a[0]) || [];
        return p[p.length - 1];
    },
    ds_stack_size: (m, a) => (pegaDs(m, 'pilha', a[0]) || []).length,
    ds_stack_empty: (m, a) => ((pegaDs(m, 'pilha', a[0]) || []).length ? 0 : 1),
    ds_queue_create: m => novoDs(m, 'fila', []),
    ds_queue_destroy: (m, a) => ds(m, 'fila').itens.delete(paraInt(a[0])),
    ds_queue_enqueue: (m, a) => {
        const p = pegaDs(m, 'fila', a[0]);
        if (p) p.push(...a.slice(1));
    },
    ds_queue_dequeue: (m, a) => (pegaDs(m, 'fila', a[0]) || []).shift(),
    ds_queue_head: (m, a) => (pegaDs(m, 'fila', a[0]) || [])[0],
    ds_queue_size: (m, a) => (pegaDs(m, 'fila', a[0]) || []).length,
    ds_queue_empty: (m, a) => ((pegaDs(m, 'fila', a[0]) || []).length ? 0 : 1),
    ds_exists: () => 1
});

// ---------------------------------------------------------------- arquivos (.ini e texto, guardados no navegador)
const lerIni = t => {
    const r = new Map();
    let sec = '';
    for (const linha of String(t || '').split(/\r?\n/)) {
        const l = linha.trim();
        if (!l || l.startsWith(';')) continue;
        const ms = /^\[(.*)\]$/.exec(l);
        if (ms) {
            sec = ms[1];
            if (!r.has(sec)) r.set(sec, new Map());
            continue;
        }
        const i = l.indexOf('=');
        if (i > 0) {
            if (!r.has(sec)) r.set(sec, new Map());
            let v = l.slice(i + 1).trim();
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            r.get(sec).set(l.slice(0, i).trim(), v);
        }
    }
    return r;
};
const escreverIni = mapa => Array.from(mapa.entries()).map(([sec, kv]) =>
    `[${sec}]\r\n${Array.from(kv.entries()).map(([k, v]) => `${k}="${v}"`)
        .join('\r\n')}`)
    .join('\r\n');
const nomeArq = (m, v) => texto(m, v).replace(/\\/g, '/')
    .toLowerCase();
let proxArq = 1;
Object.assign(F, {
    ini_open: (m, a) => {
        const n = nomeArq(m, a[0]);
        m.ini = {nome: n, dados: lerIni(m.vfs.get(n)), mudou: false};
    },
    ini_open_from_string: (m, a) => {
        m.ini = {nome: null, dados: lerIni(texto(m, a[0])), mudou: false};
    },
    ini_close: m => {
        if (!m.ini) return '';
        const t = escreverIni(m.ini.dados);
        if (m.ini.nome && m.ini.mudou) {
            m.vfs.set(m.ini.nome, t);
            m.salvarVfs();
        }
        m.ini = null;
        return t;
    },
    ini_read_string: (m, a) => {
        const sec = m.ini && m.ini.dados.get(texto(m, a[0]));
        const v = sec && sec.get(texto(m, a[1]));
        return v === undefined ? a[2] : v;
    },
    ini_read_real: (m, a) => {
        const sec = m.ini && m.ini.dados.get(texto(m, a[0]));
        const v = sec && sec.get(texto(m, a[1]));
        if (v === undefined) return a[2];
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : a[2];
    },
    ini_write_string: (m, a) => {
        if (!m.ini) return;
        const sec = texto(m, a[0]);
        if (!m.ini.dados.has(sec)) m.ini.dados.set(sec, new Map());
        m.ini.dados.get(sec).set(texto(m, a[1]), texto(m, a[2]));
        m.ini.mudou = true;
    },
    ini_write_real: (m, a) => F.ini_write_string(m, [a[0], a[1], texto(m, num(a[2]))]),
    ini_key_exists: (m, a) => {
        const sec = m.ini && m.ini.dados.get(texto(m, a[0]));
        return sec && sec.has(texto(m, a[1])) ? 1 : 0;
    },
    ini_section_exists: (m, a) => (m.ini && m.ini.dados.has(texto(m, a[0])) ? 1 : 0),
    ini_key_delete: (m, a) => {
        const sec = m.ini && m.ini.dados.get(texto(m, a[0]));
        if (sec) {
            sec.delete(texto(m, a[1]));
            m.ini.mudou = true;
        }
    },
    ini_section_delete: (m, a) => {
        if (m.ini) {
            m.ini.dados.delete(texto(m, a[0]));
            m.ini.mudou = true;
        }
    },
    file_exists: (m, a) => (m.vfs.has(nomeArq(m, a[0])) ? 1 : 0),
    file_delete: (m, a) => {
        m.vfs.delete(nomeArq(m, a[0]));
        m.salvarVfs();
        return 1;
    },
    file_copy: (m, a) => {
        const t = m.vfs.get(nomeArq(m, a[0]));
        if (t !== undefined) {
            m.vfs.set(nomeArq(m, a[1]), t);
            m.salvarVfs();
        }
    },
    file_rename: (m, a) => {
        const t = m.vfs.get(nomeArq(m, a[0]));
        if (t !== undefined) {
            m.vfs.delete(nomeArq(m, a[0]));
            m.vfs.set(nomeArq(m, a[1]), t);
            m.salvarVfs();
        }
    },
    directory_exists: () => 1,
    directory_create: () => {},
    file_text_open_read: (m, a) => {
        const n = nomeArq(m, a[0]);
        if (!m.vfs.has(n)) return -1;
        const id = proxArq++;
        m.arquivosAbertos.set(id, {nome: n, linhas: m.vfs.get(n).split(/\r?\n/), linha: 0, col: 0, escrita: false});
        return id;
    },
    file_text_open_write: (m, a) => {
        const id = proxArq++;
        m.arquivosAbertos.set(id, {nome: nomeArq(m, a[0]), texto: '', escrita: true});
        return id;
    },
    file_text_open_append: (m, a) => {
        const n = nomeArq(m, a[0]);
        const id = proxArq++;
        m.arquivosAbertos.set(id, {nome: n, texto: m.vfs.get(n) || '', escrita: true});
        return id;
    },
    file_text_close: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (!f) return;
        if (f.escrita) {
            m.vfs.set(f.nome, f.texto);
            m.salvarVfs();
        }
        m.arquivosAbertos.delete(paraInt(a[0]));
    },
    file_text_write_string: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (f && f.escrita) f.texto += texto(m, a[1]);
    },
    file_text_write_real: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (f && f.escrita) f.texto += ` ${texto(m, num(a[1]))}`;
    },
    file_text_writeln: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (f && f.escrita) f.texto += '\r\n';
    },
    file_text_read_string: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (!f || f.escrita) return '';
        const l = f.linhas[f.linha] || '';
        const r = l.slice(f.col);
        f.col = l.length;
        return r;
    },
    file_text_read_real: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (!f || f.escrita) return 0;
        const l = f.linhas[f.linha] || '';
        const resto = l.slice(f.col);
        const ms = /^\s*(-?[0-9.]+(e-?\d+)?)/i.exec(resto);
        if (!ms) {
            f.col = l.length;
            return 0;
        }
        f.col += ms[0].length;
        return parseFloat(ms[1]);
    },
    file_text_readln: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (!f || f.escrita) return '';
        const l = (f.linhas[f.linha] || '').slice(f.col);
        f.linha++;
        f.col = 0;
        return l;
    },
    file_text_eof: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        if (!f || f.escrita) return 1;
        return f.linha >= f.linhas.length || (f.linha === f.linhas.length - 1 && f.col >= f.linhas[f.linha].length) ? 1 : 0;
    },
    file_text_eoln: (m, a) => {
        const f = m.arquivosAbertos.get(paraInt(a[0]));
        return !f || f.escrita || f.col >= (f.linhas[f.linha] || '').length ? 1 : 0;
    },
    json_encode: (m, a) => {
        const d = pegaDs(m, 'mapa', a[0]);
        if (!d) return '{}';
        return JSON.stringify(Object.fromEntries(Array.from(d.entries()).map(([k, v]) => [String(valorChave(k)), v])));
    },
    json_stringify: (m, a) => {
        const conv = v => {
            if (v instanceof Struct) return Object.fromEntries(Array.from(v.vars.entries()).map(([k, x]) => [k, conv(x)]));
            if (Array.isArray(v)) return v.map(conv);
            return v === undefined ? null : v;
        };
        return JSON.stringify(conv(a[0]));
    },
    json_parse: (m, a) => {
        const conv = v => {
            if (Array.isArray(v)) return v.map(conv);
            if (v && typeof v === 'object') {
                const st = new Struct();
                for (const [k, x] of Object.entries(v)) st.vars.set(k, conv(x));
                return st;
            }
            if (typeof v === 'boolean') return v ? 1 : 0;
            return v === null ? undefined : v;
        };
        try {
            return conv(JSON.parse(texto(m, a[0])));
        } catch (e) {
            return undefined;
        }
    }
});

// ---------------------------------------------------------------- ações antigas (arrastar e soltar do GM)
Object.assign(F, {
    sprite_prefetch: () => 0,
    sprite_prefetch_multi: () => 0,
    texture_prefetch: () => 0,
    texturegroup_load: () => 0,
    // "000010000": 9 setas do GM antigo (linha de baixo primeiro, como o teclado numérico); o 5º é parar
    action_move: (m, a, q) => {
        const i = eu(q);
        if (!i) return;
        const dirs = [225, 270, 315, 180, -1, 0, 135, 90, 45];
        const t = texto(m, a[0]);
        const opcoes = [];
        for (let k = 0; k < 9; k++) if (t[k] === '1') opcoes.push(dirs[k]);
        if (!opcoes.length) return;
        const d = opcoes[Math.floor(aleat() * opcoes.length)];
        if (d < 0) {
            i.hs = 0;
            i.vs = 0;
        } else {
            i.dir = d;
            i.speed = num(a[1]);
        }
    },
    action_move_point: (m, a, q) => F.move_towards_point(m, a, q),
    action_move_start: (m, a, q) => {
        const i = eu(q);
        if (i) {
            i.x = i.xstart;
            i.y = i.ystart;
        }
    },
    action_move_random: (m, a, q) => {
        const i = eu(q);
        if (i) {
            i.x = Math.floor(aleat() * m.room_width);
            i.y = Math.floor(aleat() * m.room_height);
        }
    },
    action_snap: (m, a, q) => F.move_snap(m, a, q),
    action_bounce: (m, a, q) => F.move_bounce_solid(m, a, q),
    action_path_end: () => {},
    action_set_timeline: () => {},
    action_sprite_set: (m, a, q) => {
        const i = eu(q);
        if (i) {
            i.sprite_index = paraInt(a[0]);
            if (num(a[1]) >= 0) i.image_index = num(a[1]);
            i.image_speed = num(a[2]);
        }
    },
    action_sprite_transform: (m, a, q) => {
        const i = eu(q);
        if (i) {
            i.image_xscale = num(a[0]);
            i.image_yscale = num(a[1]);
            i.image_angle = num(a[2]);
        }
    },
    action_sprite_color: (m, a, q) => {
        const i = eu(q);
        if (i) {
            i.image_blend = paraInt(a[0]);
            i.image_alpha = num(a[1]);
        }
    },
    action_move_to: (m, a, q) => {
        const i = eu(q);
        if (i) {
            i.x = num(a[0]);
            i.y = num(a[1]);
        }
    },
    action_kill_object: (m, a, q) => {
        if (eu(q)) m.destruir(eu(q), true);
    },
    action_create_object: (m, a, q) => criarInstancia(m, q, a[0], a[1], a[2]),
    action_set_alarm: (m, a, q) => {
        const i = eu(q);
        if (i) i.alarm[paraInt(a[1])] = num(a[0]);
    },
    action_sound: (m, a) => tocar(m, a[0], verdade(a[1])),
    action_set_motion: (m, a, q) => F.motion_set(m, a, q),
    action_set_hspeed: (m, a, q) => {
        if (eu(q)) eu(q).hs = num(a[0]);
    },
    action_set_vspeed: (m, a, q) => {
        if (eu(q)) eu(q).vs = num(a[0]);
    },
    action_set_friction: (m, a, q) => {
        if (eu(q)) eu(q).friction = num(a[0]);
    },
    action_set_gravity: (m, a, q) => {
        const i = eu(q);
        if (i) {
            i.gravity_direction = num(a[0]);
            i.gravity = num(a[1]);
        }
    },
    action_reverse_xdir: (m, a, q) => {
        if (eu(q)) eu(q).hs = -eu(q).hs;
    },
    action_reverse_ydir: (m, a, q) => {
        if (eu(q)) eu(q).vs = -eu(q).vs;
    },
    action_another_room: (m, a) => m.irPara(paraInt(a[0])),
    action_next_room: m => F.room_goto_next(m),
    action_previous_room: m => F.room_goto_previous(m),
    action_restart_game: m => F.game_restart(m),
    action_end_game: m => F.game_end(m),
    action_set_score: (m, a) => {
        m.score = num(a[0]);
    },
    action_inherited: (m, a, q) => F.event_inherited(m, a, q),
    action_execute_script: (m, a, q) => m.vm.chamarValor(q, a[0], a.slice(1), q.self),
    action_color: (m, a) => F.draw_set_color(m, a),
    action_font: (m, a) => {
        m.d.fonte = paraInt(a[0]);
        m.d.halign = paraInt(a[1]);
    },
    action_draw_text: (m, a, q) => comCtx(m, () => D(m).texto(num(a[1]) + (eu(q) ? eu(q).x : 0),
        num(a[2]) + (eu(q) ? eu(q).y : 0), texto(m, a[0]))),
    action_draw_sprite: (m, a, q) => comCtx(m, () => D(m).sprite(paraInt(a[0]), num(a[3]),
        num(a[1]) + (eu(q) ? eu(q).x : 0), num(a[2]) + (eu(q) ? eu(q).y : 0))),
    action_draw_rectangle: (m, a) => F.draw_rectangle(m, [a[0], a[1], a[2], a[3], a[4]]),
    action_set_caption: () => {},
    action_wrap: (m, a, q) => F.move_wrap(m, [paraInt(a[0]) !== 1, paraInt(a[0]) !== 0, 0], q)
});

export const FUNCOES = F;
