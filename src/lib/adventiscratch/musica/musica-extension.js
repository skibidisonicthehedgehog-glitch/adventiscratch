/**
 * Extensão "Músicas": toca no jogo as músicas feitas no Criador de Músicas.
 * Uma música de fundo por vez (tocar outra troca a atual), com pausar, continuar, parar, repetir,
 * volume, velocidade e eventos por batida.
 */
import icone from './icone-musica.svg';
import {nomesMusicas, obterMusica, aoMudarMusicas, totalPassos, PASSOS_POR_BATIDA} from './dados.js';
import {Tocador, INSTRUMENTOS, tocarNota} from './sintetizador.js';
import {instrumentosExtras, aoMudarInstrumentosExtras} from './soundfont-store.js';

const A = {NUMBER: 'number', STRING: 'string'};
const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat', BUTTON: 'button'};
export const ID_MUSICA = 'adventiscratchmusica';
export const CRIADOR_CALLBACK = 'ADVENTISCRATCH_CRIADOR_MUSICAS';

const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

class AdventiscratchMusicas {
    constructor (runtime) {
        this.runtime = runtime;
        runtime.adventiscratchMusicas = this; // acesso pelo console (F12)
        const audio = () => runtime.audioEngine;
        this.tocador = new Tocador(() => audio().audioContext, () => audio().inputNode);
        this.batidaAnterior = 0;
        this.terminouPendente = false;
        this.tocador.aoTerminar = () => {
            this.terminouPendente = true;
        };
        this.esperando = null;

        runtime.on('PROJECT_STOP_ALL', () => this.tocador.parar());
        runtime.on('PROJECT_LOADED', () => {
            this.tocador.parar();
            this.tocador.musica = null;
        });

        // eventos "a cada batida" e "quando a música terminar", conferidos a cada quadro do Scratch
        const passoOriginal = runtime._step.bind(runtime);
        runtime._step = () => {
            try {
                this.conferirEventos();
            } catch (e) {
                console.warn('Adventiscratch: erro na música', e); // eslint-disable-line no-console
            }
            passoOriginal();
        };
    }

    conferirEventos () {
        const t = this.tocador;
        if (t.estado === 'tocando') {
            const b = t.batidaAtual();
            if (b !== this.batidaAnterior) {
                this.batidaAnterior = b;
                this.runtime.startHats(`${ID_MUSICA}_aCadaBatida`);
            }
        } else if (t.estado === 'parada') {
            this.batidaAnterior = 0;
        }
        if (this.terminouPendente) {
            this.terminouPendente = false;
            this.runtime.startHats(`${ID_MUSICA}_quandoTerminar`);
        }
    }

    getInfo () {
        return {
            id: ID_MUSICA,
            name: 'Músicas',
            color1: '#C24BCF',
            color2: '#A93BB6',
            color3: '#8E2E9A',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {func: CRIADOR_CALLBACK, blockType: B.BUTTON, text: '🎼 Criador de Músicas…'},
                {
                    opcode: 'tocar',
                    blockType: B.COMMAND,
                    text: 'tocar música [MUSICA]',
                    arguments: {MUSICA: {type: A.STRING, menu: 'musicas'}}
                },
                {
                    opcode: 'tocarEsperar',
                    blockType: B.COMMAND,
                    text: 'tocar música [MUSICA] até o fim',
                    arguments: {MUSICA: {type: A.STRING, menu: 'musicas'}}
                },
                {opcode: 'pausar', blockType: B.COMMAND, text: 'pausar música'},
                {opcode: 'continuar', blockType: B.COMMAND, text: 'continuar música'},
                {opcode: 'parar', blockType: B.COMMAND, text: 'parar música'},
                '---',
                {
                    opcode: 'repetir',
                    blockType: B.COMMAND,
                    text: 'repetir música: [LIGA]',
                    arguments: {LIGA: {type: A.STRING, menu: 'ligaDesliga', defaultValue: 'sim'}}
                },
                {
                    opcode: 'volume',
                    blockType: B.COMMAND,
                    text: 'definir volume da música para [V] %',
                    arguments: {V: {type: A.NUMBER, defaultValue: 100}}
                },
                {
                    opcode: 'velocidade',
                    blockType: B.COMMAND,
                    text: 'definir velocidade da música para [V] %',
                    arguments: {V: {type: A.NUMBER, defaultValue: 100}}
                },
                {
                    opcode: 'irPara',
                    blockType: B.COMMAND,
                    text: 'pular para a batida [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 1}}
                },
                '---',
                {
                    opcode: 'esta',
                    blockType: B.BOOLEAN,
                    text: 'música está [ESTADO]?',
                    arguments: {ESTADO: {type: A.STRING, menu: 'estados', defaultValue: 'tocando'}}
                },
                {opcode: 'batida', blockType: B.REPORTER, text: 'batida da música'},
                {opcode: 'nomeTocando', blockType: B.REPORTER, text: 'nome da música'},
                {
                    opcode: 'quandoBatida',
                    blockType: B.HAT,
                    isEdgeActivated: true,
                    text: 'quando a música chegar na batida [N]',
                    arguments: {N: {type: A.NUMBER, defaultValue: 5}}
                },
                {opcode: 'aCadaBatida', blockType: B.HAT, isEdgeActivated: false, text: 'a cada batida da música'},
                {opcode: 'quandoTerminar', blockType: B.HAT, isEdgeActivated: false, text: 'quando a música terminar'},
                '---',
                {
                    opcode: 'nota',
                    blockType: B.COMMAND,
                    text: 'tocar nota [NOTA] com [INST] por [BAT] batidas',
                    arguments: {
                        NOTA: {type: A.NUMBER, defaultValue: 60},
                        INST: {type: A.STRING, menu: 'instrumentos', defaultValue: 'piano'},
                        BAT: {type: A.NUMBER, defaultValue: 0.5}
                    }
                }
            ],
            menus: {
                musicas: {acceptReporters: true, items: 'menuMusicas'},
                instrumentos: {acceptReporters: false, items: 'menuInstrumentos'},
                ligaDesliga: {acceptReporters: false, items: [{text: 'sim', value: 'sim'}, {text: 'não', value: 'nao'}]},
                estados: {
                    acceptReporters: false,
                    items: [{text: 'tocando', value: 'tocando'}, {text: 'pausada', value: 'pausada'},
                        {text: 'parada', value: 'parada'}]
                }
            }
        };
    }

    menuMusicas () {
        const nomes = nomesMusicas();
        if (!nomes.length) return [{text: '(crie uma música)', value: ''}];
        return nomes;
    }

    menuInstrumentos () {
        return [
            ...INSTRUMENTOS.map(i => ({text: i.nome.replace(/^\S+\s/, ''), value: i.id})),
            ...instrumentosExtras().map(i => ({text: `${i.nome} (.sf2)`, value: i.id}))
        ];
    }

    _musica (nome) {
        const m = obterMusica(nome);
        if (!m) return null;
        return m;
    }

    tocar (args) {
        const m = this._musica(args.MUSICA);
        if (!m) return;
        this.batidaAnterior = 0;
        this.tocador.tocar(m, 0);
    }

    tocarEsperar (args, util) {
        if (!util.stackFrame.comecou) {
            const m = this._musica(args.MUSICA);
            if (!m) return;
            util.stackFrame.comecou = true;
            util.stackFrame.musica = m;
            this.batidaAnterior = 0;
            this.tocador.tocar(m, 0);
        }
        // espera enquanto ESSA música estiver tocando ou pausada (se pararem ou trocarem, o bloco segue)
        if (this.tocador.musica === util.stackFrame.musica && this.tocador.estado !== 'parada') util.yield();
    }

    pausar () {
        this.tocador.pausar();
    }

    continuar () {
        this.tocador.continuar();
    }

    parar () {
        this.tocador.parar();
    }

    repetir (args) {
        this.tocador.repetir = args.LIGA === 'sim';
    }

    volume (args) {
        this.tocador.definirVolume(num(args.V) / 100);
    }

    velocidade (args) {
        this.tocador.definirVelocidade(num(args.V) / 100);
    }

    irPara (args) {
        if (!this.tocador.musica) return;
        const total = totalPassos(this.tocador.musica);
        this.tocador.irPara(Math.max(0, Math.min(total - 1, (Math.round(num(args.N)) - 1) * PASSOS_POR_BATIDA)));
    }

    esta (args) {
        return this.tocador.estado === args.ESTADO;
    }

    batida () {
        return this.tocador.estado === 'parada' ? 0 : this.tocador.batidaAtual();
    }

    nomeTocando () {
        return this.tocador.musica && this.tocador.estado !== 'parada' ? this.tocador.musica.nome : '';
    }

    quandoBatida (args) {
        return this.tocador.estado === 'tocando' && this.tocador.batidaAtual() === Math.round(num(args.N));
    }

    aCadaBatida () {
        return true;
    }

    quandoTerminar () {
        return true;
    }

    nota (args, util) {
        if (!util.stackFrame.fim) {
            const audio = this.runtime.audioEngine;
            const ctx = audio && audio.audioContext;
            if (!ctx) return;
            const bpm = (this.tocador.musica && this.tocador.musica.bpm) || 120;
            const dur = Math.max(0.05, Math.min(10, num(args.BAT) * 60 / bpm));
            tocarNota(ctx, audio.inputNode, String(args.INST), Math.max(0, Math.min(127, num(args.NOTA))),
                ctx.currentTime + 0.01, dur, 0.8);
            util.stackFrame.fim = Date.now() + (dur * 1000);
        }
        if (Date.now() < util.stackFrame.fim) util.yield();
    }
}

/**
 * Atualiza os menus quando músicas ou instrumentos mudam e marca o projeto como alterado.
 * @param {VirtualMachine} vm VM
 */
export const ligarMusicasNaVm = vm => {
    const atualizar = () => {
        if (vm.extensionManager.isExtensionLoaded(ID_MUSICA)) vm.extensionManager.refreshBlocks();
        vm.emit('PROJECT_CHANGED');
    };
    aoMudarMusicas(atualizar);
    aoMudarInstrumentosExtras(atualizar);
};

export {AdventiscratchMusicas};
