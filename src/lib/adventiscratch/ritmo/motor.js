/**
 * Motor do Jogo de Ritmo: desenha as setas (estilo FNF) ou os círculos (estilo osu!) numa camada por cima do
 * palco, lê o teclado/mouse, avalia os acertos e avisa a extensão (para os blocos "quando acertar…").
 *
 * As setas/círculos podem usar as fantasias de um ator (pele). Nomes aceitos (sem os números do fim):
 *   nota:      "nota esquerda" | "esquerda" | "purple"            (baixo/blue, cima/green, direita/red)
 *   receptor:  "receptor esquerda" | "arrowLEFT" | "static left"
 *   apertado:  "apertado esquerda" | "left press"
 *   acerto:    "acerto esquerda" | "left confirm"
 *   segurar:   "segurar esquerda" | "purple hold piece"
 *   fim:       "fim segurar esquerda" | "purple hold end" | "pruple end hold"
 *   círculos:  "circulo" | "hitcircle"; "aproximacao" | "approachcircle"
 *   itens:     "item perigo" (ou "item perigo esquerda" para cada seta), "item vida", "item moeda"…
 */
import {RelogioDoMapa} from './audio.js';
import {fimDasNotas, PISTAS, ITENS, iconeItem} from './dados.js';
import {separarNome} from '../spritesheet/spritesheet.js';

const LARG = 480;
const ALT = 360;
const CORES = ['#C24BCF', '#00C4E8', '#12FA05', '#F9393F'];
const ANGULOS = [Math.PI, Math.PI / 2, -Math.PI / 2, 0]; // ← ↓ ↑ → (y da tela para baixo)
const EN = ['left', 'down', 'up', 'right'];
const COR_FNF = ['purple', 'blue', 'green', 'red'];
const JANELAS = {perfeito: 45, bom: 90, ok: 135};
const JANELAS_CIRCULO = {c300: 50, c100: 100, c50: 150};
const FONTE_EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",Helvetica,Arial,sans-serif';
const ehPerigo = item => Boolean(item && ITENS[item] && ITENS[item].perigo);
const ehOpcional = item => Boolean(item && ITENS[item] && ITENS[item].opcional);
const VIDA_ITEM = 0.2;
const PONTOS_BONUS = 500;
const DANO_PERIGO = 0.25;
const TECLAS = {
    'setas-dfjk': {ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, d: 0, f: 1, j: 2, k: 3},
    'setas-wasd': {ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, a: 0, s: 1, w: 2, d: 3},
    'setas': {ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3}
};

const NOMES_PELE = (p) => {
    const pt = PISTAS[p];
    const en = EN[p];
    const cor = COR_FNF[p];
    return {
        nota: [`nota ${pt}`, pt, cor, `${cor} alone`, `${en} note`],
        receptor: [`receptor ${pt}`, `arrow${en.toUpperCase()}`, `arrow${en}`, `static ${en}`, `${en} static`],
        apertado: [`apertado ${pt}`, `${en} press`, `${en} pressed`],
        acerto: [`acerto ${pt}`, `${en} confirm`],
        corpo: [`segurar ${pt}`, `${cor} hold piece`, `${cor} hold`],
        fim: [`fim segurar ${pt}`, `${cor} hold end`, cor === 'purple' ? 'pruple end hold' : `${cor} end hold`]
    };
};

const carregarImg = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
});

/** Lê as fantasias de um ator e monta a pele {papel: {pista: [quadros]}}. */
const montarPele = async alvo => {
    const grupos = new Map();
    alvo.getCostumes().forEach(c => {
        const {animacao, numero} = separarNome(c.name);
        const k = animacao.toLowerCase().trim();
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push({c, numero});
    });
    const imgs = async nomes => {
        for (const nome of nomes) {
            const g = grupos.get(nome.toLowerCase());
            if (!g) continue;
            const lista = g.sort((a, b) => a.numero - b.numero);
            const quadros = [];
            for (const {c} of lista) {
                const img = await carregarImg(c.asset.encodeDataURI());
                if (img) quadros.push({img, w: img.naturalWidth, h: img.naturalHeight});
            }
            if (quadros.length) return quadros;
        }
        return null;
    };
    const pele = {setas: [], circulo: null, aproximacao: null, borda: null};
    for (let p = 0; p < 4; p++) {
        const nomes = NOMES_PELE(p);
        const r = {};
        for (const papel of Object.keys(nomes)) r[papel] = await imgs(nomes[papel]);
        pele.setas.push(r);
    }
    // itens: fantasias "item <nome>" ou "item <nome> <seta>"
    pele.itens = {};
    for (const k of grupos.keys()) {
        if (!k.startsWith('item ')) continue;
        const q = await imgs([k]);
        if (q) pele.itens[k.slice(5).trim()] = q;
    }
    pele.circulo = await imgs(['circulo', 'círculo', 'hitcircle']);
    pele.aproximacao = await imgs(['aproximacao', 'aproximação', 'approachcircle']);
    pele.borda = await imgs(['borda', 'hitcircleoverlay']);
    // tamanho de referência: a nota (ou o receptor) da primeira pista
    const ref = (pele.setas[0].nota || pele.setas[0].receptor || [null])[0];
    pele.ref = ref ? Math.max(ref.w, ref.h) : 0;
    const refC = (pele.circulo || [null])[0];
    pele.refCirculo = refC ? Math.max(refC.w, refC.h) : 0;
    return pele;
};

export class MotorRitmo {
    constructor (runtime) {
        this.runtime = runtime;
        this.relogio = new RelogioDoMapa(runtime);
        this.estado = 'parado'; // parado | tocando | pausado | terminado | perdeu
        this.config = {
            lado: 'direita', mostrarOponente: true, rolagem: 'cima', velocidade: 1, teclas: 'setas-dfjk',
            placar: true, permitirPerder: true, tamanho: 42, xJogador: null, yJogador: null, xOponente: null,
            yOponente: null, tamanhoCirculo: 34, aproximacao: 900
        };
        this.pele = null;
        this.eventos = [];
        this.apertadas = [false, false, false, false];
        this.brilho = [0, 0, 0, 0];
        this.brilhoOp = [0, 0, 0, 0];
        this.efeitos = [];
        this.zerar();

        const el = document.createElement('canvas');
        el.className = 'adventiscratch-ritmo';
        el.style.position = 'absolute';
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
        this.canvas = el;
        this.g = el.getContext('2d');

        this._aoTeclar = this._aoTeclar.bind(this);
        this._aoSoltarTecla = this._aoSoltarTecla.bind(this);
        this._aoClicar = this._aoClicar.bind(this);
        this._laco = this._laco.bind(this);
        document.addEventListener('keydown', this._aoTeclar);
        document.addEventListener('keyup', this._aoSoltarTecla);
    }

    zerar () {
        this.pontos = 0;
        this.combo = 0;
        this.maiorCombo = 0;
        this.vida = 0.5;
        this.contagem = {perfeito: 0, bom: 0, ok: 0, errou: 0, itens: 0, perigo: 0};
        this.ultimaAvaliacao = '';
        this.ultimaPista = '';
        this.ultimoItem = '';
        this.popup = null;
        this.popupItem = null;
    }

    // ---------------------------------------------------------------- pele
    async usarPele (alvo) {
        this.pele = alvo ? await montarPele(alvo) : null;
    }

    // ---------------------------------------------------------------- controle
    comecar (mapa) {
        this.parar();
        this.mapa = mapa;
        const duracaoAudio = this.relogio.preparar(mapa);
        this.fim = Math.max(mapa.duracao || 0, fimDasNotas(mapa) + 1200, duracaoAudio ? duracaoAudio - mapa.offset : 0);
        this.notas = mapa.notas.map(n => ({...n, estado: null}));
        this.circulos = mapa.circulos.map((c, i) => ({...c, estado: null, numero: (i % 8) + 1}));
        this.zerar();
        this.efeitos = [];
        this.apertadas = [false, false, false, false];
        this._fimVisivelAte = 0;
        this.relogio.tocar(0);
        this.estado = 'tocando';
        this._ligarCamada(true);
    }

    pausar () {
        if (this.estado !== 'tocando') return;
        this.relogio.pausar();
        this.estado = 'pausado';
    }

    continuar () {
        if (this.estado !== 'pausado') return;
        this.relogio.continuar();
        this.estado = 'tocando';
    }

    parar () {
        this.relogio.parar();
        if (this.estado === 'tocando' || this.estado === 'pausado') this.estado = 'parado';
        this._ligarCamada(false);
    }

    tempo () {
        return this.relogio.tempo();
    }

    _evento (tipo, pista, item) {
        this.eventos.push({tipo, pista, item});
    }

    // ---------------------------------------------------------------- camada sobre o palco
    _ligarCamada (on) {
        this.canvas.style.display = on ? 'block' : 'none';
        const stage = this.runtime.renderer && this.runtime.renderer.canvas;
        if (stage) {
            if (on) stage.addEventListener('mousedown', this._aoClicar);
            else stage.removeEventListener('mousedown', this._aoClicar);
        }
        if (on && !this._raf) this._raf = requestAnimationFrame(this._laco);
        if (!on) {
            const g = this.g;
            g.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    _encaixar () {
        const stage = this.runtime.renderer && this.runtime.renderer.canvas;
        if (!stage || !stage.parentElement) return false;
        const el = this.canvas;
        // fica por cima do palco e da camada 3D
        let antes = stage;
        const tres = stage.parentElement.querySelector('.adventiscratch-3d');
        if (tres && tres.parentElement === stage.parentElement) antes = tres;
        if (el.parentElement !== stage.parentElement || el.previousSibling !== antes) {
            stage.parentElement.insertBefore(el, antes.nextSibling);
        }
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
            el.width = Math.round(w * dpr);
            el.height = Math.round(h * dpr);
        }
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.left = `${stage.offsetLeft}px`;
        el.style.top = `${stage.offsetTop}px`;
        return w > 0;
    }

    // ---------------------------------------------------------------- entrada
    _ignorar (ev) {
        const t = ev.target;
        if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return true;
        // editores do Adventiscratch abertos por cima não jogam
        return Boolean(document.querySelector('.adv-mus, .adv-mapa, .adv-ctl, .adv-fli'));
    }

    _aoTeclar (ev) {
        if (this.estado !== 'tocando' || ev.repeat || this._ignorar(ev)) return;
        const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
        if (this.mapa.modo === 'circulos') {
            if (k === 'z' || k === 'x') {
                const mouse = this.runtime.ioDevices.mouse;
                this._clicarCirculo(mouse.getScratchX(), mouse.getScratchY());
            }
            return;
        }
        const pista = TECLAS[this.config.teclas][k];
        if (pista === undefined) return;
        this.apertadas[pista] = true;
        this._apertar(pista);
    }

    _aoSoltarTecla (ev) {
        const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
        const pista = TECLAS[this.config.teclas][k];
        if (pista === undefined) return;
        this.apertadas[pista] = false;
        if (this.estado !== 'tocando' || !this.notas) return;
        const agora = this.tempo();
        for (const n of this.notas) {
            if (n.estado === 'segurando' && n.pista === pista) {
                if (agora < n.t + n.dur - JANELAS.ok) {
                    n.estado = 'soltou';
                    this._errar(pista, 'Soltou cedo');
                } else {
                    n.estado = 'acertou';
                }
            }
        }
    }

    _aoClicar (ev) {
        if (this.estado !== 'tocando' || this.mapa.modo !== 'circulos') return;
        const r = this.canvas.getBoundingClientRect();
        const x = ((ev.clientX - r.left) / r.width * LARG) - (LARG / 2);
        const y = (ALT / 2) - ((ev.clientY - r.top) / r.height * ALT);
        this._clicarCirculo(x, y);
    }

    _avaliar (nome, pontos, vida, pista) {
        this.contagem[nome === 'Perfeito!' ? 'perfeito' : (nome === 'Bom' ? 'bom' : 'ok')]++;
        this.combo++;
        this.maiorCombo = Math.max(this.maiorCombo, this.combo);
        this.pontos += pontos;
        this.vida = Math.min(1, this.vida + vida);
        this.ultimaAvaliacao = nome.replace('!', '').toLowerCase();
        this.ultimaPista = pista === null ? '' : PISTAS[pista];
        this.popup = {txt: nome, cor: nome === 'Perfeito!' ? '#7CFF8A' : (nome === 'Bom' ? '#7FD3FF' : '#FFC928'),
            ate: performance.now() + 450};
        this._evento('acertou', pista);
    }

    _errar (pista, txt = 'Errou', dano = 0.0475) {
        this.contagem.errou++;
        this.combo = 0;
        this.pontos = Math.max(0, this.pontos - 10);
        this.vida -= dano;
        this.ultimaAvaliacao = 'errou';
        this.ultimaPista = pista === null ? '' : PISTAS[pista];
        this.popup = {txt, cor: '#FF5A5A', ate: performance.now() + 450};
        this._evento('errou', pista);
        if (this.vida <= 0 && this.config.permitirPerder) {
            this.vida = 0;
            this.estado = 'perdeu';
            this.relogio.parar();
            this._evento('perdeu', null);
        }
    }

    /** Pegou um item (nota especial acertada). */
    _pegarItem (item, pista) {
        this.contagem.itens++;
        this.ultimoItem = item;
        let txt = `${iconeItem(item)} ${item}`;
        if (item === 'vida') {
            this.vida = Math.min(1, this.vida + VIDA_ITEM);
            txt = '❤ +vida';
        } else if (item === 'bonus') {
            this.pontos += PONTOS_BONUS;
            txt = `⭐ +${PONTOS_BONUS}`;
        } else if (item === 'fantasma') {
            txt = '';
        }
        if (txt) this.popupItem = {txt, cor: (ITENS[item] && ITENS[item].cor) || '#FFFFFF', ate: performance.now() + 650};
        this._evento('item', pista, item);
    }

    /** Apertou um item de perigo: conta como erro e tira bastante vida. */
    _pegarPerigo (item, pista) {
        this.contagem.perigo++;
        this.ultimoItem = item;
        this.popupItem = {txt: '☠ Perigo!', cor: '#FF5A5A', ate: performance.now() + 650};
        this._evento('item', pista, item);
        this._errar(pista, 'Perigo!', DANO_PERIGO);
    }

    _apertar (pista) {
        const agora = this.tempo();
        let melhor = null;
        for (const n of this.notas) {
            if (n.quem !== 'eu' || n.estado || n.pista !== pista) continue;
            const d = Math.abs(agora - n.t);
            if (d <= JANELAS.ok && (!melhor || d < Math.abs(agora - melhor.t))) melhor = n;
            if (n.t > agora + JANELAS.ok) break;
        }
        if (!melhor) return; // apertar sem nota não tira ponto
        if (ehPerigo(melhor.item)) {
            melhor.estado = 'pegou';
            this._pegarPerigo(melhor.item, pista);
            return;
        }
        const d = Math.abs(agora - melhor.t);
        melhor.estado = melhor.dur > 0 ? 'segurando' : 'acertou';
        this.brilho[pista] = 1;
        if (d <= JANELAS.perfeito) this._avaliar('Perfeito!', 350, 0.023, pista);
        else if (d <= JANELAS.bom) this._avaliar('Bom', 200, 0.015, pista);
        else this._avaliar('Ok', 100, 0.004, pista);
        if (melhor.item) this._pegarItem(melhor.item, pista);
    }

    _clicarCirculo (x, y) {
        const agora = this.tempo();
        const r = this.config.tamanhoCirculo;
        // clicou num círculo de perigo que está na hora?
        const perigo = this.circulos.find(c => !c.estado && ehPerigo(c.item) &&
            Math.abs(agora - c.t) <= JANELAS_CIRCULO.c100 && Math.hypot(x - c.x, y - c.y) <= r * 1.1);
        if (perigo) {
            perigo.estado = 'pegou';
            this.efeitos.push({x: perigo.x, y: perigo.y, ini: performance.now(), tipo: 'erro'});
            this._pegarPerigo(perigo.item, null);
            return;
        }
        // os de perigo não entram na ordem (é para deixar passar)
        const alvo = this.circulos.find(c => !c.estado && !ehPerigo(c.item));
        if (!alvo) return;
        const d = agora - alvo.t;
        if (d < -JANELAS_CIRCULO.c50) return; // cedo demais
        if (Math.hypot(x - alvo.x, y - alvo.y) > r * 1.1) return;
        alvo.estado = 'acertou';
        const ad = Math.abs(d);
        this.efeitos.push({x: alvo.x, y: alvo.y, ini: performance.now(), tipo: 'acerto'});
        if (ad <= JANELAS_CIRCULO.c300) this._avaliar('Perfeito!', 300, 0.02, null);
        else if (ad <= JANELAS_CIRCULO.c100) this._avaliar('Bom', 100, 0.012, null);
        else this._avaliar('Ok', 50, 0.004, null);
        if (alvo.item) this._pegarItem(alvo.item, null);
    }

    /** Uma nota/círculo passou sem ser pego. Devolve true se isso contou como erro. */
    _deixouPassar (nota, pista) {
        if (ehPerigo(nota.item)) {
            nota.estado = 'evitou'; // era para deixar passar mesmo
            return false;
        }
        if (nota.item) this._evento('itemPassou', pista, nota.item);
        if (ehOpcional(nota.item)) {
            nota.estado = 'passou';
            return false;
        }
        nota.estado = 'errou';
        this._errar(pista);
        return true;
    }

    // ---------------------------------------------------------------- lógica a cada quadro
    _logica () {
        const agora = this.tempo();
        if (this.mapa.modo === 'circulos') {
            for (const c of this.circulos) {
                if (c.estado) continue;
                if (agora - c.t > JANELAS_CIRCULO.c50) {
                    if (this._deixouPassar(c, null)) {
                        this.efeitos.push({x: c.x, y: c.y, ini: performance.now(), tipo: 'erro'});
                    }
                    if (this.estado !== 'tocando') return;
                } else if (c.t > agora) {
                    break;
                }
            }
        } else {
            for (const n of this.notas) {
                if (n.t > agora + 50) break;
                if (n.quem === 'op') {
                    if (!n.estado && agora >= n.t && ehPerigo(n.item)) {
                        n.estado = 'evitou'; // o oponente não aperta perigo
                    } else if (!n.estado && agora >= n.t) {
                        n.estado = 'cantou';
                        this.brilhoOp[n.pista] = 1;
                        this._evento('oponente', n.pista);
                    }
                    continue;
                }
                if (!n.estado && agora - n.t > JANELAS.ok) {
                    this._deixouPassar(n, n.pista);
                    if (this.estado !== 'tocando') return;
                } else if (n.estado === 'segurando') {
                    if (agora >= n.t + n.dur) {
                        n.estado = 'acertou';
                    } else {
                        this.pontos += 1;
                        this.brilho[n.pista] = 1;
                    }
                }
            }
        }
        if (agora > this.fim) {
            this.estado = 'terminado';
            this.relogio.parar();
            this._evento('terminou', null);
        }
    }

    // ---------------------------------------------------------------- desenho
    _x (x) {
        return (x + (LARG / 2)) * this.s;
    }

    _y (y) {
        return ((ALT / 2) - y) * this.s;
    }

    _laco () {
        this._raf = null;
        if (this.canvas.style.display === 'none') return;
        if (this._encaixar()) {
            if (this.estado === 'tocando') this._logica();
            this._desenhar();
        }
        if (this.estado === 'tocando' || this.estado === 'pausado' || this._fimVisivelAte > performance.now()) {
            this._raf = requestAnimationFrame(this._laco);
        } else if (this.estado === 'terminado' || this.estado === 'perdeu') {
            // mostra o placar final por 3 s e some
            if (!this._fimVisivelAte) {
                this._fimVisivelAte = performance.now() + 3000;
                this._raf = requestAnimationFrame(this._laco);
            } else {
                this._fimVisivelAte = 0;
                this._ligarCamada(false);
            }
        }
    }

    _desenhar () {
        const g = this.g;
        this.s = this.canvas.width / LARG;
        g.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.mapa) return;
        if (this.mapa.modo === 'circulos') this._desenharCirculos();
        else this._desenharSetas();
        this._desenharHud();
    }

    _imagem (quadros, x, y, alvo, angulo = 0, alfa = 1, esticarAltura = 0, tempoAnim = 0) {
        const g = this.g;
        const q = quadros[Math.min(quadros.length - 1, Math.floor(tempoAnim * 24) % quadros.length)];
        const escala = alvo / (this.pele.ref || Math.max(q.w, q.h)) * this.s;
        g.save();
        g.globalAlpha = alfa;
        g.translate(this._x(x), this._y(y));
        if (angulo) g.rotate(angulo);
        const w = q.w * escala;
        const h = esticarAltura ? esticarAltura * this.s : q.h * escala;
        g.drawImage(q.img, -w / 2, esticarAltura ? 0 : -h / 2, w, h);
        g.restore();
    }

    _setaPadrao (x, y, pista, tam, {vazia = false, brilho = 0, alfa = 1, cor = null, borda = null} = {}) {
        const g = this.g;
        const s = tam * this.s / 2;
        g.save();
        g.globalAlpha = alfa;
        g.translate(this._x(x), this._y(y));
        g.rotate(ANGULOS[pista]);
        g.beginPath();
        g.moveTo(s, 0);
        g.lineTo(0, -s);
        g.lineTo(0, -s * 0.45);
        g.lineTo(-s, -s * 0.45);
        g.lineTo(-s, s * 0.45);
        g.lineTo(0, s * 0.45);
        g.lineTo(0, s);
        g.closePath();
        g.lineJoin = 'round';
        if (brilho > 0) {
            g.shadowColor = cor || CORES[pista];
            g.shadowBlur = 22 * brilho * this.s;
        }
        if (vazia) {
            g.fillStyle = brilho > 0.3 ? CORES[pista] : 'rgba(170,170,200,.45)';
            g.fill();
            g.lineWidth = 3 * this.s;
            g.strokeStyle = 'rgba(25,18,55,.85)';
            g.stroke();
        } else {
            g.fillStyle = cor || CORES[pista];
            g.fill();
            g.lineWidth = 3.5 * this.s;
            g.strokeStyle = borda || '#1B1338';
            g.stroke();
        }
        g.restore();
    }

    /** Ícone (emoji) centralizado num ponto do palco. */
    _icone (txt, x, y, tam, alfa = 1) {
        const g = this.g;
        g.save();
        g.globalAlpha = alfa;
        g.font = `${Math.round(tam * this.s)}px ${FONTE_EMOJI}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(txt, this._x(x), this._y(y));
        g.restore();
    }

    /** Fantasias da pele para um item ("item perigo esquerda" ou "item perigo"). */
    _peleItem (item, pista) {
        const it = this.pele && this.pele.itens;
        if (!it || !item) return null;
        const k = item.toLowerCase();
        return (pista !== null && it[`${k} ${PISTAS[pista]}`]) || it[k] || null;
    }

    /** Desenha a cabeça de uma nota (comum ou item). */
    _desenharNota (n, x, y, tam, alfa, sp) {
        const pi = this._peleItem(n.item, n.pista);
        if (pi) {
            this._imagem(pi, x, y, tam, 0, alfa);
            return;
        }
        const perigo = ehPerigo(n.item);
        if (sp && sp.nota && !perigo) this._imagem(sp.nota, x, y, tam, 0, alfa);
        else if (perigo) this._setaPadrao(x, y, n.pista, tam, {alfa, cor: ITENS.perigo.cor, borda: '#FF3B3B'});
        else {
            this._setaPadrao(x, y, n.pista, tam, {alfa, brilho: n.item === 'bonus' ? 0.8 : 0,
                cor: null});
        }
        if (n.item && n.item !== 'fantasma') this._icone(iconeItem(n.item), x, y, tam * 0.48, alfa);
    }

    _posicoesLado (quem) {
        const c = this.config;
        const direita = c.lado !== 'esquerda';
        const meu = quem === 'eu';
        const xPadrao = (meu === direita ? 1 : -1) * (c.mostrarOponente && this.mapa.oponente ? 120 : (meu ? 0 : 999));
        const x = meu ? (c.xJogador !== null ? c.xJogador : (c.mostrarOponente && this.mapa.oponente ? xPadrao : 0)) :
            (c.xOponente !== null ? c.xOponente : xPadrao);
        let y = meu ? c.yJogador : c.yOponente;
        if (y === null) y = c.rolagem === 'baixo' ? -135 : 135;
        return {x, y};
    }

    _desenharSetas () {
        const c = this.config;
        const agora = this.tempo();
        const tam = c.tamanho;
        const esp = tam * 1.12;
        const vel = 0.45 * this.mapa.velocidade * c.velocidade; // px do palco por ms
        const dir = c.rolagem === 'baixo' ? 1 : -1; // as notas vêm de baixo (rolagem para cima)
        const lados = ['eu'];
        if (c.mostrarOponente && this.mapa.oponente) lados.unshift('op');
        const pele = this.pele && this.pele.ref ? this.pele : null;
        for (const quem of lados) {
            const {x: cx, y: ry} = this._posicoesLado(quem);
            const xs = [0, 1, 2, 3].map(p => cx + ((p - 1.5) * esp));
            // receptores
            for (let p = 0; p < 4; p++) {
                const brilho = quem === 'eu' ? this.brilho[p] : this.brilhoOp[p];
                const apertada = quem === 'eu' && this.apertadas[p];
                const sp = pele && pele.setas[p];
                if (sp && (sp.receptor || sp.nota)) {
                    let q = sp.receptor || sp.nota;
                    if (brilho > 0.2 && sp.acerto) q = sp.acerto;
                    else if (apertada && sp.apertado) q = sp.apertado;
                    this._imagem(q, xs[p], ry, tam, 0, 1, 0, (1 - brilho) * 0.25);
                } else {
                    this._setaPadrao(xs[p], ry, p, tam, {vazia: true, brilho: Math.max(brilho, apertada ? 0.35 : 0)});
                }
            }
            // notas
            for (const n of this.notas) {
                if (n.quem !== quem) continue;
                const fimNota = n.t + n.dur;
                if (fimNota < agora - 200) continue;
                const yN = ry + (dir * (n.t - agora) * vel);
                // nota (e o fim dela) ainda fora da tela, no lado de onde as notas vêm: as próximas também estão
                if (n.t > agora && Math.abs(yN) > 260) break;
                if (n.dur === 0 && (n.estado === 'acertou' || n.estado === 'cantou')) continue;
                const sp = pele && pele.setas[n.pista];
                // corpo da nota longa
                if (n.dur > 0 && n.estado !== 'soltou') {
                    const ini = (n.estado === 'segurando' || n.estado === 'cantou' || n.estado === 'acertou') ?
                        Math.max(agora, n.t) : n.t;
                    if (fimNota > ini) {
                        const y1 = ry + (dir * (ini - agora) * vel);
                        const y2 = ry + (dir * (fimNota - agora) * vel);
                        if (sp && sp.corpo) {
                            const topo = Math.max(y1, y2);
                            this._imagem(sp.corpo, xs[n.pista], topo, tam * 0.95, 0, n.estado === 'errou' ? 0.4 : 0.9,
                                Math.abs(y2 - y1));
                            if (sp.fim) this._imagem(sp.fim, xs[n.pista], y2, tam * 0.95, 0, 0.9);
                        } else {
                            const g = this.g;
                            g.fillStyle = CORES[n.pista];
                            g.globalAlpha = n.estado === 'errou' ? 0.35 : 0.75;
                            const w = tam * 0.32 * this.s;
                            g.fillRect(this._x(xs[n.pista]) - (w / 2), this._y(Math.max(y1, y2)), w,
                                Math.abs(y2 - y1) * this.s);
                            g.globalAlpha = 1;
                        }
                    }
                }
                if (n.estado === 'segurando' || n.estado === 'cantou' || n.estado === 'acertou' ||
                    n.estado === 'pegou') continue;
                let alfa = n.estado === 'errou' || n.estado === 'passou' ? 0.35 : 1;
                // fantasma: some quando chega perto dos receptores
                if (n.item === 'fantasma') alfa *= Math.max(0, Math.min(1, (Math.abs(yN - ry) - 70) / 90));
                if (alfa > 0.01) this._desenharNota(n, xs[n.pista], yN, tam, alfa, sp);
            }
        }
        for (let p = 0; p < 4; p++) {
            this.brilho[p] = Math.max(0, this.brilho[p] - 0.06);
            this.brilhoOp[p] = Math.max(0, this.brilhoOp[p] - 0.06);
        }
    }

    _desenharCirculos () {
        const g = this.g;
        const agora = this.tempo();
        const r = this.config.tamanhoCirculo;
        const pre = this.config.aproximacao;
        const pele = this.pele && this.pele.circulo ? this.pele : null;
        const visiveis = this.circulos.filter(c => !c.estado && c.t - pre <= agora && c.t + 160 >= agora);
        // os mais tarde ficam embaixo
        for (let i = visiveis.length - 1; i >= 0; i--) {
            const c = visiveis[i];
            const falta = c.t - agora;
            let alfa = Math.max(0, Math.min(1, (pre - falta) / (pre / 3)));
            // fantasma: some antes da hora (como o "Hidden" do osu!)
            if (c.item === 'fantasma') alfa *= Math.max(0, Math.min(1, falta / (pre * 0.4)));
            if (alfa <= 0.01) continue;
            const perigo = ehPerigo(c.item);
            const cor = perigo ? ITENS.perigo.cor : CORES[(c.numero - 1) % 4];
            const pi = this._peleItem(c.item, null);
            if (pi) {
                this._imagemCirculo(pi, c.x, c.y, r * 2, alfa);
            } else if (pele && !perigo) {
                const escala = r * 2;
                this._imagemCirculo(pele.circulo, c.x, c.y, escala, alfa);
                if (pele.borda) this._imagemCirculo(pele.borda, c.x, c.y, escala, alfa);
            } else {
                g.save();
                g.globalAlpha = alfa;
                g.beginPath();
                g.arc(this._x(c.x), this._y(c.y), r * this.s, 0, Math.PI * 2);
                g.fillStyle = cor;
                g.fill();
                g.lineWidth = 4 * this.s;
                g.strokeStyle = perigo ? '#FF3B3B' : '#fff';
                if (c.item === 'bonus') {
                    g.shadowColor = '#FFC928';
                    g.shadowBlur = 18 * this.s;
                }
                g.stroke();
                g.restore();
            }
            if (c.item && c.item !== 'fantasma') {
                if (!pi) this._icone(iconeItem(c.item), c.x, c.y, r * 1.05, alfa);
                if (falta > 0 && c.item !== 'fantasma') {
                    const rr = r * (1 + (2.2 * falta / pre));
                    g.save();
                    g.globalAlpha = alfa;
                    g.beginPath();
                    g.arc(this._x(c.x), this._y(c.y), rr * this.s, 0, Math.PI * 2);
                    g.lineWidth = 3 * this.s;
                    g.strokeStyle = perigo ? '#FF3B3B' : cor;
                    g.stroke();
                    g.restore();
                }
                continue;
            }
            g.save();
            g.globalAlpha = alfa;
            g.font = `bold ${Math.round(r * 0.9 * this.s)}px Helvetica, Arial, sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineWidth = 3 * this.s;
            g.strokeStyle = '#1B1338';
            g.strokeText(String(c.numero), this._x(c.x), this._y(c.y));
            g.fillStyle = '#fff';
            g.fillText(String(c.numero), this._x(c.x), this._y(c.y));
            g.restore();
            if (falta > 0 && c.item !== 'fantasma') {
                const rr = r * (1 + (2.2 * falta / pre));
                if (pele && pele.aproximacao) {
                    this._imagemCirculo(pele.aproximacao, c.x, c.y, rr * 2, alfa);
                } else {
                    g.save();
                    g.globalAlpha = alfa;
                    g.beginPath();
                    g.arc(this._x(c.x), this._y(c.y), rr * this.s, 0, Math.PI * 2);
                    g.lineWidth = 3 * this.s;
                    g.strokeStyle = cor;
                    g.stroke();
                    g.restore();
                }
            }
        }
        const agoraMs = performance.now();
        this.efeitos = this.efeitos.filter(e => agoraMs - e.ini < 350);
        for (const e of this.efeitos) {
            const k = (agoraMs - e.ini) / 350;
            g.save();
            g.globalAlpha = 1 - k;
            if (e.tipo === 'acerto') {
                g.beginPath();
                g.arc(this._x(e.x), this._y(e.y), r * (1 + (k * 0.6)) * this.s, 0, Math.PI * 2);
                g.lineWidth = 5 * this.s;
                g.strokeStyle = '#fff';
                g.stroke();
            } else {
                g.strokeStyle = '#FF5A5A';
                g.lineWidth = 5 * this.s;
                const d = r * 0.5 * this.s;
                g.beginPath();
                g.moveTo(this._x(e.x) - d, this._y(e.y) - d);
                g.lineTo(this._x(e.x) + d, this._y(e.y) + d);
                g.moveTo(this._x(e.x) + d, this._y(e.y) - d);
                g.lineTo(this._x(e.x) - d, this._y(e.y) + d);
                g.stroke();
            }
            g.restore();
        }
    }

    _imagemCirculo (quadros, x, y, diametro, alfa) {
        const q = quadros[0];
        const escala = diametro / (this.pele.refCirculo || Math.max(q.w, q.h)) * this.s;
        const g = this.g;
        g.save();
        g.globalAlpha = alfa;
        g.drawImage(q.img, this._x(x) - (q.w * escala / 2), this._y(y) - (q.h * escala / 2), q.w * escala, q.h * escala);
        g.restore();
    }

    _texto (txt, x, y, tam, cor) {
        const g = this.g;
        g.save();
        g.font = `bold ${Math.round(tam * this.s)}px Helvetica, Arial, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = Math.max(2, tam / 5) * this.s;
        g.strokeStyle = '#1B1338';
        g.strokeText(txt, this._x(x), this._y(y));
        g.fillStyle = cor;
        g.fillText(txt, this._x(x), this._y(y));
        g.restore();
    }

    precisao () {
        const total = this.contagem.perfeito + this.contagem.bom + this.contagem.ok + this.contagem.errou;
        if (!total) return 100;
        return Math.round(((this.contagem.perfeito + (this.contagem.bom * 0.75) + (this.contagem.ok * 0.4)) / total) * 1000) / 10;
    }

    _desenharHud () {
        const agoraMs = performance.now();
        if (this.popup && this.popup.ate > agoraMs) {
            const k = (this.popup.ate - agoraMs) / 450;
            this._texto(this.popup.txt, 0, 30 + (k * 8), 26, this.popup.cor);
            if (this.combo >= 5 && this.popup.cor !== '#FF5A5A') this._texto(`${this.combo}×`, 0, 2, 18, '#fff');
        }
        if (this.popupItem && this.popupItem.ate > agoraMs) {
            const k = (this.popupItem.ate - agoraMs) / 650;
            const g = this.g;
            g.save();
            g.globalAlpha = Math.min(1, k * 2);
            this._texto(this.popupItem.txt, 0, 62 + ((1 - k) * 14), 18, this.popupItem.cor);
            g.restore();
        }
        if (!this.config.placar) return;
        const g = this.g;
        if (this.mapa.modo === 'setas') {
            // barra de vida (roxo = você)
            const w = 200 * this.s;
            const h = 9 * this.s;
            const x = this._x(-100);
            const y = this._y(this.config.rolagem === 'baixo' ? 160 : -152);
            g.fillStyle = '#1B1338';
            g.fillRect(x - (2 * this.s), y - (2 * this.s), w + (4 * this.s), h + (4 * this.s));
            g.fillStyle = '#E8742C';
            g.fillRect(x, y, w, h);
            g.fillStyle = '#7A4FC8';
            g.fillRect(x + (w * (1 - this.vida)), y, w * this.vida, h);
        }
        const yTexto = this.mapa.modo === 'setas' && this.config.rolagem === 'baixo' ? 172 : -168;
        this._texto(`Pontos ${this.pontos} · Erros ${this.contagem.errou} · ${this.precisao()}%`, 0, yTexto, 12, '#fff');
        if (this.estado === 'terminado' || this.estado === 'perdeu') {
            g.fillStyle = 'rgba(15,8,40,.55)';
            g.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this._texto(this.estado === 'perdeu' ? 'Fim de jogo!' : 'Mapa completo! 🎉', 0, 40, 30,
                this.estado === 'perdeu' ? '#FF9F5A' : '#FFC928');
            this._texto(`${this.pontos} pontos · precisão ${this.precisao()}% · maior combo ${this.maiorCombo}`, 0, 0, 14, '#fff');
        }
    }
}
