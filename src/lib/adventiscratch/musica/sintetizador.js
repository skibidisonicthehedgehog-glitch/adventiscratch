/**
 * Sintetizador do Criador de Músicas: instrumentos feitos com Web Audio (nada de arquivos de som)
 * e o "tocador", que agenda as notas com antecedência para o ritmo ficar certinho.
 */
import {PASSOS_POR_BATIDA, LINHAS_BATERIA, totalPassos} from './dados.js';

export const INSTRUMENTOS = [
    {id: 'piano', nome: '🎹 Piano'},
    {id: 'orgao', nome: '⛪ Órgão'},
    {id: 'baixo', nome: '🎸 Baixo'},
    {id: 'cordas', nome: '🎻 Cordas'},
    {id: 'flauta', nome: '🪈 Flauta'},
    {id: 'sinos', nome: '🔔 Sinos'},
    {id: 'synth', nome: '🎛️ Sintetizador'},
    {id: 'bit8', nome: '👾 8-bit'}
];

// instrumentos .sf2 (registrados pelo soundfont-store, para não criar dependência circular)
let instrumentoExterno = null;
export const registrarInstrumentoExterno = fn => {
    instrumentoExterno = fn;
};

export const NOMES_NOTAS = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
export const nomeNota = n => `${NOMES_NOTAS[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
export const freqDaNota = n => 440 * Math.pow(2, (n - 69) / 12);

const ruidos = new WeakMap();
const ruido = ctx => {
    if (!ruidos.has(ctx)) {
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2) - 1;
        ruidos.set(ctx, buf);
    }
    return ruidos.get(ctx);
};

const envelope = (g, t, {ataque = 0.005, pico = 0.3, sustain = 0.6, decai = 0.1, dur, solta = 0.08}) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, pico * sustain), t + ataque + decai);
    const fim = t + Math.max(dur, ataque + decai);
    g.gain.setValueAtTime(Math.max(0.0001, pico * sustain), fim);
    g.gain.exponentialRampToValueAtTime(0.0001, fim + solta);
    return fim + solta;
};

const osc = (ctx, tipo, freq, t, fim, destino, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(destino);
    o.start(t);
    o.stop(fim + 0.02);
    return o;
};

/**
 * Toca uma nota de um instrumento.
 * @param {AudioContext} ctx contexto de áudio
 * @param {AudioNode} destino para onde vai o som
 * @param {string} instrumento id do instrumento
 * @param {number} n nota MIDI (60 = Dó central)
 * @param {number} t quando começa (tempo do contexto)
 * @param {number} dur duração em segundos
 * @param {number} vol volume (0 a 1)
 */
export const tocarNota = (ctx, destino, instrumento, n, t, dur, vol = 0.8) => {
    if (typeof instrumento === 'string' && instrumento.startsWith('sf2:')) {
        const fim = instrumentoExterno && instrumentoExterno(ctx, destino, instrumento, n, t, dur, vol);
        if (fim) return fim;
        instrumento = 'piano'; // instrumento .sf2 que não está no projeto: toca piano
    }
    const f = freqDaNota(n);
    const g = ctx.createGain();
    g.connect(destino);
    const v = Math.max(0.0001, vol);
    let fim;
    switch (instrumento) {
    case 'orgao': {
        fim = envelope(g, t, {ataque: 0.01, pico: 0.12 * v, sustain: 0.9, decai: 0.05, dur, solta: 0.06});
        osc(ctx, 'sine', f, t, fim, g);
        osc(ctx, 'sine', f * 2, t, fim, g);
        osc(ctx, 'triangle', f * 3, t, fim, g);
        break;
    }
    case 'baixo': {
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.setValueAtTime(900, t);
        filtro.frequency.exponentialRampToValueAtTime(250, t + 0.2);
        filtro.connect(g);
        fim = envelope(g, t, {ataque: 0.004, pico: 0.32 * v, sustain: 0.55, decai: 0.15, dur, solta: 0.05});
        osc(ctx, 'sawtooth', f, t, fim, filtro);
        osc(ctx, 'sine', f / 2, t, fim, g);
        break;
    }
    case 'cordas': {
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = 2200;
        filtro.connect(g);
        fim = envelope(g, t, {ataque: 0.12, pico: 0.1 * v, sustain: 0.9, decai: 0.1, dur, solta: 0.25});
        osc(ctx, 'sawtooth', f, t, fim, filtro, -7);
        osc(ctx, 'sawtooth', f, t, fim, filtro, 7);
        break;
    }
    case 'flauta': {
        fim = envelope(g, t, {ataque: 0.05, pico: 0.25 * v, sustain: 0.8, decai: 0.08, dur, solta: 0.1});
        const o = osc(ctx, 'sine', f, t, fim, g);
        const lfo = ctx.createOscillator();
        const prof = ctx.createGain();
        lfo.frequency.value = 5.5;
        prof.gain.value = f * 0.008;
        lfo.connect(prof).connect(o.frequency);
        lfo.start(t);
        lfo.stop(fim + 0.02);
        break;
    }
    case 'sinos': {
        fim = envelope(g, t, {ataque: 0.002, pico: 0.25 * v, sustain: 0.25, decai: 0.4, dur: Math.max(dur, 0.6),
            solta: 0.6});
        const portadora = osc(ctx, 'sine', f, t, fim, g);
        const mod = ctx.createOscillator();
        const modG = ctx.createGain();
        mod.frequency.value = f * 3.5;
        modG.gain.setValueAtTime(f * 2, t);
        modG.gain.exponentialRampToValueAtTime(1, fim);
        mod.connect(modG).connect(portadora.frequency);
        mod.start(t);
        mod.stop(fim + 0.02);
        break;
    }
    case 'synth': {
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.Q.value = 6;
        filtro.frequency.setValueAtTime(400, t);
        filtro.frequency.exponentialRampToValueAtTime(3000, t + 0.05);
        filtro.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
        filtro.connect(g);
        fim = envelope(g, t, {ataque: 0.005, pico: 0.14 * v, sustain: 0.7, decai: 0.2, dur, solta: 0.1});
        osc(ctx, 'sawtooth', f, t, fim, filtro, -10);
        osc(ctx, 'square', f, t, fim, filtro, 10);
        break;
    }
    case 'bit8': {
        fim = envelope(g, t, {ataque: 0.002, pico: 0.1 * v, sustain: 0.8, decai: 0.02, dur, solta: 0.02});
        osc(ctx, 'square', f, t, fim, g);
        break;
    }
    default: { // piano
        fim = envelope(g, t, {ataque: 0.003, pico: 0.3 * v, sustain: 0.3, decai: 0.35, dur, solta: 0.25});
        osc(ctx, 'triangle', f, t, fim, g);
        osc(ctx, 'sine', f * 2, t, fim, g);
    }
    }
    return fim;
};

/**
 * Toca um som de bateria.
 * @param {AudioContext} ctx contexto
 * @param {AudioNode} destino saída
 * @param {string} linha bumbo | caixa | chimbal | palmas | tom | prato
 * @param {number} t quando
 * @param {number} vol volume
 */
export const tocarBateria = (ctx, destino, linha, t, vol = 0.8) => {
    const g = ctx.createGain();
    g.connect(destino);
    const ruidoComFiltro = (tipo, freq, pico, dur, q = 1) => {
        const s = ctx.createBufferSource();
        s.buffer = ruido(ctx);
        const fl = ctx.createBiquadFilter();
        fl.type = tipo;
        fl.frequency.value = freq;
        fl.Q.value = q;
        const gg = ctx.createGain();
        gg.gain.setValueAtTime(pico * vol, t);
        gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(fl).connect(gg).connect(g);
        s.start(t);
        s.stop(t + dur + 0.02);
    };
    switch (linha) {
    case 'bumbo': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
        g.gain.setValueAtTime(0.9 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.4);
        break;
    }
    case 'caixa':
        ruidoComFiltro('highpass', 1500, 0.45, 0.18);
        {
            const o = ctx.createOscillator();
            o.frequency.setValueAtTime(220, t);
            const gg = ctx.createGain();
            gg.gain.setValueAtTime(0.3 * vol, t);
            gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
            o.connect(gg).connect(g);
            o.start(t);
            o.stop(t + 0.12);
        }
        break;
    case 'chimbal':
        ruidoComFiltro('highpass', 7000, 0.22, 0.05);
        break;
    case 'palmas':
        for (const atraso of [0, 0.012, 0.024]) {
            const s = ctx.createBufferSource();
            s.buffer = ruido(ctx);
            const fl = ctx.createBiquadFilter();
            fl.type = 'bandpass';
            fl.frequency.value = 1200;
            const gg = ctx.createGain();
            gg.gain.setValueAtTime(0.35 * vol, t + atraso);
            gg.gain.exponentialRampToValueAtTime(0.0001, t + atraso + 0.08);
            s.connect(fl).connect(gg).connect(g);
            s.start(t + atraso);
            s.stop(t + atraso + 0.1);
        }
        break;
    case 'tom': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
        g.gain.setValueAtTime(0.5 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.32);
        break;
    }
    case 'prato':
        ruidoComFiltro('highpass', 5000, 0.25, 1.1);
        break;
    }
};

/**
 * Toca uma música com play, pausa, continuar, parar, repetir, volume e velocidade.
 * O tempo vem do relógio do áudio, então o ritmo não atrasa mesmo com o jogo pesado.
 */
export class Tocador {
    /**
     * @param {function(): AudioContext} obterContexto devolve o contexto de áudio
     * @param {function(): AudioNode} obterSaida devolve o nó de saída
     */
    constructor (obterContexto, obterSaida) {
        this.obterContexto = obterContexto;
        this.obterSaida = obterSaida;
        this.musica = null;
        this.estado = 'parada'; // parada | tocando | pausada
        this.repetir = false;
        this.volume = 1;
        this.velocidade = 1;
        this.posPausa = 0;
        this.timer = null;
        this.sessao = null;
        this.nodoVolume = null;
        this.aoTerminar = null;
        this.terminou = false;
    }

    duracaoPasso () {
        return 60 / (this.musica.bpm * this.velocidade) / PASSOS_POR_BATIDA;
    }

    /** Passo atual (com fração), contando do começo da música. */
    passoAtual () {
        if (!this.musica) return 0;
        if (this.estado === 'pausada') return this.posPausa;
        if (this.estado !== 'tocando') return 0;
        const ctx = this.obterContexto();
        const p = (ctx.currentTime - this.t0) / this.duracaoPasso();
        return Math.max(0, Math.min(totalPassos(this.musica), p));
    }

    batidaAtual () {
        return Math.floor(this.passoAtual() / PASSOS_POR_BATIDA) + 1;
    }

    _abrirSessao () {
        const ctx = this.obterContexto();
        if (ctx.state === 'suspended') ctx.resume();
        if (!this.nodoVolume || this.nodoVolume.context !== ctx) {
            this.nodoVolume = ctx.createGain();
            this.nodoVolume.connect(this.obterSaida());
        }
        this.nodoVolume.gain.value = this.volume;
        this.sessao = ctx.createGain();
        this.sessao.connect(this.nodoVolume);
        return ctx;
    }

    _fecharSessao () {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        const s = this.sessao;
        this.sessao = null;
        if (s) {
            const ctx = s.context;
            s.gain.setValueAtTime(s.gain.value, ctx.currentTime);
            s.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
            setTimeout(() => {
                try {
                    s.disconnect();
                } catch (e) { /* já desligado */ }
            }, 80);
        }
    }

    _agendar (passo, t) {
        const m = this.musica;
        const dp = this.duracaoPasso();
        const destino = this.sessao;
        const ctx = destino.context;
        for (const f of m.faixas) {
            for (const n of f.notas) {
                if (n.p === passo) tocarNota(ctx, destino, f.instrumento, n.n, t, (n.d * dp) - 0.01, f.volume);
            }
        }
        for (const linha of LINHAS_BATERIA) {
            if (m.bateria.linhas[linha].includes(passo)) tocarBateria(ctx, destino, linha, t, m.bateria.volume);
        }
    }

    _rodar () {
        const ctx = this.obterContexto();
        const total = totalPassos(this.musica);
        const dp = this.duracaoPasso();
        while (this.proximo < total && this.t0 + (this.proximo * dp) < ctx.currentTime + 0.15) {
            this._agendar(this.proximo, Math.max(ctx.currentTime, this.t0 + (this.proximo * dp)));
            this.proximo++;
            if (this.proximo >= total && this.repetir) {
                this.t0 += total * dp;
                this.proximo = 0;
            }
        }
        if (this.proximo >= total && !this.repetir && ctx.currentTime >= this.t0 + (total * dp)) {
            this._fecharSessao();
            this.estado = 'parada';
            this.terminou = true;
            if (this.aoTerminar) this.aoTerminar();
        }
    }

    _comecar (passo) {
        const ctx = this._abrirSessao();
        this.t0 = ctx.currentTime + 0.05 - (passo * this.duracaoPasso());
        this.proximo = Math.ceil(passo - 0.0001);
        this.estado = 'tocando';
        this.terminou = false;
        this._rodar();
        this.timer = setInterval(() => this._rodar(), 25);
    }

    tocar (musica, passoInicial = 0) {
        this._fecharSessao();
        this.musica = musica;
        this._comecar(Math.max(0, Math.min(totalPassos(musica) - 1, passoInicial)));
    }

    /** Atualiza a música que está tocando (o editor chama ao mudar notas), sem parar. */
    trocarMusica (musica) {
        if (!this.musica) return;
        const pos = this.passoAtual();
        this.musica = musica;
        if (this.estado === 'tocando') {
            const ctx = this.obterContexto();
            this.t0 = ctx.currentTime - (pos * this.duracaoPasso());
        }
    }

    pausar () {
        if (this.estado !== 'tocando') return;
        this.posPausa = this.passoAtual();
        this._fecharSessao();
        this.estado = 'pausada';
    }

    continuar () {
        if (this.estado !== 'pausada' || !this.musica) return;
        this._comecar(this.posPausa);
    }

    parar () {
        this._fecharSessao();
        this.estado = 'parada';
        this.posPausa = 0;
    }

    irPara (passo) {
        if (!this.musica) return;
        const p = Math.max(0, Math.min(totalPassos(this.musica) - 1, passo));
        if (this.estado === 'tocando') {
            this._fecharSessao();
            this._comecar(p);
        } else {
            this.posPausa = p;
            if (this.estado === 'parada') this.estado = 'pausada';
        }
    }

    definirVolume (v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.nodoVolume) this.nodoVolume.gain.setTargetAtTime(this.volume, this.nodoVolume.context.currentTime, 0.02);
    }

    definirVelocidade (v) {
        const pos = this.passoAtual();
        this.velocidade = Math.max(0.25, Math.min(4, v));
        if (this.estado === 'tocando') {
            const ctx = this.obterContexto();
            this.t0 = ctx.currentTime - (pos * this.duracaoPasso());
            this.proximo = Math.ceil(pos);
        }
    }
}
