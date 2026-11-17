/**
 * O "relógio" de um mapa de ritmo: toca o áudio do mapa (música do Criador, som do projeto ou nada)
 * e diz em que milissegundo do mapa estamos, usando o relógio do áudio (não atrasa com o jogo pesado).
 */
import {obterMusica, totalPassos, PASSOS_POR_BATIDA} from '../musica/dados.js';
import {Tocador} from '../musica/sintetizador.js';

/** Todos os sons do projeto (do Palco e dos atores), sem repetir nome. */
export const sonsDoProjeto = runtime => {
    const vistos = new Set();
    const lista = [];
    const alvos = runtime.targets.filter(t => t.isOriginal);
    alvos.sort((a, b) => (b.isStage ? 1 : 0) - (a.isStage ? 1 : 0));
    for (const t of alvos) {
        for (const s of t.sprite.sounds) {
            if (vistos.has(s.name)) continue;
            vistos.add(s.name);
            lista.push({nome: s.name, ator: t.isStage ? 'Palco' : t.getName()});
        }
    }
    return lista;
};

const bufferDoSom = (runtime, nome) => {
    for (const t of runtime.targets) {
        if (!t.isOriginal) continue;
        const s = t.sprite.sounds.find(x => x.name === nome);
        const banco = t.sprite.soundBank;
        if (s && banco && banco.soundPlayers[s.soundId]) return banco.soundPlayers[s.soundId].buffer;
    }
    return null;
};

export class RelogioDoMapa {
    constructor (runtime) {
        this.runtime = runtime;
        this.estado = 'parado'; // parado | tocando | pausado
        this.mapa = null;
        this.duracaoAudio = 0;
        this.fonte = null;
        this.tocador = null;
        this.volume = 1;
        this.saida = null;
    }

    get ctx () {
        return this.runtime.audioEngine.audioContext;
    }

    _latencia () {
        const c = this.ctx;
        return ((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000;
    }

    _saida () {
        const c = this.ctx;
        if (!this.saida || this.saida.context !== c) {
            this.saida = c.createGain();
            this.saida.connect(this.runtime.audioEngine.inputNode);
        }
        this.saida.gain.value = this.volume;
        return this.saida;
    }

    /** Duração do áudio em ms (0 = sem áudio). */
    preparar (mapa) {
        this.parar();
        this.mapa = mapa;
        this.duracaoAudio = 0;
        this.musica = null;
        this.buffer = null;
        if (mapa.audio.tipo === 'musica') {
            const m = obterMusica(mapa.audio.nome);
            if (m) {
                this.musica = m;
                this.duracaoAudio = totalPassos(m) / PASSOS_POR_BATIDA * 60000 / m.bpm;
            }
        } else if (mapa.audio.tipo === 'som') {
            this.buffer = bufferDoSom(this.runtime, mapa.audio.nome);
            if (this.buffer) this.duracaoAudio = this.buffer.duration * 1000;
        }
        return this.duracaoAudio;
    }

    /** Começa a tocar a partir de "desde" (ms do áudio). */
    tocar (desde = 0) {
        this._pararFontes();
        const c = this.ctx;
        if (c.state === 'suspended') c.resume();
        const inicio = Math.max(0, desde);
        this.t0 = c.currentTime + 0.06 - (inicio / 1000);
        if (this.musica) {
            this.tocador = new Tocador(() => this.ctx, () => this._saida());
            this.tocador.repetir = false;
            const msPorPasso = 60000 / this.musica.bpm / PASSOS_POR_BATIDA;
            this.tocador.tocar(this.musica, inicio / msPorPasso);
            this.t0 = this.tocador.t0; // o Tocador já calcula quando o passo 0 "aconteceu"
        } else if (this.buffer && inicio < this.duracaoAudio) {
            const f = c.createBufferSource();
            f.buffer = this.buffer;
            f.connect(this._saida());
            f.start(c.currentTime + 0.06, inicio / 1000);
            this.fonte = f;
        }
        this.estado = 'tocando';
    }

    _pararFontes () {
        if (this.fonte) {
            try {
                this.fonte.stop();
            } catch (e) { /* já parou */ }
            this.fonte.disconnect();
            this.fonte = null;
        }
        if (this.tocador) {
            this.tocador.parar();
            this.tocador = null;
        }
    }

    /** Milissegundo atual do áudio (o que a pessoa está ouvindo agora). */
    tempoAudio () {
        if (this.estado === 'pausado') return this.posPausa;
        if (this.estado !== 'tocando') return 0;
        if (this.tocador) this.t0 = this.tocador.t0;
        return ((this.ctx.currentTime - this.t0) * 1000) - this._latencia();
    }

    /** Milissegundo atual do MAPA (áudio menos o deslocamento). */
    tempo () {
        return this.tempoAudio() - (this.mapa ? this.mapa.offset : 0);
    }

    pausar () {
        if (this.estado !== 'tocando') return;
        this.posPausa = Math.max(0, this.tempoAudio());
        this._pararFontes();
        this.estado = 'pausado';
    }

    continuar () {
        if (this.estado !== 'pausado') return;
        this.tocar(this.posPausa);
    }

    parar () {
        this._pararFontes();
        this.estado = 'parado';
        this.posPausa = 0;
    }

    definirVolume (v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.saida) this.saida.gain.value = this.volume;
    }
}
