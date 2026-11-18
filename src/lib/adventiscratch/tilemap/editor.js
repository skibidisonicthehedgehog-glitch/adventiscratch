/**
 * Editor de tilemaps: desenhe fases com tiles (blocos) numa grade.
 *
 *  - Paleta: as fantasias do ator escolhido como tileset (tile 1 = 1ª fantasia…). "Criar tileset de uma imagem"
 *    corta uma imagem (ex.: um tileset de pixel art) em tiles e cria esse ator.
 *  - Ferramentas: lápis (P), borracha (E), balde (B), retângulo (R) e conta-gotas (I ou Alt + clique).
 *  - Camadas: "principal" (colide, tem tipo) e "fundo" (só enfeite, fica atrás).
 *  - Tipo de cada tile: sólido, plataforma, perigo, moeda… (os blocos e a Plataforma 2D usam isso).
 *  - Navegar: rodinha do mouse (Shift = para os lados), Ctrl + rodinha = zoom, botão direito/do meio = arrastar.
 *  - Importar: mapas do Tiled (.tmj/.json/.tmx + .tsx + imagens dos tilesets).
 */
import JSZip from 'jszip';
import {
    CAMADAS, NOMES_TIPOS, TIPOS_PADRAO, apagarTilemap, avisarTilemaps, centroDe, definirAtivo, escreverTile,
    gravarTilemap, lerTile, nomeAtivo, nomeLivre, normalizarTilemap, obterTilemap, redimensionar, tilemapVazio,
    todosTilemaps
} from './dados.js';
import {ehCamadaDeColisao, ehCamadaDeFundo, lerMapaTiled, nomeBase} from './importar-tiled.js';
import {TILESET_PRONTO} from './tileset-pronto.js';

const CORES_TIPO = {
    solido: '#E53935', plataforma: '#FB8C00', perigo: '#C2185B', moeda: '#FDD835', escada: '#8D6E63',
    agua: '#1E88E5', inicio: '#43A047', fim: '#00ACC1'
};
const corDoTipo = t => CORES_TIPO[t] || '#9E9E9E';
const MAX_TILES_TILESET = 2000;

const CSS = `
.adv-tm{position:fixed;inset:0;z-index:15000;background:#17112E;color:#fff;display:flex;flex-direction:column;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px}
.adv-tm-topo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(90deg,#B5651D,#6D4FC2)}
.adv-tm-topo h2{margin:0 8px 0 0;font-size:19px}
.adv-tm button{font:inherit;font-weight:700;border:0;border-radius:9px;padding:7px 12px;cursor:pointer;background:rgba(255,255,255,.18);color:#fff}
.adv-tm button:hover{background:rgba(255,255,255,.3)}
.adv-tm button:disabled{opacity:.35;cursor:default}
.adv-tm button.prim{background:#5BBF4A}
.adv-tm button.ativo{background:#FFC928;color:#1B1338}
.adv-tm .esp{flex:1}
.adv-tm input,.adv-tm select{font:inherit;border:0;border-radius:8px;padding:5px 7px;background:#fff;color:#1B1338;min-width:0}
.adv-tm input[type=number]{width:74px}
.adv-tm label.chk{display:flex;gap:6px;align-items:center;font-size:13.5px;white-space:nowrap}
.adv-tm-corpo{flex:1;display:grid;grid-template-columns:290px 1fr;min-height:0}
.adv-tm-lado{background:#221A45;padding:12px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.adv-tm-lado h3{margin:6px 0 2px;font-size:15px;color:#E3DAFF}
.adv-tm-lado p{margin:0;font-size:12.5px;color:#CFC4F5;line-height:1.4}
.adv-tm .paleta{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:4px;background:#160F30;border-radius:10px;
  padding:6px;max-height:300px;overflow:auto}
.adv-tm .paleta .t{position:relative;aspect-ratio:1;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  background:repeating-conic-gradient(#3a3166 0 25%,#2c2456 0 50%) 0 0/10px 10px;border:2px solid transparent;overflow:hidden}
.adv-tm .paleta .t img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.adv-tm .paleta .t.sel{border-color:#FFC928;box-shadow:0 0 0 2px #FFC928}
.adv-tm .paleta .t small{position:absolute;right:2px;bottom:1px;font-size:9px;font-weight:700;background:rgba(0,0,0,.55);border-radius:4px;padding:0 2px}
.adv-tm .paleta .t i{position:absolute;left:2px;top:2px;width:8px;height:8px;border-radius:50%;border:1px solid #fff}
.adv-tm .grade2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.adv-tm label.campo{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:#CFC4F5}
.adv-tm .tipo-linha{display:flex;gap:6px;align-items:center}
.adv-tm .tipo-linha select{flex:1}
.adv-tm-meio{display:flex;flex-direction:column;min-width:0;min-height:0}
.adv-tm-ferr{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;background:#1E1640;border-bottom:1px solid #2E2560}
.adv-tm-ferr button{padding:6px 10px}
.adv-tm-area{flex:1;position:relative;min-height:0;overflow:hidden;background:#0E0A20}
.adv-tm-area canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
.adv-tm-status{padding:5px 12px;font-size:12.5px;color:#CFC4F5;background:#1E1640;display:flex;gap:16px}
.adv-tm .aviso{background:rgba(255,201,40,.15);border:1px solid #FFC928;border-radius:8px;padding:6px 8px;font-size:12.5px}
.adv-tm .msg{position:absolute;left:50%;top:16px;transform:translateX(-50%);background:#FFC928;color:#1B1338;font-weight:700;
  padding:8px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.4);max-width:80%;text-align:center;pointer-events:none}
.adv-tm .janela{position:fixed;inset:0;z-index:15001;background:rgba(10,6,25,.7);display:flex;align-items:center;justify-content:center}
.adv-tm .janela>div{background:#221A45;border-radius:16px;padding:16px;width:min(560px,94vw);display:flex;flex-direction:column;gap:10px;
  box-shadow:0 20px 60px rgba(0,0,0,.5)}
.adv-tm .janela h3{margin:0}
.adv-tm .janela canvas{max-width:100%;max-height:260px;background:repeating-conic-gradient(#3a3166 0 25%,#2c2456 0 50%) 0 0/12px 12px;
  border-radius:8px;image-rendering:pixelated;align-self:center}
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const num = (v, p = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : p;
};
const carregarImagem = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
});
const imagemDeArquivo = async arquivo => {
    const url = URL.createObjectURL(arquivo);
    const img = await carregarImagem(url);
    if (!img) throw new Error(`Não deu para abrir a imagem "${arquivo.name}".`);
    return img;
};
const canvasParaPng = c => new Promise(resolve => c.toBlob(b => b.arrayBuffer().then(buf =>
    resolve(new Uint8Array(buf))), 'image/png'));

const TIPOS_TILED = {
    solid: 'solido', solido: 'solido', ground: 'solido', wall: 'solido', block: 'solido', platform: 'plataforma',
    plataforma: 'plataforma', oneway: 'plataforma', hazard: 'perigo', danger: 'perigo', spike: 'perigo',
    spikes: 'perigo', perigo: 'perigo', lava: 'perigo', coin: 'moeda', moeda: 'moeda', ladder: 'escada',
    escada: 'escada', water: 'agua', agua: 'agua', 'água': 'agua', spawn: 'inicio', start: 'inicio',
    player: 'inicio', inicio: 'inicio', 'início': 'inicio', goal: 'fim', end: 'fim', exit: 'fim', fim: 'fim'
};

/**
 * Cria um ator (escondido) com uma fantasia por tile.
 * @param {VirtualMachine} vm VM
 * @param {string} nome nome do ator
 * @param {Array<{canvas: HTMLCanvasElement, nome: string}>} tiles canvas com o dobro do tamanho no palco
 * @returns {Promise<string>} nome final do ator
 */
export const criarAtorTileset = async (vm, nome, tiles) => {
    const storage = vm.runtime.storage;
    const zip = new JSZip();
    const costumes = [];
    const ja = new Set();
    for (const t of tiles) {
        const png = await canvasParaPng(t.canvas);
        const asset = storage.createAsset(storage.AssetType.ImageBitmap, storage.DataFormat.PNG, png, null, true);
        const md5ext = `${asset.assetId}.png`;
        if (!ja.has(md5ext)) {
            ja.add(md5ext);
            zip.file(md5ext, png);
        }
        costumes.push({
            name: t.nome, bitmapResolution: 2, dataFormat: 'png', assetId: asset.assetId, md5ext,
            rotationCenterX: Math.round(t.canvas.width / 2), rotationCenterY: Math.round(t.canvas.height / 2)
        });
    }
    zip.file('sprite.json', JSON.stringify({
        isStage: false, name: nome, variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
        currentCostume: 0, sounds: [], volume: 100, visible: false, x: 0, y: 0, size: 100, direction: 90,
        draggable: false, rotationStyle: 'all around', costumes
    }));
    await vm.addSprite(await zip.generateAsync({type: 'arraybuffer'}));
    const novo = vm.editingTarget;
    return novo && !novo.isStage ? novo.getName() : nome;
};

/** Desenha um pedaço da imagem num canvas de lado "lado" px (sem suavizar: pixel art fica nítida). */
const recortar = (img, sx, sy, sw, sh, lado) => {
    const c = document.createElement('canvas');
    c.width = lado;
    c.height = lado;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, sx, sy, sw, sh, 0, 0, lado, lado);
    return c;
};

const ehTransparente = c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return false;
    return true;
};

/**
 * Abre o editor.
 * @param {VirtualMachine} vm VM do Scratch
 */
export const abrirEditorTilemap = vm => {
    if (document.querySelector('.adv-tm')) return;
    if (!document.getElementById('adv-tm-css')) {
        const st = document.createElement('style');
        st.id = 'adv-tm-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const runtime = vm.runtime;
    const raiz = document.createElement('div');
    raiz.className = 'adv-tm';
    raiz.innerHTML = `
<div class="adv-tm-topo">
  <h2>🧱 Editor de tilemaps</h2>
  <select class="mapa" title="Tilemap"></select>
  <input class="nome" title="Nome do tilemap" style="width:150px">
  <button class="novo">➕ Novo</button>
  <button class="duplicar">📄 Duplicar</button>
  <button class="apagar">🗑 Apagar</button>
  <button class="importar" title="Mapas do Tiled: escolha o .tmj/.tmx junto com as imagens (e .tsx) dos tilesets">📥 Importar do Tiled…</button>
  <input type="file" class="arquivos" hidden multiple accept=".tmj,.json,.tmx,.tsx,.tsj,.png,.jpg,.jpeg,.gif,.webp,.bmp">
  <span class="esp"></span>
  <label class="chk"><input type="checkbox" class="noPalco"> mostrar no palco</label>
  <button class="prim fechar">✔ Pronto</button>
</div>
<div class="adv-tm-corpo">
  <aside class="adv-tm-lado">
    <h3>Tileset</h3>
    <p>As fantasias deste ator são os tiles (a 1ª fantasia é o tile 1).</p>
    <select class="tileset"></select>
    <button class="criarTileset">🖼 Criar tileset de uma imagem…</button>
    <button class="tilesetPronto" title="Grama, terra, tijolo, madeira, moeda, espinhos, bandeira, nuvem, arbusto, início, inimigo e pedra">🎁 Usar tileset pronto</button>
    <input type="file" class="arqTileset" hidden accept="image/*">
    <div class="paleta"></div>
    <h3 class="tituloTile">Tile</h3>
    <div class="tipo-linha"><span>Tipo:</span><select class="tipo"></select></div>
    <input class="tipoOutro" placeholder="nome do tipo (ex.: gelo)" hidden>
    <p class="dicaTipo"></p>
    <h3>Mapa</h3>
    <div class="grade2">
      <label class="campo">Colunas <input type="number" class="colunas" min="1" max="1000"></label>
      <label class="campo">Linhas <input type="number" class="linhas" min="1" max="1000"></label>
      <label class="campo">Tamanho do tile (px) <input type="number" class="tamanho" min="2" max="512"></label>
      <span></span>
      <label class="campo">x do canto <input type="number" class="mx"></label>
      <label class="campo">y do canto <input type="number" class="my"></label>
    </div>
    <button class="aplicar">Aplicar tamanho e posição</button>
    <p>O canto de cima à esquerda do mapa fica em (x, y) do palco. O retângulo tracejado mostra o palco.
      Para fases maiores que o palco, use a extensão <b>Câmera</b>.</p>
  </aside>
  <section class="adv-tm-meio">
    <div class="adv-tm-ferr">
      <button data-f="lapis" title="Lápis (P)">✏️ Lápis</button>
      <button data-f="borracha" title="Borracha (E)">🧽 Borracha</button>
      <button data-f="balde" title="Balde (B)">🪣 Balde</button>
      <button data-f="retangulo" title="Retângulo (R)">▭ Retângulo</button>
      <button data-f="gotas" title="Conta-gotas (I ou Alt + clique)">💧 Pegar</button>
      <select class="camada" title="Camada"><option value="principal">camada principal</option><option value="fundo">camada de fundo</option></select>
      <label class="chk"><input type="checkbox" class="verTipos" checked> ver tipos</label>
      <label class="chk"><input type="checkbox" class="verGrade" checked> grade</label>
      <span class="esp"></span>
      <button class="zoomMenos" title="Diminuir (Ctrl + rodinha)">−</button>
      <span class="zoomTxt">100%</span>
      <button class="zoomMais" title="Aumentar (Ctrl + rodinha)">+</button>
      <button class="desfazer" title="Desfazer (Ctrl+Z)">↶</button>
      <button class="refazer" title="Refazer (Ctrl+Y)">↷</button>
    </div>
    <div class="adv-tm-area"><canvas></canvas></div>
    <div class="adv-tm-status"><span class="st1"></span><span class="st2"></span><span class="esp"></span>
      <span>rodinha: rolar · Ctrl+rodinha: zoom · botão direito: arrastar · Alt+clique: pegar tile</span></div>
  </section>
</div>`;
    document.body.appendChild(raiz);
    const $ = s => raiz.querySelector(s);
    const canvas = $('.adv-tm-area canvas');
    const g = canvas.getContext('2d');

    const est = {
        mapa: null, tile: 1, ferramenta: 'lapis', camada: 'principal', zoom: 1, ox: -16, oy: -16,
        desfazer: [], refazer: [], mouse: null, arrasto: null, imagens: new Map(), fantasias: []
    };

    let msgTimer = null;
    const aviso = texto => {
        let m = raiz.querySelector('.msg');
        if (!m) {
            m = document.createElement('div');
            m.className = 'msg';
            $('.adv-tm-area').appendChild(m);
        }
        m.textContent = texto;
        m.hidden = false;
        clearTimeout(msgTimer);
        msgTimer = setTimeout(() => {
            m.hidden = true;
        }, 4500);
    };

    // ---------------------------------------------------------------- tileset
    const atores = () => runtime.targets.filter(t => t.isOriginal && !t.isStage);
    const atorTileset = () => (est.mapa && est.mapa.tileset ? runtime.getSpriteTargetByName(est.mapa.tileset) : null);

    const carregarFantasias = async () => {
        const t = atorTileset();
        est.fantasias = t ? t.getCostumes() : [];
        await Promise.all(est.fantasias.map(async c => {
            if (est.imagens.has(c.assetId) || !c.asset) return;
            const img = await carregarImagem(c.asset.encodeDataURI());
            if (img) est.imagens.set(c.assetId, img);
        }));
        desenhar();
    };
    const imagemTile = n => {
        const c = est.fantasias[n - 1];
        return c ? est.imagens.get(c.assetId) : null;
    };

    const montarTilesetSelect = () => {
        const sel = $('.tileset');
        const nomes = atores().map(t => t.getName());
        sel.innerHTML = `<option value="">(escolha o ator do tileset)</option>${
            nomes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}`;
        sel.value = est.mapa && nomes.includes(est.mapa.tileset) ? est.mapa.tileset : '';
    };

    const montarPaleta = () => {
        const p = $('.paleta');
        const m = est.mapa;
        if (!est.fantasias.length) {
            p.innerHTML = `<p style="grid-column:1/-1">${m ? 'Escolha um ator com fantasias, ou crie um tileset de uma imagem.' :
                'Crie um tilemap.'}</p>`;
            return;
        }
        p.innerHTML = '';
        const vazio = document.createElement('div');
        vazio.className = `t${est.tile === 0 ? ' sel' : ''}`;
        vazio.title = 'Vazio (apagar)';
        vazio.innerHTML = '<span style="font-size:18px">∅</span>';
        vazio.onclick = () => escolherTile(0);
        p.appendChild(vazio);
        est.fantasias.slice(0, MAX_TILES_TILESET).forEach((c, i) => {
            const n = i + 1;
            const d = document.createElement('div');
            d.className = `t${est.tile === n ? ' sel' : ''}`;
            const tipo = m && m.tipos[n];
            d.title = `Tile ${n}: ${c.name}${tipo ? ` (${NOMES_TIPOS[tipo] || tipo})` : ''}`;
            d.innerHTML = `<img src="${c.asset ? c.asset.encodeDataURI() : ''}" alt=""><small>${n}</small>${
                tipo ? `<i style="background:${corDoTipo(tipo)}"></i>` : ''}`;
            d.onclick = () => escolherTile(n);
            p.appendChild(d);
        });
    };

    const montarTipo = () => {
        const m = est.mapa;
        const n = est.tile;
        $('.tituloTile').textContent = n ? `Tile ${n}` : 'Vazio';
        const sel = $('.tipo');
        const atual = (m && n && m.tipos[n]) || 'nada';
        const extras = m ? Object.values(m.tipos).filter(t => !TIPOS_PADRAO.includes(t)) : [];
        const opcoes = TIPOS_PADRAO.concat(Array.from(new Set(extras)));
        sel.innerHTML = opcoes.map(t => `<option value="${esc(t)}">${esc(NOMES_TIPOS[t] || t)}</option>`).join('') +
            '<option value="__outro__">outro…</option>';
        sel.value = atual;
        sel.disabled = !m || !n;
        $('.tipoOutro').hidden = true;
        $('.dicaTipo').textContent = {
            solido: 'Ninguém atravessa (chão e paredes da Plataforma 2D).',
            plataforma: 'Dá para pular por baixo e pousar em cima.',
            perigo: 'Use "tocando em tile perigo?" para perder vida.',
            moeda: 'Use "quando tocar em tile moeda" e "apagar os tiles moeda que este ator toca".',
            inicio: 'Use "ir para o tile início número 1" para posicionar o jogador.'
        }[atual] || 'O tipo vale para este tile em todo este mapa.';
    };

    const escolherTile = n => {
        est.tile = n;
        if (n === 0 && est.ferramenta === 'lapis') est.ferramenta = 'borracha';
        else if (n > 0 && est.ferramenta === 'borracha') est.ferramenta = 'lapis';
        montarPaleta();
        montarTipo();
        montarFerramentas();
    };

    // ---------------------------------------------------------------- mapa
    const montarMapas = () => {
        const sel = $('.mapa');
        const lista = todosTilemaps();
        sel.innerHTML = lista.length ? lista.map(m => `<option value="${esc(m.nome)}">${esc(m.nome)}</option>`).join('') :
            '<option value="">(nenhum)</option>';
        sel.value = est.mapa ? est.mapa.nome : '';
        $('.nome').value = est.mapa ? est.mapa.nome : '';
        $('.nome').disabled = !est.mapa;
        $('.apagar').disabled = !est.mapa;
        $('.duplicar').disabled = !est.mapa;
        $('.noPalco').checked = Boolean(est.mapa && nomeAtivo() === est.mapa.nome);
        $('.noPalco').disabled = !est.mapa;
        const m = est.mapa;
        for (const [cls, v] of [['.colunas', m && m.colunas], ['.linhas', m && m.linhas], ['.tamanho', m && m.tamanho],
            ['.mx', m && m.x], ['.my', m && m.y]]) {
            $(cls).value = m ? v : '';
            $(cls).disabled = !m;
        }
        $('.aplicar').disabled = !m;
    };

    const abrirMapa = m => {
        est.mapa = m;
        est.desfazer = [];
        est.refazer = [];
        montarMapas();
        montarTilesetSelect();
        carregarFantasias().then(() => {
            montarPaleta();
            montarTipo();
        });
        centralizar();
    };

    const centralizar = () => {
        const m = est.mapa;
        if (!m) return;
        const w = canvas.clientWidth || 800;
        const h = canvas.clientHeight || 500;
        const larg = m.colunas * m.tamanho;
        const alt = m.linhas * m.tamanho;
        est.zoom = Math.max(0.1, Math.min(4, Math.min((w - 40) / larg, (h - 40) / alt, 2)));
        est.ox = Math.min(-20 / est.zoom, (larg - (w / est.zoom)) / 2);
        est.oy = Math.min(-20 / est.zoom, (alt - (h / est.zoom)) / 2);
        if (larg * est.zoom > w) est.ox = -20 / est.zoom;
        desenhar();
    };

    /** Guarda o mapa e avisa o palco. */
    const salvar = celulas => {
        const m = est.mapa;
        if (!m) return;
        gravarTilemap(m, null, true);
        if (celulas && celulas.length && celulas.length <= 64) {
            celulas.forEach(([col, lin]) => avisarTilemaps({tipo: 'tile', mapa: m.nome, col, lin}));
        } else {
            avisarTilemaps();
        }
    };

    const fotografar = () => ({
        colunas: est.mapa.colunas, linhas: est.mapa.linhas,
        camadas: {fundo: est.mapa.camadas.fundo.slice(), principal: est.mapa.camadas.principal.slice()},
        tipos: {...est.mapa.tipos}
    });
    const restaurar = f => Object.assign(est.mapa, {colunas: f.colunas, linhas: f.linhas,
        camadas: {fundo: f.camadas.fundo.slice(), principal: f.camadas.principal.slice()}, tipos: {...f.tipos}});
    const marcarDesfazer = () => {
        if (!est.mapa) return;
        est.desfazer.push(fotografar());
        if (est.desfazer.length > 60) est.desfazer.shift();
        est.refazer = [];
        atualizarBotoes();
    };
    const desfazer = () => {
        if (!est.desfazer.length) return;
        est.refazer.push(fotografar());
        restaurar(est.desfazer.pop());
        salvar();
        montarMapas();
        montarPaleta();
        montarTipo();
        desenhar();
        atualizarBotoes();
    };
    const refazer = () => {
        if (!est.refazer.length) return;
        est.desfazer.push(fotografar());
        restaurar(est.refazer.pop());
        salvar();
        montarMapas();
        montarPaleta();
        montarTipo();
        desenhar();
        atualizarBotoes();
    };
    const atualizarBotoes = () => {
        $('.desfazer').disabled = !est.desfazer.length;
        $('.refazer').disabled = !est.refazer.length;
    };

    const montarFerramentas = () => {
        raiz.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('ativo', b.dataset.f === est.ferramenta));
        $('.camada').value = est.camada;
        $('.zoomTxt').textContent = `${Math.round(est.zoom * 100)}%`;
        atualizarBotoes();
    };

    // ---------------------------------------------------------------- desenho
    let pedido = false;
    const desenhar = () => {
        if (pedido) return;
        pedido = true;
        requestAnimationFrame(() => {
            pedido = false;
            desenharAgora();
        });
    };

    const desenharAgora = () => {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        g.imageSmoothingEnabled = false;
        const m = est.mapa;
        $('.zoomTxt').textContent = `${Math.round(est.zoom * 100)}%`;
        if (!m) {
            g.fillStyle = '#CFC4F5';
            g.font = '16px sans-serif';
            g.textAlign = 'center';
            g.fillText('Clique em "➕ Novo" para criar um tilemap.', w / 2, h / 2);
            return;
        }
        const z = est.zoom;
        const t = m.tamanho * z;
        const sx = mx => (mx - est.ox) * z;
        const sy = my => (my - est.oy) * z;
        // área do mapa
        g.fillStyle = '#2B2350';
        g.fillRect(sx(0), sy(0), m.colunas * t, m.linhas * t);
        const c0 = Math.max(0, Math.floor(est.ox / m.tamanho));
        const c1 = Math.min(m.colunas - 1, Math.floor((est.ox + (w / z)) / m.tamanho));
        const l0 = Math.max(0, Math.floor(est.oy / m.tamanho));
        const l1 = Math.min(m.linhas - 1, Math.floor((est.oy + (h / z)) / m.tamanho));
        for (const camada of CAMADAS) {
            g.globalAlpha = camada === 'fundo' && est.camada === 'principal' ? 0.75 : 1;
            if (camada === 'principal' && est.camada === 'fundo') g.globalAlpha = 0.45;
            for (let lin = l0; lin <= l1; lin++) {
                for (let col = c0; col <= c1; col++) {
                    const n = lerTile(m, camada, col, lin);
                    if (!n) continue;
                    const img = imagemTile(n);
                    const x = sx(col * m.tamanho);
                    const y = sy(lin * m.tamanho);
                    if (img) {
                        g.drawImage(img, x, y, t + 0.5, t + 0.5);
                    } else {
                        g.fillStyle = '#7E57C2';
                        g.fillRect(x, y, t, t);
                    }
                }
            }
        }
        g.globalAlpha = 1;
        // tipos
        if ($('.verTipos').checked && t >= 6) {
            for (let lin = l0; lin <= l1; lin++) {
                for (let col = c0; col <= c1; col++) {
                    const n = lerTile(m, 'principal', col, lin);
                    const tipo = n && m.tipos[n];
                    if (!tipo) continue;
                    g.strokeStyle = corDoTipo(tipo);
                    g.lineWidth = Math.max(1, Math.min(3, t / 12));
                    g.strokeRect(sx(col * m.tamanho) + 1, sy(lin * m.tamanho) + 1, t - 2, t - 2);
                }
            }
        }
        // grade
        if ($('.verGrade').checked && t >= 8) {
            g.strokeStyle = 'rgba(255,255,255,.09)';
            g.lineWidth = 1;
            g.beginPath();
            for (let col = c0; col <= c1 + 1; col++) {
                const x = Math.round(sx(col * m.tamanho)) + 0.5;
                g.moveTo(x, sy(l0 * m.tamanho));
                g.lineTo(x, sy((l1 + 1) * m.tamanho));
            }
            for (let lin = l0; lin <= l1 + 1; lin++) {
                const y = Math.round(sy(lin * m.tamanho)) + 0.5;
                g.moveTo(sx(c0 * m.tamanho), y);
                g.lineTo(sx((c1 + 1) * m.tamanho), y);
            }
            g.stroke();
        }
        // borda do mapa e o palco
        g.strokeStyle = 'rgba(255,255,255,.5)';
        g.lineWidth = 1;
        g.strokeRect(sx(0) - 0.5, sy(0) - 0.5, (m.colunas * t) + 1, (m.linhas * t) + 1);
        g.setLineDash([6, 5]);
        g.strokeStyle = '#FFC928';
        g.lineWidth = 2;
        const px = -240 - m.x;
        const py = m.y - 180;
        g.strokeRect(sx(px), sy(py), 480 * z, 360 * z);
        g.setLineDash([]);
        g.fillStyle = '#FFC928';
        g.font = 'bold 12px sans-serif';
        g.textAlign = 'left';
        g.fillText('palco', sx(px) + 4, sy(py) - 5);
        // prévia da ferramenta
        const mouse = est.mouse;
        if (mouse && mouse.dentro) {
            if (est.arrasto && est.arrasto.tipo === 'retangulo') {
                const a = est.arrasto;
                const ca = Math.min(a.col, mouse.col);
                const cb = Math.max(a.col, mouse.col);
                const la = Math.min(a.lin, mouse.lin);
                const lb = Math.max(a.lin, mouse.lin);
                g.fillStyle = 'rgba(255,201,40,.25)';
                g.fillRect(sx(ca * m.tamanho), sy(la * m.tamanho), (cb - ca + 1) * t, (lb - la + 1) * t);
            }
            const x = sx(mouse.col * m.tamanho);
            const y = sy(mouse.lin * m.tamanho);
            if (est.ferramenta === 'lapis' && est.tile) {
                const img = imagemTile(est.tile);
                if (img) {
                    g.globalAlpha = 0.6;
                    g.drawImage(img, x, y, t, t);
                    g.globalAlpha = 1;
                }
            }
            g.strokeStyle = '#FFFFFF';
            g.lineWidth = 2;
            g.strokeRect(x, y, t, t);
        }
    };

    // ---------------------------------------------------------------- edição
    const celulaDoMouse = ev => {
        const r = canvas.getBoundingClientRect();
        const mx = ((ev.clientX - r.left) / est.zoom) + est.ox;
        const my = ((ev.clientY - r.top) / est.zoom) + est.oy;
        const m = est.mapa;
        const col = Math.floor(mx / m.tamanho);
        const lin = Math.floor(my / m.tamanho);
        return {col, lin, dentro: col >= 0 && lin >= 0 && col < m.colunas && lin < m.linhas};
    };

    const pintar = (col, lin, valor, mudadas) => {
        if (escreverTile(est.mapa, est.camada, col, lin, valor)) mudadas.push([col, lin]);
    };

    const linha = (a, b, valor, mudadas) => {
        let x0 = a.col;
        let y0 = a.lin;
        const dx = Math.abs(b.col - x0);
        const dy = -Math.abs(b.lin - y0);
        const sxs = x0 < b.col ? 1 : -1;
        const sys = y0 < b.lin ? 1 : -1;
        let erro = dx + dy;
        for (let i = 0; i < 5000; i++) {
            pintar(x0, y0, valor, mudadas);
            if (x0 === b.col && y0 === b.lin) break;
            const e2 = 2 * erro;
            if (e2 >= dy) {
                erro += dy;
                x0 += sxs;
            }
            if (e2 <= dx) {
                erro += dx;
                y0 += sys;
            }
        }
    };

    const balde = (col, lin, valor) => {
        const m = est.mapa;
        const alvo = lerTile(m, est.camada, col, lin);
        if (alvo === valor) return [];
        const mudadas = [];
        const pilha = [[col, lin]];
        const visto = new Uint8Array(m.colunas * m.linhas);
        while (pilha.length) {
            const [c, l] = pilha.pop();
            if (c < 0 || l < 0 || c >= m.colunas || l >= m.linhas) continue;
            const i = (l * m.colunas) + c;
            if (visto[i] || m.camadas[est.camada][i] !== alvo) continue;
            visto[i] = 1;
            pintar(c, l, valor, mudadas);
            pilha.push([c + 1, l], [c - 1, l], [c, l + 1], [c, l - 1]);
        }
        return mudadas;
    };

    const pegar = (col, lin) => {
        const m = est.mapa;
        let n = lerTile(m, est.camada, col, lin);
        if (!n) {
            const outra = est.camada === 'principal' ? 'fundo' : 'principal';
            n = lerTile(m, outra, col, lin);
        }
        escolherTile(n);
        if (est.ferramenta === 'gotas') est.ferramenta = n ? 'lapis' : 'borracha';
        montarFerramentas();
    };

    const valorDaFerramenta = () => (est.ferramenta === 'borracha' ? 0 : est.tile);

    canvas.addEventListener('contextmenu', ev => ev.preventDefault());
    canvas.addEventListener('pointerdown', ev => {
        if (!est.mapa) return;
        canvas.setPointerCapture(ev.pointerId);
        if (ev.button === 1 || ev.button === 2) {
            est.arrasto = {tipo: 'mover', x: ev.clientX, y: ev.clientY, ox: est.ox, oy: est.oy};
            canvas.style.cursor = 'grabbing';
            return;
        }
        if (ev.button !== 0) return;
        const c = celulaDoMouse(ev);
        est.mouse = c;
        if (ev.altKey || est.ferramenta === 'gotas') {
            if (c.dentro) pegar(c.col, c.lin);
            return;
        }
        if (!c.dentro) return;
        marcarDesfazer();
        if (est.ferramenta === 'balde') {
            const mudadas = balde(c.col, c.lin, est.tile);
            salvar(mudadas);
            desenhar();
            return;
        }
        if (est.ferramenta === 'retangulo') {
            est.arrasto = {tipo: 'retangulo', col: c.col, lin: c.lin};
            desenhar();
            return;
        }
        const mudadas = [];
        pintar(c.col, c.lin, valorDaFerramenta(), mudadas);
        est.arrasto = {tipo: 'pintar', ultima: c, mudadas};
        desenhar();
    });
    canvas.addEventListener('pointermove', ev => {
        if (!est.mapa) return;
        const a = est.arrasto;
        if (a && a.tipo === 'mover') {
            est.ox = a.ox - ((ev.clientX - a.x) / est.zoom);
            est.oy = a.oy - ((ev.clientY - a.y) / est.zoom);
            desenhar();
            return;
        }
        const c = celulaDoMouse(ev);
        const mudou = !est.mouse || est.mouse.col !== c.col || est.mouse.lin !== c.lin;
        est.mouse = c;
        if (a && a.tipo === 'pintar' && mudou) {
            linha(a.ultima, c, valorDaFerramenta(), a.mudadas);
            a.ultima = c;
        }
        if (mudou) {
            const m = est.mapa;
            const n = c.dentro ? lerTile(m, est.camada, c.col, c.lin) : 0;
            const centro = centroDe(m, c.col, c.lin);
            $('.st1').textContent = c.dentro ? `coluna ${c.col + 1}, linha ${c.lin + 1}` : 'fora do mapa';
            $('.st2').textContent = c.dentro ? `tile ${n}${n && m.tipos[n] ? ` (${NOMES_TIPOS[m.tipos[n]] || m.tipos[n]})` : ''
            } · palco x: ${Math.round(centro.x)} y: ${Math.round(centro.y)}` : '';
            desenhar();
        }
    });
    const soltar = () => {
        const a = est.arrasto;
        est.arrasto = null;
        canvas.style.cursor = '';
        if (!a || !est.mapa) return;
        if (a.tipo === 'pintar') {
            salvar(a.mudadas);
        } else if (a.tipo === 'retangulo' && est.mouse) {
            const mudadas = [];
            const m = est.mapa;
            const ca = Math.max(0, Math.min(a.col, est.mouse.col));
            const cb = Math.min(m.colunas - 1, Math.max(a.col, est.mouse.col));
            const la = Math.max(0, Math.min(a.lin, est.mouse.lin));
            const lb = Math.min(m.linhas - 1, Math.max(a.lin, est.mouse.lin));
            for (let l = la; l <= lb; l++) for (let c = ca; c <= cb; c++) pintar(c, l, est.tile, mudadas);
            salvar(mudadas);
        }
        desenhar();
    };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);
    canvas.addEventListener('pointerleave', () => {
        if (est.mouse) est.mouse.dentro = false;
        desenhar();
    });
    const mudarZoom = (fator, cx, cy) => {
        const novo = Math.max(0.05, Math.min(8, est.zoom * fator));
        const r = canvas.getBoundingClientRect();
        const px = cx === undefined ? r.width / 2 : cx - r.left; // eslint-disable-line no-undefined
        const py = cy === undefined ? r.height / 2 : cy - r.top; // eslint-disable-line no-undefined
        est.ox += (px / est.zoom) - (px / novo);
        est.oy += (py / est.zoom) - (py / novo);
        est.zoom = novo;
        desenhar();
    };
    canvas.addEventListener('wheel', ev => {
        ev.preventDefault();
        if (ev.ctrlKey || ev.metaKey) {
            mudarZoom(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX, ev.clientY);
            return;
        }
        const dx = ev.shiftKey ? ev.deltaY : ev.deltaX;
        const dy = ev.shiftKey ? 0 : ev.deltaY;
        est.ox += dx / est.zoom;
        est.oy += dy / est.zoom;
        desenhar();
    }, {passive: false});

    // ---------------------------------------------------------------- controles
    raiz.querySelectorAll('[data-f]').forEach(b => {
        b.onclick = () => {
            est.ferramenta = b.dataset.f;
            if (est.ferramenta === 'borracha') est.tile = est.tile || 0;
            montarFerramentas();
        };
    });
    $('.camada').onchange = () => {
        est.camada = $('.camada').value;
        desenhar();
    };
    $('.verTipos').onchange = desenhar;
    $('.verGrade').onchange = desenhar;
    $('.zoomMais').onclick = () => mudarZoom(1.25);
    $('.zoomMenos').onclick = () => mudarZoom(1 / 1.25);
    $('.desfazer').onclick = desfazer;
    $('.refazer').onclick = refazer;

    $('.mapa').onchange = () => {
        const m = obterTilemap($('.mapa').value);
        if (m) abrirMapa(m);
    };
    $('.nome').onchange = () => {
        const m = est.mapa;
        const novo = $('.nome').value.trim()
            .slice(0, 60);
        if (!m || !novo || novo === m.nome) {
            $('.nome').value = m ? m.nome : '';
            return;
        }
        if (obterTilemap(novo)) {
            aviso('Já existe um tilemap com esse nome.');
            $('.nome').value = m.nome;
            return;
        }
        const antigo = m.nome;
        m.nome = novo;
        gravarTilemap(m, antigo);
        montarMapas();
    };
    const tilesetSugerido = () => {
        if (est.mapa && est.mapa.tileset) return est.mapa.tileset;
        const t = atores().find(a => /tile/i.test(a.getName()));
        return t ? t.getName() : '';
    };
    /** Tipos para um mapa novo: os de outro mapa com o mesmo tileset, ou "sólido" para todos os tiles. */
    const tiposPadrao = (tileset, quantos) => {
        const outro = todosTilemaps().find(x => x.tileset === tileset && Object.keys(x.tipos).length);
        if (outro) return {...outro.tipos};
        const r = {};
        for (let n = 1; n <= quantos; n++) r[n] = 'solido';
        return r;
    };
    $('.novo').onclick = () => {
        const m = tilemapVazio(nomeLivre('mapa'));
        m.tileset = tilesetSugerido();
        const ator = m.tileset ? runtime.getSpriteTargetByName(m.tileset) : null;
        // um chão para começar
        for (let c = 0; c < m.colunas; c++) m.camadas.principal[((m.linhas - 1) * m.colunas) + c] = ator ? 1 : 0;
        if (ator) m.tipos = tiposPadrao(m.tileset, ator.getCostumes().length);
        gravarTilemap(m);
        if (!nomeAtivo()) definirAtivo(m.nome);
        abrirMapa(m);
    };
    $('.duplicar').onclick = () => {
        if (!est.mapa) return;
        const copia = normalizarTilemap(JSON.parse(JSON.stringify(est.mapa)));
        copia.nome = nomeLivre(`${est.mapa.nome} cópia`.replace(/ \d+$/, ''));
        gravarTilemap(copia);
        abrirMapa(copia);
    };
    $('.apagar').onclick = () => {
        if (!est.mapa) return;
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Apagar o tilemap "${est.mapa.nome}"? Não dá para desfazer.`)) return;
        apagarTilemap(est.mapa.nome);
        abrirMapa(todosTilemaps()[0] || null);
    };
    $('.noPalco').onchange = () => {
        if (!est.mapa) return;
        definirAtivo($('.noPalco').checked ? est.mapa.nome : '');
    };
    $('.tileset').onchange = () => {
        if (!est.mapa) return;
        est.mapa.tileset = $('.tileset').value;
        salvar();
        carregarFantasias().then(() => {
            montarPaleta();
            montarTipo();
        });
    };
    $('.tipo').onchange = () => {
        const m = est.mapa;
        if (!m || !est.tile) return;
        const v = $('.tipo').value;
        if (v === '__outro__') {
            $('.tipoOutro').hidden = false;
            $('.tipoOutro').focus();
            return;
        }
        marcarDesfazer();
        if (v === 'nada') delete m.tipos[est.tile];
        else m.tipos[est.tile] = v;
        salvar();
        montarPaleta();
        montarTipo();
        desenhar();
    };
    $('.tipoOutro').onchange = () => {
        const m = est.mapa;
        const v = $('.tipoOutro').value.trim()
            .toLowerCase()
            .slice(0, 30);
        if (!m || !est.tile || !v) return;
        marcarDesfazer();
        m.tipos[est.tile] = v;
        salvar();
        montarPaleta();
        montarTipo();
        desenhar();
    };
    $('.aplicar').onclick = () => {
        const m = est.mapa;
        if (!m) return;
        marcarDesfazer();
        redimensionar(m, $('.colunas').value, $('.linhas').value);
        m.tamanho = Math.max(2, Math.min(512, Math.round(num($('.tamanho').value, m.tamanho))));
        m.x = num($('.mx').value, m.x);
        m.y = num($('.my').value, m.y);
        salvar();
        montarMapas();
        desenhar();
    };

    // ---------------------------------------------------------------- criar tileset de uma imagem
    $('.criarTileset').onclick = () => $('.arqTileset').click();
    $('.arqTileset').onchange = async () => {
        const arq = $('.arqTileset').files[0];
        $('.arqTileset').value = '';
        if (!arq) return;
        let img;
        try {
            img = await imagemDeArquivo(arq);
        } catch (e) {
            aviso(e.message);
            return;
        }
        const palpite = [16, 32, 8, 24, 48, 64].find(n => img.naturalWidth % n === 0 && img.naturalHeight % n === 0) || 16;
        const jan = document.createElement('div');
        jan.className = 'janela';
        jan.innerHTML = `<div>
  <h3>🖼 Criar tileset de "${esc(arq.name)}"</h3>
  <p style="margin:0;font-size:13px;color:#CFC4F5">A imagem é cortada numa grade; cada quadrado vira uma fantasia
    (um tile) de um ator novo, escondido no palco.</p>
  <div class="grade2">
    <label class="campo">Largura do tile (px da imagem) <input type="number" class="tw" min="1" value="${palpite}"></label>
    <label class="campo">Altura do tile <input type="number" class="th" min="1" value="${palpite}"></label>
    <label class="campo">Margem <input type="number" class="mg" min="0" value="0"></label>
    <label class="campo">Espaço entre tiles <input type="number" class="sp" min="0" value="0"></label>
    <label class="campo">Tamanho no palco (px) <input type="number" class="tp" min="2" value="${palpite < 24 ? palpite * 2 : palpite}"></label>
    <label class="campo">Nome do ator <input class="nm" value="Tileset"></label>
  </div>
  <label class="chk"><input type="checkbox" class="pular" checked> pular quadrados vazios (transparentes)</label>
  <canvas class="prev"></canvas>
  <p class="contagem" style="margin:0;font-size:13px"></p>
  <div style="display:flex;gap:8px;justify-content:flex-end"><button class="cancelar">Cancelar</button>
    <button class="prim criar">Criar tileset</button></div></div>`;
        raiz.appendChild(jan);
        const q = s => jan.querySelector(s);
        const ler = () => ({
            tw: Math.max(1, num(q('.tw').value, 16)), th: Math.max(1, num(q('.th').value, 16)),
            mg: Math.max(0, num(q('.mg').value)), sp: Math.max(0, num(q('.sp').value)),
            tp: Math.max(2, Math.min(512, num(q('.tp').value, 32)))
        });
        const grade = () => {
            const {tw, th, mg, sp} = ler();
            const cols = Math.max(0, Math.floor((img.naturalWidth - (2 * mg) + sp) / (tw + sp)));
            const lins = Math.max(0, Math.floor((img.naturalHeight - (2 * mg) + sp) / (th + sp)));
            return {cols, lins, tw, th, mg, sp};
        };
        const previa = () => {
            const c = q('.prev');
            const {cols, lins, tw, th, mg, sp} = grade();
            const esc2 = Math.max(1, Math.min(4, Math.floor(480 / img.naturalWidth)));
            c.width = img.naturalWidth * esc2;
            c.height = img.naturalHeight * esc2;
            const pg = c.getContext('2d');
            pg.imageSmoothingEnabled = false;
            pg.drawImage(img, 0, 0, c.width, c.height);
            pg.strokeStyle = 'rgba(255,201,40,.8)';
            pg.lineWidth = 1;
            for (let l = 0; l < lins; l++) {
                for (let k = 0; k < cols; k++) {
                    pg.strokeRect(((mg + (k * (tw + sp))) * esc2) + 0.5, ((mg + (l * (th + sp))) * esc2) + 0.5,
                        (tw * esc2) - 1, (th * esc2) - 1);
                }
            }
            q('.contagem').textContent = `${cols} × ${lins} = ${cols * lins} quadrados`;
        };
        jan.querySelectorAll('input').forEach(i => {
            i.oninput = previa;
        });
        previa();
        q('.cancelar').onclick = () => jan.remove();
        q('.criar').onclick = async () => {
            const {cols, lins, tw, th, mg, sp} = grade();
            const {tp} = ler();
            if (!cols || !lins) return;
            q('.criar').disabled = true;
            q('.criar').textContent = 'Criando…';
            const tiles = [];
            for (let l = 0; l < lins; l++) {
                for (let k = 0; k < cols; k++) {
                    const c = recortar(img, mg + (k * (tw + sp)), mg + (l * (th + sp)), tw, th, tp * 2);
                    if (q('.pular').checked && ehTransparente(c)) continue;
                    tiles.push({canvas: c, nome: `tile ${tiles.length + 1}`});
                    if (tiles.length >= MAX_TILES_TILESET) break;
                }
            }
            if (!tiles.length) {
                aviso('Todos os quadrados ficaram vazios. Confira o tamanho do tile.');
                jan.remove();
                return;
            }
            try {
                const nome = await criarAtorTileset(vm, q('.nm').value.trim() || 'Tileset', tiles);
                if (!est.mapa) {
                    const m = tilemapVazio(nomeLivre('mapa'), 30, 12, tp);
                    gravarTilemap(m, null, true);
                    if (!nomeAtivo()) definirAtivo(m.nome, true);
                    est.mapa = m;
                }
                est.mapa.tileset = nome;
                est.mapa.tamanho = tp;
                // todo tile começa sólido (chão e paredes); mude moedas, espinhos… na paleta
                est.mapa.tipos = {};
                for (let n = 1; n <= tiles.length; n++) est.mapa.tipos[n] = 'solido';
                salvar();
                abrirMapa(est.mapa);
                aviso(`Tileset "${nome}" criado com ${tiles.length} tiles (todos sólidos: mude moedas, espinhos… ` +
                    'no "Tipo"). Agora escolha um tile e desenhe!');
            } catch (e) {
                aviso(`Não deu para criar o tileset: ${e.message}`);
            }
            jan.remove();
        };
    };

    // ---------------------------------------------------------------- tileset pronto
    $('.tilesetPronto').onclick = async () => {
        const botao = $('.tilesetPronto');
        botao.disabled = true;
        try {
            const tiles = [];
            for (const t of TILESET_PRONTO) {
                const img = await carregarImagem(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(t.svg)}`);
                const c = document.createElement('canvas');
                c.width = 64;
                c.height = 64;
                if (img) c.getContext('2d').drawImage(img, 0, 0, 64, 64);
                tiles.push({canvas: c, nome: t.nome});
            }
            const nome = await criarAtorTileset(vm, 'Tileset pronto', tiles);
            const tipos = {};
            TILESET_PRONTO.forEach((t, i) => {
                if (t.tipo !== 'nada') tipos[i + 1] = t.tipo;
            });
            if (!est.mapa) {
                const m = tilemapVazio(nomeLivre('mapa'), 30, 11, 32);
                m.y = 176;
                // chão de grama e terra, e o lugar de início
                for (let c = 0; c < m.colunas; c++) {
                    m.camadas.principal[(8 * m.colunas) + c] = 1;
                    m.camadas.principal[(9 * m.colunas) + c] = 2;
                    m.camadas.principal[(10 * m.colunas) + c] = 2;
                }
                m.camadas.principal[(6 * m.colunas) + 2] = 10;
                gravarTilemap(m, null, true);
                if (!nomeAtivo()) definirAtivo(m.nome, true);
                est.mapa = m;
            }
            est.mapa.tileset = nome;
            est.mapa.tamanho = 32;
            est.mapa.tipos = tipos;
            salvar();
            abrirMapa(est.mapa);
            aviso(`Tileset "${nome}" pronto, com os tipos já marcados. Escolha um tile e desenhe!`);
        } catch (e) {
            aviso(`Não deu para criar o tileset: ${e.message}`);
        } finally {
            botao.disabled = false;
        }
    };

    // ---------------------------------------------------------------- importar do Tiled
    $('.importar').onclick = () => $('.arquivos').click();
    $('.arquivos').onchange = async () => {
        const arquivos = Array.from($('.arquivos').files);
        $('.arquivos').value = '';
        if (!arquivos.length) return;
        const outros = new Map(arquivos.map(f => [f.name.toLowerCase(), f]));
        const mapaArq = arquivos.find(f => /\.(tmj|tmx)$/i.test(f.name)) || arquivos.find(f => /\.json$/i.test(f.name));
        if (!mapaArq) {
            aviso('Escolha o arquivo do mapa (.tmj, .json ou .tmx) junto com as imagens dos tilesets.');
            return;
        }
        $('.importar').disabled = true;
        aviso(`Lendo ${mapaArq.name}…`);
        try {
            const r = await importarTiled(mapaArq, outros);
            abrirMapa(r.mapa);
            aviso(r.mensagem);
        } catch (e) {
            aviso(`⚠ ${e.message}`);
        } finally {
            $('.importar').disabled = false;
        }
    };

    const importarTiled = async (arquivo, outros) => {
        const t = await lerMapaTiled(arquivo, outros);
        const tamanho = t.tilewidth < 24 ? t.tilewidth * 2 : t.tilewidth;
        // gids usados (só esses viram fantasias)
        const usados = new Set();
        t.camadas.forEach(c => c.gids.forEach(gid => gid && usados.add(gid)));
        const tilesetDe = gid => {
            let ts = null;
            for (const x of t.tilesets) if (gid >= x.firstgid) ts = x;
            return ts;
        };
        const imagens = new Map();
        const imagemTs = async nome => {
            const chave = nomeBase(nome);
            if (imagens.has(chave)) return imagens.get(chave);
            const f = outros.get(chave);
            if (!f) throw new Error(`Faltou a imagem "${chave}": escolha ela junto com o mapa.`);
            const img = await imagemDeArquivo(f);
            imagens.set(chave, img);
            return img;
        };
        const gids = Array.from(usados).sort((a, b) => a - b);
        if (gids.length > MAX_TILES_TILESET) throw new Error(`O mapa usa ${gids.length} tiles diferentes (máximo ${MAX_TILES_TILESET}).`);
        const tiles = [];
        const novoId = new Map();
        const tipos = {};
        for (const gid of gids) {
            const ts = tilesetDe(gid);
            if (!ts) continue;
            const local = gid - ts.firstgid;
            let canvas;
            if (ts.imagensTiles[local]) {
                const img = await imagemTs(ts.imagensTiles[local]);
                canvas = recortar(img, 0, 0, img.naturalWidth, img.naturalHeight, tamanho * 2);
            } else if (ts.imagem) {
                const img = await imagemTs(ts.imagem);
                const tw = ts.tilewidth || t.tilewidth;
                const th = ts.tileheight || t.tileheight;
                const cols = ts.columns || Math.floor((img.naturalWidth - (2 * ts.margin) + ts.spacing) / (tw + ts.spacing));
                const k = local % cols;
                const l = Math.floor(local / cols);
                canvas = recortar(img, ts.margin + (k * (tw + ts.spacing)), ts.margin + (l * (th + ts.spacing)), tw, th,
                    tamanho * 2);
            } else {
                continue;
            }
            tiles.push({canvas, nome: `${ts.nome} ${local}`});
            novoId.set(gid, tiles.length);
            const tipo = ts.tipos[local];
            if (tipo) tipos[tiles.length] = TIPOS_TILED[tipo] || tipo;
        }
        if (!tiles.length) throw new Error('Não achei as imagens dos tiles. Escolha as imagens dos tilesets junto com o mapa.');
        const m = tilemapVazio(nomeLivre(arquivo.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'mapa'),
            Math.min(1000, t.colunas), Math.min(1000, t.linhas), tamanho);
        const n = m.colunas * m.linhas;
        const colisao = new Array(n).fill(false);
        let temColisao = false;
        for (const c of t.camadas) {
            const destino = ehCamadaDeColisao(c.nome) ? 'colisao' : (ehCamadaDeFundo(c.nome) ? 'fundo' : 'principal');
            for (let lin = 0; lin < m.linhas; lin++) {
                for (let col = 0; col < m.colunas; col++) {
                    const gid = c.gids[(lin * t.colunas) + col];
                    if (!gid) continue;
                    const i = (lin * m.colunas) + col;
                    if (destino === 'colisao') {
                        colisao[i] = true;
                        temColisao = true;
                        if (!c.visivel) continue;
                    }
                    const id = novoId.get(gid);
                    if (!id) continue;
                    if (destino === 'fundo') m.camadas.fundo[i] = id;
                    else m.camadas.principal[i] = id;
                }
            }
        }
        m.tipos = tipos;
        let mensagem;
        if (temColisao) {
            // camada de colisão: um tile invisível e sólido onde ela tem tiles
            const invisivel = document.createElement('canvas');
            invisivel.width = tamanho * 2;
            invisivel.height = tamanho * 2;
            tiles.push({canvas: invisivel, nome: 'colisão (invisível)'});
            const idInvisivel = tiles.length;
            m.tipos[idInvisivel] = 'solido';
            for (let i = 0; i < n; i++) {
                if (!colisao[i]) continue;
                const visual = m.camadas.principal[i];
                if (visual && !m.camadas.fundo[i]) m.camadas.fundo[i] = visual;
                else if (visual) m.tipos[visual] = m.tipos[visual] || 'solido';
                m.camadas.principal[i] = idInvisivel;
            }
            mensagem = 'A camada de colisão virou tiles sólidos invisíveis.';
        } else if (!Object.keys(m.tipos).length) {
            new Set(m.camadas.principal.filter(Boolean)).forEach(id => {
                m.tipos[id] = 'solido';
            });
            mensagem = 'Todos os tiles da camada principal ficaram sólidos: mude os tipos na paleta se precisar.';
        } else {
            mensagem = 'Os tipos dos tiles vieram das propriedades do Tiled.';
        }
        aviso('Criando o tileset…');
        m.tileset = await criarAtorTileset(vm, `Tileset ${m.nome}`.slice(0, 60), tiles);
        gravarTilemap(m);
        definirAtivo(m.nome);
        return {mapa: m, mensagem: `Mapa "${m.nome}" importado (${m.colunas}×${m.linhas}, ${tiles.length} tiles). ${mensagem}`};
    };

    // ---------------------------------------------------------------- teclado e fechar
    const teclas = ev => {
        if (ev.target && /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
        const k = ev.key.toLowerCase();
        if ((ev.ctrlKey || ev.metaKey) && k === 'z') {
            ev.preventDefault();
            if (ev.shiftKey) refazer();
            else desfazer();
            return;
        }
        if ((ev.ctrlKey || ev.metaKey) && k === 'y') {
            ev.preventDefault();
            refazer();
            return;
        }
        const f = {p: 'lapis', e: 'borracha', b: 'balde', r: 'retangulo', i: 'gotas'}[k];
        if (f && !ev.ctrlKey && !ev.metaKey) {
            est.ferramenta = f;
            montarFerramentas();
        }
        if (k === 'escape' && est.arrasto) {
            est.arrasto = null;
            desenhar();
        }
        ev.stopPropagation();
    };
    window.addEventListener('keydown', teclas, true);
    const redimensionou = new ResizeObserver(() => desenhar());
    redimensionou.observe($('.adv-tm-area'));
    const fechar = () => {
        window.removeEventListener('keydown', teclas, true);
        redimensionou.disconnect();
        raiz.remove();
    };
    $('.fechar').onclick = fechar;

    montarFerramentas();
    abrirMapa(obterTilemap(nomeAtivo()) || todosTilemaps()[0] || null);
    // para testes e para o console (F12)
    window.adventiblocksEditorTilemap = {estado: est, desenhar: desenharAgora, importarTiled, fechar};
};
