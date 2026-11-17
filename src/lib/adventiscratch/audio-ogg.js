/**
 * Suporte a sons .ogg (Ogg Vorbis / Opus) no Adventiblocks.
 *
 * O formato de projeto do Scratch só guarda sons WAV ou MP3, então o .ogg é decodificado pelo navegador
 * e salvo como WAV mono 16 bits. Assim o som funciona em todo lugar: tocar, editar no editor de sons,
 * salvar no .asp e usar como música do Jogo de Ritmo (as músicas de FNF costumam vir em .ogg).
 */
import WavEncoder from 'wav-encoder';

/** Mesmo limite do editor de sons do Scratch: acima disso o som não pode ser editado. */
const LIMITE_BYTES = 10 * 1000 * 1000;
const TAXA_PADRAO = 44100;
const TAXA_REDUZIDA = 22050;

const EXTENSOES_OGG = ['ogg', 'oga', 'opus'];
const TIPOS_OGG = ['audio/ogg', 'audio/vorbis', 'audio/opus', 'audio/x-ogg', 'application/ogg', 'video/ogg'];

/** É um arquivo .ogg? (o Windows muitas vezes não informa o tipo, então olha a extensão também) */
export const ehOgg = (tipo, nomeArquivo = '') => {
    if (TIPOS_OGG.includes(String(tipo || '').toLowerCase())) return true;
    const ext = String(nomeArquivo).split('.').pop()
        .toLowerCase();
    return !tipo && EXTENSOES_OGG.includes(ext);
};

/** Tipo de arquivo "de verdade": completa o tipo vazio dos .ogg a partir da extensão. */
export const tipoDoArquivo = arquivo => {
    if (arquivo.type && arquivo.type !== 'video/ogg' && arquivo.type !== 'application/ogg') return arquivo.type;
    return ehOgg(arquivo.type, arquivo.name) ? 'audio/ogg' : arquivo.type;
};

const ContextoOffline = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;

/** Decodifica o áudio já na taxa pedida (o navegador reamostra) e mistura os canais em mono. */
const decodificarMono = async (dados, taxa) => {
    const Ctx = ContextoOffline();
    if (!Ctx) throw new Error('Este navegador não tem Web Audio.');
    const ctx = new Ctx(1, 1, taxa);
    const buffer = await new Promise((resolve, reject) => {
        // Safari antigo só aceita a versão com callbacks
        const p = ctx.decodeAudioData(dados.slice(0), resolve, reject);
        if (p && p.then) p.then(resolve, reject);
    });
    const canais = buffer.numberOfChannels;
    const mono = new Float32Array(buffer.length);
    for (let c = 0; c < canais; c++) {
        const dadosCanal = buffer.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += dadosCanal[i] / canais;
    }
    return {amostras: mono, taxa: buffer.sampleRate};
};

const decodificarTodos = async (lista, taxa) => {
    const sons = [];
    for (const dados of lista) sons.push(await decodificarMono(dados, taxa));
    const tamanho = Math.max(...sons.map(x => x.amostras.length));
    if (sons.length === 1) return sons[0];
    // várias faixas (ex.: Inst.ogg + Voices.ogg do FNF): soma tudo numa só, sem estourar
    const mix = new Float32Array(tamanho);
    let pico = 0;
    for (const x of sons) {
        for (let i = 0; i < x.amostras.length; i++) mix[i] += x.amostras[i];
    }
    for (let i = 0; i < tamanho; i++) pico = Math.max(pico, Math.abs(mix[i]));
    if (pico > 1) for (let i = 0; i < tamanho; i++) mix[i] /= pico;
    return {amostras: mix, taxa: sons[0].taxa};
};

/**
 * Converte áudio (.ogg, .mp3, .wav…) em WAV mono. Com vários arquivos, mistura todos numa faixa só.
 * @param {ArrayBuffer|ArrayBuffer[]} dados conteúdo do(s) arquivo(s)
 * @returns {Promise<{wav: Uint8Array, taxa: number, amostras: number, reduzido: boolean, grande: boolean}>}
 */
export const audioParaWav = async dados => {
    const lista = Array.isArray(dados) ? dados : [dados];
    let som;
    try {
        som = await decodificarTodos(lista, TAXA_PADRAO);
    } catch (e) {
        throw new Error('Não foi possível ler este arquivo de áudio. ' +
            'Ele pode estar corrompido, ou este navegador não sabe abrir .ogg (use o Chrome, Edge ou Firefox).');
    }
    let reduzido = false;
    if (som.amostras.length * 2 > LIMITE_BYTES) {
        // Música longa: 22 kHz ainda soa bem e cabe no limite do editor de sons por quase 4 minutos.
        som = await decodificarTodos(lista, TAXA_REDUZIDA);
        reduzido = true;
    }
    const wav = await WavEncoder.encode({sampleRate: som.taxa, channelData: [som.amostras]});
    return {
        wav: new Uint8Array(wav),
        taxa: som.taxa,
        amostras: som.amostras.length,
        reduzido,
        grande: som.amostras.length * 2 > LIMITE_BYTES
    };
};

/** Converte um .ogg em WAV (veja audioParaWav). */
export const oggParaWav = dados => audioParaWav(dados);

/** Mostra um aviso rápido na tela do editor. */
export const avisar = texto => {
    window.dispatchEvent(new CustomEvent('adventiscratch-aviso', {detail: {texto}}));
};
