/**
 * Extensão secreta "GameMaker (data.win)": abre o data.win de um jogo feito no GameMaker e roda
 * dentro do palco. Desbloqueada digitando a palavra secreta (ver segredo.js).
 *
 * Os arquivos do jogo não são salvos no projeto: cada um abre o data.win que tem no computador.
 */
import icone from './icone-datawin.svg';
import {lerDataWin} from './leitor.js';
import {MotorGM} from './motor.js';
import {Struct} from './vm.js';

const B = {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat', BUTTON: 'button'};
const A = {STRING: 'string', NUMBER: 'number'};
export const ID_DATAWIN = 'adventiscratchdatawin';
export const ABRIR_CALLBACK = 'ADVENTISCRATCH_ABRIR_DATAWIN';
export const ABRIR_PASTA_CALLBACK = 'ADVENTISCRATCH_ABRIR_PASTA_DATAWIN';

const ehCampoDeTexto = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

class AdventiscratchDataWin {
    constructor (runtime) {
        this.runtime = runtime;
        runtime.adventiscratchDataWin = this;
        this.motor = null;
        this.nome = '';
        this.status = 'nenhum jogo aberto';
        this.skin = -1;
        this.drawable = -1;
        this.visivel = true;
        this.pausado = false;
        this.raf = 0;
        this.acumulado = 0;
        this.ultimo = 0;
        this.mudouSala = false;

        this.teclaDown = e => {
            if (!this.motor || !this.motor.rodando || this.pausado || ehCampoDeTexto(e.target)) return;
            this.motor.teclaDown(e.keyCode);
            if (e.key && e.key.length === 1) this.motor.keyboard_string = (this.motor.keyboard_string + e.key).slice(-1024);
            if (e.keyCode === 8) this.motor.keyboard_string = this.motor.keyboard_string.slice(0, -1);
            if ([32, 37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
        };
        this.teclaUp = e => {
            if (this.motor) this.motor.teclaUp(e.keyCode);
        };
        window.addEventListener('keydown', this.teclaDown, true);
        window.addEventListener('keyup', this.teclaUp, true);
        window.addEventListener('blur', () => {
            if (this.motor) Array.from(this.motor.teclas).forEach(k => this.motor.teclaUp(k));
        });

        runtime.on('PROJECT_STOP_ALL', () => this.parar());
        const passoOriginal = runtime._step.bind(runtime);
        runtime._step = () => {
            if (this.mudouSala) {
                this.mudouSala = false;
                runtime.startHats(`${ID_DATAWIN}_quandoMudarSala`);
            }
            passoOriginal();
        };
    }

    getInfo () {
        return {
            id: ID_DATAWIN,
            name: 'GameMaker (data.win)',
            color1: '#3B3B4F',
            color2: '#2E2E3E',
            color3: '#1E1E2A',
            menuIconURI: icone,
            blockIconURI: icone,
            blocks: [
                {func: ABRIR_PASTA_CALLBACK, blockType: B.BUTTON, text: '📁 Abrir pasta do jogo…'},
                {func: ABRIR_CALLBACK, blockType: B.BUTTON, text: '📂 Abrir data.win…'},
                {opcode: 'iniciar', blockType: B.COMMAND, text: 'iniciar o jogo'},
                {opcode: 'pararJogo', blockType: B.COMMAND, text: 'parar o jogo'},
                {opcode: 'pausar', blockType: B.COMMAND, text: 'pausar o jogo'},
                {opcode: 'continuar', blockType: B.COMMAND, text: 'continuar o jogo'},
                {
                    opcode: 'mostrar',
                    blockType: B.COMMAND,
                    text: '[ACAO] o jogo no palco',
                    arguments: {ACAO: {type: A.STRING, menu: 'mostrar', defaultValue: 'mostrar'}}
                },
                '---',
                {opcode: 'rodando', blockType: B.BOOLEAN, text: 'jogo rodando?'},
                {opcode: 'nomeJogo', blockType: B.REPORTER, text: 'nome do jogo'},
                {opcode: 'salaAtual', blockType: B.REPORTER, text: 'sala atual do jogo'},
                {
                    opcode: 'irSala',
                    blockType: B.COMMAND,
                    text: 'ir para a sala [SALA] do jogo',
                    arguments: {SALA: {type: A.STRING, defaultValue: ''}}
                },
                {opcode: 'quandoMudarSala', blockType: B.HAT, isEdgeActivated: false, text: 'quando o jogo mudar de sala'},
                '---',
                {
                    opcode: 'lerGlobal',
                    blockType: B.REPORTER,
                    text: 'global [NOME] do jogo',
                    arguments: {NOME: {type: A.STRING, defaultValue: 'score'}}
                },
                {
                    opcode: 'definirGlobal',
                    blockType: B.COMMAND,
                    text: 'definir global [NOME] do jogo para [VALOR]',
                    arguments: {NOME: {type: A.STRING, defaultValue: 'score'}, VALOR: {type: A.STRING, defaultValue: '0'}}
                },
                {
                    opcode: 'tecla',
                    blockType: B.COMMAND,
                    text: '[ACAO] a tecla [TECLA] no jogo',
                    arguments: {
                        ACAO: {type: A.STRING, menu: 'apertar', defaultValue: 'apertar'},
                        TECLA: {type: A.STRING, menu: 'teclas', defaultValue: 'z'}
                    }
                },
                '---',
                {opcode: 'status', blockType: B.REPORTER, text: 'situação do jogo'},
                {opcode: 'faltando', blockType: B.REPORTER, text: 'funções do GML que faltam'},
                {opcode: 'ultimoErro', blockType: B.REPORTER, text: 'último erro do jogo'}
            ],
            menus: {
                mostrar: {acceptReporters: false, items: ['mostrar', 'esconder']},
                apertar: {acceptReporters: false, items: ['apertar', 'soltar']},
                teclas: {
                    acceptReporters: true,
                    items: ['z', 'x', 'c', 'enter', 'espaço', 'esc', 'shift', 'ctrl', 'seta para cima', 'seta para baixo',
                        'seta para esquerda', 'seta para direita']
                }
            }
        };
    }

    // ---------------------------------------------------------------- abrir
    /**
     * Abre o jogo a partir dos arquivos escolhidos (o data.win e, se tiver, músicas e audiogroupN.dat).
     * @param {File[]} arquivos arquivos
     * @returns {Promise<string>} mensagem para o usuário
     */
    async abrirArquivos (arquivos) {
        this.parar();
        const extras = new Map();
        let principal = null;
        // o data.win é lido agora; os outros (músicas, audiogroupN.dat) só quando o jogo pedir
        const ehForm = async f => {
            const cab = new Uint8Array(await f.slice(0, 4).arrayBuffer());
            return cab.length === 4 && String.fromCharCode(...cab) === 'FORM';
        };
        const candidatos = arquivos.slice().sort((a, b) => {
            const pa = /^(data\.win|game\.unx|game\.droid|game\.ios)$/i.test(a.name) ? 0 : 1;
            const pb = /^(data\.win|game\.unx|game\.droid|game\.ios)$/i.test(b.name) ? 0 : 1;
            return pa - pb;
        });
        for (const f of candidatos) {
            const nome = f.name.toLowerCase();
            if (!principal && !/^audiogroup\d+\.dat$/.test(nome) && /\.(win|unx|droid|ios|dat)$/.test(nome) &&
                await ehForm(f)) {
                principal = {nome: f.name, dados: await f.arrayBuffer()};
                continue;
            }
            const extra = {arquivo: f};
            extras.set(nome, extra);
            // também pelo caminho dentro da pasta (ex.: "mus/story.ogg")
            const rel = (f.webkitRelativePath || '').toLowerCase().split('/').slice(1).join('/');
            if (rel && rel !== nome) extras.set(rel, extra);
        }
        if (!principal) throw new Error('Não achei o data.win. Escolha a pasta do jogo ou o arquivo data.win.');
        this.status = 'lendo o data.win…';
        const dw = lerDataWin(principal.dados);
        const audio = this.runtime.audioEngine ? {
            ctx: this.runtime.audioEngine.audioContext, destino: this.runtime.audioEngine.inputNode
        } : null;
        this.motor = new MotorGM(dw, {extras, audio});
        this.motor.aoMudarSala = () => {
            this.mudouSala = true;
        };
        this.ligarAvisos();
        this.nome = dw.info.nomeExibido || dw.info.nome || principal.nome;
        this.status = 'carregando texturas…';
        await this.motor.carregarTexturas((i, n) => {
            this.status = `carregando texturas ${i}/${n}`;
        });
        this.status = 'pronto';
        return `${this.nome}: ${dw.salas.length} salas, ${dw.objetos.length} objetos, ${dw.sprites.length} sprites, ` +
            `${dw.codigos.length} scripts (bytecode ${dw.info.bytecode}).`;
    }

    // avisa uma vez quando o jogo pede uma música que não veio junto
    ligarAvisos () {
        let avisou = false;
        this.motor.aoErro = msg => {
            if (avisou || !/^música não encontrada/.test(msg)) return;
            avisou = true;
            window.dispatchEvent(new CustomEvent('adventiscratch-aviso', {detail: {
                texto: '🎵 Este jogo guarda as músicas fora do data.win. Para ouvir, use "📁 Abrir pasta do jogo…" ' +
                    'e escolha a pasta onde o data.win está.'
            }}));
        };
    }

    // ---------------------------------------------------------------- palco
    garantirDesenho () {
        const r = this.runtime.renderer;
        if (!r || this.skin >= 0) return;
        this.skin = r.createBitmapSkin(this.motor.canvas, 1);
        this.drawable = r.createDrawable('sprite');
        r.updateDrawableSkinId(this.drawable, this.skin);
    }

    atualizarDesenho () {
        const r = this.runtime.renderer;
        if (!r || !this.motor) return;
        this.garantirDesenho();
        const c = this.motor.canvas;
        r.updateBitmapSkin(this.skin, c, 1, [c.width / 2, c.height / 2]);
        const esc = Math.min(480 / c.width, 360 / c.height) * 100;
        r.updateDrawableProperties(this.drawable, {
            position: [0, 0], scale: [esc, esc], visible: this.visivel, direction: 90
        });
        r.setDrawableOrder(this.drawable, Infinity, 'sprite');
        this.runtime.requestRedraw();
    }

    removerDesenho () {
        const r = this.runtime.renderer;
        if (!r || this.skin < 0) return;
        r.destroyDrawable(this.drawable, 'sprite');
        r.destroySkin(this.skin);
        this.skin = -1;
        this.drawable = -1;
    }

    // mouse do palco → coordenadas do jogo
    atualizarMouse () {
        const mouse = this.runtime.ioDevices && this.runtime.ioDevices.mouse;
        const m = this.motor;
        if (!mouse || !m) return;
        const c = m.canvas;
        const s = Math.min(480 / c.width, 360 / c.height);
        const cx = (mouse.getScratchX() / s) + (c.width / 2);
        const cy = (-mouse.getScratchY() / s) + (c.height / 2);
        m.mouse.guiX = cx;
        m.mouse.guiY = cy;
        const V = m.vistas;
        if (m.view_enabled && V.visible[0]) {
            const cam = m.camera(0) || {x: 0, y: 0, w: V.wview[0], h: V.hview[0]};
            m.mouse.x = cam.x + ((cx - V.xport[0]) * cam.w / Math.max(1, V.wport[0]));
            m.mouse.y = cam.y + ((cy - V.yport[0]) * cam.h / Math.max(1, V.hport[0]));
        } else {
            m.mouse.x = cx;
            m.mouse.y = cy;
        }
        const baixo = mouse.getIsDown();
        if (baixo && !m.mouse.botoes.has(1)) m.mouse.apertados.add(1);
        if (!baixo && m.mouse.botoes.has(1)) m.mouse.soltos.add(1);
        if (baixo) m.mouse.botoes.add(1);
        else m.mouse.botoes.delete(1);
    }

    laco (agora) {
        this.raf = requestAnimationFrame(t => this.laco(t));
        const m = this.motor;
        if (!m || !m.rodando) return;
        if (m.terminou) {
            this.status = 'o jogo terminou';
            this.parar();
            return;
        }
        if (this.pausado) {
            this.ultimo = agora;
            return;
        }
        const passo = 1000 / Math.max(1, Math.min(240, m.room_speed));
        this.acumulado += Math.min(250, agora - (this.ultimo || agora));
        this.ultimo = agora;
        let rodou = false;
        let n = 0;
        while (this.acumulado >= passo && n < 4) {
            this.acumulado -= passo;
            n++;
            this.atualizarMouse();
            try {
                m.quadro();
            } catch (e) {
                m.erro(e.message);
            }
            rodou = true;
        }
        if (n >= 4) this.acumulado = 0;
        if (rodou) this.atualizarDesenho();
    }

    // ---------------------------------------------------------------- blocos
    iniciar () {
        if (!this.motor) {
            this.status = 'abra um data.win primeiro (botão "Abrir data.win…")';
            return;
        }
        this.parar();
        // recomeça do zero com o mesmo arquivo
        const {dw, extras} = {dw: this.motor.dw, extras: this.motor.extras};
        const audio = this.motor.audio;
        this.motor = new MotorGM(dw, {extras, audio});
        this.motor.aoMudarSala = () => {
            this.mudouSala = true;
        };
        this.ligarAvisos();
        this.pausado = false;
        this.status = 'rodando';
        try {
            this.motor.iniciar();
        } catch (e) {
            this.motor.erro(e.message);
        }
        this.ultimo = 0;
        this.acumulado = 0;
        this.atualizarDesenho();
        if (!this.raf) this.raf = requestAnimationFrame(t => this.laco(t));
    }

    parar () {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
        if (this.motor) this.motor.parar();
        this.removerDesenho();
        if (this.status === 'rodando') this.status = 'parado';
    }

    pararJogo () {
        this.parar();
    }

    pausar () {
        this.pausado = true;
    }

    continuar () {
        this.pausado = false;
    }

    mostrar (args) {
        this.visivel = args.ACAO !== 'esconder';
        if (this.drawable >= 0) {
            this.runtime.renderer.updateDrawableProperties(this.drawable, {visible: this.visivel});
            this.runtime.requestRedraw();
        }
    }

    rodando () {
        return Boolean(this.motor && this.motor.rodando && !this.motor.terminou);
    }

    nomeJogo () {
        return this.nome;
    }

    salaAtual () {
        const m = this.motor;
        return m && m.sala >= 0 ? m.dw.salas[m.sala].nome : '';
    }

    irSala (args) {
        const m = this.motor;
        if (!m) return;
        const v = String(args.SALA);
        let i = m.dw.salas.findIndex(s => s.nome === v);
        if (i < 0 && /^\d+$/.test(v)) i = Number(v);
        m.irPara(i);
    }

    quandoMudarSala () {
        return true;
    }

    lerGlobal (args) {
        const m = this.motor;
        if (!m) return '';
        const v = m.lerVar(m.global, String(args.NOME));
        if (v === undefined) return '';
        if (typeof v === 'number' || typeof v === 'string') return v;
        if (v instanceof Struct || Array.isArray(v)) return m.texto(v);
        return String(v);
    }

    definirGlobal (args) {
        const m = this.motor;
        if (!m) return;
        const n = Number(args.VALOR);
        m.escreverVar(m.global, String(args.NOME),
            String(args.VALOR).trim() !== '' && Number.isFinite(n) ? n : String(args.VALOR));
    }

    tecla (args) {
        const m = this.motor;
        if (!m) return;
        const nomes = {
            'enter': 13,
            'espaço': 32,
            'esc': 27,
            'shift': 16,
            'ctrl': 17,
            'seta para cima': 38,
            'seta para baixo': 40,
            'seta para esquerda': 37,
            'seta para direita': 39
        };
        const t = String(args.TECLA).toLowerCase();
        const codigo = nomes[t] || (t.length === 1 ? t.toUpperCase().charCodeAt(0) : Number(t) || 0);
        if (!codigo) return;
        if (args.ACAO === 'soltar') m.teclaUp(codigo);
        else m.teclaDown(codigo);
    }

    status () {
        return this.status;
    }

    faltando () {
        if (!this.motor) return '';
        return Array.from(this.motor.faltando.entries()).sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([n]) => n)
            .join(', ');
    }

    ultimoErro () {
        const e = this.motor && this.motor.erros;
        return e && e.length ? e[e.length - 1] : '';
    }
}

export {AdventiscratchDataWin};
