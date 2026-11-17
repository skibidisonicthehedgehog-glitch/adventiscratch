/**
 * Extensão "Animações": toca sequências de fantasias pelo nome (como as que vêm de uma spritesheet).
 * Ex.: fantasias "BF idle dance0000" … "BF idle dance0013" formam a animação "BF idle dance".
 *
 * Também roda o "controlador de animação" de cada ator (máquina de estados com parâmetros e transições):
 * ao clicar na bandeira, o ator começa no estado inicial e troca de estado sozinho quando as condições valem.
 */
import {separarNome} from './spritesheet.js';
import {obterControlador, transicaoPassa, QUALQUER} from './controladores.js';

const A = {NUMBER: 'number', STRING: 'string'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', BUTTON: 'button', HAT: 'hat'};
export const ID_ANIM = 'adventiscratchanim';
export const SPRITESHEET_CALLBACK = 'ADVENTISCRATCH_IMPORTAR_SPRITESHEET';
export const CONTROLADOR_CALLBACK = 'ADVENTISCRATCH_CONTROLADOR_ANIMACAO';

const icone = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
<circle cx="20" cy="20" r="19" fill="#fff"/><rect x="7" y="9" width="26" height="22" rx="3" fill="#E6FAF6" stroke="#1E9C8A" stroke-width="2"/>
<path d="M7 16h26M7 24h26M16 9v22M24 9v22" stroke="#1E9C8A" stroke-width="1.5"/>
<circle cx="11.5" cy="12.5" r="2" fill="#6D4FC2"/><circle cx="20" cy="20" r="2.4" fill="#6D4FC2"/><circle cx="28.5" cy="27.5" r="2.8" fill="#6D4FC2"/>
</svg>`);

const num = (v, padrao) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : padrao;
};

/**
 * Lista as animações de um ator: {nome: [índices das fantasias em ordem]}.
 * @param {RenderedTarget} alvo ator
 * @returns {Map<string, number[]>} animações
 */
export const animacoesDoAtor = alvo => {
    const mapa = new Map();
    alvo.getCostumes().forEach((c, i) => {
        const {animacao, numero} = separarNome(c.name);
        if (!mapa.has(animacao)) mapa.set(animacao, []);
        mapa.get(animacao).push({i, numero});
    });
    const r = new Map();
    mapa.forEach((lista, nome) => r.set(nome, lista.sort((a, b) => a.numero - b.numero).map(x => x.i)));
    return r;
};

class AdventiscratchAnimacoes {
    constructor (runtime) {
        this.runtime = runtime;
        this.tocando = new Map(); // id do ator -> {nome, quadros, inicio, qps, loop, ultimo, fim}
        this.maquinas = new Map(); // id do ator -> {estado, valores, gatilhos, ligado, inicio}
        this.rodando = false;
        runtime.adventiscratchAnimacoes = this; // acesso pelo console (F12)
        runtime.on('PROJECT_START', () => {
            this.maquinas.clear();
            this.rodando = true;
        });
        runtime.on('PROJECT_STOP_ALL', () => {
            this.tocando.clear();
            this.maquinas.clear();
            this.rodando = false;
        });
        runtime.on('PROJECT_LOADED', () => {
            this.tocando.clear();
            this.maquinas.clear();
            this.rodando = false;
        });
        const passoOriginal = runtime._step.bind(runtime);
        runtime._step = () => {
            try {
                this.passo();
            } catch (e) {
                console.warn('Adventiblocks: erro nas animações', e); // eslint-disable-line no-console
            }
            passoOriginal();
        };
    }

    // ---------------------------------------------------------------- controlador de animação

    _maquina (alvo, criar = true) {
        const c = obterControlador(alvo.getName());
        if (!c || !c.estados.length) return null;
        let mq = this.maquinas.get(alvo.id);
        if (!mq && criar) {
            mq = {estado: null, valores: new Map(), gatilhos: new Set(), ligado: true, inicio: 0, anim: null};
            c.parametros.forEach(p => mq.valores.set(p.nome, p.tipo === 'gatilho' ? false : p.valor));
            this.maquinas.set(alvo.id, mq);
        }
        return mq ? {c, mq} : null;
    }

    _entrar (alvo, c, mq, estado) {
        mq.estado = estado.id;
        mq.inicio = performance.now();
        mq.anim = this._comecar(alvo, estado.animacao, estado.qps, estado.loop);
        this.runtime.startHats(`${ID_ANIM}_quandoEntrar`, {ESTADO: estado.nome}, alvo);
    }

    /** A animação do estado atual já tocou inteira pelo menos uma vez? */
    _terminou (alvo, mq) {
        const t = mq.anim;
        if (!t || this.tocando.get(alvo.id) !== t) return true;
        return (performance.now() - t.inicio) / 1000 * t.qps >= t.quadros.length;
    }

    passoControladores () {
        for (const alvo of this.runtime.targets) {
            if (alvo.isStage) continue;
            const r = this._maquina(alvo, true);
            if (!r || !r.mq.ligado) continue;
            const {c, mq} = r;
            let atual = c.estados.find(e => e.id === mq.estado);
            if (!atual) {
                atual = c.estados.find(e => e.id === c.inicial) || c.estados[0];
                this._entrar(alvo, c, mq, atual);
                continue;
            }
            const terminou = this._terminou(alvo, mq);
            const candidatas = c.transicoes.filter(t => t.de === atual.id)
                .concat(c.transicoes.filter(t => t.de === QUALQUER && t.para !== atual.id));
            const t = candidatas.find(x => transicaoPassa(x, mq.valores, mq.gatilhos, terminou));
            if (t) {
                t.condicoes.forEach(k => {
                    if (k.op === 'disparado') mq.gatilhos.delete(k.param);
                });
                const destino = c.estados.find(e => e.id === t.para);
                if (destino) this._entrar(alvo, c, mq, destino);
            }
        }
    }

    passo () {
        if (this.rodando) this.passoControladores();
        if (!this.tocando.size) return;
        const agora = performance.now();
        this.tocando.forEach((t, id) => {
            const alvo = this.runtime.getTargetById(id);
            if (!alvo) {
                this.tocando.delete(id);
                return;
            }
            let q = Math.floor((agora - t.inicio) / 1000 * t.qps);
            if (q >= t.quadros.length) {
                if (t.loop) {
                    q %= t.quadros.length;
                } else {
                    q = t.quadros.length - 1;
                    t.fim = true;
                }
            }
            if (q !== t.ultimo) {
                t.ultimo = q;
                alvo.setCostume(t.quadros[q]);
            }
            if (t.fim) this.tocando.delete(id);
        });
    }

    getInfo () {
        return {
            id: ID_ANIM,
            name: 'Animações',
            color1: '#1E9C8A',
            color2: '#178273',
            color3: '#11685C',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {func: SPRITESHEET_CALLBACK, blockType: B.BUTTON, text: '🖼️ Importar spritesheet (.png + .xml)…'},
                {func: CONTROLADOR_CALLBACK, blockType: B.BUTTON, text: '🎛️ Controlador de animação…'},
                {
                    opcode: 'tocar',
                    blockType: B.COMMAND,
                    text: 'tocar animação [ANIM] a [QPS] quadros por segundo [MODO]',
                    arguments: {
                        ANIM: {type: A.STRING, menu: 'animacoes'},
                        QPS: {type: A.NUMBER, defaultValue: 24},
                        MODO: {type: A.STRING, menu: 'modos', defaultValue: 'uma'}
                    }
                },
                {
                    opcode: 'tocarEsperar',
                    blockType: B.COMMAND,
                    text: 'tocar animação [ANIM] a [QPS] quadros por segundo até o fim',
                    arguments: {
                        ANIM: {type: A.STRING, menu: 'animacoes'},
                        QPS: {type: A.NUMBER, defaultValue: 24}
                    }
                },
                {opcode: 'parar', blockType: B.COMMAND, text: 'parar animação'},
                '---',
                {opcode: 'atual', blockType: B.REPORTER, text: 'animação tocando'},
                {opcode: 'estaTocando', blockType: B.BOOLEAN, text: 'animação está tocando?'},
                {opcode: 'quadro', blockType: B.REPORTER, text: 'quadro da animação'},
                {
                    opcode: 'quantidade',
                    blockType: B.REPORTER,
                    text: 'quadros da animação [ANIM]',
                    arguments: {ANIM: {type: A.STRING, menu: 'animacoes'}}
                },
                '---',
                {
                    opcode: 'definirParametro',
                    blockType: B.COMMAND,
                    text: 'definir parâmetro [P] para [V]',
                    arguments: {P: {type: A.STRING, menu: 'parametros'}, V: {type: A.STRING, defaultValue: '1'}}
                },
                {
                    opcode: 'mudarParametro',
                    blockType: B.COMMAND,
                    text: 'mudar parâmetro [P] em [V]',
                    arguments: {P: {type: A.STRING, menu: 'parametros'}, V: {type: A.NUMBER, defaultValue: 1}}
                },
                {
                    opcode: 'disparar',
                    blockType: B.COMMAND,
                    text: 'disparar gatilho [P]',
                    arguments: {P: {type: A.STRING, menu: 'parametros'}}
                },
                {
                    opcode: 'parametro',
                    blockType: B.REPORTER,
                    text: 'parâmetro [P]',
                    arguments: {P: {type: A.STRING, menu: 'parametros'}}
                },
                {opcode: 'estado', blockType: B.REPORTER, text: 'estado da animação'},
                {
                    opcode: 'irPara',
                    blockType: B.COMMAND,
                    text: 'ir para o estado [ESTADO]',
                    arguments: {ESTADO: {type: A.STRING, menu: 'estadosReporter'}}
                },
                {
                    opcode: 'quandoEntrar',
                    blockType: B.HAT,
                    isEdgeActivated: false,
                    text: 'quando entrar no estado [ESTADO]',
                    arguments: {ESTADO: {type: A.STRING, menu: 'estados'}}
                },
                {
                    opcode: 'ligar',
                    blockType: B.COMMAND,
                    text: '[LIGA] controlador de animação',
                    arguments: {LIGA: {type: A.STRING, menu: 'ligaDesliga', defaultValue: 'ligar'}}
                }
            ],
            menus: {
                animacoes: {acceptReporters: true, items: 'menuAnimacoes'},
                modos: {acceptReporters: false, items: [{text: 'uma vez', value: 'uma'}, {text: 'em loop', value: 'loop'}]},
                parametros: {acceptReporters: true, items: 'menuParametros'},
                estados: {acceptReporters: false, items: 'menuEstados'},
                estadosReporter: {acceptReporters: true, items: 'menuEstados'},
                ligaDesliga: {acceptReporters: false, items: [{text: 'ligar', value: 'ligar'},
                    {text: 'desligar', value: 'desligar'}]}
            }
        };
    }

    menuAnimacoes (idAlvo) {
        const alvo = (idAlvo && this.runtime.getTargetById(idAlvo)) || this.runtime.getEditingTarget();
        if (!alvo || alvo.isStage) return [{text: '(escolha um ator)', value: ''}];
        const nomes = Array.from(animacoesDoAtor(alvo).entries()).filter(([, q]) => q.length > 1).map(([n]) => n);
        if (!nomes.length) return [{text: '(importe uma spritesheet)', value: ''}];
        return nomes;
    }

    _alvoMenu (idAlvo) {
        const alvo = (idAlvo && this.runtime.getTargetById(idAlvo)) || this.runtime.getEditingTarget();
        return alvo && !alvo.isStage ? alvo : null;
    }

    menuParametros (idAlvo) {
        const alvo = this._alvoMenu(idAlvo);
        const c = alvo && obterControlador(alvo.getName());
        if (!c || !c.parametros.length) return [{text: '(crie no controlador)', value: ''}];
        return c.parametros.map(p => p.nome);
    }

    menuEstados (idAlvo) {
        const alvo = this._alvoMenu(idAlvo);
        const c = alvo && obterControlador(alvo.getName());
        if (!c || !c.estados.length) return [{text: '(crie no controlador)', value: ''}];
        return c.estados.map(e => e.nome);
    }

    _comecar (alvo, nome, qps, loop) {
        const quadros = animacoesDoAtor(alvo).get(String(nome).trim());
        if (!quadros || !quadros.length) return null;
        const t = {nome: String(nome).trim(), quadros, inicio: performance.now(), qps: Math.max(0.1, Math.min(120, qps)),
            loop, ultimo: -1, fim: false};
        alvo.setCostume(quadros[0]);
        t.ultimo = 0;
        this.tocando.set(alvo.id, t);
        return t;
    }

    tocar (args, util) {
        if (util.target.isStage) return;
        this._comecar(util.target, args.ANIM, num(args.QPS, 24), args.MODO === 'loop');
    }

    tocarEsperar (args, util) {
        if (util.target.isStage) return;
        if (!util.stackFrame.anim) {
            const t = this._comecar(util.target, args.ANIM, num(args.QPS, 24), false);
            if (!t) return;
            util.stackFrame.anim = t;
        }
        // espera enquanto essa mesma animação estiver tocando (outra animação ou "parar" liberam o bloco)
        if (this.tocando.get(util.target.id) === util.stackFrame.anim) util.yield();
    }

    parar (args, util) {
        this.tocando.delete(util.target.id);
    }

    atual (args, util) {
        const t = this.tocando.get(util.target.id);
        return t ? t.nome : '';
    }

    estaTocando (args, util) {
        return this.tocando.has(util.target.id);
    }

    quadro (args, util) {
        const t = this.tocando.get(util.target.id);
        return t ? t.ultimo + 1 : 0;
    }

    quantidade (args, util) {
        if (util.target.isStage) return 0;
        const q = animacoesDoAtor(util.target).get(String(args.ANIM).trim());
        return q ? q.length : 0;
    }

    // ---------------------------------------------------------------- blocos do controlador

    _tipoParametro (alvo, nome) {
        const c = obterControlador(alvo.getName());
        const p = c && c.parametros.find(x => x.nome === String(nome));
        return p ? p.tipo : null;
    }

    definirParametro (args, util) {
        if (util.target.isStage) return;
        const r = this._maquina(util.target);
        if (!r) return;
        const tipo = this._tipoParametro(util.target, args.P);
        if (!tipo) return;
        const v = args.V;
        if (tipo === 'booleano') {
            const t = String(v).toLowerCase().trim();
            r.mq.valores.set(String(args.P), !(t === '' || t === '0' || t === 'false' || t === 'falso' || t === 'não' ||
                t === 'nao'));
        } else if (tipo === 'gatilho') {
            r.mq.gatilhos.add(String(args.P));
        } else {
            r.mq.valores.set(String(args.P), num(v, 0));
        }
    }

    mudarParametro (args, util) {
        if (util.target.isStage) return;
        const r = this._maquina(util.target);
        if (!r || this._tipoParametro(util.target, args.P) !== 'numero') return;
        r.mq.valores.set(String(args.P), num(r.mq.valores.get(String(args.P)), 0) + num(args.V, 0));
    }

    disparar (args, util) {
        if (util.target.isStage) return;
        const r = this._maquina(util.target);
        if (r && this._tipoParametro(util.target, args.P)) r.mq.gatilhos.add(String(args.P));
    }

    parametro (args, util) {
        if (util.target.isStage) return '';
        const r = this._maquina(util.target);
        if (!r) return '';
        const tipo = this._tipoParametro(util.target, args.P);
        if (tipo === 'gatilho') return r.mq.gatilhos.has(String(args.P));
        const v = r.mq.valores.get(String(args.P));
        return v === undefined ? '' : v;
    }

    estado (args, util) {
        if (util.target.isStage) return '';
        const r = this._maquina(util.target, false);
        if (!r) return '';
        const e = r.c.estados.find(x => x.id === r.mq.estado);
        return e ? e.nome : '';
    }

    irPara (args, util) {
        if (util.target.isStage) return;
        const r = this._maquina(util.target);
        if (!r) return;
        const e = r.c.estados.find(x => x.nome === String(args.ESTADO));
        if (e) this._entrar(util.target, r.c, r.mq, e);
    }

    quandoEntrar () {
        return true;
    }

    ligar (args, util) {
        if (util.target.isStage) return;
        const r = this._maquina(util.target);
        if (!r) return;
        r.mq.ligado = args.LIGA !== 'desligar';
        if (!r.mq.ligado) this.tocando.delete(util.target.id);
        else r.mq.estado = null; // volta para o estado inicial
    }
}

export {AdventiscratchAnimacoes};