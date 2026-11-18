/**
 * Lê mapas do Tiled (https://www.mapeditor.org): .tmj/.json e .tmx, com tilesets embutidos ou em .tsx/.tsj.
 *
 * Devolve um mapa "cru" com os gids do Tiled; quem chama corta as imagens dos tilesets e troca os gids pelos
 * números das fantasias. Camadas de tiles com dados em CSV, lista JSON ou base64 (sem compressão, zlib ou gzip).
 */

const FLAGS = 0x1FFFFFFF; // os 3 bits de cima do gid são espelhamentos (ignorados)

const base64ParaBytes = texto => {
    const bin = atob(String(texto).trim());
    const r = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) r[i] = bin.charCodeAt(i);
    return r;
};

const descomprimir = async (bytes, formato) => {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Este navegador não abre mapas comprimidos. No Tiled, salve a camada como CSV.');
    }
    const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(formato));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
};

const lerDados = async (dados, codificacao, compressao, n) => {
    let gids;
    if (Array.isArray(dados)) {
        gids = dados.map(Number);
    } else if (codificacao === 'base64') {
        let bytes = base64ParaBytes(dados);
        if (compressao === 'zlib') bytes = await descomprimir(bytes, 'deflate');
        else if (compressao === 'gzip') bytes = await descomprimir(bytes, 'gzip');
        else if (compressao) throw new Error(`Compressão "${compressao}" não suportada. No Tiled, use CSV.`);
        const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        gids = [];
        for (let i = 0; i + 3 < bytes.length; i += 4) gids.push(v.getUint32(i, true));
    } else {
        gids = String(dados).split(',')
            .map(s => Number(s.trim()) || 0);
    }
    const r = new Array(n).fill(0);
    for (let i = 0; i < n && i < gids.length; i++) r[i] = (gids[i] >>> 0) & FLAGS;
    return r;
};

/** Tipo do tile no Adventiblocks a partir das propriedades do Tiled. */
const tipoDasPropriedades = (classe, props) => {
    const p = {};
    (props || []).forEach(x => {
        p[String(x.name).toLowerCase()] = x.value;
    });
    const texto = p.tipo || p.type || p.class || classe;
    if (texto) return String(texto).toLowerCase();
    const sim = v => v === true || v === 'true' || v === 1 || v === '1';
    if (sim(p.solido) || sim(p.solid) || sim(p.collides) || sim(p.collision) || sim(p.colisao)) return 'solido';
    if (sim(p.plataforma) || sim(p.platform) || sim(p.oneway)) return 'plataforma';
    if (sim(p.perigo) || sim(p.hazard) || sim(p.damage)) return 'perigo';
    return null;
};

const atributos = el => {
    const r = {};
    if (!el) return r;
    for (const a of Array.from(el.attributes)) r[a.name] = a.value;
    return r;
};

const propsXml = el => Array.from(el ? el.querySelectorAll(':scope > properties > property') : [])
    .map(p => ({name: p.getAttribute('name'), value: p.getAttribute('value') !== null ?
        p.getAttribute('value') : p.textContent}));

/** Tileset no formato interno, a partir do XML (<tileset> do .tmx ou do .tsx). */
const tilesetXml = (el, firstgid, origem) => {
    const a = atributos(el);
    const imagem = el.querySelector(':scope > image');
    const tipos = {};
    const imagensTiles = {};
    for (const t of Array.from(el.querySelectorAll(':scope > tile'))) {
        const id = Number(t.getAttribute('id'));
        const tipo = tipoDasPropriedades(t.getAttribute('type') || t.getAttribute('class'), propsXml(t));
        if (tipo) tipos[id] = tipo;
        const img = t.querySelector(':scope > image');
        if (img) imagensTiles[id] = img.getAttribute('source');
    }
    return {
        firstgid, nome: a.name || origem || 'tileset', imagem: imagem ? imagem.getAttribute('source') : null,
        tilewidth: Number(a.tilewidth) || 0, tileheight: Number(a.tileheight) || 0,
        margin: Number(a.margin) || 0, spacing: Number(a.spacing) || 0,
        columns: Number(a.columns) || 0, tilecount: Number(a.tilecount) || 0, tipos, imagensTiles
    };
};

const tilesetJson = (t, firstgid, origem) => {
    const tipos = {};
    const imagensTiles = {};
    for (const tile of t.tiles || []) {
        const tipo = tipoDasPropriedades(tile.type || tile.class, tile.properties);
        if (tipo) tipos[tile.id] = tipo;
        if (tile.image) imagensTiles[tile.id] = tile.image;
    }
    return {
        firstgid, nome: t.name || origem || 'tileset', imagem: t.image || null,
        tilewidth: Number(t.tilewidth) || 0, tileheight: Number(t.tileheight) || 0,
        margin: Number(t.margin) || 0, spacing: Number(t.spacing) || 0,
        columns: Number(t.columns) || 0, tilecount: Number(t.tilecount) || 0, tipos, imagensTiles
    };
};

const nomeBase = caminho => String(caminho || '').split(/[\\/]/)
    .pop()
    .toLowerCase();

/**
 * Lê o mapa.
 * @param {File} arquivo .tmj/.json/.tmx
 * @param {Map<string, File>} outros outros arquivos escolhidos (pelo nome em minúsculas): .tsx/.tsj e imagens
 * @returns {Promise<object>} {colunas, linhas, tilewidth, tileheight, camadas: [{nome, gids}], tilesets}
 */
export const lerMapaTiled = async (arquivo, outros) => {
    const texto = await arquivo.text();
    const ehXml = texto.trim().startsWith('<');
    const tilesets = [];
    const camadas = [];
    let colunas;
    let linhas;
    let tilewidth;
    let tileheight;
    const externo = async (fonte, firstgid) => {
        const f = outros.get(nomeBase(fonte));
        if (!f) throw new Error(`Faltou o tileset "${nomeBase(fonte)}": escolha ele junto com o mapa.`);
        const t = await f.text();
        if (t.trim().startsWith('<')) {
            const doc = new DOMParser().parseFromString(t, 'application/xml');
            return tilesetXml(doc.querySelector('tileset'), firstgid, nomeBase(fonte));
        }
        return tilesetJson(JSON.parse(t), firstgid, nomeBase(fonte));
    };

    if (ehXml) {
        const doc = new DOMParser().parseFromString(texto, 'application/xml');
        const mapa = doc.querySelector('map');
        if (!mapa) throw new Error('Este .tmx não parece um mapa do Tiled.');
        if (mapa.getAttribute('infinite') === '1') {
            throw new Error('Mapas "infinitos" do Tiled não são suportados: desmarque "Infinito" no mapa.');
        }
        colunas = Number(mapa.getAttribute('width'));
        linhas = Number(mapa.getAttribute('height'));
        tilewidth = Number(mapa.getAttribute('tilewidth'));
        tileheight = Number(mapa.getAttribute('tileheight'));
        for (const ts of Array.from(mapa.querySelectorAll(':scope > tileset'))) {
            const firstgid = Number(ts.getAttribute('firstgid')) || 1;
            tilesets.push(ts.getAttribute('source') ? await externo(ts.getAttribute('source'), firstgid) :
                tilesetXml(ts, firstgid));
        }
        // camadas (inclusive dentro de grupos), na ordem de desenho
        for (const camada of Array.from(mapa.querySelectorAll('layer'))) {
            const dados = camada.querySelector('data');
            if (!dados) continue;
            if (dados.querySelector('chunk')) throw new Error('Mapas "infinitos" do Tiled não são suportados.');
            let valores;
            const tiles = Array.from(dados.querySelectorAll('tile'));
            if (!dados.getAttribute('encoding') && tiles.length) {
                valores = tiles.map(t => Number(t.getAttribute('gid')) || 0);
            } else {
                valores = dados.textContent;
            }
            camadas.push({
                nome: camada.getAttribute('name') || 'camada',
                visivel: camada.getAttribute('visible') !== '0',
                gids: await lerDados(valores, dados.getAttribute('encoding'), dados.getAttribute('compression'),
                    colunas * linhas)
            });
        }
    } else {
        let j;
        try {
            j = JSON.parse(texto);
        } catch (e) {
            throw new Error('Não deu para ler este arquivo. Use um mapa do Tiled (.tmj, .json ou .tmx).');
        }
        if (!j || !Array.isArray(j.layers)) throw new Error('Este .json não parece um mapa do Tiled.');
        if (j.infinite) throw new Error('Mapas "infinitos" do Tiled não são suportados: desmarque "Infinito".');
        colunas = Number(j.width);
        linhas = Number(j.height);
        tilewidth = Number(j.tilewidth);
        tileheight = Number(j.tileheight);
        for (const ts of j.tilesets || []) {
            const firstgid = Number(ts.firstgid) || 1;
            tilesets.push(ts.source ? await externo(ts.source, firstgid) : tilesetJson(ts, firstgid));
        }
        const percorrer = async lista => {
            for (const camada of lista || []) {
                if (camada.type === 'group') {
                    await percorrer(camada.layers);
                } else if (camada.type === 'tilelayer' && camada.data !== undefined) { // eslint-disable-line no-undefined
                    camadas.push({
                        nome: camada.name || 'camada', visivel: camada.visible !== false,
                        gids: await lerDados(camada.data, camada.encoding, camada.compression, colunas * linhas)
                    });
                }
            }
        };
        await percorrer(j.layers);
    }
    if (!colunas || !linhas || !tilewidth) throw new Error('O mapa não tem tamanho (largura, altura ou tile).');
    if (!camadas.length) throw new Error('O mapa não tem camadas de tiles.');
    tilesets.sort((a, b) => a.firstgid - b.firstgid);
    return {colunas, linhas, tilewidth, tileheight: tileheight || tilewidth, camadas, tilesets};
};

/** É camada de enfeite (vai para o "fundo")? */
export const ehCamadaDeFundo = nome => /^(fundo|background|bg|back|decor|decora|enfeite|parallax|ceu|céu|sky)/i
    .test(String(nome).trim());

/** É camada de colisão (tudo nela vira sólido)? */
export const ehCamadaDeColisao = nome => /(colis|collision|collide|solid|sólid)/i.test(String(nome));

export {nomeBase};
