/**
 * Desenho no canvas 2D: sprites (com cor/alpha/rotação), fundos, tiles e textos com as fontes do jogo.
 * Cores do GameMaker são BGR: 0xBBGGRR.
 */
export const corCss = (c, a = 1) => {
    const n = Math.round(Number(c) || 0);
    const r = n & 0xff;
    const g = (n >> 8) & 0xff;
    const b = (n >> 16) & 0xff;
    return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
};

export class Desenhista {
    constructor (dw) {
        this.dw = dw;
        this.ctx = null;
        this.cor = 0xffffff;
        this.alpha = 1;
        this.fonte = -1;
        this.halign = 0;
        this.valign = 0;
        this.tingidos = new Map(); // cache de imagens tingidas
        this.tamCache = 0;
    }

    imagem (it) {
        const t = this.dw.texturas[it.textura];
        return t && t.imagem;
    }

    // recorte tingido (multiplica pela cor) guardado em cache
    tingir (it, cor) {
        const chave = `${it.textura}:${it.sx}:${it.sy}:${it.sw}:${it.sh}:${cor}`;
        let c = this.tingidos.get(chave);
        if (c) return c;
        const img = this.imagem(it);
        if (!img || !it.sw || !it.sh) return null;
        c = document.createElement('canvas');
        c.width = it.sw;
        c.height = it.sh;
        const x = c.getContext('2d');
        x.drawImage(img, it.sx, it.sy, it.sw, it.sh, 0, 0, it.sw, it.sh);
        x.globalCompositeOperation = 'multiply';
        x.fillStyle = corCss(cor);
        x.fillRect(0, 0, it.sw, it.sh);
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(img, it.sx, it.sy, it.sw, it.sh, 0, 0, it.sw, it.sh);
        if (this.tamCache > 600) {
            this.tingidos.clear();
            this.tamCache = 0;
        }
        this.tingidos.set(chave, c);
        this.tamCache++;
        return c;
    }

    /**
     * Desenha um item de página de textura. (ox, oy) é a origem dentro do quadro original.
     */
    item (it, x, y, ox, oy, xs = 1, ys = 1, ang = 0, cor = 0xffffff, alpha = 1) {
        const ctx = this.ctx;
        if (!it || !ctx || alpha <= 0) return;
        const img = this.imagem(it);
        if (!img) return;
        cor = Math.round(cor) & 0xffffff;
        ctx.save();
        ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
        ctx.translate(x, y);
        if (ang) ctx.rotate(-ang * Math.PI / 180);
        if (xs !== 1 || ys !== 1) ctx.scale(xs, ys);
        const dx = it.tx - ox;
        const dy = it.ty - oy;
        if (cor !== 0xffffff) {
            const t = this.tingir(it, cor);
            if (t) ctx.drawImage(t, 0, 0, it.sw, it.sh, dx, dy, it.tw, it.th);
        } else {
            ctx.drawImage(img, it.sx, it.sy, it.sw, it.sh, dx, dy, it.tw, it.th);
        }
        ctx.restore();
    }

    /** Parte de um item (em coordenadas do quadro original). */
    parte (it, left, top, w, h, x, y, xs = 1, ys = 1, cor = 0xffffff, alpha = 1) {
        const ctx = this.ctx;
        if (!it || !ctx || alpha <= 0) return;
        const img = cor === 0xffffff ? this.imagem(it) : this.tingir(it, cor);
        if (!img) return;
        const baseX = cor === 0xffffff ? it.sx : 0;
        const baseY = cor === 0xffffff ? it.sy : 0;
        // recorta o retângulo pedido contra a área que existe na textura
        const fx = it.sw / Math.max(1, it.tw);
        const fy = it.sh / Math.max(1, it.th);
        const x0 = Math.max(left, it.tx);
        const y0 = Math.max(top, it.ty);
        const x1 = Math.min(left + w, it.tx + it.tw);
        const y1 = Math.min(top + h, it.ty + it.th);
        if (x1 <= x0 || y1 <= y0) return;
        ctx.save();
        ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
        ctx.translate(x, y);
        ctx.scale(xs, ys);
        ctx.drawImage(img, baseX + ((x0 - it.tx) * fx), baseY + ((y0 - it.ty) * fy), (x1 - x0) * fx, (y1 - y0) * fy,
            x0 - left, y0 - top, x1 - x0, y1 - y0);
        ctx.restore();
    }

    sprite (spr, sub, x, y, xs = 1, ys = 1, ang = 0, cor = 0xffffff, alpha = 1) {
        const s = this.dw.sprites[spr];
        if (!s || !s.quadros.length) return;
        const n = s.quadros.length;
        const k = ((Math.floor(sub) % n) + n) % n;
        this.item(s.quadros[k], x, y, s.origemX, s.origemY, xs, ys, ang, cor, alpha);
    }

    // ---------------------------------------------------------------- texto
    fonteAtual () {
        return this.dw.fontes[this.fonte] || null;
    }

    linhas (t) {
        let s = String(t);
        if (!this.dw.info.v23) s = s.replace(/(^|[^\\])#/g, '$1\n').replace(/\\#/g, '#');
        return s.split(/\r?\n/);
    }

    larguraLinha (l, f) {
        if (!f) {
            this.ctx.font = '16px sans-serif';
            return this.ctx.measureText(l).width;
        }
        let w = 0;
        for (const ch of l) {
            const g = f.glifos.get(ch.codePointAt(0)) || f.glifos.get(32);
            if (g) w += g.avanco;
        }
        return w;
    }

    alturaLinha (f) {
        if (!f) return 18;
        const g = f.glifos.get(77) || f.glifos.get(65);
        return g ? g.h : (f.altura || 16);
    }

    larguraTexto (t) {
        const f = this.fonteAtual();
        return Math.max(0, ...this.linhas(t).map(l => this.larguraLinha(l, f)));
    }

    alturaTexto (t) {
        return this.linhas(t).length * this.alturaLinha(this.fonteAtual());
    }

    texto (x, y, t, opcoes = {}) {
        const ctx = this.ctx;
        if (!ctx) return;
        const f = this.fonteAtual();
        const {xs = 1, ys = 1, ang = 0, cor = this.cor, alpha = this.alpha, sep = -1, largura = -1} = opcoes;
        let linhas = this.linhas(t);
        // quebra automática (draw_text_ext)
        if (largura > 0) {
            const novas = [];
            for (const l of linhas) {
                let atual = '';
                for (const palavra of l.split(' ')) {
                    const tentativa = atual ? `${atual} ${palavra}` : palavra;
                    if (atual && this.larguraLinha(tentativa, f) > largura) {
                        novas.push(atual);
                        atual = palavra;
                    } else {
                        atual = tentativa;
                    }
                }
                novas.push(atual);
            }
            linhas = novas;
        }
        const alt = sep > 0 ? sep : this.alturaLinha(f);
        const total = alt * linhas.length;
        ctx.save();
        ctx.translate(x, y);
        if (ang) ctx.rotate(-ang * Math.PI / 180);
        ctx.scale(xs, ys);
        ctx.globalAlpha *= alpha;
        let yy = this.valign === 1 ? -total / 2 : (this.valign === 2 ? -total : 0);
        for (const l of linhas) {
            const w = this.larguraLinha(l, f);
            let xx = this.halign === 1 ? -w / 2 : (this.halign === 2 ? -w : 0);
            if (!f) {
                ctx.font = '16px sans-serif';
                ctx.textBaseline = 'top';
                ctx.fillStyle = corCss(cor);
                ctx.fillText(l, xx, yy);
            } else {
                for (const ch of l) {
                    const g = f.glifos.get(ch.codePointAt(0));
                    if (g) {
                        if (g.w && g.h) {
                            this.glifo(f, g, xx + g.desloc, yy, cor);
                        }
                        xx += g.avanco;
                    } else {
                        const esp = f.glifos.get(32);
                        xx += esp ? esp.avanco : 8;
                    }
                }
            }
            yy += alt;
        }
        ctx.restore();
    }

    glifo (f, g, x, y, cor) {
        if (g.item) {
            // fonte de sprite
            this.item(g.item, x, y, 0, 0, 1, 1, 0, cor & 0xffffff, 1);
            return;
        }
        const it = f.pagina;
        if (!it) return;
        const sub = {textura: it.textura, sx: it.sx + g.x, sy: it.sy + g.y, sw: g.w, sh: g.h, tx: 0, ty: 0, tw: g.w, th: g.h};
        const img = (cor & 0xffffff) === 0xffffff ? this.imagem(it) : this.tingir(sub, cor & 0xffffff);
        if (!img) return;
        if ((cor & 0xffffff) === 0xffffff) this.ctx.drawImage(img, sub.sx, sub.sy, g.w, g.h, x, y, g.w, g.h);
        else this.ctx.drawImage(img, 0, 0, g.w, g.h, x, y, g.w, g.h);
    }
}
