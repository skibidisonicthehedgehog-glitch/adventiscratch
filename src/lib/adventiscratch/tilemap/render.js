/**
 * Desenha o tilemap ativo no palco, dentro do próprio renderizador do Scratch: o mapa vira alguns "pedaços"
 * (imagens de até ~1024×1024 px do palco), cada um como um objeto desenhável na camada da caneta, atrás dos
 * atores. Assim o mapa anda com a extensão Câmera, aparece nas fotos do palco e conta para "tocando na cor".
 */
import {CAMADAS, lerTile} from './dados.js';

const PEDACO_PX = 1024; // tamanho máximo de um pedaço, em px do palco
const RESOLUCAO = 2; // desenha com o dobro de pixels, como as fantasias bitmap do Scratch
const MAX_TEXTURA = 4096;

const carregarImagem = url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
});

export class RenderizadorTilemap {
    /**
     * @param {Runtime} runtime runtime da VM
     * @param {function(): object} fonte devolve o mapa a desenhar (o ativo, ou a cópia que o jogo está mudando)
     */
    constructor (runtime, fonte) {
        this.runtime = runtime;
        this.fonte = fonte;
        this.pedacos = []; // {cx, cy, canvas, skin, drawable}
        this.imagens = new Map(); // assetId -> Image
        this.fantasias = []; // [{assetId}] do tileset (tile n = fantasias[n - 1])
        this.assinatura = '';
        this.mapa = null;
        this.geometria = null;
        this._versao = 0;
    }

    get renderer () {
        return this.runtime.renderer;
    }

    /** Fantasias do ator usado como tileset. */
    _tileset (m) {
        const alvo = m && m.tileset ? this.runtime.getSpriteTargetByName(m.tileset) : null;
        return alvo ? alvo.getCostumes() : [];
    }

    /** Muda quando o mapa ativo ou as fantasias do tileset mudam (para refazer o desenho). */
    assinaturaAtual () {
        const m = this.fonte();
        if (!m) return '';
        const fs = this._tileset(m);
        return `${m.nome}|${m.tileset}|${fs.map(c => c.assetId).join(',')}`;
    }

    /** Imagem de uma fantasia do tileset (carrega e guarda). */
    async _carregarTileset (m) {
        const fs = this._tileset(m);
        this.fantasias = fs.map(c => ({assetId: c.assetId, nome: c.name}));
        await Promise.all(fs.map(async c => {
            if (this.imagens.has(c.assetId)) return;
            const img = c.asset ? await carregarImagem(c.asset.encodeDataURI()) : null;
            if (img) this.imagens.set(c.assetId, img);
        }));
    }

    imagemDoTile (n) {
        const f = this.fantasias[n - 1];
        return f ? this.imagens.get(f.assetId) || null : null;
    }

    _destruirPedacos () {
        const r = this.renderer;
        for (const p of this.pedacos) {
            if (!r) continue;
            r.destroyDrawable(p.drawable, 'pen');
            r.destroySkin(p.skin);
        }
        this.pedacos = [];
        this.geometria = null;
    }

    /** Refaz tudo (mapa novo, tileset mudou, tamanho mudou…). */
    async atualizar () {
        const versao = ++this._versao;
        const m = this.fonte();
        this.assinatura = this.assinaturaAtual();
        if (!m || !this.renderer) {
            this._destruirPedacos();
            this.mapa = null;
            this.runtime.requestRedraw();
            return;
        }
        await this._carregarTileset(m);
        if (versao !== this._versao) return; // outra atualização começou enquanto carregava
        this._destruirPedacos();
        this.mapa = m;
        const tilesPorPedaco = Math.max(1, Math.min(
            Math.floor(PEDACO_PX / m.tamanho),
            Math.floor(MAX_TEXTURA / (m.tamanho * RESOLUCAO))
        ));
        const res = m.tamanho * tilesPorPedaco * RESOLUCAO > MAX_TEXTURA ? 1 : RESOLUCAO;
        this.geometria = {tilesPorPedaco, res, x: m.x, y: m.y, tamanho: m.tamanho, colunas: m.colunas, linhas: m.linhas};
        const r = this.renderer;
        for (let cy = 0; cy * tilesPorPedaco < m.linhas; cy++) {
            for (let cx = 0; cx * tilesPorPedaco < m.colunas; cx++) {
                const cols = Math.min(tilesPorPedaco, m.colunas - (cx * tilesPorPedaco));
                const lins = Math.min(tilesPorPedaco, m.linhas - (cy * tilesPorPedaco));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(cols * m.tamanho * res));
                canvas.height = Math.max(1, Math.round(lins * m.tamanho * res));
                const p = {cx, cy, cols, lins, canvas, vazio: true};
                this._desenharPedaco(p);
                p.skin = r.createBitmapSkin(canvas, res, [0, 0]);
                p.drawable = r.createDrawable('pen');
                r.updateDrawableSkinId(p.drawable, p.skin);
                r.updateDrawablePosition(p.drawable, [
                    m.x + (cx * tilesPorPedaco * m.tamanho),
                    m.y - (cy * tilesPorPedaco * m.tamanho)
                ]);
                r.updateDrawableVisible(p.drawable, !p.vazio);
                this.pedacos.push(p);
            }
        }
        this.runtime.requestRedraw();
    }

    _desenharCelula (g, m, col, lin, px, py, t) {
        g.clearRect(px, py, t, t);
        for (const camada of CAMADAS) {
            const n = lerTile(m, camada, col, lin);
            if (!n) continue;
            const img = this.imagemDoTile(n);
            if (img) g.drawImage(img, px, py, t, t);
        }
    }

    _desenharPedaco (p) {
        const m = this.mapa || this.fonte();
        const {tilesPorPedaco, res} = this.geometria;
        const g = p.canvas.getContext('2d');
        g.imageSmoothingEnabled = false; // pixel art nítida
        g.clearRect(0, 0, p.canvas.width, p.canvas.height);
        const t = m.tamanho * res;
        let vazio = true;
        for (let l = 0; l < p.lins; l++) {
            for (let k = 0; k < p.cols; k++) {
                const col = (p.cx * tilesPorPedaco) + k;
                const lin = (p.cy * tilesPorPedaco) + l;
                if (!lerTile(m, 'fundo', col, lin) && !lerTile(m, 'principal', col, lin)) continue;
                vazio = false;
                this._desenharCelula(g, m, col, lin, Math.round(k * t), Math.round(l * t), Math.round(t));
            }
        }
        p.vazio = vazio;
    }

    /** Redesenha só um tile (quando um bloco troca o tile durante o jogo). */
    redesenharTile (col, lin) {
        const m = this.mapa;
        const geo = this.geometria;
        if (!m || !geo || m !== this.fonte()) return;
        const {tilesPorPedaco, res} = geo;
        const p = this.pedacos.find(o => o.cx === Math.floor(col / tilesPorPedaco) &&
            o.cy === Math.floor(lin / tilesPorPedaco));
        if (!p) return;
        const g = p.canvas.getContext('2d');
        g.imageSmoothingEnabled = false;
        const t = m.tamanho * res;
        this._desenharCelula(g, m, col, lin, Math.round((col % tilesPorPedaco) * t),
            Math.round((lin % tilesPorPedaco) * t), Math.round(t));
        p.vazio = false;
        this.renderer.updateBitmapSkin(p.skin, p.canvas, res, [0, 0]);
        this.renderer.updateDrawableVisible(p.drawable, true);
        this.runtime.requestRedraw();
    }

    /** O mapa mudou de lugar, de tamanho ou de tiles? Então precisa refazer. */
    precisaRefazer () {
        const m = this.fonte();
        if (this.assinaturaAtual() !== this.assinatura) return true;
        if (!m) return false;
        const g = this.geometria;
        return !g || m !== this.mapa || g.x !== m.x || g.y !== m.y || g.tamanho !== m.tamanho ||
            g.colunas !== m.colunas || g.linhas !== m.linhas;
    }

    mostrar (visivel) {
        const r = this.renderer;
        for (const p of this.pedacos) r.updateDrawableVisible(p.drawable, visivel && !p.vazio);
        this.runtime.requestRedraw();
    }
}
