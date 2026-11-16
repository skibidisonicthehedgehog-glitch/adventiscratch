/**
 * Extensão "Plataforma 2D" do Adventiscratch.
 *
 * Física simples e previsível para jogos de plataforma com atores comuns:
 *  - "personagem": cai com a gravidade, anda, pula (com pulo duplo opcional) e colide.
 *  - "sólido": chão, paredes e blocos. Ninguém atravessa.
 *  - "plataforma": dá para atravessar por baixo e pousar em cima (e descer com a seta para baixo).
 *
 * As colisões usam a caixa (retângulo) de cada ator, sem girar. Atores escondidos não colidem
 * (para uma parede invisível, use o efeito fantasma 100). A física só roda enquanto o projeto
 * está rodando, uma vez por quadro, antes dos scripts.
 *
 * Unidades: tudo em "passos por quadro", igual ao "mude x por" do Scratch.
 */
import icone from './icone-2d.svg';

const ArgumentType = {NUMBER: 'number', STRING: 'string'};
const BlockType = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat'};

const ID = 'adventiscratch2d';
const EPS = 0.001;
const PASSO_MAX = 6; // tamanho máximo de cada sub-passo (evita atravessar coisas finas)
const COYOTE = 5; // quadros em que ainda dá para pular depois de sair da beirada
const BUFFER_PULO = 6; // quadros em que um pulo apertado antes de tocar o chão ainda vale

const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const novoEstado = () => ({
    tipo: 'nada',
    vx: 0,
    vy: 0,
    gravidade: 1, // multiplicador da gravidade do mundo
    pulosNoAr: 0,
    pulosRestantes: 0,
    aceleracao: 30, // %
    quedaMax: 20,
    degrau: 4,
    caixa: null, // {l, r, b, t} relativo a (x, y)
    caixaFixa: false,
    tamanhoCaixa: null,
    noChao: false,
    paredeEsq: false,
    paredeDir: false,
    teto: false,
    chao: null, // id do alvo embaixo
    quadrosFora: 99,
    pulou: false,
    puloTecla: false,
    ultimoPulo: -10,
    bufferPulo: 0,
    descer: 0,
    teclaPuloAntes: false
});

const copiarEstado = e => Object.assign({}, e, {caixa: e.caixa ? Object.assign({}, e.caixa) : null});

const TECLAS = {
    setas: {esq: ['left arrow'], dir: ['right arrow'], pulo: ['up arrow', 'space'], baixo: ['down arrow']},
    wasd: {esq: ['a'], dir: ['d'], pulo: ['w', 'space'], baixo: ['s']},
    ambos: {
        esq: ['left arrow', 'a'],
        dir: ['right arrow', 'd'],
        pulo: ['up arrow', 'w', 'space'],
        baixo: ['down arrow', 's']
    }
};

class AdventiscratchPlataforma2D {
    constructor (runtime) {
        this.runtime = runtime;
        this.gravidade = -1;
        this.bordas = 'chao-paredes';
        this.quadro = 0;
        this.posAnterior = new Map(); // id -> {x, y} dos sólidos no quadro anterior
        runtime.adventiscratch2d = this; // acesso pelo console (F12)

        runtime.on('targetWasCreated', (novo, origem) => {
            const e = origem && origem.getCustomState(ID);
            if (e) novo.setCustomState(ID, copiarEstado(e));
        });
        runtime.on('PROJECT_STOP_ALL', () => {
            for (const t of runtime.targets) {
                const e = t.getCustomState(ID);
                if (e) {
                    e.vx = 0;
                    e.vy = 0;
                }
            }
        });
        runtime.on('PROJECT_LOADED', () => this.reiniciarMundo());

        const passoOriginal = runtime._step.bind(runtime);
        runtime._step = () => {
            if (runtime._nonMonitorThreadCount > 0) {
                try {
                    this.passo();
                } catch (err) {
                    console.warn('Adventiscratch 2D: erro na física', err); // eslint-disable-line no-console
                }
            }
            passoOriginal();
        };
    }

    reiniciarMundo () {
        this.gravidade = -1;
        this.bordas = 'chao-paredes';
        this.posAnterior.clear();
    }

    getInfo () {
        return {
            id: ID,
            name: 'Plataforma 2D',
            color1: '#E8742C',
            color2: '#D06020',
            color3: '#B04E15',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {
                    opcode: 'tornar',
                    blockType: BlockType.COMMAND,
                    text: 'tornar este ator [TIPO]',
                    arguments: {TIPO: {type: ArgumentType.STRING, menu: 'tipos', defaultValue: 'personagem'}}
                },
                {
                    opcode: 'controlar',
                    blockType: BlockType.COMMAND,
                    text: 'controlar com [TECLAS] velocidade [V] pulo [F]',
                    arguments: {
                        TECLAS: {type: ArgumentType.STRING, menu: 'teclas', defaultValue: 'ambos'},
                        V: {type: ArgumentType.NUMBER, defaultValue: 5},
                        F: {type: ArgumentType.NUMBER, defaultValue: 13}
                    }
                },
                '---',
                {
                    opcode: 'pular',
                    blockType: BlockType.COMMAND,
                    text: 'pular com força [F]',
                    arguments: {F: {type: ArgumentType.NUMBER, defaultValue: 13}}
                },
                {
                    opcode: 'definirVel',
                    blockType: BlockType.COMMAND,
                    text: 'definir velocidade [EIXO] para [V]',
                    arguments: {
                        EIXO: {type: ArgumentType.STRING, menu: 'eixos', defaultValue: 'x'},
                        V: {type: ArgumentType.NUMBER, defaultValue: 5}
                    }
                },
                {
                    opcode: 'mudarVel',
                    blockType: BlockType.COMMAND,
                    text: 'mudar velocidade [EIXO] em [V]',
                    arguments: {
                        EIXO: {type: ArgumentType.STRING, menu: 'eixos', defaultValue: 'x'},
                        V: {type: ArgumentType.NUMBER, defaultValue: 1}
                    }
                },
                {
                    opcode: 'velocidade',
                    blockType: BlockType.REPORTER,
                    text: 'velocidade [EIXO]',
                    arguments: {EIXO: {type: ArgumentType.STRING, menu: 'eixos', defaultValue: 'x'}}
                },
                '---',
                {
                    opcode: 'esta',
                    blockType: BlockType.BOOLEAN,
                    text: 'está [ESTADO]?',
                    arguments: {ESTADO: {type: ArgumentType.STRING, menu: 'estados', defaultValue: 'chao'}}
                },
                {
                    opcode: 'nomeChao',
                    blockType: BlockType.REPORTER,
                    text: 'nome do que está embaixo'
                },
                {
                    opcode: 'quando',
                    blockType: BlockType.HAT,
                    isEdgeActivated: false,
                    text: 'quando este ator [EVENTO]',
                    arguments: {EVENTO: {type: ArgumentType.STRING, menu: 'eventos', defaultValue: 'aterrissar'}}
                },
                '---',
                {
                    opcode: 'pulosNoAr',
                    blockType: BlockType.COMMAND,
                    text: 'permitir [N] pulos no ar',
                    arguments: {N: {type: ArgumentType.NUMBER, defaultValue: 1}}
                },
                {
                    opcode: 'aceleracao',
                    blockType: BlockType.COMMAND,
                    text: 'definir aceleração para [A] %',
                    arguments: {A: {type: ArgumentType.NUMBER, defaultValue: 30}}
                },
                {
                    opcode: 'quedaMax',
                    blockType: BlockType.COMMAND,
                    text: 'definir queda máxima para [V]',
                    arguments: {V: {type: ArgumentType.NUMBER, defaultValue: 20}}
                },
                {
                    opcode: 'escalaGravidade',
                    blockType: BlockType.COMMAND,
                    text: 'definir gravidade deste ator para [P] %',
                    arguments: {P: {type: ArgumentType.NUMBER, defaultValue: 100}}
                },
                {
                    opcode: 'caixa',
                    blockType: BlockType.COMMAND,
                    text: 'definir caixa de colisão largura [L] altura [A]',
                    arguments: {
                        L: {type: ArgumentType.NUMBER, defaultValue: 40},
                        A: {type: ArgumentType.NUMBER, defaultValue: 60}
                    }
                },
                {
                    opcode: 'caixaAuto',
                    blockType: BlockType.COMMAND,
                    text: 'usar caixa de colisão do traje atual'
                },
                '---',
                {
                    opcode: 'gravidadeMundo',
                    blockType: BlockType.COMMAND,
                    text: 'definir gravidade do mundo para [G]',
                    arguments: {G: {type: ArgumentType.NUMBER, defaultValue: -1}}
                },
                {
                    opcode: 'gravidadeAtual',
                    blockType: BlockType.REPORTER,
                    text: 'gravidade do mundo'
                },
                {
                    opcode: 'usarBordas',
                    blockType: BlockType.COMMAND,
                    text: 'usar bordas do palco como [MODO]',
                    arguments: {MODO: {type: ArgumentType.STRING, menu: 'bordas', defaultValue: 'chao-paredes'}}
                }
            ],
            menus: {
                tipos: {
                    acceptReporters: false,
                    items: [
                        {text: 'personagem', value: 'personagem'},
                        {text: 'sólido', value: 'solido'},
                        {text: 'plataforma (atravessa por baixo)', value: 'plataforma'},
                        {text: 'nada (sem física)', value: 'nada'}
                    ]
                },
                teclas: {
                    acceptReporters: false,
                    items: [
                        {text: 'setas e WASD', value: 'ambos'},
                        {text: 'setas', value: 'setas'},
                        {text: 'WASD', value: 'wasd'}
                    ]
                },
                eixos: {acceptReporters: false, items: ['x', 'y']},
                estados: {
                    acceptReporters: false,
                    items: [
                        {text: 'no chão', value: 'chao'},
                        {text: 'no ar', value: 'ar'},
                        {text: 'subindo', value: 'subindo'},
                        {text: 'caindo', value: 'caindo'},
                        {text: 'encostado numa parede', value: 'parede'},
                        {text: 'encostado na parede da esquerda', value: 'paredeEsq'},
                        {text: 'encostado na parede da direita', value: 'paredeDir'},
                        {text: 'batendo no teto', value: 'teto'},
                        {text: 'andando', value: 'andando'},
                        {text: 'parado', value: 'parado'}
                    ]
                },
                eventos: {
                    acceptReporters: false,
                    items: [
                        {text: 'aterrissar', value: 'aterrissar'},
                        {text: 'pular', value: 'pular'},
                        {text: 'bater numa parede', value: 'parede'},
                        {text: 'bater no teto', value: 'teto'}
                    ]
                },
                bordas: {
                    acceptReporters: false,
                    items: [
                        {text: 'chão e paredes', value: 'chao-paredes'},
                        {text: 'só paredes (dá para cair no buraco)', value: 'paredes'},
                        {text: 'só chão', value: 'chao'},
                        {text: 'nada', value: 'nada'}
                    ]
                }
            }
        };
    }

    // ---------- estado ----------

    estado (target) {
        let e = target.getCustomState(ID);
        if (!e) {
            e = novoEstado();
            target.setCustomState(ID, e);
        }
        return e;
    }

    medirCaixa (target, e) {
        const b = target.getBounds();
        if (!b) {
            e.caixa = {l: -20, r: 20, b: -20, t: 20};
        } else {
            e.caixa = {l: b.left - target.x, r: b.right - target.x, b: b.bottom - target.y, t: b.top - target.y};
        }
        e.tamanhoCaixa = target.size;
    }

    // ---------- blocos ----------

    tornar (args, util) {
        const t = util.target;
        if (t.isStage) return;
        const e = this.estado(t);
        e.tipo = String(args.TIPO);
        if (e.tipo === 'personagem') {
            // girar de cabeça para baixo atrapalha a caixa de colisão
            if (t.rotationStyle === 'all around') t.setRotationStyle('left-right');
            if (!e.caixaFixa) this.medirCaixa(t, e);
            e.vx = 0;
            e.vy = 0;
        } else {
            this.posAnterior.delete(t.id);
        }
    }

    controlar (args, util) {
        const t = util.target;
        if (t.isStage) return;
        const e = this.estado(t);
        if (e.tipo !== 'personagem') this.tornar({TIPO: 'personagem'}, util);
        const kb = this.runtime.ioDevices.keyboard;
        const teclas = TECLAS[args.TECLAS] || TECLAS.ambos;
        const algum = lista => lista.some(k => kb.getKeyIsDown(k));
        const vel = Math.abs(num(args.V));
        const forca = num(args.F);

        let alvo = 0;
        if (algum(teclas.esq)) alvo -= vel;
        if (algum(teclas.dir)) alvo += vel;
        const ac = Math.max(1, Math.min(100, e.aceleracao)) / 100;
        const fator = (alvo === 0 && !e.noChao) ? ac / 2 : ac;
        e.vx += (alvo - e.vx) * fator;
        if (Math.abs(e.vx) < 0.05) e.vx = 0;
        if (alvo > 0 && t.direction !== 90) t.setDirection(90);
        if (alvo < 0 && t.direction !== -90) t.setDirection(-90);

        const puloAgora = algum(teclas.pulo);
        if (puloAgora && !e.teclaPuloAntes) e.bufferPulo = BUFFER_PULO;
        // pulo mais baixo se soltar a tecla cedo (só para pulos feitos pelas teclas)
        if (!puloAgora && e.vy > 0 && e.puloTecla) {
            e.vy *= 0.5;
            e.puloTecla = false;
        }
        e.teclaPuloAntes = puloAgora;
        if (e.bufferPulo > 0) {
            if (this.tentarPular(t, e, forca, true, true)) e.bufferPulo = 0;
            else e.bufferPulo--;
        }
        if (algum(teclas.baixo) && e.noChao) {
            const chao = e.chao && this.runtime.getTargetById(e.chao);
            const ec = chao && chao.getCustomState(ID);
            if (ec && ec.tipo === 'plataforma') e.descer = 8;
        }
    }

    tentarPular (t, e, forca, teclaNova, viaTecla) {
        const doChao = e.noChao || (e.quadrosFora <= COYOTE && !e.pulou);
        if (doChao) {
            e.pulosRestantes = e.pulosNoAr;
        } else {
            if (!teclaNova || e.pulosRestantes <= 0) return false;
            e.pulosRestantes--;
        }
        e.vy = forca;
        e.noChao = false;
        e.pulou = true;
        e.puloTecla = Boolean(viaTecla);
        e.quadrosFora = 99;
        this.runtime.startHats(`${ID}_quando`, {EVENTO: 'pular'}, t);
        return true;
    }

    pular (args, util) {
        const t = util.target;
        if (t.isStage) return;
        const e = this.estado(t);
        // chamado dentro de "sempre" com a tecla segurada: só conta como pulo novo
        // (para o pulo no ar) se não foi chamado no quadro anterior
        const novo = this.quadro - e.ultimoPulo > 1;
        e.ultimoPulo = this.quadro;
        this.tentarPular(t, e, num(args.F), novo, false);
    }

    definirVel (args, util) {
        if (util.target.isStage) return;
        const e = this.estado(util.target);
        if (args.EIXO === 'y') e.vy = num(args.V);
        else e.vx = num(args.V);
    }

    mudarVel (args, util) {
        if (util.target.isStage) return;
        const e = this.estado(util.target);
        if (args.EIXO === 'y') e.vy += num(args.V);
        else e.vx += num(args.V);
    }

    velocidade (args, util) {
        if (util.target.isStage) return 0;
        const e = this.estado(util.target);
        const v = args.EIXO === 'y' ? e.vy : e.vx;
        return Math.round(v * 100) / 100;
    }

    esta (args, util) {
        if (util.target.isStage) return false;
        const e = this.estado(util.target);
        switch (args.ESTADO) {
        case 'chao': return e.noChao;
        case 'ar': return !e.noChao;
        case 'subindo': return !e.noChao && e.vy > 0;
        case 'caindo': return !e.noChao && e.vy < 0;
        case 'parede': return e.paredeEsq || e.paredeDir;
        case 'paredeEsq': return e.paredeEsq;
        case 'paredeDir': return e.paredeDir;
        case 'teto': return e.teto;
        case 'andando': return e.noChao && Math.abs(e.vx) > 0.3;
        case 'parado': return e.noChao && Math.abs(e.vx) <= 0.3;
        }
        return false;
    }

    nomeChao (args, util) {
        if (util.target.isStage) return '';
        const e = this.estado(util.target);
        if (!e.noChao) return '';
        if (!e.chao) return 'chão do palco';
        const t = this.runtime.getTargetById(e.chao);
        return t ? t.getName() : '';
    }

    quando () {
        return true;
    }

    pulosNoAr (args, util) {
        if (util.target.isStage) return;
        const e = this.estado(util.target);
        e.pulosNoAr = Math.max(0, Math.round(num(args.N)));
        e.pulosRestantes = Math.min(e.pulosRestantes, e.pulosNoAr);
    }

    aceleracao (args, util) {
        if (util.target.isStage) return;
        this.estado(util.target).aceleracao = Math.max(1, Math.min(100, num(args.A)));
    }

    quedaMax (args, util) {
        if (util.target.isStage) return;
        this.estado(util.target).quedaMax = Math.max(1, Math.abs(num(args.V)));
    }

    escalaGravidade (args, util) {
        if (util.target.isStage) return;
        this.estado(util.target).gravidade = num(args.P) / 100;
    }

    caixa (args, util) {
        const t = util.target;
        if (t.isStage) return;
        const e = this.estado(t);
        const l = Math.max(1, Math.abs(num(args.L))) / 2;
        const a = Math.max(1, Math.abs(num(args.A))) / 2;
        e.caixa = {l: -l, r: l, b: -a, t: a};
        e.caixaFixa = true;
    }

    caixaAuto (args, util) {
        const t = util.target;
        if (t.isStage) return;
        const e = this.estado(t);
        e.caixaFixa = false;
        this.medirCaixa(t, e);
    }

    gravidadeMundo (args) {
        this.gravidade = num(args.G);
    }

    gravidadeAtual () {
        return this.gravidade;
    }

    usarBordas (args) {
        this.bordas = String(args.MODO);
    }

    // ---------- simulação ----------

    passo () {
        this.quadro++;
        const personagens = [];
        const solidos = [];
        for (const t of this.runtime.targets) {
            if (t.isStage) continue;
            const e = t.getCustomState(ID);
            if (!e || e.tipo === 'nada') continue;
            if (e.tipo === 'personagem') {
                personagens.push(t);
            } else if (t.visible) {
                const b = t.getBounds();
                if (b) {
                    const ant = this.posAnterior.get(t.id);
                    solidos.push({
                        id: t.id,
                        tipo: e.tipo,
                        l: b.left,
                        r: b.right,
                        b: b.bottom,
                        t: b.top,
                        dx: ant ? t.x - ant.x : 0,
                        dy: ant ? t.y - ant.y : 0
                    });
                }
            }
        }
        for (const s of solidos) {
            const t = this.runtime.getTargetById(s.id);
            this.posAnterior.set(s.id, {x: t.x, y: t.y});
        }
        if (this.posAnterior.size > solidos.length + 50) {
            const vivos = new Set(solidos.map(s => s.id));
            for (const id of this.posAnterior.keys()) if (!vivos.has(id)) this.posAnterior.delete(id);
        }
        for (const t of personagens) {
            if (t.dragging) continue;
            this.moverPersonagem(t, t.getCustomState(ID), solidos);
        }
    }

    moverPersonagem (target, e, solidos) {
        if (!e.caixaFixa && e.tamanhoCaixa !== target.size) this.medirCaixa(target, e);
        if (!e.caixa) this.medirCaixa(target, e);
        const c = e.caixa;
        const meiaL = (this.runtime.stageWidth || 480) / 2;
        const meiaA = (this.runtime.stageHeight || 360) / 2;
        const bordaChao = this.bordas === 'chao-paredes' || this.bordas === 'chao';
        const bordaParede = this.bordas === 'chao-paredes' || this.bordas === 'paredes';

        const estavaNoChao = e.noChao;
        const batiaParede = e.paredeEsq || e.paredeDir;
        const batiaTeto = e.teto;

        let x = target.x;
        let y = target.y;

        // anda junto com a plataforma em que está em pé
        if (estavaNoChao && e.chao) {
            const s = solidos.find(o => o.id === e.chao);
            if (s) {
                x += s.dx;
                y += s.dy;
            }
        }

        e.vy += this.gravidade * e.gravidade;
        if (e.vy < -e.quedaMax) e.vy = -e.quedaMax;
        if (e.descer > 0) e.descer--;

        e.noChao = false;
        e.paredeEsq = false;
        e.paredeDir = false;
        e.teto = false;
        let chao = null;

        const sobrepoe = (px, py, s) => px + c.r > s.l + EPS && px + c.l < s.r - EPS &&
            py + c.t > s.b + EPS && py + c.b < s.t - EPS;

        // ---- horizontal ----
        let restante = e.vx;
        while (Math.abs(restante) > EPS) {
            const d = Math.max(-PASSO_MAX, Math.min(PASSO_MAX, restante));
            restante -= d;
            let nx = x + d;
            let bateu = false;
            for (const s of solidos) {
                if (s.tipo !== 'solido' || !sobrepoe(nx, y, s)) continue;
                // degrau pequeno: sobe em vez de parar
                const altura = s.t - (y + c.b);
                if (estavaNoChao && altura > 0 && altura <= e.degrau &&
                    !solidos.some(o => o !== s && o.tipo === 'solido' && sobrepoe(nx, y + altura, o))) {
                    y += altura;
                    continue;
                }
                if (d > 0) {
                    nx = s.l - c.r;
                    e.paredeDir = true;
                } else {
                    nx = s.r - c.l;
                    e.paredeEsq = true;
                }
                bateu = true;
            }
            if (bordaParede) {
                if (nx + c.l < -meiaL) {
                    nx = -meiaL - c.l;
                    e.paredeEsq = true;
                    bateu = true;
                } else if (nx + c.r > meiaL) {
                    nx = meiaL - c.r;
                    e.paredeDir = true;
                    bateu = true;
                }
            }
            x = nx;
            if (bateu) {
                e.vx = 0;
                break;
            }
        }

        // ---- vertical ----
        restante = e.vy;
        const passos = Math.max(1, Math.ceil(Math.abs(restante) / PASSO_MAX));
        const d = restante / passos;
        for (let i = 0; i < passos; i++) {
            const peAntes = y + c.b;
            let ny = y + d;
            let bateu = false;
            for (const s of solidos) {
                if (!sobrepoe(x, ny, s)) continue;
                if (s.tipo === 'plataforma') {
                    if (d >= 0 || e.descer > 0 || peAntes < s.t - EPS) continue;
                }
                if (d <= 0) {
                    ny = s.t - c.b;
                    chao = s.id;
                    e.noChao = true;
                } else {
                    ny = s.b - c.t;
                    e.teto = true;
                }
                bateu = true;
            }
            if (bordaChao && ny + c.b < -meiaA) {
                ny = -meiaA - c.b;
                e.noChao = true;
                chao = null;
                bateu = true;
            }
            y = ny;
            if (bateu) {
                e.vy = 0;
                break;
            }
        }

        // sem velocidade vertical (ex.: gravidade 0), confere se ainda está apoiado
        if (!e.noChao && Math.abs(e.vy) < EPS) {
            for (const s of solidos) {
                if (Math.abs((y + c.b) - s.t) < 0.5 && x + c.r > s.l && x + c.l < s.r &&
                    (s.tipo === 'solido' || e.descer === 0)) {
                    e.noChao = true;
                    chao = s.id;
                }
            }
        }

        e.chao = e.noChao ? chao : null;
        if (e.noChao) {
            e.quadrosFora = 0;
            e.pulou = false;
            e.puloTecla = false;
            e.pulosRestantes = e.pulosNoAr;
        } else {
            e.quadrosFora++;
        }

        if (x !== target.x || y !== target.y) target.setXY(x, y);

        if (e.noChao && !estavaNoChao) this.runtime.startHats(`${ID}_quando`, {EVENTO: 'aterrissar'}, target);
        if ((e.paredeEsq || e.paredeDir) && !batiaParede) {
            this.runtime.startHats(`${ID}_quando`, {EVENTO: 'parede'}, target);
        }
        if (e.teto && !batiaTeto) this.runtime.startHats(`${ID}_quando`, {EVENTO: 'teto'}, target);
    }
}

export {AdventiscratchPlataforma2D};
