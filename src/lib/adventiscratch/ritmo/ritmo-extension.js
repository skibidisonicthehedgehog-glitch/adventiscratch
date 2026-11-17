/**
 * Extensão "Jogo de Ritmo": toca os mapas feitos no Editor de mapas de ritmo (setas estilo FNF ou círculos
 * estilo osu!) por cima do palco, com pontos, combo, precisão, vida e eventos para animar os personagens.
 */
import {MotorRitmo} from './motor.js';
import {nomesMapas, obterMapa, aoMudarMapas, PISTAS, ITENS, itensPersonalizados, todosMapas} from './dados.js';

const A = {NUMBER: 'number', STRING: 'string'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat', BUTTON: 'button'};
export const ID_RITMO = 'adventiscratchritmo';
export const EDITOR_MAPAS_CALLBACK = 'ADVENTISCRATCH_EDITOR_MAPAS';

const icone = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
<circle cx="20" cy="20" r="19" fill="#fff"/>
<path d="M8 13 l5 -5 v3 h5 v4 h-5 v3z" fill="#C24BCF"/><path d="M27 8 l5 5 l-3 0 v5 h-4 v-5 h-3z" fill="#12C805"/>
<circle cx="14" cy="27" r="6" fill="#00C4E8" stroke="#1B1338" stroke-width="1.5"/><circle cx="14" cy="27" r="9" fill="none" stroke="#00C4E8" stroke-width="1.5"/>
<path d="M32 25 l-5 5 v-3 h-5 v-4 h5 v-3z" fill="#F9393F"/>
</svg>`);

const PISTA_MENU = [{text: 'qualquer seta', value: 'qualquer'}, {text: '← esquerda', value: 'esquerda'},
    {text: '↓ baixo', value: 'baixo'}, {text: '↑ cima', value: 'cima'}, {text: '→ direita', value: 'direita'}];

const num = (v, p) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : p;
};

class AdventiscratchRitmo {
    constructor (runtime) {
        this.runtime = runtime;
        this.motor = new MotorRitmo(runtime);
        runtime.adventiscratchRitmo = this; // acesso pelo console (F12)
        runtime.on('PROJECT_STOP_ALL', () => this.motor.parar());
        runtime.on('PROJECT_LOADED', () => {
            this.motor.parar();
            this.motor.pele = null;
        });
        const passoOriginal = runtime._step.bind(runtime);
        runtime._step = () => {
            try {
                this.despacharEventos();
            } catch (e) {
                console.warn('Adventiscratch: erro no jogo de ritmo', e); // eslint-disable-line no-console
            }
            passoOriginal();
        };
    }

    despacharEventos () {
        const lista = this.motor.eventos;
        if (!lista.length) return;
        this.motor.eventos = [];
        const hat = (op, campos) => this.runtime.startHats(`${ID_RITMO}_${op}`, campos);
        for (const e of lista) {
            const pista = e.pista === null || e.pista === undefined ? null : PISTAS[e.pista];
            if (e.tipo === 'acertou' || e.tipo === 'errou' || e.tipo === 'oponente') {
                const op = {acertou: 'quandoAcertar', errou: 'quandoErrar', oponente: 'quandoOponente'}[e.tipo];
                hat(op, {PISTA: 'qualquer'});
                if (pista) hat(op, {PISTA: pista});
            } else if (e.tipo === 'item' || e.tipo === 'itemPassou') {
                const op = e.tipo === 'item' ? 'quandoPegarItem' : 'quandoItemPassar';
                hat(op, {ITEM: 'qualquer'});
                hat(op, {ITEM: e.item});
            } else if (e.tipo === 'terminou') {
                hat('quandoTerminar', {});
            } else if (e.tipo === 'perdeu') {
                hat('quandoPerder', {});
            }
        }
    }

    getInfo () {
        return {
            id: ID_RITMO,
            name: 'Jogo de Ritmo',
            color1: '#E0457B',
            color2: '#C63768',
            color3: '#A82B56',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {func: EDITOR_MAPAS_CALLBACK, blockType: B.BUTTON, text: '🎯 Editor de mapas de ritmo…'},
                {
                    opcode: 'comecar', blockType: B.COMMAND, text: 'começar mapa [MAPA]',
                    arguments: {MAPA: {type: A.STRING, menu: 'mapas'}}
                },
                {
                    opcode: 'comecarEsperar', blockType: B.COMMAND, text: 'começar mapa [MAPA] e esperar terminar',
                    arguments: {MAPA: {type: A.STRING, menu: 'mapas'}}
                },
                {opcode: 'pausar', blockType: B.COMMAND, text: 'pausar mapa'},
                {opcode: 'continuar', blockType: B.COMMAND, text: 'continuar mapa'},
                {opcode: 'parar', blockType: B.COMMAND, text: 'parar mapa'},
                '---',
                {
                    opcode: 'quandoAcertar', blockType: B.HAT, isEdgeActivated: false, text: 'quando acertar [PISTA]',
                    arguments: {PISTA: {type: A.STRING, menu: 'pistas', defaultValue: 'qualquer'}}
                },
                {
                    opcode: 'quandoErrar', blockType: B.HAT, isEdgeActivated: false, text: 'quando errar [PISTA]',
                    arguments: {PISTA: {type: A.STRING, menu: 'pistas', defaultValue: 'qualquer'}}
                },
                {
                    opcode: 'quandoOponente', blockType: B.HAT, isEdgeActivated: false, text: 'quando o oponente cantar [PISTA]',
                    arguments: {PISTA: {type: A.STRING, menu: 'pistas', defaultValue: 'qualquer'}}
                },
                {
                    opcode: 'quandoPegarItem', blockType: B.HAT, isEdgeActivated: false, text: 'quando pegar item [ITEM]',
                    arguments: {ITEM: {type: A.STRING, menu: 'itens', defaultValue: 'qualquer'}}
                },
                {
                    opcode: 'quandoItemPassar', blockType: B.HAT, isEdgeActivated: false,
                    text: 'quando deixar passar item [ITEM]',
                    arguments: {ITEM: {type: A.STRING, menu: 'itens', defaultValue: 'qualquer'}}
                },
                {opcode: 'quandoTerminar', blockType: B.HAT, isEdgeActivated: false, text: 'quando o mapa terminar'},
                {opcode: 'quandoPerder', blockType: B.HAT, isEdgeActivated: false, text: 'quando a vida acabar'},
                '---',
                {opcode: 'pontos', blockType: B.REPORTER, text: 'pontos'},
                {opcode: 'combo', blockType: B.REPORTER, text: 'combo'},
                {opcode: 'maiorCombo', blockType: B.REPORTER, text: 'maior combo'},
                {opcode: 'precisao', blockType: B.REPORTER, text: 'precisão (%)'},
                {opcode: 'vida', blockType: B.REPORTER, text: 'vida (%)'},
                {
                    opcode: 'contagem', blockType: B.REPORTER, text: 'quantidade de [TIPO]',
                    arguments: {TIPO: {type: A.STRING, menu: 'avaliacoes', defaultValue: 'perfeito'}}
                },
                {opcode: 'ultima', blockType: B.REPORTER, text: 'última avaliação'},
                {opcode: 'ultimaPista', blockType: B.REPORTER, text: 'última seta'},
                {opcode: 'ultimoItem', blockType: B.REPORTER, text: 'último item'},
                {opcode: 'tempo', blockType: B.REPORTER, text: 'tempo do mapa (s)'},
                {opcode: 'tocando', blockType: B.BOOLEAN, text: 'mapa tocando?'},
                {
                    opcode: 'apertada', blockType: B.BOOLEAN, text: 'seta [PISTA] apertada?',
                    arguments: {PISTA: {type: A.STRING, menu: 'pistasSo', defaultValue: 'esquerda'}}
                },
                '---',
                {
                    opcode: 'pele', blockType: B.COMMAND, text: 'usar as fantasias do ator [ATOR] nas setas e círculos',
                    arguments: {ATOR: {type: A.STRING, menu: 'atores'}}
                },
                {opcode: 'pelePadrao', blockType: B.COMMAND, text: 'usar setas e círculos padrão'},
                {
                    opcode: 'lado', blockType: B.COMMAND, text: 'jogador do lado [LADO]',
                    arguments: {LADO: {type: A.STRING, menu: 'lados', defaultValue: 'direita'}}
                },
                {
                    opcode: 'mostrarOponente', blockType: B.COMMAND, text: 'mostrar setas do oponente: [SIM]',
                    arguments: {SIM: {type: A.STRING, menu: 'simNao', defaultValue: 'sim'}}
                },
                {
                    opcode: 'rolagem', blockType: B.COMMAND, text: 'notas vão para [DIR]',
                    arguments: {DIR: {type: A.STRING, menu: 'rolagens', defaultValue: 'cima'}}
                },
                {
                    opcode: 'velocidade', blockType: B.COMMAND, text: 'velocidade das notas [V]',
                    arguments: {V: {type: A.NUMBER, defaultValue: 1}}
                },
                {
                    opcode: 'teclas', blockType: B.COMMAND, text: 'jogar com [TECLAS]',
                    arguments: {TECLAS: {type: A.STRING, menu: 'teclas', defaultValue: 'setas-dfjk'}}
                },
                {
                    opcode: 'posicao', blockType: B.COMMAND, text: 'setas do [QUEM] em x: [X] y: [Y]',
                    arguments: {
                        QUEM: {type: A.STRING, menu: 'quem', defaultValue: 'eu'},
                        X: {type: A.NUMBER, defaultValue: 120},
                        Y: {type: A.NUMBER, defaultValue: 135}
                    }
                },
                {
                    opcode: 'tamanho', blockType: B.COMMAND, text: 'tamanho das setas e círculos [T]',
                    arguments: {T: {type: A.NUMBER, defaultValue: 42}}
                },
                {
                    opcode: 'placar', blockType: B.COMMAND, text: 'mostrar placar e vida: [SIM]',
                    arguments: {SIM: {type: A.STRING, menu: 'simNao', defaultValue: 'sim'}}
                },
                {
                    opcode: 'perder', blockType: B.COMMAND, text: 'pode perder quando a vida acaba: [SIM]',
                    arguments: {SIM: {type: A.STRING, menu: 'simNao', defaultValue: 'sim'}}
                }
            ],
            menus: {
                mapas: {acceptReporters: true, items: 'menuMapas'},
                atores: {acceptReporters: true, items: 'menuAtores'},
                pistas: {acceptReporters: false, items: PISTA_MENU},
                pistasSo: {acceptReporters: false, items: PISTA_MENU.slice(1)},
                avaliacoes: {acceptReporters: false, items: [{text: 'perfeitos', value: 'perfeito'},
                    {text: 'bons', value: 'bom'}, {text: 'oks', value: 'ok'}, {text: 'erros', value: 'errou'},
                    {text: 'itens pegos', value: 'itens'}, {text: 'perigos apertados', value: 'perigo'}]},
                itens: {acceptReporters: false, items: 'menuItens'},
                lados: {acceptReporters: false, items: ['direita', 'esquerda']},
                simNao: {acceptReporters: false, items: [{text: 'sim', value: 'sim'}, {text: 'não', value: 'nao'}]},
                rolagens: {acceptReporters: false, items: [{text: 'cima (padrão)', value: 'cima'},
                    {text: 'baixo (downscroll)', value: 'baixo'}]},
                teclas: {acceptReporters: false, items: [{text: 'setas e D F J K', value: 'setas-dfjk'},
                    {text: 'setas e A S W D', value: 'setas-wasd'}, {text: 'só as setas', value: 'setas'}]},
                quem: {acceptReporters: false, items: [{text: 'jogador', value: 'eu'}, {text: 'oponente', value: 'op'}]}
            }
        };
    }

    menuMapas () {
        const n = nomesMapas();
        return n.length ? n : [{text: '(crie um mapa)', value: ''}];
    }

    menuItens () {
        return [{text: 'qualquer item', value: 'qualquer'}]
            .concat(Object.keys(ITENS).map(k => ({text: `${ITENS[k].icone} ${ITENS[k].nome.toLowerCase()}`, value: k})))
            .concat(itensPersonalizados(todosMapas()).map(n => ({text: `🏷 ${n}`, value: n})));
    }

    menuAtores () {
        const nomes = this.runtime.targets.filter(t => t.isOriginal && !t.isStage).map(t => t.getName());
        return nomes.length ? nomes : [{text: '(nenhum ator)', value: ''}];
    }

    comecar (args) {
        const m = obterMapa(args.MAPA);
        if (m) this.motor.comecar(m);
    }

    comecarEsperar (args, util) {
        if (!util.stackFrame.comecou) {
            const m = obterMapa(args.MAPA);
            if (!m) return;
            this.motor.comecar(m);
            util.stackFrame.comecou = true;
            util.stackFrame.mapa = this.motor.mapa;
        }
        const e = this.motor.estado;
        if (this.motor.mapa === util.stackFrame.mapa && (e === 'tocando' || e === 'pausado')) util.yield();
    }

    pausar () {
        this.motor.pausar();
    }

    continuar () {
        this.motor.continuar();
    }

    parar () {
        this.motor.parar();
    }

    quandoAcertar () {
        return true;
    }

    quandoErrar () {
        return true;
    }

    quandoOponente () {
        return true;
    }

    quandoPegarItem () {
        return true;
    }

    quandoItemPassar () {
        return true;
    }

    quandoTerminar () {
        return true;
    }

    quandoPerder () {
        return true;
    }

    pontos () {
        return this.motor.pontos;
    }

    combo () {
        return this.motor.combo;
    }

    maiorCombo () {
        return this.motor.maiorCombo;
    }

    precisao () {
        return this.motor.precisao();
    }

    vida () {
        return Math.round(this.motor.vida * 100);
    }

    contagem (args) {
        return this.motor.contagem[args.TIPO] || 0;
    }

    ultima () {
        return this.motor.ultimaAvaliacao;
    }

    ultimaPista () {
        return this.motor.ultimaPista;
    }

    ultimoItem () {
        return this.motor.ultimoItem;
    }

    tempo () {
        const e = this.motor.estado;
        return e === 'tocando' || e === 'pausado' ? Math.round(this.motor.tempo()) / 1000 : 0;
    }

    tocando () {
        return this.motor.estado === 'tocando';
    }

    apertada (args) {
        return this.motor.apertadas[PISTAS.indexOf(args.PISTA)] === true;
    }

    pele (args, util) {
        if (!util.stackFrame.promessa) {
            const alvo = this.runtime.getSpriteTargetByName(String(args.ATOR));
            if (!alvo) return;
            util.stackFrame.pronto = false;
            util.stackFrame.promessa = this.motor.usarPele(alvo).then(() => {
                util.stackFrame.pronto = true;
            });
        }
        if (!util.stackFrame.pronto) util.yield();
    }

    pelePadrao () {
        this.motor.pele = null;
    }

    lado (args) {
        this.motor.config.lado = args.LADO === 'esquerda' ? 'esquerda' : 'direita';
        this.motor.config.xJogador = null;
        this.motor.config.xOponente = null;
    }

    mostrarOponente (args) {
        this.motor.config.mostrarOponente = args.SIM !== 'nao';
    }

    rolagem (args) {
        this.motor.config.rolagem = args.DIR === 'baixo' ? 'baixo' : 'cima';
        this.motor.config.yJogador = null;
        this.motor.config.yOponente = null;
    }

    velocidade (args) {
        this.motor.config.velocidade = Math.max(0.2, Math.min(5, num(args.V, 1)));
    }

    teclas (args) {
        this.motor.config.teclas = args.TECLAS;
        this.motor.apertadas = [false, false, false, false];
    }

    posicao (args) {
        const c = this.motor.config;
        const x = Math.max(-240, Math.min(240, num(args.X, 0)));
        const y = Math.max(-180, Math.min(180, num(args.Y, 0)));
        if (args.QUEM === 'op') {
            c.xOponente = x;
            c.yOponente = y;
        } else {
            c.xJogador = x;
            c.yJogador = y;
        }
    }

    tamanho (args) {
        const t = Math.max(10, Math.min(120, num(args.T, 42)));
        this.motor.config.tamanho = t;
        this.motor.config.tamanhoCirculo = Math.round(t * 0.8);
    }

    placar (args) {
        this.motor.config.placar = args.SIM !== 'nao';
    }

    perder (args) {
        this.motor.config.permitirPerder = args.SIM !== 'nao';
    }
}

export const ligarRitmoNaVm = vm => {
    aoMudarMapas(() => {
        if (vm.extensionManager.isExtensionLoaded(ID_RITMO)) vm.extensionManager.refreshBlocks();
        vm.emit('PROJECT_CHANGED');
    });
};

export {AdventiscratchRitmo};
