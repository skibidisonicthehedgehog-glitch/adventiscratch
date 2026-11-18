/**
 * Motor que roda um jogo do GameMaker a partir do data.win: instâncias, eventos, salas, vistas,
 * desenho, teclado, mouse e som. As funções nativas do GML ficam em funcoes.js.
 */
import {MaquinaGML, Struct, Metodo, INST, num, paraInt, verdade} from './vm.js';
import {Desenhista, corCss} from './desenho.js';
import {carregarTextura} from './texturas.js';
import {FUNCOES} from './funcoes.js';

export const EV = {CREATE: 0,
    DESTROY: 1,
    ALARM: 2,
    STEP: 3,
    COLLISION: 4,
    KEYBOARD: 5,
    MOUSE: 6,
    OTHER: 7,
    DRAW: 8,
    KEYPRESS: 9,
    KEYRELEASE: 10,
    CLEANUP: 12,
    PRECREATE: 14};

const BUILTIN_INST = new Set([
    'x', 'y', 'xprevious', 'yprevious', 'xstart', 'ystart', 'hspeed', 'vspeed', 'speed', 'direction',
    'friction', 'gravity', 'gravity_direction', 'image_index', 'image_speed', 'image_xscale', 'image_yscale',
    'image_angle', 'image_alpha', 'image_blend', 'image_number', 'image_single', 'sprite_index', 'sprite_width',
    'sprite_height', 'sprite_xoffset', 'sprite_yoffset', 'mask_index', 'depth', 'visible', 'solid', 'persistent',
    'object_index', 'id', 'alarm', 'bbox_left', 'bbox_right', 'bbox_top', 'bbox_bottom', 'layer'
]);

let proximoId = 100000;

export class Instancia {
    constructor (motor, objeto, x, y, id) {
        const o = motor.dw.objetos[objeto] || {};
        this.ehInstancia = true;
        this.motor = motor;
        this.id = id || ++proximoId;
        if (this.id > proximoId) proximoId = this.id;
        this.objeto = objeto;
        this.vars = new Map();
        this.x = x;
        this.y = y;
        this.xstart = x;
        this.ystart = y;
        this.xprevious = x;
        this.yprevious = y;
        this.hs = 0;
        this.vs = 0;
        this.dir = 0;
        this.friction = 0;
        this.gravity = 0;
        this.gravity_direction = 270;
        this.sprite_index = o.sprite === undefined ? -1 : o.sprite;
        this.mask_index = o.mascara === undefined ? -1 : o.mascara;
        this.image_index = 0;
        this.image_speed = 1;
        this.image_xscale = 1;
        this.image_yscale = 1;
        this.image_angle = 0;
        this.image_alpha = 1;
        this.image_blend = 0xffffff;
        this.depth = o.prof || 0;
        this.visible = o.visivel !== false;
        this.solid = Boolean(o.solido);
        this.persistent = Boolean(o.persistente);
        this.alarm = new Array(12).fill(-1);
        this.layer = -1;
        this.destruida = false;
        this.desativada = false;
    }

    get speed () {
        return Math.hypot(this.hs, this.vs);
    }

    set speed (v) {
        const d = this.direction * Math.PI / 180;
        this.hs = v * Math.cos(d);
        this.vs = -v * Math.sin(d);
        if (Math.abs(this.hs) < 1e-9) this.hs = 0;
        if (Math.abs(this.vs) < 1e-9) this.vs = 0;
        if (v < 0) this.dir = (this.direction + 180) % 360;
    }

    get direction () {
        if (this.hs === 0 && this.vs === 0) return this.dir;
        let d = Math.atan2(-this.vs, this.hs) * 180 / Math.PI;
        if (d < 0) d += 360;
        return d;
    }

    set direction (v) {
        const s = this.speed;
        this.dir = ((v % 360) + 360) % 360;
        const d = this.dir * Math.PI / 180;
        this.hs = s * Math.cos(d);
        this.vs = -s * Math.sin(d);
        if (Math.abs(this.hs) < 1e-9) this.hs = 0;
        if (Math.abs(this.vs) < 1e-9) this.vs = 0;
    }

    spriteDados () {
        return this.motor.dw.sprites[this.sprite_index] || null;
    }

    // caixa de colisão (usa a máscara se tiver)
    caixa (x = this.x, y = this.y) {
        const s = this.motor.dw.sprites[this.mask_index >= 0 ? this.mask_index : this.sprite_index];
        if (!s) return null;
        const xs = this.image_xscale;
        const ys = this.image_yscale;
        let l = (s.margemEsq - s.origemX) * xs;
        let r = (s.margemDir + 1 - s.origemX) * xs;
        let t = (s.margemCima - s.origemY) * ys;
        let b = (s.margemBaixo + 1 - s.origemY) * ys;
        if (l > r) [l, r] = [r, l];
        if (t > b) [t, b] = [b, t];
        if (this.image_angle % 360) {
            // gira os cantos e usa a caixa que envolve tudo
            const a = -this.image_angle * Math.PI / 180;
            const c = Math.cos(a);
            const sn = Math.sin(a);
            const xsP = [];
            const ysP = [];
            for (const [px, py] of [[l, t], [r, t], [l, b], [r, b]]) {
                xsP.push((px * c) - (py * sn));
                ysP.push((px * sn) + (py * c));
            }
            l = Math.min(...xsP);
            r = Math.max(...xsP);
            t = Math.min(...ysP);
            b = Math.max(...ysP);
        }
        return {l: x + l, r: x + r, t: y + t, b: y + b};
    }
}

const sobrepoe = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

export class MotorGM {
    constructor (dw, opcoes = {}) {
        this.dw = dw;
        this.opcoes = opcoes;
        this.extras = opcoes.extras || new Map(); // outros arquivos (músicas .ogg, audiogroupN.dat)
        this.canvas = document.createElement('canvas');
        this.canvas.width = dw.info.largura || 640;
        this.canvas.height = dw.info.altura || 480;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.d = new Desenhista(dw);
        this.d.ctx = this.ctx;
        this.global = new Struct();
        this.instancias = [];
        this.porId = new Map();
        this.vm = new MaquinaGML(dw, this);
        this.sala = -1;
        this.proxSala = -1;
        this.salasSalvas = new Map();
        this.room_speed = 30;
        this.score = 0;
        this.lives = -1;
        this.health = 100;
        this.background_color = 0;
        this.mostrarCor = true;
        this.teclas = new Set();
        this.apertadas = new Set();
        this.soltas = new Set();
        this.ultimaTecla = 0;
        this.keyboard_string = '';
        this.mouse = {x: 0, y: 0, botoes: new Set(), apertados: new Set(), soltos: new Set()};
        this.vistas = {
            visible: new Array(8).fill(0),
            xview: new Array(8).fill(0),
            yview: new Array(8).fill(0),
            wview: new Array(8).fill(640),
            hview: new Array(8).fill(480),
            xport: new Array(8).fill(0),
            yport: new Array(8).fill(0),
            wport: new Array(8).fill(640),
            hport: new Array(8).fill(480),
            angle: new Array(8).fill(0),
            hborder: new Array(8).fill(0),
            vborder: new Array(8).fill(0),
            hspeed: new Array(8).fill(-1),
            vspeed: new Array(8).fill(-1),
            object: new Array(8).fill(-4),
            camera: [0, 1, 2, 3, 4, 5, 6, 7]
        };
        this.camerasExtras = new Map();
        this.view_enabled = false;
        this.view_current = 0;
        this.fundos = {
            visible: new Array(8).fill(0),
            foreground: new Array(8).fill(0),
            index: new Array(8).fill(-1),
            x: new Array(8).fill(0),
            y: new Array(8).fill(0),
            htiled: new Array(8).fill(0),
            vtiled: new Array(8).fill(0),
            xscale: new Array(8).fill(1),
            yscale: new Array(8).fill(1),
            hspeed: new Array(8).fill(0),
            vspeed: new Array(8).fill(0),
            blend: new Array(8).fill(0xffffff),
            alpha: new Array(8).fill(1)
        };
        this.camadas = [];
        this.tiles = [];
        this.eventoAtual = [];
        this.erros = [];
        this.faltando = new Map();
        this.quadros = 0;
        this.tempoInicio = performance.now();
        this.rodando = false;
        this.terminou = false;
        this.ds = {};
        this.superficies = new Map();
        this.alvoSuperficie = [];
        this.audio = opcoes.audio || null; // {ctx, destino}
        this.vozes = new Map();
        this.buffers = new Map();
        this.ini = null;
        this.arquivosAbertos = new Map();
        this.prefixo = `adventiblocks.datawin.${dw.info.nome || 'jogo'}`;
        this.vfs = this.carregarVfs();
        this.blend = 'source-over';
        this.aoMudarSala = null;
        this.gui = {w: 0, h: 0};
    }

    // ---------------------------------------------------------------- preparação
    async carregarTexturas (aoProgredir) {
        const t = this.dw.texturas;
        for (let i = 0; i < t.length; i++) {
            if (t[i].dados && !t[i].imagem) {
                try {
                    t[i].imagem = await carregarTextura(this.dw.bytes, t[i].dados);
                } catch (e) {
                    this.erro(`textura ${i}: ${e.message}`);
                }
            }
            if (aoProgredir) aoProgredir(i + 1, t.length);
        }
    }

    erro (msg) {
        if (this.erros.length > 50) this.erros.shift();
        this.erros.push(msg);
        console.warn('[data.win]', msg); // eslint-disable-line no-console
    }

    faltou (nome) {
        const n = (this.faltando.get(nome) || 0) + 1;
        this.faltando.set(nome, n);
        if (n === 1) console.info(`[data.win] função ainda não suportada: ${nome}`); // eslint-disable-line no-console
    }

    // ---------------------------------------------------------------- variáveis
    texto (v) {
        if (typeof v === 'string') return v;
        if (typeof v === 'number') {
            if (Number.isInteger(v)) return String(v);
            if (!Number.isFinite(v)) return v > 0 ? 'inf' : (v < 0 ? '-inf' : 'nan');
            return v.toFixed(2);
        }
        if (v === undefined || v === null) return 'undefined';
        if (Array.isArray(v)) return `[ ${v.map(x => this.texto(x)).join(',')} ]`;
        if (v instanceof Metodo) return `function ${v.funcao}`;
        if (v instanceof Struct) {
            return `{ ${Array.from(v.vars.entries()).map(([k, x]) => `${k} : ${this.texto(x)}`)
                .join(', ')} }`;
        }
        if (v && v.ehInstancia) return String(v.id);
        return String(v);
    }

    lerVar (dono, nome) {
        if (dono === undefined || dono === null) return undefined;
        if (dono === this.global) {
            if (this.globalBuiltin(nome)) return this.lerGlobal(nome);
            return dono.vars.get(nome);
        }
        if (dono instanceof Struct) return dono.vars.get(nome);
        if (dono.ehInstancia) {
            if (BUILTIN_INST.has(nome)) return this.lerBuiltin(dono, nome);
            if (dono.vars.has(nome)) return dono.vars.get(nome);
            if (this.globalBuiltin(nome)) return this.lerGlobal(nome);
            return undefined;
        }
        return undefined;
    }

    escreverVar (dono, nome, v) {
        if (dono === undefined || dono === null) return;
        if (dono === this.global) {
            if (this.globalBuiltin(nome)) this.escreverGlobal(nome, v);
            else dono.vars.set(nome, v);
            return;
        }
        if (dono instanceof Struct) {
            dono.vars.set(nome, v);
            return;
        }
        if (dono.ehInstancia) {
            if (BUILTIN_INST.has(nome)) this.escreverBuiltin(dono, nome, v);
            else if (this.globalBuiltin(nome) && !dono.vars.has(nome)) this.escreverGlobal(nome, v);
            else dono.vars.set(nome, v);
        }
    }

    lerBuiltin (i, n) {
        switch (n) {
        case 'hspeed': return i.hs;
        case 'vspeed': return i.vs;
        case 'speed': return i.speed;
        case 'direction': return i.direction;
        case 'image_number': {
            const s = i.spriteDados();
            return s ? s.quadros.length : 0;
        }
        case 'image_single': return -1;
        case 'sprite_width': {
            const s = i.spriteDados();
            return s ? s.largura * i.image_xscale : 0;
        }
        case 'sprite_height': {
            const s = i.spriteDados();
            return s ? s.altura * i.image_yscale : 0;
        }
        case 'sprite_xoffset': {
            const s = i.spriteDados();
            return s ? s.origemX : 0;
        }
        case 'sprite_yoffset': {
            const s = i.spriteDados();
            return s ? s.origemY : 0;
        }
        case 'object_index': return i.objeto;
        case 'id': return i.id;
        case 'bbox_left': case 'bbox_right': case 'bbox_top': case 'bbox_bottom': {
            const c = i.caixa();
            if (!c) return n === 'bbox_left' || n === 'bbox_right' ? i.x : i.y;
            if (n === 'bbox_left') return Math.floor(c.l);
            if (n === 'bbox_right') return Math.ceil(c.r) - 1;
            if (n === 'bbox_top') return Math.floor(c.t);
            return Math.ceil(c.b) - 1;
        }
        case 'visible': case 'solid': case 'persistent': return i[n] ? 1 : 0;
        default: return i[n];
        }
    }

    escreverBuiltin (i, n, v) {
        switch (n) {
        case 'hspeed': i.hs = num(v); break;
        case 'vspeed': i.vs = num(v); break;
        case 'speed': i.speed = num(v); break;
        case 'direction': i.direction = num(v); break;
        case 'image_single':
            if (num(v) >= 0) {
                i.image_index = num(v);
                i.image_speed = 0;
            }
            break;
        case 'visible': case 'solid': case 'persistent': i[n] = verdade(v); break;
        case 'alarm': if (Array.isArray(v)) i.alarm = v; break;
        case 'object_index': case 'id': case 'image_number': case 'sprite_width': case 'sprite_height':
        case 'sprite_xoffset': case 'sprite_yoffset': case 'bbox_left': case 'bbox_right': case 'bbox_top':
        case 'bbox_bottom':
            break;
        case 'sprite_index': case 'mask_index': i[n] = paraInt(v); break;
        default: i[n] = num(v); break;
        }
    }

    globalBuiltin (n) {
        return Object.prototype.hasOwnProperty.call(GLOBAIS, n);
    }

    lerGlobal (n) {
        return GLOBAIS[n].ler(this);
    }

    escreverGlobal (n, v) {
        const g = GLOBAIS[n];
        if (g.escrever) g.escrever(this, v);
    }

    // ---------------------------------------------------------------- instâncias
    ehFilho (obj, pai) {
        let o = obj;
        for (let k = 0; k < 64 && o >= 0; k++) {
            if (o === pai) return true;
            const d = this.dw.objetos[o];
            o = d ? d.pai : -1;
        }
        return false;
    }

    instanciasDe (v) {
        const n = paraInt(v);
        if (n === INST.ALL) return this.instancias.filter(i => !i.destruida && !i.desativada);
        if (n >= 100000) {
            const i = this.porId.get(n);
            return i && !i.destruida && !i.desativada ? [i] : [];
        }
        if (n >= 0 && n < this.dw.objetos.length) {
            return this.instancias.filter(i => !i.destruida && !i.desativada && this.ehFilho(i.objeto, n));
        }
        return [];
    }

    criar (objeto, x, y, opcoes = {}) {
        const inst = new Instancia(this, objeto, x, y, opcoes.id);
        if (opcoes.profundidade !== undefined) inst.depth = opcoes.profundidade;
        if (opcoes.camada !== undefined) inst.layer = opcoes.camada;
        if (opcoes.ajustar) opcoes.ajustar(inst);
        this.instancias.push(inst);
        this.porId.set(inst.id, inst);
        if (opcoes.preCriacao >= 0) this.rodarCodigo(opcoes.preCriacao, inst, inst);
        this.evento(inst, EV.PRECREATE, 0);
        this.evento(inst, EV.CREATE, 0);
        if (opcoes.codigo >= 0) this.rodarCodigo(opcoes.codigo, inst, inst);
        return inst;
    }

    destruir (inst, comEvento = true) {
        if (!inst || inst.destruida) return;
        if (comEvento) this.evento(inst, EV.DESTROY, 0);
        this.evento(inst, EV.CLEANUP, 0);
        inst.destruida = true;
        this.porId.delete(inst.id);
    }

    limparDestruidas () {
        if (this.instancias.some(i => i.destruida)) this.instancias = this.instancias.filter(i => !i.destruida);
    }

    // ---------------------------------------------------------------- eventos
    acharEvento (objeto, tipo, sub) {
        let o = objeto;
        for (let k = 0; k < 64 && o >= 0; k++) {
            const d = this.dw.objetos[o];
            if (!d) return null;
            const lista = d.eventos[tipo];
            if (lista) {
                const ev = lista.find(e => e.sub === sub);
                if (ev) return {ev, nivel: o};
            }
            o = d.pai;
        }
        return null;
    }

    temEvento (inst, tipo, sub) {
        return Boolean(this.acharEvento(inst.objeto, tipo, sub));
    }

    evento (inst, tipo, sub, other = inst, nivel = inst.objeto) {
        if (inst.destruida && tipo !== EV.DESTROY && tipo !== EV.CLEANUP) return false;
        const r = this.acharEvento(nivel, tipo, sub);
        if (!r) return false;
        this.eventoAtual.push({inst, tipo, sub, nivel: r.nivel});
        try {
            for (const c of r.ev.codigos) this.rodarCodigo(c, inst, other);
        } finally {
            this.eventoAtual.pop();
        }
        return true;
    }

    eventoHerdado (inst, other) {
        const atual = this.eventoAtual[this.eventoAtual.length - 1];
        if (!atual) return;
        const d = this.dw.objetos[atual.nivel];
        if (!d || d.pai < 0) return;
        this.evento(inst, atual.tipo, atual.sub, other, d.pai);
    }

    rodarCodigo (indice, self, other, args) {
        try {
            return this.vm.executar(indice, self, other, args);
        } catch (e) {
            const c = this.dw.codigos[indice];
            this.erro(`${c ? c.nome : indice}: ${e.message}`);
            return undefined;
        }
    }

    todosComEvento (tipo, sub, fn) {
        const lista = this.instancias.slice();
        for (const i of lista) {
            if (!i.destruida && !i.desativada) {
                if (fn) fn(i);
                else this.evento(i, tipo, sub);
            }
        }
    }

    // ---------------------------------------------------------------- salas
    iniciar () {
        this.rodando = true;
        // scripts globais (GMS 2.3+) definem as funções e variáveis globais
        for (const c of this.dw.iniciaisGlobais) this.rodarCodigo(c, this.global, this.global);
        this.primeiraSala = true;
        this.carregarSala(this.dw.ordemSalas[0]);
    }

    irPara (sala) {
        if (sala >= 0 && sala < this.dw.salas.length) this.proxSala = sala;
    }

    carregarSala (indice) {
        const anterior = this.sala;
        if (anterior >= 0) {
            this.todosComEvento(EV.OTHER, 5);
            const salaAnt = this.dw.salas[anterior];
            if (salaAnt && (salaAnt.persistente || this.salaPersistente)) {
                this.salasSalvas.set(anterior, this.instancias.filter(i => !i.persistent && !i.destruida));
            }
            for (const i of this.instancias) {
                if (!i.persistent) {
                    this.evento(i, EV.CLEANUP, 0);
                    i.destruida = true;
                    this.porId.delete(i.id);
                }
            }
            this.limparDestruidas();
        }
        const sala = this.dw.salas[indice];
        if (!sala) {
            this.erro(`sala ${indice} não existe`);
            return;
        }
        this.sala = indice;
        this.salaPersistente = sala.persistente;
        this.room_speed = sala.velocidade || this.dw.info.fps || 30;
        this.room_width = sala.largura;
        this.room_height = sala.altura;
        this.background_color = sala.cor;
        this.mostrarCor = sala.mostrarCor;
        this.view_enabled = Boolean(sala.flags & 1);
        // vistas
        const V = this.vistas;
        for (let k = 0; k < 8; k++) {
            const v = sala.vistas[k];
            V.visible[k] = v && v.ativa ? 1 : 0;
            V.xview[k] = v ? v.x : 0;
            V.yview[k] = v ? v.y : 0;
            V.wview[k] = v ? v.w : sala.largura;
            V.hview[k] = v ? v.h : sala.altura;
            V.xport[k] = v ? v.px : 0;
            V.yport[k] = v ? v.py : 0;
            V.wport[k] = v ? v.pw : sala.largura;
            V.hport[k] = v ? v.ph : sala.altura;
            V.hborder[k] = v ? v.bx : 0;
            V.vborder[k] = v ? v.by : 0;
            V.hspeed[k] = v ? v.vx : -1;
            V.vspeed[k] = v ? v.vy : -1;
            V.object[k] = v ? v.seguir : -4;
            V.angle[k] = 0;
            V.camera[k] = k;
        }
        this.ajustarTela();
        // fundos (GMS 1)
        const F = this.fundos;
        for (let k = 0; k < 8; k++) {
            const b = sala.fundos[k];
            F.visible[k] = b && b.ativo ? 1 : 0;
            F.foreground[k] = b && b.frente ? 1 : 0;
            F.index[k] = b ? b.fundo : -1;
            F.x[k] = b ? b.x : 0;
            F.y[k] = b ? b.y : 0;
            F.htiled[k] = b && b.repeteX ? 1 : 0;
            F.vtiled[k] = b && b.repeteY ? 1 : 0;
            F.hspeed[k] = b ? b.vx : 0;
            F.vspeed[k] = b ? b.vy : 0;
            F.xscale[k] = 1;
            F.yscale[k] = 1;
            F.alpha[k] = 1;
            F.blend[k] = 0xffffff;
        }
        this.tiles = sala.tiles.map(t => ({...t, visivel: true}));
        // camadas (GMS 2)
        this.camadas = sala.camadas.map(c => ({
            ...c,
            x: 0,
            y: 0,
            visivel: c.visivel,
            fundo: c.fundo ? {...c.fundo, quadroAtual: c.fundo.quadro} : null,
            sprites: c.sprites ? c.sprites.map(s => ({...s, quadroAtual: s.quadro})) : null
        }));
        const profCamada = new Map();
        for (const c of this.camadas) {
            for (const id of c.instancias || []) profCamada.set(id, c);
        }
        // instâncias
        const salvas = this.salasSalvas.get(indice);
        const novas = [];
        if (salvas) {
            this.salasSalvas.delete(indice);
            for (const i of salvas) {
                i.destruida = false;
                this.instancias.push(i);
                this.porId.set(i.id, i);
            }
        } else {
            for (const def of sala.instancias) {
                if (this.porId.has(def.id) || def.objeto < 0) continue;
                const camada = profCamada.get(def.id);
                const inst = new Instancia(this, def.objeto, def.x, def.y, def.id);
                inst.image_xscale = def.escalaX;
                inst.image_yscale = def.escalaY;
                inst.image_angle = def.angulo;
                inst.image_blend = def.cor & 0xffffff;
                inst.image_alpha = ((def.cor >>> 24) & 0xff) / 255 || 1;
                inst.image_speed = def.velImagem;
                inst.image_index = def.indiceImagem;
                if (camada) {
                    inst.depth = camada.prof;
                    inst.layer = camada.id;
                }
                this.instancias.push(inst);
                this.porId.set(inst.id, inst);
                novas.push([inst, def]);
            }
            for (const [inst, def] of novas) {
                if (def.preCriacao >= 0) this.rodarCodigo(def.preCriacao, inst, inst);
                this.evento(inst, EV.PRECREATE, 0);
                this.evento(inst, EV.CREATE, 0);
                if (def.codigo >= 0) this.rodarCodigo(def.codigo, inst, inst);
            }
        }
        if (this.primeiraSala) {
            this.primeiraSala = false;
            this.todosComEvento(EV.OTHER, 2);
        }
        if (!salvas && sala.codigoCriacao >= 0) this.rodarCodigo(sala.codigoCriacao, this.global, this.global);
        this.todosComEvento(EV.OTHER, 4);
        if (this.aoMudarSala) this.aoMudarSala(sala.nome);
    }

    ajustarTela () {
        const V = this.vistas;
        let w = this.room_width || this.dw.info.largura || 640;
        let h = this.room_height || this.dw.info.altura || 480;
        if (this.view_enabled) {
            let x1 = 0;
            let y1 = 0;
            for (let k = 0; k < 8; k++) {
                if (V.visible[k]) {
                    x1 = Math.max(x1, V.xport[k] + V.wport[k]);
                    y1 = Math.max(y1, V.yport[k] + V.hport[k]);
                }
            }
            if (x1 > 0 && y1 > 0) {
                w = x1;
                h = y1;
            }
        }
        w = Math.max(1, Math.min(4096, Math.round(w)));
        h = Math.max(1, Math.min(4096, Math.round(h)));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.ctx.imageSmoothingEnabled = false;
        }
    }

    // ---------------------------------------------------------------- quadro
    quadro () {
        if (!this.rodando || this.terminou) return;
        this.vm.passos = 0;
        if (this.proxSala >= 0) {
            const s = this.proxSala;
            this.proxSala = -1;
            this.carregarSala(s);
        }
        this.todosComEvento(EV.STEP, 1);
        // alarmes
        this.todosComEvento(0, 0, i => {
            for (let k = 0; k < 12; k++) {
                if (i.alarm[k] > 0) {
                    i.alarm[k] -= 1;
                    if (i.alarm[k] <= 0) {
                        i.alarm[k] = -1;
                        this.evento(i, EV.ALARM, k);
                    }
                }
            }
        });
        this.eventosDeTeclado();
        this.todosComEvento(EV.STEP, 0);
        this.mover();
        this.colisoes();
        this.todosComEvento(EV.STEP, 2);
        this.animar();
        this.atualizarVistas();
        this.desenhar();
        this.limparDestruidas();
        this.apertadas.clear();
        this.soltas.clear();
        this.mouse.apertados.clear();
        this.mouse.soltos.clear();
        this.quadros++;
    }

    eventosDeTeclado () {
        const lista = this.instancias.slice();
        for (const i of lista) {
            if (i.destruida || i.desativada) continue;
            const d = this.dw.objetos[i.objeto];
            if (!d) continue;
            for (const k of this.teclas) this.evento(i, EV.KEYBOARD, k);
            if (this.teclas.size) this.evento(i, EV.KEYBOARD, 1);
            else this.evento(i, EV.KEYBOARD, 0);
            for (const k of this.apertadas) this.evento(i, EV.KEYPRESS, k);
            if (this.apertadas.size) this.evento(i, EV.KEYPRESS, 1);
            for (const k of this.soltas) this.evento(i, EV.KEYRELEASE, k);
            if (this.soltas.size) this.evento(i, EV.KEYRELEASE, 1);
        }
    }

    mover () {
        for (const i of this.instancias) {
            if (i.destruida || i.desativada) continue;
            i.xprevious = i.x;
            i.yprevious = i.y;
            if (i.friction) {
                const s = i.speed;
                if (s > 0) i.speed = Math.max(0, s - i.friction);
            }
            if (i.gravity) {
                const g = i.gravity_direction * Math.PI / 180;
                i.hs += i.gravity * Math.cos(g);
                i.vs -= i.gravity * Math.sin(g);
            }
            if (i.hs || i.vs) {
                i.x += i.hs;
                i.y += i.vs;
            }
            // fora da sala
            if (this.temEvento(i, EV.OTHER, 0)) {
                const c = i.caixa() || {l: i.x, r: i.x, t: i.y, b: i.y};
                const fora = c.r < 0 || c.l > this.room_width || c.b < 0 || c.t > this.room_height;
                if (fora && !i.estavaFora) this.evento(i, EV.OTHER, 0);
                i.estavaFora = fora;
            }
        }
    }

    colisoes () {
        const lista = this.instancias.slice();
        for (const a of lista) {
            if (a.destruida || a.desativada) continue;
            const d = this.dw.objetos[a.objeto];
            if (!d) continue;
            // eventos de colisão do objeto e dos pais
            const subs = new Set();
            let o = a.objeto;
            for (let k = 0; k < 64 && o >= 0; k++) {
                const od = this.dw.objetos[o];
                if (!od) break;
                for (const ev of od.eventos[EV.COLLISION] || []) subs.add(ev.sub);
                o = od.pai;
            }
            if (!subs.size) continue;
            const ca = a.caixa();
            if (!ca) continue;
            for (const alvo of subs) {
                for (const b of this.instanciasDe(alvo)) {
                    if (b === a || a.destruida) continue;
                    if (!sobrepoe(ca, b.caixa())) continue;
                    if (a.solid || b.solid) {
                        a.x = a.xprevious;
                        a.y = a.yprevious;
                    }
                    this.evento(a, EV.COLLISION, alvo, b);
                }
            }
        }
    }

    animar () {
        for (const i of this.instancias) {
            if (i.destruida || i.desativada) continue;
            const s = i.spriteDados();
            if (!s || !s.quadros.length) continue;
            let passo = i.image_speed;
            if (this.dw.info.gms2) {
                passo *= s.tipoVelocidade === 0 ? (s.velocidade / Math.max(1, this.room_speed)) : s.velocidade;
            }
            i.image_index += passo;
            const n = s.quadros.length;
            if (i.image_index >= n) {
                i.image_index -= n * Math.floor(i.image_index / n);
                this.evento(i, EV.OTHER, 7);
            } else if (i.image_index < 0) {
                i.image_index = n + (i.image_index % n);
                if (i.image_index >= n) i.image_index = 0;
                this.evento(i, EV.OTHER, 7);
            }
        }
        // fundos/sprites animados das camadas
        for (const c of this.camadas) {
            c.x += c.vx;
            c.y += c.vy;
        }
        const F = this.fundos;
        for (let k = 0; k < 8; k++) {
            F.x[k] += F.hspeed[k];
            F.y[k] += F.vspeed[k];
        }
    }

    atualizarVistas () {
        if (!this.view_enabled) return;
        const V = this.vistas;
        for (let k = 0; k < 8; k++) {
            if (!V.visible[k] || V.object[k] < 0) continue;
            const alvo = this.instanciasDe(V.object[k])[0];
            if (!alvo) continue;
            const bx = V.hborder[k];
            const by = V.vborder[k];
            let x = V.xview[k];
            let y = V.yview[k];
            const w = V.wview[k];
            const h = V.hview[k];
            let nx = x;
            let ny = y;
            if (alvo.x - bx < x) nx = alvo.x - bx;
            if (alvo.x + bx > x + w) nx = alvo.x + bx - w;
            if (alvo.y - by < y) ny = alvo.y - by;
            if (alvo.y + by > y + h) ny = alvo.y + by - h;
            const vx = V.hspeed[k];
            const vy = V.vspeed[k];
            if (vx >= 0) nx = x + Math.max(-vx, Math.min(vx, nx - x));
            if (vy >= 0) ny = y + Math.max(-vy, Math.min(vy, ny - y));
            x = Math.max(0, Math.min(nx, this.room_width - w));
            y = Math.max(0, Math.min(ny, this.room_height - h));
            V.xview[k] = x;
            V.yview[k] = y;
        }
    }

    // ---------------------------------------------------------------- desenho
    camera (k) {
        const id = this.vistas.camera[k];
        if (id >= 0 && id < 8 && id === k) {
            const V = this.vistas;
            return {x: V.xview[k], y: V.yview[k], w: V.wview[k], h: V.hview[k], ang: V.angle[k]};
        }
        const c = this.camerasExtras.get(id);
        return c ? {x: c.x, y: c.y, w: c.w, h: c.h, ang: c.ang || 0} : null;
    }

    desenhar () {
        const ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = corCss(this.mostrarCor ? this.background_color : 0);
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const V = this.vistas;
        const vistas = [];
        if (this.view_enabled) {
            for (let k = 0; k < 8; k++) if (V.visible[k]) vistas.push(k);
        }
        if (!vistas.length) vistas.push(-1);
        for (const k of vistas) {
            ctx.save();
            this.view_current = Math.max(0, k);
            if (k >= 0) {
                const cam = this.camera(k) || {x: 0, y: 0, w: V.wview[k], h: V.hview[k], ang: 0};
                ctx.beginPath();
                ctx.rect(V.xport[k], V.yport[k], V.wport[k], V.hport[k]);
                ctx.clip();
                ctx.translate(V.xport[k], V.yport[k]);
                ctx.scale(V.wport[k] / Math.max(1, cam.w), V.hport[k] / Math.max(1, cam.h));
                if (cam.ang) {
                    ctx.translate(cam.w / 2, cam.h / 2);
                    ctx.rotate(cam.ang * Math.PI / 180);
                    ctx.translate(-cam.w / 2, -cam.h / 2);
                }
                ctx.translate(-cam.x, -cam.y);
            }
            this.desenharMundo();
            ctx.restore();
        }
        // GUI
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const gw = this.gui.w || this.canvas.width;
        const gh = this.gui.h || this.canvas.height;
        ctx.scale(this.canvas.width / gw, this.canvas.height / gh);
        const ordem = this.porProfundidade();
        for (const sub of [74, 64, 75]) {
            for (const i of ordem) {
                if (i.visible && !i.destruida) this.evento(i, EV.DRAW, sub);
            }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    porProfundidade () {
        return this.instancias.filter(i => !i.destruida && !i.desativada).sort((a, b) => b.depth - a.depth);
    }

    desenharMundo () {
        const itens = [];
        const F = this.fundos;
        for (let k = 0; k < 8; k++) {
            if (F.visible[k] && !F.foreground[k]) itens.push({prof: Infinity, f: () => this.desenharFundo(k)});
            if (F.visible[k] && F.foreground[k]) itens.push({prof: -Infinity, f: () => this.desenharFundo(k)});
        }
        for (const t of this.tiles) if (t.visivel) itens.push({prof: t.prof, f: () => this.desenharTile(t)});
        for (const c of this.camadas) {
            if (!c.visivel) continue;
            if (c.tipo === 1 && c.fundo) itens.push({prof: c.prof, f: () => this.desenharCamadaFundo(c)});
            if (c.tipo === 4 && c.mapa) itens.push({prof: c.prof, f: () => this.desenharMapa(c)});
            if (c.tipo === 3) {
                itens.push({prof: c.prof,
                    f: () => {
                        for (const t of c.tiles || []) this.desenharTile(t, true);
                        for (const s of c.sprites || []) {
                            this.d.sprite(s.sprite, s.quadroAtual, s.x, s.y, s.escalaX, s.escalaY, s.angulo,
                                s.cor & 0xffffff, ((s.cor >>> 24) & 0xff) / 255 || 1);
                        }
                    }});
            }
        }
        for (const i of this.instancias) {
            if (i.destruida || i.desativada || !i.visible) continue;
            itens.push({prof: i.depth, inst: i});
        }
        itens.sort((a, b) => b.prof - a.prof);
        const temEv = sub => i => this.temEvento(i, EV.DRAW, sub);
        const insts = itens.filter(x => x.inst).map(x => x.inst);
        for (const i of insts.filter(temEv(72))) this.evento(i, EV.DRAW, 72);
        for (const it of itens) {
            if (it.inst) {
                const i = it.inst;
                if (i.destruida) continue;
                if (!this.evento(i, EV.DRAW, 0)) this.desenharSelf(i);
            } else {
                it.f();
            }
        }
        for (const i of insts.filter(temEv(73))) this.evento(i, EV.DRAW, 73);
    }

    desenharSelf (i) {
        if (i.sprite_index < 0) return;
        this.d.sprite(i.sprite_index, i.image_index, i.x, i.y, i.image_xscale, i.image_yscale, i.image_angle,
            i.image_blend, i.image_alpha);
    }

    desenharFundo (k) {
        const F = this.fundos;
        const b = this.dw.fundos[F.index[k]];
        if (!b || !b.pagina) return;
        const it = b.pagina;
        const w = it.bw * F.xscale[k];
        const h = it.bh * F.yscale[k];
        if (w <= 0 || h <= 0) return;
        let x0 = F.x[k];
        let y0 = F.y[k];
        let nx = 1;
        let ny = 1;
        if (F.htiled[k]) {
            x0 = ((x0 % w) + w) % w - w;
            nx = Math.ceil((this.room_width + w) / w) + 1;
        }
        if (F.vtiled[k]) {
            y0 = ((y0 % h) + h) % h - h;
            ny = Math.ceil((this.room_height + h) / h) + 1;
        }
        for (let a = 0; a < nx; a++) {
            for (let c = 0; c < ny; c++) {
                this.d.item(it, x0 + (a * w), y0 + (c * h), 0, 0, F.xscale[k], F.yscale[k], 0, F.blend[k], F.alpha[k]);
            }
        }
    }

    desenharCamadaFundo (c) {
        const f = c.fundo;
        if (!f.visivel) return;
        const ctx = this.ctx;
        const s = this.dw.sprites[f.sprite];
        const cor = f.cor & 0xffffff;
        const alpha = ((f.cor >>> 24) & 0xff) / 255;
        if (!s || !s.quadros.length) {
            ctx.save();
            ctx.globalAlpha *= alpha;
            ctx.fillStyle = corCss(cor);
            ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
            ctx.restore();
            return;
        }
        const it = s.quadros[Math.floor(f.quadroAtual || 0) % s.quadros.length];
        if (f.esticar) {
            this.d.item(it, 0, 0, 0, 0, this.room_width / s.largura, this.room_height / s.altura, 0, cor, alpha);
            return;
        }
        const w = s.largura;
        const h = s.altura;
        let x0 = c.dx + c.x;
        let y0 = c.dy + c.y;
        let nx = 1;
        let ny = 1;
        if (f.repeteX) {
            x0 = ((x0 % w) + w) % w - w;
            nx = Math.ceil((this.room_width + w) / w) + 1;
        }
        if (f.repeteY) {
            y0 = ((y0 % h) + h) % h - h;
            ny = Math.ceil((this.room_height + h) / h) + 1;
        }
        for (let a = 0; a < nx; a++) {
            for (let b = 0; b < ny; b++) this.d.item(it, x0 + (a * w), y0 + (b * h), 0, 0, 1, 1, 0, cor, alpha);
        }
    }

    desenharTile (t, ehSprite) {
        const fonte = ehSprite || this.dw.info.gms2 ? this.dw.sprites[t.fundo] : this.dw.fundos[t.fundo];
        const it = fonte ? (fonte.pagina || (fonte.quadros && fonte.quadros[0])) : null;
        if (!it) return;
        this.d.parte(it, t.sx, t.sy, t.w, t.h, t.x, t.y, t.escalaX, t.escalaY, t.cor & 0xffffff,
            ((t.cor >>> 24) & 0xff) / 255 || 1);
    }

    desenharMapa (c) {
        const m = c.mapa;
        const ts = this.dw.fundos[m.fundo];
        if (!ts || !ts.pagina || !ts.tw) return;
        const it = ts.pagina;
        const img = this.d.imagem(it);
        if (!img) return;
        const ctx = this.ctx;
        const tw = ts.tw;
        const th = ts.th;
        const passoX = tw + (2 * ts.bx) + ts.sx;
        const passoY = th + (2 * ts.by) + ts.sy;
        const ox = c.dx + c.x;
        const oy = c.dy + c.y;
        for (let ty = 0; ty < m.ty; ty++) {
            for (let tx = 0; tx < m.tx; tx++) {
                const v = m.dados[(ty * m.tx) + tx];
                const idx = v & 0x7ffff;
                if (!idx) continue;
                const col = idx % ts.colunas;
                const lin = Math.floor(idx / ts.colunas);
                const sx = it.sx + (col * passoX) + ts.bx - it.tx;
                const sy = it.sy + (lin * passoY) + ts.by - it.ty;
                const x = ox + (tx * tw);
                const y = oy + (ty * th);
                const espelha = v & 0x10000000;
                const vira = v & 0x20000000;
                const gira = v & 0x40000000;
                if (espelha || vira || gira) {
                    ctx.save();
                    ctx.translate(x + (tw / 2), y + (th / 2));
                    if (gira) ctx.rotate(Math.PI / 2);
                    ctx.scale(espelha ? -1 : 1, vira ? -1 : 1);
                    ctx.drawImage(img, sx, sy, tw, th, -tw / 2, -th / 2, tw, th);
                    ctx.restore();
                } else {
                    ctx.drawImage(img, sx, sy, tw, th, x, y, tw, th);
                }
            }
        }
    }

    // ---------------------------------------------------------------- arquivos (salvos no navegador)
    carregarVfs () {
        try {
            return new Map(Object.entries(JSON.parse(localStorage.getItem(this.prefixo) || '{}')));
        } catch (e) {
            return new Map();
        }
    }

    salvarVfs () {
        try {
            localStorage.setItem(this.prefixo, JSON.stringify(Object.fromEntries(this.vfs)));
        } catch (e) {
            // sem espaço: ignora
        }
    }

    // ---------------------------------------------------------------- entrada
    teclaDown (codigo) {
        if (!this.teclas.has(codigo)) this.apertadas.add(codigo);
        this.teclas.add(codigo);
        this.ultimaTecla = codigo;
    }

    teclaUp (codigo) {
        this.teclas.delete(codigo);
        this.soltas.add(codigo);
    }

    // ---------------------------------------------------------------- chamadas nativas
    chamarNativa (nome, args, q) {
        const f = FUNCOES[nome];
        if (f) return f(this, args, q);
        this.faltou(nome);
        return undefined;
    }

    parar () {
        this.rodando = false;
        for (const v of this.vozes.values()) {
            try {
                v.fonte.stop();
            } catch (e) {
                // já parou
            }
        }
        this.vozes.clear();
    }
}

// variáveis globais embutidas
const arr = (chave, sub) => ({ler: m => m[chave][sub]});
const GLOBAIS = {
    room: {ler: m => m.sala, escrever: (m, v) => m.irPara(paraInt(v))},
    room_first: {ler: m => m.dw.ordemSalas[0]},
    room_last: {ler: m => m.dw.ordemSalas[m.dw.ordemSalas.length - 1]},
    room_width: {ler: m => m.room_width,
        escrever: (m, v) => {
            m.room_width = num(v);
        }},
    room_height: {ler: m => m.room_height,
        escrever: (m, v) => {
            m.room_height = num(v);
        }},
    room_speed: {ler: m => m.room_speed,
        escrever: (m, v) => {
            m.room_speed = Math.max(1, num(v));
        }},
    room_caption: {ler: m => (m.dw.salas[m.sala] || {}).titulo || '', escrever: () => {}},
    room_persistent: {ler: m => (m.salaPersistente ? 1 : 0),
        escrever: (m, v) => {
            m.salaPersistente = verdade(v);
        }},
    score: {ler: m => m.score,
        escrever: (m, v) => {
            m.score = num(v);
        }},
    lives: {ler: m => m.lives,
        escrever: (m, v) => {
            m.lives = num(v);
        }},
    health: {ler: m => m.health,
        escrever: (m, v) => {
            m.health = num(v);
        }},
    fps: {ler: m => m.room_speed},
    fps_real: {ler: m => m.room_speed},
    current_time: {ler: m => Math.floor(performance.now() - m.tempoInicio)},
    delta_time: {ler: m => Math.round(1e6 / Math.max(1, m.room_speed))},
    keyboard_key: {ler: m => (m.teclas.size ? m.ultimaTecla : 0), escrever: () => {}},
    keyboard_lastkey: {ler: m => m.ultimaTecla,
        escrever: (m, v) => {
            m.ultimaTecla = paraInt(v);
        }},
    keyboard_lastchar: {ler: m => m.keyboard_string.slice(-1), escrever: () => {}},
    keyboard_string: {ler: m => m.keyboard_string,
        escrever: (m, v) => {
            m.keyboard_string = String(v);
        }},
    mouse_x: {ler: m => m.mouse.x},
    mouse_y: {ler: m => m.mouse.y},
    mouse_button: {ler: m => (m.mouse.botoes.has(1) ? 1 : (m.mouse.botoes.has(2) ? 2 : 0))},
    view_enabled: {ler: m => (m.view_enabled ? 1 : 0),
        escrever: (m, v) => {
            m.view_enabled = verdade(v);
            m.ajustarTela();
        }},
    view_current: {ler: m => m.view_current},
    view_visible: arr('vistas', 'visible'),
    view_xview: arr('vistas', 'xview'),
    view_yview: arr('vistas', 'yview'),
    view_wview: arr('vistas', 'wview'),
    view_hview: arr('vistas', 'hview'),
    view_xport: arr('vistas', 'xport'),
    view_yport: arr('vistas', 'yport'),
    view_wport: arr('vistas', 'wport'),
    view_hport: arr('vistas', 'hport'),
    view_angle: arr('vistas', 'angle'),
    view_hborder: arr('vistas', 'hborder'),
    view_vborder: arr('vistas', 'vborder'),
    view_hspeed: arr('vistas', 'hspeed'),
    view_vspeed: arr('vistas', 'vspeed'),
    view_object: arr('vistas', 'object'),
    view_camera: arr('vistas', 'camera'),
    background_color: {ler: m => m.background_color,
        escrever: (m, v) => {
            m.background_color = paraInt(v);
        }},
    background_colour: {ler: m => m.background_color,
        escrever: (m, v) => {
            m.background_color = paraInt(v);
        }},
    background_showcolor: {ler: m => (m.mostrarCor ? 1 : 0),
        escrever: (m, v) => {
            m.mostrarCor = verdade(v);
        }},
    background_showcolour: {ler: m => (m.mostrarCor ? 1 : 0),
        escrever: (m, v) => {
            m.mostrarCor = verdade(v);
        }},
    background_visible: arr('fundos', 'visible'),
    background_foreground: arr('fundos', 'foreground'),
    background_index: arr('fundos', 'index'),
    background_x: arr('fundos', 'x'),
    background_y: arr('fundos', 'y'),
    background_htiled: arr('fundos', 'htiled'),
    background_vtiled: arr('fundos', 'vtiled'),
    background_xscale: arr('fundos', 'xscale'),
    background_yscale: arr('fundos', 'yscale'),
    background_hspeed: arr('fundos', 'hspeed'),
    background_vspeed: arr('fundos', 'vspeed'),
    background_blend: arr('fundos', 'blend'),
    background_alpha: arr('fundos', 'alpha'),
    instance_count: {ler: m => m.instancias.filter(i => !i.destruida).length},
    game_id: {ler: () => 0},
    working_directory: {ler: () => ''},
    program_directory: {ler: () => ''},
    temp_directory: {ler: () => ''},
    game_save_id: {ler: () => ''},
    os_type: {ler: () => 0},
    os_browser: {ler: () => -1},
    os_device: {ler: () => 0},
    debug_mode: {ler: () => 0},
    application_surface: {ler: () => -1},
    event_type: {ler: m => (m.eventoAtual.length ? m.eventoAtual[m.eventoAtual.length - 1].tipo : -1)},
    event_number: {ler: m => (m.eventoAtual.length ? m.eventoAtual[m.eventoAtual.length - 1].sub : -1)},
    event_object: {ler: m => (m.eventoAtual.length ? m.eventoAtual[m.eventoAtual.length - 1].nivel : -1)},
    async_load: {ler: () => -1},
    browser_width: {ler: m => m.canvas.width},
    browser_height: {ler: m => m.canvas.height},
    display_aa: {ler: () => 0},
    current_year: {ler: () => new Date().getFullYear()},
    current_month: {ler: () => new Date().getMonth() + 1},
    current_day: {ler: () => new Date().getDate()},
    current_weekday: {ler: () => new Date().getDay()},
    current_hour: {ler: () => new Date().getHours()},
    current_minute: {ler: () => new Date().getMinutes()},
    current_second: {ler: () => new Date().getSeconds()},
    secure_mode: {ler: () => 0},
    gamemaker_version: {ler: () => 2},
    pointer_null: {ler: () => undefined},
    pointer_invalid: {ler: () => -1}
};
