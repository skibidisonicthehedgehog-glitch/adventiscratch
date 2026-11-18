/**
 * Descompressor bzip2 (usado nas texturas "2zoq" do GameMaker 2022+).
 * Implementação direta do formato: blocos com Huffman + MTF + BWT + RLE.
 */

class LeitorDeBits {
    constructor (dados, inicio = 0) {
        this.d = dados;
        this.pos = inicio; // byte
        this.bit = 0; // bits já lidos do byte atual
    }

    ler (n) {
        let v = 0;
        while (n > 0) {
            if (this.pos >= this.d.length) throw new Error('bzip2: fim inesperado dos dados');
            const disponiveis = 8 - this.bit;
            const pega = Math.min(n, disponiveis);
            const byte = this.d[this.pos];
            const bits = (byte >> (disponiveis - pega)) & ((1 << pega) - 1);
            v = (v * (1 << pega)) + bits;
            this.bit += pega;
            n -= pega;
            if (this.bit === 8) {
                this.bit = 0;
                this.pos++;
            }
        }
        return v;
    }

    bit1 () {
        return this.ler(1);
    }
}

const MAX_GRUPOS = 6;
const MAX_CODIGO = 20;

const lerBloco = (br, tamBloco, saida) => {
    br.ler(32); // CRC do bloco (não conferimos)
    if (br.bit1()) throw new Error('bzip2: blocos "randomizados" não são suportados');
    const origPtr = br.ler(24);

    // mapa dos bytes usados
    const usados = [];
    const grupos16 = br.ler(16);
    for (let i = 0; i < 16; i++) {
        if (grupos16 & (0x8000 >> i)) {
            const m = br.ler(16);
            for (let j = 0; j < 16; j++) {
                if (m & (0x8000 >> j)) usados.push((i * 16) + j);
            }
        }
    }
    if (!usados.length) throw new Error('bzip2: bloco sem símbolos');
    const nSimbolos = usados.length + 2; // + RUNA/RUNB … + EOB
    const nGrupos = br.ler(3);
    if (nGrupos < 2 || nGrupos > MAX_GRUPOS) throw new Error('bzip2: número de tabelas inválido');
    const nSeletores = br.ler(15);
    if (!nSeletores) throw new Error('bzip2: sem seletores');

    // seletores (codificados com MTF em unário)
    const mtfGrupos = [];
    for (let i = 0; i < nGrupos; i++) mtfGrupos.push(i);
    const seletores = new Uint8Array(nSeletores);
    for (let i = 0; i < nSeletores; i++) {
        let j = 0;
        while (br.bit1()) {
            j++;
            if (j >= nGrupos) throw new Error('bzip2: seletor inválido');
        }
        const v = mtfGrupos[j];
        mtfGrupos.splice(j, 1);
        mtfGrupos.unshift(v);
        seletores[i] = v;
    }

    // tabelas de Huffman (comprimentos com codificação delta)
    const tabelas = [];
    for (let g = 0; g < nGrupos; g++) {
        const comp = new Uint8Array(nSimbolos);
        let c = br.ler(5);
        for (let s = 0; s < nSimbolos; s++) {
            for (;;) {
                if (c < 1 || c > MAX_CODIGO) throw new Error('bzip2: comprimento de código inválido');
                if (!br.bit1()) break;
                c += br.bit1() ? -1 : 1;
            }
            comp[s] = c;
        }
        // códigos canônicos: limite/base/permutação por comprimento
        let minL = MAX_CODIGO;
        let maxL = 0;
        for (const l of comp) {
            if (l < minL) minL = l;
            if (l > maxL) maxL = l;
        }
        const perm = [];
        for (let l = minL; l <= maxL; l++) {
            for (let s = 0; s < nSimbolos; s++) if (comp[s] === l) perm.push(s);
        }
        const limite = new Int32Array(MAX_CODIGO + 2);
        const base = new Int32Array(MAX_CODIGO + 2);
        let codigo = 0;
        let k = 0;
        for (let l = minL; l <= maxL; l++) {
            let qtd = 0;
            for (let s = 0; s < nSimbolos; s++) if (comp[s] === l) qtd++;
            base[l] = k - codigo; // índice em perm = codigo + base
            codigo += qtd;
            k += qtd;
            limite[l] = codigo - 1;
            codigo <<= 1;
        }
        tabelas.push({minL, maxL, limite, base, perm});
    }

    // decodificação Huffman + RUNA/RUNB + MTF
    const mtf = usados.slice();
    const contagem = new Int32Array(256);
    const tt = new Uint32Array(tamBloco);
    let n = 0;
    let seletor = 0;
    let restantes = 0;
    let tab = null;
    let corrida = 0;
    let pesoCorrida = 1;
    const EOB = nSimbolos - 1;
    const despejarCorrida = () => {
        if (!corrida) return;
        const b = mtf[0];
        if (n + corrida > tamBloco) throw new Error('bzip2: bloco maior que o permitido');
        contagem[b] += corrida;
        for (let i = 0; i < corrida; i++) tt[n++] = b;
        corrida = 0;
        pesoCorrida = 1;
    };
    for (;;) {
        if (!restantes) {
            if (seletor >= nSeletores) throw new Error('bzip2: seletores acabaram');
            tab = tabelas[seletores[seletor++]];
            restantes = 50;
        }
        restantes--;
        let l = tab.minL;
        let v = br.ler(l);
        while (v > tab.limite[l]) {
            l++;
            if (l > tab.maxL) throw new Error('bzip2: código de Huffman inválido');
            v = (v << 1) | br.bit1();
        }
        const sym = tab.perm[v + tab.base[l]];
        if (sym <= 1) { // RUNA = 0, RUNB = 1
            corrida += pesoCorrida * (sym + 1);
            pesoCorrida <<= 1;
            continue;
        }
        despejarCorrida();
        if (sym === EOB) break;
        const idx = sym - 1;
        const b = mtf[idx];
        mtf.splice(idx, 1);
        mtf.unshift(b);
        if (n >= tamBloco) throw new Error('bzip2: bloco maior que o permitido');
        contagem[b]++;
        tt[n++] = b;
    }
    if (origPtr >= n) throw new Error('bzip2: ponteiro de origem inválido');

    // BWT inverso
    const inicio = new Int32Array(256);
    for (let i = 0, soma = 0; i < 256; i++) {
        inicio[i] = soma;
        soma += contagem[i];
    }
    for (let i = 0; i < n; i++) {
        const b = tt[i] & 0xff;
        tt[inicio[b]] |= (i << 8);
        inicio[b]++;
    }
    // percorre e desfaz o RLE inicial (4 bytes iguais + contagem)
    let p = tt[origPtr] >>> 8;
    let ultimo = -1;
    let repetidos = 0;
    for (let i = 0; i < n; i++) {
        const e = tt[p];
        const b = e & 0xff;
        p = e >>> 8;
        if (repetidos === 4) {
            for (let r = 0; r < b; r++) saida.push(ultimo);
            repetidos = 0;
            ultimo = -1;
            continue;
        }
        if (b === ultimo) {
            repetidos++;
        } else {
            repetidos = 1;
            ultimo = b;
        }
        saida.push(b);
    }
};

class SaidaCrescente {
    constructor (tamanho) {
        this.buf = new Uint8Array(Math.max(1024, tamanho || 0));
        this.n = 0;
    }

    push (b) {
        if (this.n >= this.buf.length) {
            const novo = new Uint8Array(this.buf.length * 2);
            novo.set(this.buf);
            this.buf = novo;
        }
        this.buf[this.n++] = b;
    }

    resultado () {
        return this.buf.subarray(0, this.n);
    }
}

/**
 * @param {Uint8Array} dados stream bzip2 completo (começa com "BZh")
 * @param {number} [tamanhoEsperado] tamanho descomprimido, se souber
 * @returns {Uint8Array} dados descomprimidos
 */
export const descomprimirBzip2 = (dados, tamanhoEsperado) => {
    if (dados[0] !== 0x42 || dados[1] !== 0x5a || dados[2] !== 0x68) throw new Error('bzip2: cabeçalho inválido');
    const nivel = dados[3] - 0x30;
    if (nivel < 1 || nivel > 9) throw new Error('bzip2: nível inválido');
    const tamBloco = nivel * 100000;
    const br = new LeitorDeBits(dados, 4);
    const saida = new SaidaCrescente(tamanhoEsperado);
    for (;;) {
        const m1 = br.ler(24);
        const m2 = br.ler(24);
        if (m1 === 0x314159 && m2 === 0x265359) {
            lerBloco(br, tamBloco, saida);
        } else if (m1 === 0x177245 && m2 === 0x385090) {
            break; // fim do stream
        } else {
            throw new Error('bzip2: assinatura de bloco inválida');
        }
    }
    return saida.resultado();
};
