/**
 * Interpretador do bytecode GML (versões 14 a 17 do bytecode: GameMaker: Studio 1.4 até GameMaker 2024).
 *
 * A pilha guarda valores JS (número, texto, undefined, array, struct, método) e, ao lado, o "tamanho" de
 * cada valor na pilha original do GameMaker (dup e pop.e usam esse tamanho).
 */

// ---------------------------------------------------------------- tipos e opcodes
const T = {D: 0, F: 1, I: 2, L: 3, B: 4, V: 5, S: 6, E: 15};
const TAMANHO = [8, 4, 4, 8, 4, 16, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
const O = {
    CONV: 0x07,
    MUL: 0x08,
    DIV: 0x09,
    REM: 0x0a,
    MOD: 0x0b,
    ADD: 0x0c,
    SUB: 0x0d,
    AND: 0x0e,
    OR: 0x0f,
    XOR: 0x10,
    NEG: 0x11,
    NOT: 0x12,
    SHL: 0x13,
    SHR: 0x14,
    CMP: 0x15,
    POP: 0x45,
    DUP: 0x86,
    RET: 0x9c,
    EXIT: 0x9d,
    POPZ: 0x9e,
    B: 0xb6,
    BT: 0xb7,
    BF: 0xb8,
    PUSHENV: 0xba,
    POPENV: 0xbb,
    PUSH: 0xc0,
    PUSHLOC: 0xc1,
    PUSHGLB: 0xc2,
    PUSHBLTN: 0xc3,
    PUSHI: 0x84,
    CALL: 0xd9,
    CALLV: 0x99,
    BREAK: 0xff
};
const ANTIGO_PARA_NOVO = {
    0x03: 0x07,
    0x04: 0x08,
    0x05: 0x09,
    0x06: 0x0a,
    0x07: 0x0b,
    0x08: 0x0c,
    0x09: 0x0d,
    0x0a: 0x0e,
    0x0b: 0x0f,
    0x0c: 0x10,
    0x0d: 0x11,
    0x0e: 0x12,
    0x0f: 0x13,
    0x10: 0x14,
    0x11: 0x15,
    0x12: 0x15,
    0x13: 0x15,
    0x14: 0x15,
    0x15: 0x15,
    0x16: 0x15,
    0x41: 0x45,
    0x82: 0x86,
    0xb7: 0xb6,
    0xb8: 0xb7,
    0xb9: 0xb8,
    0xbb: 0xba,
    0x9d: 0x9c,
    0x9e: 0x9d,
    0x9f: 0x9e,
    0xbc: 0xbb,
    0xda: 0xd9
};
export const INST = {SELF: -1, OTHER: -2, ALL: -3, NOONE: -4, GLOBAL: -5, BUILTIN: -6, LOCAL: -7, STACKTOP: -9, ARG: -15, STATIC: -16};
const VT = {ARRAY: 0x00, STACKTOP: 0x80, NORMAL: 0xa0, INSTANCE: 0xe0, MULTIPUSH: 0x10, MULTIPUSHPOP: 0x90};
const EPS = 0.00001;

export class Struct {
    constructor () {
        this.vars = new Map();
    }
}
export class Metodo {
    constructor (funcao, self) {
        this.funcao = funcao; // nome da função (código "gml_Script_…" ou nativa)
        this.self = self; // instância/struct ligada, ou undefined
    }
}
export class ErroGML extends Error {}

// ---------------------------------------------------------------- decodificação
const decodificarBlob = (dw, blob, tamanho) => {
    const {dv, refVariavel, refFuncao, textos} = dw;
    const antigo = dw.info.bytecode <= 14;
    const lista = [];
    const porEndereco = new Map();
    let p = blob;
    const fim = blob + tamanho;
    while (p < fim) {
        const addr = p;
        const w = dv.getUint32(p, true);
        p += 4;
        let op = w >>> 24;
        const b0 = w & 0xff;
        const b1 = (w >>> 8) & 0xff;
        const b2 = (w >>> 16) & 0xff;
        let cmp = b1;
        if (antigo) {
            if (op >= 0x11 && op <= 0x16) cmp = op - 0x10;
            op = ANTIGO_PARA_NOVO[op] || op;
        }
        const ins = {op, t1: b2 & 0xf, t2: b2 >> 4, extra: b0, cmp, v16: (w << 16) >> 16, addr};
        switch (op) {
        case O.B: case O.BT: case O.BF: case O.PUSHENV: case O.POPENV: {
            if ((w & 0xffffff) === 0xf00000) {
                ins.sairWith = true;
                ins.salto = 0;
            } else if (antigo) {
                ins.salto = (w << 8) >> 8;
            } else {
                ins.salto = (w << 9) >> 9;
            }
            ins.destinoAddr = addr + (ins.salto * 4);
            break;
        }
        case O.POP:
            if (ins.t1 !== T.E) {
                const ref = dv.getUint32(p, true);
                p += 4;
                ins.var = refVariavel.has(addr) ? refVariavel.get(addr) : -1;
                ins.varTipo = (ref >>> 24) & 0xf8;
            }
            break;
        case O.PUSH: case O.PUSHLOC: case O.PUSHGLB: case O.PUSHBLTN: case O.PUSHI: {
            const t = b2;
            ins.t1 = t & 0xf;
            if (t === T.D) {
                ins.valor = dv.getFloat64(p, true);
                p += 8;
            } else if (t === T.F) {
                ins.valor = dv.getFloat32(p, true);
                p += 4;
            } else if (t === T.I) {
                ins.valor = dv.getInt32(p, true);
                if (refFuncao.has(addr)) ins.funcRef = refFuncao.get(addr);
                p += 4;
            } else if (t === T.L) {
                ins.valor = Number(dv.getBigInt64(p, true));
                p += 8;
            } else if (t === T.B) {
                ins.valor = dv.getInt32(p, true);
                p += 4;
            } else if (t === T.V) {
                const ref = dv.getUint32(p, true);
                p += 4;
                ins.var = refVariavel.has(addr) ? refVariavel.get(addr) : -1;
                ins.varTipo = (ref >>> 24) & 0xf8;
            } else if (t === T.S) {
                ins.valor = textos[dv.getUint32(p, true)];
                p += 4;
            } else if (t === T.E) {
                ins.valor = ins.v16;
            }
            break;
        }
        case O.CALL:
            ins.func = refFuncao.has(addr) ? refFuncao.get(addr) : -1;
            p += 4;
            break;
        case O.BREAK:
            if (ins.t1 === T.I) {
                ins.valor = dv.getInt32(p, true);
                if (refFuncao.has(addr)) ins.funcRef = refFuncao.get(addr);
                p += 4;
            }
            break;
        default:
            break;
        }
        porEndereco.set(addr, lista.length);
        lista.push(ins);
    }
    // saltos viram índices
    for (const ins of lista) {
        if (ins.destinoAddr !== undefined) {
            ins.destino = porEndereco.has(ins.destinoAddr) ? porEndereco.get(ins.destinoAddr) : lista.length;
        }
    }
    return {lista, porEndereco};
};

// ---------------------------------------------------------------- utilidades de valores
export const num = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === undefined || v === null) return 0;
    if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    if (typeof v === 'bigint') return Number(v);
    return 0;
};
export const verdade = v => (typeof v === 'string' ? false : num(v) > 0.5);
export const paraInt = v => Math.round(num(v));
export const igual = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= EPS || a === b;
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    if (a === undefined || b === undefined) return a === b;
    if (typeof a === 'boolean' || typeof b === 'boolean') return num(a) === num(b);
    return a === b;
};
const comparar = (a, b, tipo) => {
    if (tipo === 3) return igual(a, b);
    if (tipo === 4) return !igual(a, b);
    let x;
    if (typeof a === 'string' && typeof b === 'string') {
        x = a < b ? -1 : (a > b ? 1 : 0);
    } else {
        const na = num(a);
        const nb = num(b);
        x = Math.abs(na - nb) <= EPS ? 0 : (na < nb ? -1 : 1);
    }
    switch (tipo) {
    case 1: return x < 0;
    case 2: return x <= 0;
    case 5: return x >= 0;
    case 6: return x > 0;
    default: return false;
    }
};
const bits = (a, b, op) => {
    const x = paraInt(a);
    const y = paraInt(b);
    if (Math.abs(x) < 0x40000000 && Math.abs(y) < 0x40000000 && op !== 'shl') {
        if (op === 'and') return x & y;
        if (op === 'or') return x | y;
        if (op === 'xor') return x ^ y;
        if (op === 'shr') return x >> Math.min(31, y);
    }
    const X = BigInt(x);
    const Y = BigInt(y);
    let r;
    if (op === 'and') r = X & Y;
    else if (op === 'or') r = X | Y;
    else if (op === 'xor') r = X ^ Y;
    else if (op === 'shl') r = X << Y;
    else r = X >> Y;
    return Number(BigInt.asIntN(64, r));
};
const resultadoBinario = (t1, t2, op) => {
    if (op === O.CMP) return T.B;
    const f = t => (t === T.V ? 2 : (t === T.D || t === T.L ? 1 : 0));
    if ((op === O.SUB || op === O.DIV || op === O.MOD || op === O.AND || op === O.OR || op === O.XOR ||
        op === O.SHL || op === O.SHR) && (t1 === T.S || t2 === T.S)) return T.D;
    const a = f(t1);
    const b = f(t2);
    if (a === b) return Math.min(t1 === T.E ? T.I : t1, t2 === T.E ? T.I : t2);
    return a > b ? t1 : t2;
};

// ---------------------------------------------------------------- máquina
export class MaquinaGML {
    /**
     * @param {object} dw dados do data.win (leitor.js)
     * @param {object} motor implementa: lerVar/escreverVar (instâncias), instanciasDe(valor), chamarFuncao(nome, args, quadro)
     */
    constructor (dw, motor) {
        this.dw = dw;
        this.motor = motor;
        this.v23 = dw.info.v23;
        this.blobs = new Map();
        this.codigoPorNome = new Map();
        dw.codigos.forEach((c, i) => this.codigoPorNome.set(c.nome, i));
        this.estaticos = new Map(); // código → struct de variáveis static
        this.estaticoPronto = new Set();
        this.profundidade = 0;
        this.passos = 0;
        this.limitePassos = 5e7;
    }

    preparar (indice) {
        const c = this.dw.codigos[indice];
        if (!c) throw new ErroGML(`código ${indice} não existe`);
        if (!c.ins) {
            let b = this.blobs.get(c.blob);
            if (!b) {
                b = decodificarBlob(this.dw, c.blob, c.tamBlob);
                this.blobs.set(c.blob, b);
            }
            c.ins = b.lista;
            c.pc0 = b.porEndereco.has(c.blob + c.inicio) ? b.porEndereco.get(c.blob + c.inicio) : 0;
        }
        return c;
    }

    nomeVar (ins) {
        const v = this.dw.variaveis[ins.var];
        return v ? v.nome : '';
    }

    /**
     * Executa um código.
     * @param {number} indice índice do código
     * @param {*} self instância ou struct
     * @param {*} other a outra instância
     * @param {Array} args argumentos
     * @returns {*} valor de retorno
     */
    executar (indice, self, other, args = []) {
        const c = this.preparar(indice);
        if (++this.profundidade > 400) {
            this.profundidade--;
            throw new ErroGML('recursão profunda demais');
        }
        const q = {
            codigo: indice,
            nome: c.nome,
            self,
            other,
            args,
            locais: new Map(),
            pilha: [],
            tams: [],
            envs: []
        };
        try {
            return this.rodar(c, q);
        } finally {
            this.profundidade--;
        }
    }

    // valor → lista de alvos (para with, pop em objeto, etc.)
    alvos (q, v) {
        if (v instanceof Struct) return [v];
        if (v && typeof v === 'object' && v.ehInstancia) return v.destruida ? [] : [v];
        const n = paraInt(v);
        if (n === INST.SELF) return q.self === undefined ? [] : [q.self];
        if (n === INST.OTHER) return q.other === undefined ? [] : [q.other];
        if (n === INST.GLOBAL) return [this.motor.global];
        return this.motor.instanciasDe(n);
    }

    alvoUnico (q, v) {
        const l = this.alvos(q, v);
        return l.length ? l[0] : null;
    }

    // de onde vem a variável de uma instrução push/pop
    resolverDono (q, ins, pilhaPop) {
        const inst = ins.v16;
        if (ins.varTipo === VT.STACKTOP || ins.varTipo === VT.ARRAY ||
            ins.varTipo === VT.MULTIPUSH || ins.varTipo === VT.MULTIPUSHPOP || inst === INST.STACKTOP) {
            let v = pilhaPop();
            if (v === INST.STACKTOP) v = pilhaPop();
            return {lista: this.alvos(q, v), especial: null};
        }
        if (ins.varTipo === VT.INSTANCE) return {lista: this.motor.instanciasDe(inst + 100000), especial: null};
        if (inst === INST.LOCAL) return {lista: null, especial: 'local'};
        if (inst === INST.GLOBAL) return {lista: [this.motor.global], especial: null};
        if (inst === INST.STATIC) return {lista: [this.estaticosDe(q.codigo)], especial: null};
        if (inst === INST.ARG) return {lista: null, especial: 'arg'};
        if (inst === INST.BUILTIN || inst === INST.SELF || inst === 0 && ins.op === O.PUSHBLTN) {
            return {lista: q.self === undefined ? [this.motor.global] : [q.self], especial: null};
        }
        if (inst === INST.OTHER) return {lista: q.other === undefined ? [] : [q.other], especial: null};
        if (inst === INST.ALL) return {lista: this.motor.instanciasDe(INST.ALL), especial: null};
        if (inst === INST.NOONE) return {lista: [], especial: null};
        return {lista: this.motor.instanciasDe(inst), especial: null};
    }

    estaticosDe (codigo) {
        let s = this.estaticos.get(codigo);
        if (!s) {
            s = new Struct();
            this.estaticos.set(codigo, s);
        }
        return s;
    }

    lerVariavel (q, dono, nome) {
        if (/^argument\d+$/.test(nome) && (dono === q.self || dono === undefined)) {
            const i = Number(nome.slice(8));
            return q.args[i];
        }
        if (nome === 'argument' && (dono === q.self || dono === undefined)) return q.args;
        if (nome === 'argument_count') return q.args.length;
        return this.motor.lerVar(dono, nome);
    }

    escreverVariavel (q, dono, nome, valor) {
        if (/^argument\d+$/.test(nome) && dono === q.self) {
            q.args[Number(nome.slice(8))] = valor;
            return;
        }
        this.motor.escreverVar(dono, nome, valor);
    }

    // arrays: no GMS 1 os 2D usam índice i*32000+j
    lerArray (arr, i) {
        if (!Array.isArray(arr)) return undefined;
        return arr[paraInt(i)];
    }

    rodar (c, q) {
        const ins = c.ins;
        const pilha = q.pilha;
        const tams = q.tams;
        const motor = this.motor;
        const push = (v, t) => {
            pilha.push(v);
            tams.push(TAMANHO[t]);
        };
        const pop = () => {
            tams.pop();
            return pilha.pop();
        };
        let pc = c.pc0;
        const n = ins.length;
        while (pc < n) {
            if (++this.passos > this.limitePassos) {
                throw new ErroGML('o jogo travou num laço infinito');
            }
            const i = ins[pc++];
            switch (i.op) {
            case O.CONV: {
                let v = pop();
                if (i.t2 === T.B) {
                    v = verdade(v) ? 1 : 0;
                } else if (i.t2 === T.I || i.t2 === T.L) {
                    if (typeof v !== 'string' && !Array.isArray(v) && !(v instanceof Struct) &&
                        !(v instanceof Metodo)) v = paraInt(v);
                } else if (i.t2 === T.D) {
                    if (typeof v === 'boolean') v = v ? 1 : 0;
                }
                push(v, i.t2);
                break;
            }
            case O.MUL: case O.DIV: case O.REM: case O.MOD: case O.ADD: case O.SUB:
            case O.AND: case O.OR: case O.XOR: case O.SHL: case O.SHR: {
                const b = pop();
                const a = pop();
                let r;
                switch (i.op) {
                case O.ADD:
                    if (typeof a === 'string' || typeof b === 'string') {
                        r = (typeof a === 'string' ? a : motor.texto(a)) + (typeof b === 'string' ? b : motor.texto(b));
                    } else {
                        r = num(a) + num(b);
                    }
                    break;
                case O.SUB: r = num(a) - num(b); break;
                case O.MUL:
                    if (typeof a === 'string' && typeof b !== 'string') r = a.repeat(Math.max(0, paraInt(b)));
                    else if (typeof b === 'string' && typeof a !== 'string') r = b.repeat(Math.max(0, paraInt(a)));
                    else r = num(a) * num(b);
                    break;
                case O.DIV: r = num(a) / num(b); break;
                case O.REM: r = Math.trunc(num(a) / num(b)); break;
                case O.MOD: r = num(a) % num(b); break;
                case O.AND:
                    r = (i.t1 === T.B && i.t2 === T.B) ? (verdade(a) && verdade(b) ? 1 : 0) : bits(a, b, 'and');
                    break;
                case O.OR:
                    r = (i.t1 === T.B && i.t2 === T.B) ? (verdade(a) || verdade(b) ? 1 : 0) : bits(a, b, 'or');
                    break;
                case O.XOR:
                    r = (i.t1 === T.B && i.t2 === T.B) ? (verdade(a) !== verdade(b) ? 1 : 0) : bits(a, b, 'xor');
                    break;
                case O.SHL: r = bits(a, b, 'shl'); break;
                default: r = bits(a, b, 'shr'); break;
                }
                if (typeof r === 'number' && !Number.isFinite(r) && i.op !== O.DIV) r = 0;
                push(r, resultadoBinario(i.t1, i.t2, i.op));
                break;
            }
            case O.NEG: push(-num(pop()), i.t1); break;
            case O.NOT: {
                const v = pop();
                push(i.t1 === T.B ? (verdade(v) ? 0 : 1) : bits(v, -1, 'xor'), i.t1);
                break;
            }
            case O.CMP: {
                const b = pop();
                const a = pop();
                push(comparar(a, b, i.cmp) ? 1 : 0, T.B);
                break;
            }
            case O.PUSH: case O.PUSHLOC: case O.PUSHGLB: case O.PUSHBLTN: case O.PUSHI:
                if (i.t1 !== T.V) {
                    if (i.funcRef !== undefined) {
                        push(new Metodo(this.dw.funcoes[i.funcRef].nome, undefined), T.I);
                    } else {
                        push(i.valor, i.t1);
                    }
                    break;
                }
                this.pushVar(q, i, pop, push);
                break;
            case O.POP:
                if (i.t1 === T.E) {
                    // "pop swap"
                    const e1 = pop();
                    const e2 = pop();
                    if (i.v16 === 5) {
                        const e3 = pop();
                        push(e1, T.V);
                        push(e3, T.V);
                        push(e2, T.V);
                    } else {
                        const e3 = pop();
                        const e4 = pop();
                        push(e1, T.V);
                        push(e4, T.I);
                        push(e3, T.I);
                        push(e2, T.V);
                    }
                    break;
                }
                this.popVar(q, i, pop);
                break;
            case O.DUP: {
                let tamTipo = TAMANHO[i.t1];
                let tam1 = i.extra;
                let tam2 = (i.cmp & 0x7f) >> 3;
                if (i.t1 === T.E) {
                    tamTipo = 16;
                    [tam1, tam2] = [tam2, tam1];
                }
                if (tam2 !== 0) {
                    // "dup swap": o grupo de baixo passa para cima do grupo do topo
                    if (i.t1 === T.V && tam1 === 0) break;
                    const tirar = bytes => {
                        const r = [];
                        let s = bytes;
                        while (s > 0 && pilha.length) {
                            s -= tams[tams.length - 1];
                            r.unshift([tams.pop(), pilha.pop()]);
                        }
                        return r;
                    };
                    const topo = tirar(tam1 * tamTipo);
                    const baixo = tirar(tam2 * tamTipo);
                    for (const [t, v] of topo.concat(baixo)) {
                        pilha.push(v);
                        tams.push(t);
                    }
                    break;
                }
                let s = (tam1 + 1) * tamTipo;
                let k = pilha.length;
                while (s > 0 && k > 0) {
                    k--;
                    s -= tams[k];
                }
                const fim = pilha.length;
                for (let j = k; j < fim; j++) {
                    pilha.push(pilha[j]);
                    tams.push(tams[j]);
                }
                break;
            }
            case O.RET: {
                const v = pop();
                this.sairDosWith(q);
                return v;
            }
            case O.EXIT:
                this.sairDosWith(q);
                return undefined;
            case O.POPZ: pop(); break;
            case O.B: pc = i.destino; break;
            case O.BT: if (verdade(pop())) pc = i.destino; break;
            case O.BF: if (!verdade(pop())) pc = i.destino; break;
            case O.PUSHENV: {
                const alvo = pop();
                const lista = this.alvos(q, alvo).slice();
                q.envs.push({lista, k: 0, self: q.self, other: q.other});
                if (!lista.length) {
                    // sem instâncias: vai direto para o popenv (que desempilha este contexto)
                    pc = i.destino;
                    break;
                }
                q.other = q.self;
                q.self = lista[0];
                break;
            }
            case O.POPENV: {
                const env = q.envs[q.envs.length - 1];
                if (!env) break;
                if (!i.sairWith) {
                    let k = env.k + 1;
                    while (k < env.lista.length && env.lista[k].destruida) k++;
                    if (k < env.lista.length) {
                        env.k = k;
                        q.self = env.lista[k];
                        pc = i.destino;
                        break;
                    }
                }
                q.envs.pop();
                q.self = env.self;
                q.other = env.other;
                break;
            }
            case O.CALL: {
                const f = this.dw.funcoes[i.func];
                const nome = f ? f.nome : '';
                const args = [];
                if (nome === '@@NewGMLObject@@') {
                    if (i.v16 === 0) {
                        push(new Struct(), T.V);
                        break;
                    }
                    const fn = pop();
                    for (let j = 0; j < i.v16 - 1; j++) args.push(pop());
                    push(this.novoStruct(q, fn, args), T.V);
                    break;
                }
                for (let j = 0; j < i.v16; j++) args.push(pop());
                push(this.chamar(q, nome, args, q.self, q.other), T.V);
                break;
            }
            case O.CALLV: {
                const fn = pop();
                const inst = pop();
                const args = [];
                for (let j = 0; j < i.extra; j++) args.push(pop());
                let self = q.self;
                const lista = this.alvos(q, inst);
                if (lista.length) self = lista[0];
                push(this.chamarValor(q, fn, args, self), T.V);
                break;
            }
            case O.BREAK:
                this.extendido(q, i, pop, push);
                break;
            default:
                throw new ErroGML(`instrução desconhecida 0x${i.op.toString(16)}`);
            }
        }
        this.sairDosWith(q);
        return undefined;
    }

    sairDosWith (q) {
        while (q.envs.length) {
            const env = q.envs.pop();
            q.self = env.self;
            q.other = env.other;
        }
    }

    pushVar (q, i, pop, push) {
        const nome = this.nomeVar(i);
        let indice;
        if (i.varTipo === VT.ARRAY || i.varTipo === VT.MULTIPUSH || i.varTipo === VT.MULTIPUSHPOP) indice = pop();
        const {lista, especial} = this.resolverDono(q, i, pop);
        let valor;
        if (especial === 'local') {
            valor = q.locais.get(nome);
        } else if (especial === 'arg') {
            valor = this.lerVariavel(q, q.self, nome);
        } else {
            const dono = lista && lista.length ? lista[0] : undefined;
            if (dono === undefined) {
                valor = undefined;
            } else {
                valor = this.lerVariavel(q, dono, nome);
            }
            if (indice !== undefined && i.varTipo === VT.MULTIPUSHPOP && !Array.isArray(valor) && dono) {
                valor = [];
                this.escreverVariavel(q, dono, nome, valor);
            }
        }
        if (especial === 'local' && i.varTipo === VT.MULTIPUSHPOP && !Array.isArray(valor)) {
            valor = [];
            q.locais.set(nome, valor);
        }
        if (indice !== undefined) {
            if (i.varTipo === VT.MULTIPUSHPOP) {
                const k = paraInt(indice);
                if (!Array.isArray(valor[k])) valor[k] = [];
                valor = valor[k];
            } else if (Array.isArray(valor)) {
                valor = valor[paraInt(indice)];
            } else if (i.varTipo === VT.ARRAY && paraInt(indice) === 0 && valor !== undefined) {
                // ler a[0] de um valor que não é array devolve o próprio valor (comportamento antigo)
            } else {
                valor = undefined;
            }
        }
        push(valor, T.V);
    }

    popVar (q, i, pop) {
        const nome = this.nomeVar(i);
        let valor;
        if (i.t1 === T.I) valor = pop();
        let indice;
        if (i.varTipo === VT.ARRAY) indice = pop();
        const {lista, especial} = this.resolverDono(q, i, pop);
        if (i.t1 !== T.I) valor = pop();
        if (i.t2 === T.B && typeof valor === 'number') valor = verdade(valor) ? 1 : 0;
        const gravar = (ler, escrever) => {
            if (indice === undefined) {
                escrever(valor);
                return;
            }
            let arr = ler();
            if (!Array.isArray(arr)) {
                arr = [];
                escrever(arr);
            }
            const k = paraInt(indice);
            if (k >= 0 && k < 1e8) arr[k] = valor;
        };
        if (especial === 'local') {
            gravar(() => q.locais.get(nome), v => q.locais.set(nome, v));
            return;
        }
        if (especial === 'arg') {
            gravar(() => this.lerVariavel(q, q.self, nome), v => this.escreverVariavel(q, q.self, nome, v));
            return;
        }
        for (const dono of lista || []) {
            gravar(() => this.lerVariavel(q, dono, nome), v => this.escreverVariavel(q, dono, nome, v));
        }
    }

    extendido (q, i, pop, push) {
        switch (i.v16) {
        case -1: break; // chkindex
        case -2: { // pushaf
            const k = pop();
            const arr = pop();
            push(Array.isArray(arr) ? arr[paraInt(k)] : undefined, T.V);
            break;
        }
        case -3: { // popaf
            const k = pop();
            const arr = pop();
            const v = pop();
            if (Array.isArray(arr)) arr[paraInt(k)] = v;
            break;
        }
        case -4: { // pushac
            const k = pop();
            const arr = pop();
            let sub;
            if (Array.isArray(arr)) {
                const j = paraInt(k);
                if (!Array.isArray(arr[j])) arr[j] = [];
                sub = arr[j];
            }
            push(sub, T.V);
            break;
        }
        case -5: pop(); break; // setowner
        case -6: push(this.estaticoPronto.has(q.codigo) ? 1 : 0, T.B); break; // isstaticok
        case -7: this.estaticoPronto.add(q.codigo); break; // setstatic
        case -8: case -9: break; // savearef / restorearef
        case -10: { // isnullish
            const v = pop();
            push(v === undefined || v === null ? 1 : 0, T.B);
            break;
        }
        case -11: // pushref
            if (i.funcRef !== undefined) push(new Metodo(this.dw.funcoes[i.funcRef].nome, undefined), T.V);
            else push((i.valor || 0) & 0xffffff, T.V);
            break;
        default:
            break;
        }
    }

    // ---------------------------------------------------------------- chamadas
    codigoDaFuncao (nome) {
        if (this.codigoPorNome.has(nome)) return this.codigoPorNome.get(nome);
        if (this.codigoPorNome.has(`gml_Script_${nome}`)) return this.codigoPorNome.get(`gml_Script_${nome}`);
        return -1;
    }

    chamar (q, nome, args, self, other) {
        switch (nome) {
        case '@@This@@': return q.self && q.self.ehInstancia ? q.self.id : q.self;
        case '@@Other@@': return q.other && q.other.ehInstancia ? q.other.id : q.other;
        case '@@Global@@': return this.motor.global;
        case '@@GetInstance@@': return args[0];
        case '@@NewGMLArray@@': return args;
        case '@@NullObject@@': return undefined;
        case '@@CopyStatic@@': case '@@SetStatic@@': return undefined;
        case '@@try_hook@@': case '@@try_unhook@@': case '@@finish_catch@@': case '@@finish_finally@@':
            return undefined;
        case '@@throw@@': throw new ErroGML(`exceção do jogo: ${this.motor.texto(args[0])}`);
        case 'method': {
            const fn = args[1];
            const ligado = args[0];
            const nomeF = fn instanceof Metodo ? fn.funcao : (typeof fn === 'number' ? this.nomeDoScript(fn) : fn);
            let alvo;
            if (ligado !== undefined && ligado !== null) {
                alvo = ligado instanceof Struct || (ligado && ligado.ehInstancia) ? ligado : this.alvoUnico(q, ligado);
            }
            return new Metodo(nomeF, alvo || undefined);
        }
        case 'script_execute': {
            const s = args[0];
            return this.chamarValor(q, s, args.slice(1), self);
        }
        default:
            break;
        }
        const codigo = this.codigoDaFuncao(nome);
        if (codigo >= 0) return this.executar(codigo, self, other, args);
        return this.motor.chamarNativa(nome, args, q);
    }

    nomeDoScript (indice) {
        const s = this.dw.scripts[paraInt(indice)];
        if (!s) return '';
        const c = this.dw.codigos[s.codigo];
        return c ? c.nome : s.nome;
    }

    chamarValor (q, fn, args, self) {
        if (fn instanceof Metodo) {
            const alvo = fn.self !== undefined ? fn.self : self;
            return this.chamar(q, fn.funcao, args, alvo, q.self);
        }
        if (typeof fn === 'number') {
            const nome = this.nomeDoScript(fn);
            if (nome) return this.chamar(q, nome, args, self, q.self);
        }
        if (typeof fn === 'string') return this.chamar(q, fn, args, self, q.self);
        return undefined;
    }

    novoStruct (q, fn, args) {
        const s = new Struct();
        const nome = fn instanceof Metodo ? fn.funcao : (typeof fn === 'number' ? this.nomeDoScript(fn) : String(fn));
        const codigo = this.codigoDaFuncao(nome);
        if (codigo >= 0) {
            s.construtor = nome;
            this.executar(codigo, s, q.self, args);
        }
        return s;
    }
}
