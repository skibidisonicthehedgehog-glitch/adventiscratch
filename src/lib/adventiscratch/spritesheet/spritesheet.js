/**
 * Leitura de spritesheets (folhas de sprites) para virar fantasias do Scratch.
 *
 * Formatos:
 *  - XML "Sparrow" / Starling (o do Friday Night Funkin'): <TextureAtlas><SubTexture name x y width height
 *    frameX frameY frameWidth frameHeight rotated/></TextureAtlas>
 *  - JSON do TexturePacker (hash ou array): {frames: {nome: {frame:{x,y,w,h}, rotated, spriteSourceSize, sourceSize}}}
 *  - Grade simples: colunas × linhas do mesmo tamanho (sem arquivo de mapa)
 *
 * Cada quadro vira {nome, animacao, numero, x, y, aw, ah, rotacionado, fx, fy, fw, fh}:
 *   (x, y, aw, ah) = região ocupada na imagem; se "rotacionado", a região está girada e é desvirada girando −90°
 *   (como faz o Flixel, motor do FNF); (fx, fy) = onde o pedaço fica dentro do quadro inteiro (fw × fh).
 */

/** "BF idle dance0013" -> {animacao: "BF idle dance", numero: 13} */
export const separarNome = nome => {
    const m = /^(.*?)(\d+)$/.exec(String(nome).replace(/\.(png|webp|jpg)$/i, ''));
    if (!m) return {animacao: String(nome).trim(), numero: 0};
    return {animacao: m[1].replace(/[\s_-]+$/, '').trim() || m[1].trim() || 'animação', numero: Number(m[2])};
};

const num = (v, padrao = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : padrao;
};

/**
 * Lê o XML Sparrow/Starling.
 * @param {string} texto conteúdo do .xml
 * @returns {Array<object>} quadros
 */
export const lerSparrowXML = texto => {
    const doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('O arquivo .xml está com erro de formato.');
    const subs = Array.from(doc.getElementsByTagName('SubTexture'));
    if (!subs.length) throw new Error('Esse .xml não tem quadros (<SubTexture>). É mesmo uma spritesheet?');
    return subs.map(s => {
        const a = n => s.getAttribute(n);
        // no Sparrow, width/height são da região na imagem; girada, o pedaço desvirado fica height × width
        const aw = num(a('width'));
        const ah = num(a('height'));
        const rot = a('rotated') === 'true';
        const fw = a('frameWidth') !== null ? num(a('frameWidth'), aw) : (rot ? ah : aw);
        const fh = a('frameHeight') !== null ? num(a('frameHeight'), ah) : (rot ? aw : ah);
        const nome = a('name') || 'quadro';
        return {nome, ...separarNome(nome), x: num(a('x')), y: num(a('y')), aw, ah, rotacionado: rot,
            fx: -num(a('frameX')), fy: -num(a('frameY')), fw: Math.max(1, fw), fh: Math.max(1, fh)};
    });
};

/**
 * Lê o JSON do TexturePacker (formato hash ou array).
 * @param {string} texto conteúdo do .json
 * @returns {Array<object>} quadros
 */
export const lerTexturePackerJSON = texto => {
    let dados;
    try {
        dados = JSON.parse(texto);
    } catch (e) {
        throw new Error('O arquivo .json está com erro de formato.');
    }
    let lista = dados && dados.frames;
    if (!lista) throw new Error('Esse .json não tem "frames". Use o JSON do TexturePacker (hash ou array).');
    if (!Array.isArray(lista)) lista = Object.keys(lista).map(k => ({filename: k, ...lista[k]}));
    return lista.map(f => {
        const fr = f.frame || {};
        const rot = Boolean(f.rotated);
        const sss = f.spriteSourceSize || {x: 0, y: 0};
        const ss = f.sourceSize || {w: rot ? fr.h : fr.w, h: rot ? fr.w : fr.h};
        // no TexturePacker, frame.w/h é o tamanho do pedaço desvirado; girado, ele ocupa h × w na imagem
        const aw = rot ? num(fr.h) : num(fr.w);
        const ah = rot ? num(fr.w) : num(fr.h);
        const nome = f.filename || f.name || 'quadro';
        return {nome, ...separarNome(nome), x: num(fr.x), y: num(fr.y), aw, ah, rotacionado: rot,
            fx: num(sss.x), fy: num(sss.y), fw: Math.max(1, num(ss.w, num(fr.w))), fh: Math.max(1, num(ss.h, num(fr.h)))};
    });
};

/**
 * Grade simples: divide a imagem em colunas × linhas.
 * @param {number} largura largura da imagem
 * @param {number} altura altura da imagem
 * @param {number} colunas colunas
 * @param {number} linhas linhas
 * @param {string} nome nome da animação
 * @param {number} [total] quantos quadros usar (o resto da grade fica vazio)
 * @returns {Array<object>} quadros
 */
export const quadrosEmGrade = (largura, altura, colunas, linhas, nome, total) => {
    const c = Math.max(1, Math.round(colunas));
    const l = Math.max(1, Math.round(linhas));
    const w = Math.floor(largura / c);
    const h = Math.floor(altura / l);
    const qtd = Math.min(c * l, total > 0 ? total : c * l);
    const quadros = [];
    for (let i = 0; i < qtd; i++) {
        const numero = i;
        quadros.push({nome: `${nome}${String(numero).padStart(4, '0')}`, animacao: nome, numero,
            x: (i % c) * w, y: Math.floor(i / c) * h, aw: w, ah: h, rotacionado: false, fx: 0, fy: 0, fw: w, fh: h});
    }
    return quadros;
};

/** Agrupa os quadros por animação, na ordem dos números. */
export const agruparAnimacoes = quadros => {
    const mapa = new Map();
    for (const q of quadros) {
        if (!mapa.has(q.animacao)) mapa.set(q.animacao, []);
        mapa.get(q.animacao).push(q);
    }
    const lista = [];
    mapa.forEach((qs, nome) => lista.push({nome, quadros: qs.sort((a, b) => a.numero - b.numero)}));
    return lista;
};

/**
 * Desenha um quadro inteiro (com o espaço vazio em volta) num canvas.
 * @param {HTMLImageElement|ImageBitmap} img imagem da folha
 * @param {object} q quadro
 * @param {number} escala 1 = tamanho original
 * @returns {HTMLCanvasElement} canvas do quadro
 */
export const desenharQuadro = (img, q, escala = 1) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(q.fw * escala));
    c.height = Math.max(1, Math.round(q.fh * escala));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.scale(escala, escala);
    g.translate(q.fx, q.fy);
    if (q.rotacionado) {
        // desvira girando −90°: a região aw × ah vira um pedaço ah × aw
        g.translate(0, q.aw);
        g.rotate(-Math.PI / 2);
    }
    g.drawImage(img, q.x, q.y, q.aw, q.ah, 0, 0, q.aw, q.ah);
    return c;
};

export const carregarImagem = arquivo => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Não deu para abrir a imagem. Use .png (ou .jpg/.webp).'));
    };
    img.src = url;
});

export const canvasParaPng = c => new Promise(resolve => c.toBlob(b => b.arrayBuffer().then(buf =>
    resolve(new Uint8Array(buf))), 'image/png'));
