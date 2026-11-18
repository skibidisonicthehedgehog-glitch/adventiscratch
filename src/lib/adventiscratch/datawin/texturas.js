/**
 * Texturas do data.win: PNG, QOI do GameMaker ("fioq") e QOI comprimido com bzip2 ("2zoq").
 */
import {descomprimirBzip2} from './bzip2.js';

const assinatura = (d, p, s) => s.split('').every((c, i) => d[p + i] === c.charCodeAt(0));

/** Tamanho de um PNG a partir do início (percorre os blocos até o IEND). */
export const tamanhoPng = (d, p) => {
    let q = p + 8;
    for (;;) {
        if (q + 12 > d.length) return d.length - p;
        const len = ((d[q] << 24) | (d[q + 1] << 16) | (d[q + 2] << 8) | d[q + 3]) >>> 0;
        const tipo = String.fromCharCode(d[q + 4], d[q + 5], d[q + 6], d[q + 7]);
        q += 12 + len;
        if (tipo === 'IEND') return q - p;
    }
};

const sinal = (v, bits) => {
    const m = 1 << (bits - 1);
    return (v & (m - 1)) - (v & m);
};

/**
 * Decodifica o QOI do GameMaker (rascunho antigo do formato QOI).
 * @param {Uint8Array} d dados (começando no cabeçalho "fioq")
 * @returns {ImageData} imagem
 */
export const decodificarQoi = d => {
    const largura = d[4] | (d[5] << 8);
    const altura = d[6] | (d[7] << 8);
    const tam = (d[8] | (d[9] << 8) | (d[10] << 16) | (d[11] << 24)) >>> 0;
    const px = d.subarray(12, 12 + tam);
    const img = new ImageData(largura, altura);
    const out = img.data;
    const indice = new Uint8Array(64 * 4);
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 255;
    let pos = 0;
    let corrida = 0;
    for (let o = 0; o < out.length; o += 4) {
        if (corrida > 0) {
            corrida--;
        } else if (pos < px.length) {
            const b1 = px[pos++];
            if ((b1 & 0xc0) === 0x00) {
                const i = (b1 & 0x3f) << 2;
                r = indice[i];
                g = indice[i + 1];
                b = indice[i + 2];
                a = indice[i + 3];
            } else if ((b1 & 0xe0) === 0x40) {
                corrida = b1 & 0x1f;
            } else if ((b1 & 0xe0) === 0x60) {
                corrida = (((b1 & 0x1f) << 8) | px[pos++]) + 32;
            } else if ((b1 & 0xc0) === 0x80) {
                r = (r + sinal((b1 >> 4) & 3, 2)) & 0xff;
                g = (g + sinal((b1 >> 2) & 3, 2)) & 0xff;
                b = (b + sinal(b1 & 3, 2)) & 0xff;
            } else if ((b1 & 0xe0) === 0xc0) {
                const m = (b1 << 8) | px[pos++];
                r = (r + sinal((m >> 8) & 0x1f, 5)) & 0xff;
                g = (g + sinal((m >> 4) & 0xf, 4)) & 0xff;
                b = (b + sinal(m & 0xf, 4)) & 0xff;
            } else if ((b1 & 0xf0) === 0xe0) {
                const m = (b1 << 16) | (px[pos++] << 8) | px[pos++];
                r = (r + sinal((m >> 15) & 0x1f, 5)) & 0xff;
                g = (g + sinal((m >> 10) & 0x1f, 5)) & 0xff;
                b = (b + sinal((m >> 5) & 0x1f, 5)) & 0xff;
                a = (a + sinal(m & 0x1f, 5)) & 0xff;
            } else {
                if (b1 & 8) r = px[pos++];
                if (b1 & 4) g = px[pos++];
                if (b1 & 2) b = px[pos++];
                if (b1 & 1) a = px[pos++];
            }
            const i = ((r ^ g ^ b ^ a) & 63) << 2;
            indice[i] = r;
            indice[i + 1] = g;
            indice[i + 2] = b;
            indice[i + 3] = a;
        }
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = a;
    }
    return img;
};

/** Onde começa uma textura e de que tipo ela é. */
export const tipoDeTextura = (d, p) => {
    if (p < 0 || p + 8 > d.length) return null;
    if (d[p] === 0x89 && assinatura(d, p + 1, 'PNG')) return 'png';
    if (assinatura(d, p, '2zoq')) return 'bz2qoi';
    if (assinatura(d, p, 'fioq')) return 'qoi';
    return null;
};

const paraCanvas = img => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
};

/**
 * Carrega a textura que começa em p.
 * @param {Uint8Array} d arquivo inteiro
 * @param {number} p posição
 * @returns {Promise<CanvasImageSource>} imagem pronta para desenhar
 */
export const carregarTextura = async (d, p) => {
    const tipo = tipoDeTextura(d, p);
    if (tipo === 'png') {
        const bytes = d.slice(p, p + tamanhoPng(d, p));
        const blob = new Blob([bytes], {type: 'image/png'});
        if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        await img.decode();
        URL.revokeObjectURL(url);
        return img;
    }
    if (tipo === 'qoi') return paraCanvas(decodificarQoi(d.subarray(p)));
    if (tipo === 'bz2qoi') {
        // 2022.5+: tem o tamanho descomprimido antes do stream bzip2
        let ini = p + 8;
        let tamanho = 0;
        if (!assinatura(d, ini, 'BZh')) {
            tamanho = (d[ini] | (d[ini + 1] << 8) | (d[ini + 2] << 16) | (d[ini + 3] << 24)) >>> 0;
            ini += 4;
        }
        const qoi = descomprimirBzip2(d.subarray(ini), tamanho);
        return paraCanvas(decodificarQoi(qoi));
    }
    throw new Error('Formato de textura desconhecido');
};
