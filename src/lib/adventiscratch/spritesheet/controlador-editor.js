/**
 * Editor do controlador de animação de um ator (máquina de estados).
 *  - Estados (caixas): cada um toca uma animação. Arraste para mover; duplo clique no fundo cria um estado.
 *  - Transições (setas): puxe a bolinha da direita de um estado até outro. Clique na seta para ver as condições.
 *  - "Qualquer estado": transições que saem dele valem de onde o ator estiver (ex.: levar dano).
 *  - Parâmetros (à esquerda): número, verdadeiro/falso ou gatilho, mudados pelos blocos da extensão Animações.
 */
import {
    obterControlador, definirControlador, controladorVazio, normalizarControlador, novoId, QUALQUER, OPS_NUMERO
} from './controladores.js';
import {animacoesDoAtor} from './animacoes-extension.js';

const LARG = 160;
const ALTN = 54;
const SVGNS = 'http://www.w3.org/2000/svg';

const CSS = `
.adv-ctl{position:fixed;inset:0;z-index:15000;background:#17112E;color:#fff;display:flex;flex-direction:column;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px}
.adv-ctl-topo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(90deg,#1E9C8A,#6D4FC2)}
.adv-ctl-topo h2{margin:0 10px 0 0;font-size:19px}
.adv-ctl button{font:inherit;font-weight:700;border:0;border-radius:9px;padding:7px 12px;cursor:pointer;background:rgba(255,255,255,.18);color:#fff}
.adv-ctl button:hover{background:rgba(255,255,255,.3)}
.adv-ctl button:disabled{opacity:.35;cursor:default}
.adv-ctl button.prim{background:#5BBF4A}
.adv-ctl button.perigo{background:rgba(255,90,90,.4)}
.adv-ctl .esp{flex:1}
.adv-ctl-corpo{flex:1;display:grid;grid-template-columns:250px 1fr 310px;min-height:0}
.adv-ctl-lado{background:#221A45;padding:12px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.adv-ctl-lado h3{margin:2px 0 4px;font-size:15px;color:#E3DAFF}
.adv-ctl-lado p{margin:0;font-size:13px;color:#CFC4F5;line-height:1.4}
.adv-ctl input,.adv-ctl select{font:inherit;border:0;border-radius:8px;padding:5px 7px;background:#fff;color:#1B1338;min-width:0}
.adv-ctl .param{display:grid;grid-template-columns:1fr 92px 26px;gap:4px;align-items:center;background:#2E2560;padding:6px;border-radius:10px}
.adv-ctl .param .val{grid-column:1 / span 3;display:flex;align-items:center;gap:6px;font-size:12.5px;color:#CFC4F5}
.adv-ctl .param button,.adv-ctl .cond button{padding:3px 7px;background:rgba(255,90,90,.35)}
.adv-ctl .cond{display:grid;grid-template-columns:1fr 88px 64px 26px;gap:4px;align-items:center}
.adv-ctl label.campo{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:#CFC4F5}
.adv-ctl label.chk{display:flex;gap:6px;align-items:center;font-size:13.5px}
.adv-ctl .aviso{background:rgba(255,201,40,.15);border:1px solid #FFC928;border-radius:8px;padding:6px 8px;font-size:12.5px}
.adv-ctl .lista-trans button{display:block;width:100%;text-align:left;margin-top:4px;background:#2E2560;font-weight:600}
.adv-ctl-grafo{overflow:auto;background:#120D26;background-image:radial-gradient(rgba(255,255,255,.08) 1px,transparent 1px);
  background-size:24px 24px;position:relative}
.adv-ctl-grafo svg{display:block}
.adv-ctl-grafo .no rect{cursor:grab}
.adv-ctl-grafo text{pointer-events:none;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
.adv-ctl-grafo .alca{cursor:crosshair}
.adv-ctl-grafo .seta{cursor:pointer}
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const el = (tag, attrs = {}, pai) => {
    const e = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (pai) pai.appendChild(e);
    return e;
};

/** Ponto na borda do retângulo (centro cx, cy) na direção de (dx, dy). */
const borda = (cx, cy, dx, dy, w, h) => {
    const sx = dx === 0 ? Infinity : (w / 2) / Math.abs(dx);
    const sy = dy === 0 ? Infinity : (h / 2) / Math.abs(dy);
    const s = Math.min(sx, sy);
    return {x: cx + (dx * s), y: cy + (dy * s)};
};

const resumoCondicoes = t => {
    const partes = t.condicoes.map(k => {
        if (k.op === 'disparado') return `⚡${k.param}`;
        if (k.op === 'verdadeiro') return k.param;
        if (k.op === 'falso') return `não ${k.param}`;
        return `${k.param} ${k.op} ${k.valor}`;
    });
    if (t.aoTerminar) partes.unshift('⏱ fim');
    return partes.join(' e ') || '⚠ sem condição';
};

/**
 * Abre o editor do controlador do ator que está sendo editado.
 * @param {VirtualMachine} vm VM
 */
export const abrirEditorControlador = vm => {
    if (document.querySelector('.adv-ctl')) return;
    const alvo = vm.editingTarget;
    if (!alvo || alvo.isStage) {
        window.dispatchEvent(new CustomEvent('adventiscratch-aviso', {detail: {texto:
            'Escolha um ator (não o Palco) para criar o controlador de animação.'}}));
        return;
    }
    if (!document.getElementById('adv-ctl-css')) {
        const st = document.createElement('style');
        st.id = 'adv-ctl-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const nomeAtor = alvo.getName();
    const c = normalizarControlador(obterControlador(nomeAtor) || controladorVazio());
    if (!c.qualquer) c.qualquer = {x: 40, y: 30};
    const anims = () => Array.from(animacoesDoAtor(alvo).entries()).map(([nome, q]) => ({nome, n: q.length}));
    let selecao = null; // {tipo: 'estado'|'transicao'|'qualquer', id}
    let arraste = null;

    const raiz = document.createElement('div');
    raiz.className = 'adv-ctl';
    raiz.innerHTML = `
      <div class="adv-ctl-topo">
        <h2>🎛️ Controlador de animação — ${esc(nomeAtor)}</h2>
        <button class="novo">＋ Estado</button>
        <button class="auto" title="Cria um estado para cada animação do ator">⚡ Estados das animações</button>
        <button class="inicial">★ Tornar inicial</button>
        <button class="perigo apagar">🗑 Apagar</button>
        <span class="esp"></span>
        <button class="prim fechar">✓ Pronto</button>
      </div>
      <div class="adv-ctl-corpo">
        <div class="adv-ctl-lado params"></div>
        <div class="adv-ctl-grafo"><svg width="1800" height="1100"></svg></div>
        <div class="adv-ctl-lado insp"></div>
      </div>`;
    document.body.appendChild(raiz);
    const $ = s => raiz.querySelector(s);
    const svg = $('svg');
    const grafo = $('.adv-ctl-grafo');
    raiz.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Delete' && !/INPUT|SELECT/.test(e.target.tagName)) apagarSelecionado(); // eslint-disable-line no-use-before-define
    });
    raiz.tabIndex = -1;

    let timerSalvar = null;
    const salvar = () => {
        clearTimeout(timerSalvar);
        timerSalvar = setTimeout(() => definirControlador(nomeAtor, c), 250);
    };

    const estadoPorId = id => c.estados.find(e => e.id === id);
    const nomeLivre = base => {
        let n = base;
        let i = 2;
        while (c.estados.some(e => e.nome === n)) n = `${base} ${i++}`;
        return n;
    };
    const criarEstado = (nome, animacao, x, y) => {
        const e = {id: novoId(), nome: nomeLivre(nome), animacao: animacao || '', qps: 24, loop: true, x, y};
        c.estados.push(e);
        if (!c.inicial) c.inicial = e.id;
        return e;
    };

    // ---------------------------------------------------------------- grafo
    const posNo = id => (id === QUALQUER ? c.qualquer : estadoPorId(id));

    const desenhar = () => {
        svg.innerHTML = '';
        const defs = el('defs', {}, svg);
        ['#CFC4F5', '#FFC928'].forEach((cor, i) => {
            const mk = el('marker', {id: `adv-ponta${i}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7,
                markerHeight: 7, orient: 'auto-start-reverse'}, defs);
            el('path', {'d': 'M0 0 L10 5 L0 10 z', 'fill': cor}, mk);
        });
        // setas
        c.transicoes.forEach(t => {
            const a = posNo(t.de);
            const b = posNo(t.para);
            if (!a || !b) return;
            const ax = a.x + (LARG / 2);
            const ay = a.y + (ALTN / 2);
            const bx = b.x + (LARG / 2);
            const by = b.y + (ALTN / 2);
            let dx = bx - ax;
            let dy = by - ay;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;
            // se tem seta nos dois sentidos, afasta uma da outra
            const volta = c.transicoes.some(o => o.de === t.para && o.para === t.de);
            const off = volta ? 9 : 0;
            const ox = -dy * off;
            const oy = dx * off;
            const p1 = borda(ax, ay, dx, dy, LARG + 8, ALTN + 8);
            const p2 = borda(bx, by, -dx, -dy, LARG + 12, ALTN + 12);
            const sel = selecao && selecao.tipo === 'transicao' && selecao.id === t.id;
            const cor = sel ? '#FFC928' : '#CFC4F5';
            const valida = t.aoTerminar || t.condicoes.length;
            const g = el('g', {class: 'seta'}, svg);
            el('line', {'x1': p1.x + ox, 'y1': p1.y + oy, 'x2': p2.x + ox, 'y2': p2.y + oy, 'stroke': 'transparent',
                'stroke-width': 14}, g);
            el('line', {'x1': p1.x + ox, 'y1': p1.y + oy, 'x2': p2.x + ox, 'y2': p2.y + oy, 'stroke': cor,
                'stroke-width': sel ? 3 : 2, 'stroke-dasharray': valida ? '' : '6 5',
                'marker-end': `url(#adv-ponta${sel ? 1 : 0})`}, g);
            const mx = ((p1.x + p2.x) / 2) + (ox * 2.2);
            const my = ((p1.y + p2.y) / 2) + (oy * 2.2);
            const txt = resumoCondicoes(t);
            const w = Math.min(190, (txt.length * 6.4) + 12);
            el('rect', {'x': mx - (w / 2), 'y': my - 10, 'width': w, 'height': 20, 'rx': 8,
                'fill': sel ? '#FFC928' : '#2E2560', 'stroke': valida ? 'none' : '#FF9F5A'}, g);
            const t2 = el('text', {'x': mx, 'y': my + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700,
                'fill': sel ? '#1B1338' : '#fff'}, g);
            t2.textContent = txt.length > 30 ? `${txt.slice(0, 29)}…` : txt;
            g.addEventListener('mousedown', ev => {
                ev.stopPropagation();
                selecao = {tipo: 'transicao', id: t.id};
                atualizar(); // eslint-disable-line no-use-before-define
            });
        });
        // nós
        const no = (id, x, y, titulo, sub, cores) => {
            const sel = selecao && selecao.id === id;
            const g = el('g', {'class': 'no', 'data-id': id, 'transform': `translate(${x} ${y})`}, svg);
            el('rect', {'width': LARG, 'height': ALTN, 'rx': 12, 'fill': cores.fundo,
                'stroke': sel ? '#FFC928' : cores.borda, 'stroke-width': sel ? 3.5 : 2}, g);
            const t1 = el('text', {'x': 12, 'y': 22, 'font-size': 14, 'font-weight': 700, 'fill': '#fff'}, g);
            t1.textContent = titulo.length > 18 ? `${titulo.slice(0, 17)}…` : titulo;
            const t2 = el('text', {'x': 12, 'y': 40, 'font-size': 11.5, 'fill': 'rgba(255,255,255,.75)'}, g);
            t2.textContent = sub.length > 24 ? `${sub.slice(0, 23)}…` : sub;
            const alca = el('circle', {'class': 'alca', 'cx': LARG, 'cy': ALTN / 2, 'r': 8, 'fill': '#FFC928',
                'stroke': '#1B1338', 'stroke-width': 2}, g);
            alca.addEventListener('mousedown', ev => {
                ev.stopPropagation();
                const r = svg.getBoundingClientRect();
                arraste = {tipo: 'ligar', de: id, x: ev.clientX - r.left, y: ev.clientY - r.top};
            });
            g.addEventListener('mousedown', ev => {
                ev.stopPropagation();
                selecao = {tipo: id === QUALQUER ? 'qualquer' : 'estado', id};
                const r = svg.getBoundingClientRect();
                const alvoNo = posNo(id);
                arraste = {tipo: 'mover', id, dx: ev.clientX - r.left - alvoNo.x, dy: ev.clientY - r.top - alvoNo.y};
                atualizar(); // eslint-disable-line no-use-before-define
            });
            return g;
        };
        no(QUALQUER, c.qualquer.x, c.qualquer.y, 'Qualquer estado', 'vale de onde estiver',
            {fundo: '#11685C', borda: '#2BD1B8'});
        c.estados.forEach(e => {
            const inicial = e.id === c.inicial;
            const temAnim = anims().some(a => a.nome === e.animacao);
            no(e.id, e.x, e.y, `${inicial ? '▶ ' : ''}${e.nome}`,
                e.animacao ? `${temAnim ? '🎞️' : '⚠'} ${e.animacao}` : '(sem animação)',
                {fundo: inicial ? '#8A4A16' : '#3A2F78', borda: inicial ? '#FF9F5A' : '#6D5BC0'});
        });
        if (arraste && arraste.tipo === 'ligar') {
            const a = posNo(arraste.de);
            el('line', {'x1': a.x + LARG, 'y1': a.y + (ALTN / 2), 'x2': arraste.x, 'y2': arraste.y, 'stroke': '#FFC928',
                'stroke-width': 2.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#adv-ponta1)',
                'pointer-events': 'none'}, svg);
        }
        if (!c.estados.length) {
            const t = el('text', {'x': 260, 'y': 200, 'font-size': 16, 'fill': '#CFC4F5'}, svg);
            t.textContent = 'Clique em "⚡ Estados das animações" ou dê duplo clique aqui para criar um estado.';
        }
    };

    svg.addEventListener('mousedown', () => {
        selecao = null;
        atualizar(); // eslint-disable-line no-use-before-define
    });
    svg.addEventListener('dblclick', ev => {
        if (ev.target !== svg) return;
        const r = svg.getBoundingClientRect();
        const e = criarEstado('estado', '', ev.clientX - r.left - (LARG / 2), ev.clientY - r.top - (ALTN / 2));
        selecao = {tipo: 'estado', id: e.id};
        salvar();
        atualizar(); // eslint-disable-line no-use-before-define
    });
    const aoMover = ev => {
        if (!arraste) return;
        const r = svg.getBoundingClientRect();
        if (arraste.tipo === 'mover') {
            const n = posNo(arraste.id);
            n.x = Math.max(0, Math.min(1800 - LARG, Math.round((ev.clientX - r.left - arraste.dx) / 6) * 6));
            n.y = Math.max(0, Math.min(1100 - ALTN, Math.round((ev.clientY - r.top - arraste.dy) / 6) * 6));
            arraste.moveu = true;
        } else {
            arraste.x = ev.clientX - r.left;
            arraste.y = ev.clientY - r.top;
        }
        desenhar();
    };
    const aoSoltar = ev => {
        const a = arraste;
        arraste = null;
        if (!a) return;
        if (a.tipo === 'ligar') {
            const g = document.elementFromPoint(ev.clientX, ev.clientY);
            const alvoNo = g && g.closest && g.closest('.no');
            const para = alvoNo && alvoNo.getAttribute('data-id');
            if (para && para !== QUALQUER && para !== a.de) {
                let t = c.transicoes.find(x => x.de === a.de && x.para === para);
                if (!t) {
                    t = {id: novoId(), de: a.de, para, aoTerminar: false, condicoes: []};
                    c.transicoes.push(t);
                }
                selecao = {tipo: 'transicao', id: t.id};
                salvar();
            }
            atualizar(); // eslint-disable-line no-use-before-define
        } else if (a.moveu) {
            salvar();
        }
    };
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);

    // ---------------------------------------------------------------- parâmetros
    const montarParametros = () => {
        const div = $('.params');
        div.innerHTML = `<h3>Parâmetros</h3><p>Valores que os blocos mudam (ex.: <b>velocidade</b>, <b>no chão</b>,
          <b>pular</b>). As transições olham para eles.</p>`;
        c.parametros.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'param';
            row.innerHTML = `<input class="nome" value="${esc(p.nome)}" maxlength="40">
              <select class="tipo"><option value="numero">número</option><option value="booleano">sim/não</option>
              <option value="gatilho">gatilho</option></select><button title="Apagar">✕</button>
              <div class="val"></div>`;
            row.querySelector('.tipo').value = p.tipo;
            const val = row.querySelector('.val');
            if (p.tipo === 'numero') {
                val.innerHTML = 'começa em <input type="number" step="any" style="width:80px">';
                val.querySelector('input').value = p.valor;
                val.querySelector('input').onchange = e => {
                    p.valor = Number(e.target.value) || 0;
                    salvar();
                };
            } else if (p.tipo === 'booleano') {
                val.innerHTML = '<label class="chk"><input type="checkbox"> começa ligado</label>';
                val.querySelector('input').checked = Boolean(p.valor);
                val.querySelector('input').onchange = e => {
                    p.valor = e.target.checked;
                    salvar();
                };
            } else {
                val.textContent = 'dispara uma vez, com o bloco "disparar gatilho"';
            }
            row.querySelector('.nome').onchange = e => {
                let novo = e.target.value.trim() || p.nome;
                if (c.parametros.some(o => o !== p && o.nome === novo)) novo = p.nome;
                c.transicoes.forEach(t => t.condicoes.forEach(k => {
                    if (k.param === p.nome) k.param = novo;
                }));
                p.nome = novo;
                e.target.value = novo;
                salvar();
                atualizar(); // eslint-disable-line no-use-before-define
            };
            row.querySelector('.tipo').onchange = e => {
                p.tipo = e.target.value;
                p.valor = p.tipo === 'booleano' ? false : 0;
                // ajusta as condições que usam esse parâmetro
                c.transicoes.forEach(t => t.condicoes.forEach(k => {
                    if (k.param !== p.nome) return;
                    k.op = p.tipo === 'gatilho' ? 'disparado' : (p.tipo === 'booleano' ? 'verdadeiro' : '>');
                    k.valor = 0;
                }));
                salvar();
                atualizar(); // eslint-disable-line no-use-before-define
            };
            row.querySelector('button').onclick = () => {
                c.parametros.splice(i, 1);
                c.transicoes.forEach(t => {
                    t.condicoes = t.condicoes.filter(k => k.param !== p.nome);
                });
                salvar();
                atualizar(); // eslint-disable-line no-use-before-define
            };
            div.appendChild(row);
        });
        const add = document.createElement('button');
        add.textContent = '＋ Parâmetro';
        add.onclick = () => {
            let n = 'parametro';
            let i = 2;
            while (c.parametros.some(p => p.nome === n)) n = `parametro${i++}`;
            c.parametros.push({nome: n, tipo: 'numero', valor: 0});
            salvar();
            atualizar(); // eslint-disable-line no-use-before-define
            const ins = div.querySelectorAll('.param .nome');
            if (ins.length) ins[ins.length - 1].select();
        };
        div.appendChild(add);
        const dica = document.createElement('p');
        dica.innerHTML = '<br><b>Blocos:</b> definir parâmetro, mudar parâmetro, disparar gatilho, estado da animação, ' +
            'ir para o estado, quando entrar no estado.';
        div.appendChild(dica);
    };

    // ---------------------------------------------------------------- inspetor
    const opcoesOp = p => {
        if (!p) return ['='];
        if (p.tipo === 'booleano') return ['verdadeiro', 'falso'];
        if (p.tipo === 'gatilho') return ['disparado'];
        return OPS_NUMERO;
    };
    const nomeOp = op => ({verdadeiro: 'é sim', falso: 'é não', disparado: 'disparou'}[op] || op);

    const montarInspetor = () => {
        const div = $('.insp');
        if (!selecao) {
            div.innerHTML = `<h3>Como usar</h3>
              <p>1. Importe uma spritesheet ou crie fantasias com nomes tipo <b>andar0001</b>, <b>andar0002</b>.</p>
              <p>2. Clique em <b>⚡ Estados das animações</b>: cada animação vira um estado.</p>
              <p>3. Puxe a <b style="color:#FFC928">bolinha amarela</b> de um estado até outro para criar uma transição,
                e escolha as condições aqui.</p>
              <p>4. Nos scripts, use <b>definir parâmetro</b> e <b>disparar gatilho</b>. Ao clicar na bandeira, o ator
                começa no estado <b>▶ inicial</b> e troca sozinho.</p>
              <p>Dica: transições que saem de <b>Qualquer estado</b> valem de onde o ator estiver (ex.: "levou dano").</p>`;
            return;
        }
        if (selecao.tipo === 'qualquer') {
            const saidas = c.transicoes.filter(t => t.de === QUALQUER);
            div.innerHTML = `<h3>Qualquer estado</h3><p>Puxe a bolinha amarela até um estado para criar uma transição
              que vale de qualquer lugar.</p><div class="lista-trans"></div>`;
            const lt = div.querySelector('.lista-trans');
            saidas.forEach(t => {
                const b = document.createElement('button');
                b.textContent = `→ ${estadoPorId(t.para).nome}: ${resumoCondicoes(t)}`;
                b.onclick = () => {
                    selecao = {tipo: 'transicao', id: t.id};
                    atualizar(); // eslint-disable-line no-use-before-define
                };
                lt.appendChild(b);
            });
            return;
        }
        if (selecao.tipo === 'estado') {
            const e = estadoPorId(selecao.id);
            if (!e) {
                selecao = null;
                montarInspetor();
                return;
            }
            const lista = anims();
            div.innerHTML = `<h3>Estado</h3>
              <label class="campo">Nome <input class="nome" maxlength="40"></label>
              <label class="campo">Animação <select class="anim"><option value="">(nenhuma)</option>
                ${lista.map(a => `<option value="${esc(a.nome)}">${esc(a.nome)} (${a.n})</option>`).join('')}
                ${e.animacao && !lista.some(a => a.nome === e.animacao) ?
        `<option value="${esc(e.animacao)}">⚠ ${esc(e.animacao)} (não existe)</option>` : ''}</select></label>
              <label class="campo">Quadros por segundo <input class="qps" type="number" min="0.1" max="120" step="any"></label>
              <label class="chk"><input type="checkbox" class="loop"> Repetir (loop)</label>
              ${e.id === c.inicial ? '<p>▶ Este é o estado <b>inicial</b>.</p>' :
        '<button class="ini">★ Tornar inicial</button>'}
              <h3 style="margin-top:8px">Transições que saem daqui</h3><div class="lista-trans"></div>
              ${lista.length ? '' : '<div class="aviso">Este ator não tem animações. Importe uma spritesheet ou nomeie ' +
                'as fantasias com números no fim (andar1, andar2…).</div>'}`;
            div.querySelector('.nome').value = e.nome;
            div.querySelector('.anim').value = e.animacao;
            div.querySelector('.qps').value = e.qps;
            div.querySelector('.loop').checked = e.loop;
            div.querySelector('.nome').onchange = ev => {
                const novo = ev.target.value.trim();
                if (novo && !c.estados.some(o => o !== e && o.nome === novo)) e.nome = novo;
                ev.target.value = e.nome;
                salvar();
                desenhar();
            };
            div.querySelector('.anim').onchange = ev => {
                e.animacao = ev.target.value;
                if (e.nome.startsWith('estado') && e.animacao) e.nome = nomeLivre(e.animacao);
                salvar();
                atualizar(); // eslint-disable-line no-use-before-define
            };
            div.querySelector('.qps').onchange = ev => {
                e.qps = Math.max(0.1, Math.min(120, Number(ev.target.value) || 24));
                salvar();
            };
            div.querySelector('.loop').onchange = ev => {
                e.loop = ev.target.checked;
                salvar();
            };
            const ini = div.querySelector('.ini');
            if (ini) {
                ini.onclick = () => {
                    c.inicial = e.id;
                    salvar();
                    atualizar(); // eslint-disable-line no-use-before-define
                };
            }
            const lt = div.querySelector('.lista-trans');
            c.transicoes.filter(t => t.de === e.id).forEach(t => {
                const b = document.createElement('button');
                b.textContent = `→ ${estadoPorId(t.para).nome}: ${resumoCondicoes(t)}`;
                b.onclick = () => {
                    selecao = {tipo: 'transicao', id: t.id};
                    atualizar(); // eslint-disable-line no-use-before-define
                };
                lt.appendChild(b);
            });
            if (!lt.children.length) lt.innerHTML = '<p>Nenhuma. Puxe a bolinha amarela até outro estado.</p>';
            return;
        }
        const t = c.transicoes.find(x => x.id === selecao.id);
        if (!t) {
            selecao = null;
            montarInspetor();
            return;
        }
        const de = t.de === QUALQUER ? 'Qualquer estado' : estadoPorId(t.de).nome;
        div.innerHTML = `<h3>Transição</h3><p><b>${esc(de)}</b> → <b>${esc(estadoPorId(t.para).nome)}</b></p>
          <label class="chk"><input type="checkbox" class="fim"> Esperar a animação terminar</label>
          <h3 style="margin-top:6px">Condições (todas precisam valer)</h3><div class="conds"></div>
          <button class="maisCond">＋ Condição</button>
          ${t.aoTerminar || t.condicoes.length ? '' : '<div class="aviso">⚠ Sem nenhuma condição esta transição nunca ' +
            'acontece. Marque "esperar a animação terminar" ou adicione uma condição.</div>'}
          ${c.parametros.length ? '' : '<div class="aviso">Crie um parâmetro (à esquerda) para usar nas condições.</div>'}`;
        div.querySelector('.fim').checked = t.aoTerminar;
        div.querySelector('.fim').onchange = ev => {
            t.aoTerminar = ev.target.checked;
            salvar();
            atualizar(); // eslint-disable-line no-use-before-define
        };
        const conds = div.querySelector('.conds');
        t.condicoes.forEach((k, i) => {
            const p = c.parametros.find(x => x.nome === k.param);
            const row = document.createElement('div');
            row.className = 'cond';
            row.innerHTML = `<select class="p">${c.parametros.map(x => `<option value="${esc(x.nome)}">${esc(x.nome)}</option>`)
                .join('')}</select><select class="op">${opcoesOp(p).map(o => `<option value="${esc(o)}">${esc(nomeOp(o))}</option>`)
                .join('')}</select><input class="v" type="number" step="any"><button title="Apagar">✕</button>`;
            row.querySelector('.p').value = k.param;
            row.querySelector('.op').value = k.op;
            const v = row.querySelector('.v');
            v.value = k.valor;
            v.style.visibility = p && p.tipo === 'numero' ? 'visible' : 'hidden';
            row.querySelector('.p').onchange = ev => {
                k.param = ev.target.value;
                const np = c.parametros.find(x => x.nome === k.param);
                k.op = opcoesOp(np)[0];
                k.valor = 0;
                salvar();
                atualizar(); // eslint-disable-line no-use-before-define
            };
            row.querySelector('.op').onchange = ev => {
                k.op = ev.target.value;
                salvar();
                desenhar();
            };
            v.onchange = ev => {
                k.valor = Number(ev.target.value) || 0;
                salvar();
                desenhar();
            };
            row.querySelector('button').onclick = () => {
                t.condicoes.splice(i, 1);
                salvar();
                atualizar(); // eslint-disable-line no-use-before-define
            };
            conds.appendChild(row);
        });
        const mais = div.querySelector('.maisCond');
        mais.disabled = !c.parametros.length;
        mais.onclick = () => {
            const p = c.parametros[0];
            t.condicoes.push({param: p.nome, op: opcoesOp(p)[0], valor: 0});
            salvar();
            atualizar(); // eslint-disable-line no-use-before-define
        };
    };

    // ---------------------------------------------------------------- topo
    const apagarSelecionado = () => {
        if (!selecao || selecao.tipo === 'qualquer') return;
        if (selecao.tipo === 'estado') {
            c.estados = c.estados.filter(e => e.id !== selecao.id);
            c.transicoes = c.transicoes.filter(t => t.de !== selecao.id && t.para !== selecao.id);
            if (c.inicial === selecao.id) c.inicial = c.estados[0] ? c.estados[0].id : null;
        } else {
            c.transicoes = c.transicoes.filter(t => t.id !== selecao.id);
        }
        selecao = null;
        salvar();
        atualizar(); // eslint-disable-line no-use-before-define
    };

    function atualizar () {
        desenhar();
        montarParametros();
        montarInspetor();
        $('.inicial').disabled = !(selecao && selecao.tipo === 'estado' && selecao.id !== c.inicial);
        $('.apagar').disabled = !(selecao && selecao.tipo !== 'qualquer');
    }

    $('.novo').onclick = () => {
        const e = criarEstado('estado', '', 250 + ((c.estados.length % 4) * 280), 170 + (Math.floor(c.estados.length / 4) * 170));
        selecao = {tipo: 'estado', id: e.id};
        salvar();
        atualizar();
    };
    $('.auto').onclick = () => {
        const lista = anims().filter(a => !c.estados.some(e => e.animacao === a.nome));
        if (!lista.length) {
            window.dispatchEvent(new CustomEvent('adventiscratch-aviso', {detail: {texto: anims().length ?
                'Todas as animações já têm um estado.' : 'Este ator ainda não tem animações (importe uma spritesheet).'}}));
            return;
        }
        const base = c.estados.length;
        lista.forEach((a, i) => {
            const k = base + i;
            const e = criarEstado(a.nome, a.nome, 250 + ((k % 4) * 280), 170 + (Math.floor(k / 4) * 170));
            // animações de ficar parado repetem; as outras (pulo, ataque…) tocam uma vez
            e.loop = /idle|parad|dance|andar|walk|run|corr/i.test(a.nome);
        });
        const idle = c.estados.find(e => /idle|parad/i.test(e.nome));
        if (idle && base === 0) c.inicial = idle.id;
        salvar();
        atualizar();
    };
    $('.inicial').onclick = () => {
        if (selecao && selecao.tipo === 'estado') c.inicial = selecao.id;
        salvar();
        atualizar();
    };
    $('.apagar').onclick = apagarSelecionado;
    const fechar = () => {
        clearTimeout(timerSalvar);
        definirControlador(nomeAtor, c);
        window.removeEventListener('mousemove', aoMover);
        window.removeEventListener('mouseup', aoSoltar);
        raiz.remove();
        delete window.adventiscratchControlador;
    };
    $('.fechar').onclick = fechar;
    // para depurar pelo console (F12)
    window.adventiscratchControlador = {controlador: () => c};
    grafo.scrollTo(0, 0);
    atualizar();
};
