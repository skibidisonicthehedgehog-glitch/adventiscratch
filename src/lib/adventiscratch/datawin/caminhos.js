/**
 * Caminhos (paths) do GameMaker: transforma os pontos numa linha (reta ou suave), mede o
 * comprimento e devolve a posição/velocidade em qualquer ponto (0 = começo, 1 = fim).
 */

const meio = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: (a.v + b.v) / 2});

// curva de Bézier quadrática (início, controle, fim) dividida em 2^precisão pedaços
const bezier = (saida, a, c, b, precisao) => {
    const n = Math.max(1, Math.pow(2, Math.min(8, precisao || 4)));
    for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        saida.push({
            x: (u * u * a.x) + (2 * u * t * c.x) + (t * t * b.x),
            y: (u * u * a.y) + (2 * u * t * c.y) + (t * t * b.y),
            v: (u * u * a.v) + (2 * u * t * c.v) + (t * t * b.v)
        });
    }
};

export const prepararCaminho = c => {
    if (c.cache) return c.cache;
    const p = c.pontos;
    let pts = [];
    if (p.length < 2) {
        pts = p.length ? [p[0], p[0]] : [{x: 0, y: 0, v: 100}, {x: 0, y: 0, v: 100}];
    } else if (!c.suave) {
        pts = p.slice();
        if (c.fechado) pts.push(p[0]);
    } else if (c.fechado) {
        const n = p.length;
        pts.push(meio(p[n - 1], p[0]));
        for (let i = 0; i < n; i++) {
            const a = meio(p[(i + n - 1) % n], p[i]);
            const b = meio(p[i], p[(i + 1) % n]);
            bezier(pts, a, p[i], b, c.precisao);
        }
    } else {
        const n = p.length;
        pts.push(p[0]);
        if (n === 2) {
            pts.push(p[1]);
        } else {
            for (let i = 1; i < n - 1; i++) {
                const a = i === 1 ? p[0] : meio(p[i - 1], p[i]);
                const b = i === n - 2 ? p[n - 1] : meio(p[i], p[i + 1]);
                bezier(pts, a, p[i], b, c.precisao);
            }
        }
    }
    const acum = [0];
    for (let i = 1; i < pts.length; i++) {
        acum.push(acum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    c.cache = {pts, acum, total: acum[acum.length - 1]};
    return c.cache;
};

/** Posição no caminho (t de 0 a 1). */
export const pontoNoCaminho = (c, t) => {
    const {pts, acum, total} = prepararCaminho(c);
    t = Math.max(0, Math.min(1, t));
    if (total <= 0) return {...pts[0]};
    const alvo = t * total;
    let lo = 0;
    let hi = acum.length - 1;
    while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (acum[m] <= alvo) lo = m;
        else hi = m;
    }
    const seg = acum[hi] - acum[lo];
    const f = seg > 0 ? (alvo - acum[lo]) / seg : 0;
    const a = pts[lo];
    const b = pts[hi];
    return {x: a.x + ((b.x - a.x) * f), y: a.y + ((b.y - a.y) * f), v: a.v + ((b.v - a.v) * f)};
};

export const comprimentoDoCaminho = c => prepararCaminho(c).total;
