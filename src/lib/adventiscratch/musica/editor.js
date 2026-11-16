/**
 * Criador de Músicas: tela cheia com grade de piano (Melodia, Baixo, Acordes) e grade de bateria.
 * Clique para pôr ou tirar notas, arraste para deixar a nota mais longa.
 */
import {
    PASSOS_POR_BATIDA, PASSOS_POR_COMPASSO, LINHAS_BATERIA, NOMES_BATERIA,
    nomesMusicas, obterMusica, copiarMusica, gravarMusica, apagarMusica, nomeLivre, totalPassos
} from './dados.js';
import {INSTRUMENTOS, Tocador, tocarNota, tocarBateria, nomeNota} from './sintetizador.js';
import {MODELOS} from './modelos.js';
import {instrumentosExtras, aoMudarInstrumentosExtras} from './soundfont-store.js';

const NOTA_MAX = 96; // Dó7
const NOTA_MIN = 36; // Dó2
const LINHAS = NOTA_MAX - NOTA_MIN + 1;
const TECLADO = 64;
const REGUA = 26;
const CEL = 24; // largura de um passo
const ALT = 16; // altura de uma linha do piano
const ALT_BAT = 40;
const PRETAS = new Set([1, 3, 6, 8, 10]);
const CORES = {melodia: '#B48CFF', baixo: '#FF9F5A', acordes: '#5BD1C9', bateria: '#FFC928'};
const DURACOES = [
    {d: 1, txt: '𝅘𝅥𝅯 1/16'}, {d: 2, txt: '♪ 1/8'}, {d: 4, txt: '♩ 1/4'}, {d: 8, txt: '𝅗𝅥 1/2'}, {d: 16, txt: '𝅝 inteira'}
];

const CSS = `
.adv-mus{position:fixed;inset:0;z-index:15000;background:#17112E;color:#fff;display:flex;flex-direction:column;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px}
.adv-mus-topo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(90deg,#6D4FC2,#C24BCF)}
.adv-mus-topo h2{margin:0 8px 0 0;font-size:19px;white-space:nowrap}
.adv-mus input,.adv-mus select{font:inherit;border-radius:8px;border:0;padding:6px 8px;background:#fff;color:#1B1338}
.adv-mus input[type=range]{padding:0;background:transparent}
.adv-mus button{font:inherit;font-weight:700;border:0;border-radius:9px;padding:7px 12px;cursor:pointer;
  background:rgba(255,255,255,.18);color:#fff}
.adv-mus button:hover{background:rgba(255,255,255,.3)}
.adv-mus button.ativo{background:#FFC928;color:#1B1338}
.adv-mus button.salvar{background:#5BBF4A}
.adv-mus button.perigo{background:rgba(255,90,90,.35)}
.adv-mus label{display:flex;align-items:center;gap:5px;white-space:nowrap}
.adv-mus .esp{flex:1}
.adv-mus-abas{display:flex;gap:4px;padding:8px 14px 0;background:#221A45}
.adv-mus-abas button{border-radius:10px 10px 0 0;background:#2E2560;padding:9px 16px}
.adv-mus-abas button.ativo{background:#3A2F78;color:#fff;box-shadow:inset 0 3px 0 var(--cor)}
.adv-mus-faixa{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 14px;background:#3A2F78}
.adv-mus-grade{flex:1;overflow:auto;position:relative;background:#120D26}
.adv-mus-grade .espaco{position:relative}
.adv-mus-grade canvas{position:sticky;top:0;left:0;display:block;cursor:crosshair}
.adv-mus-rodape{padding:6px 14px;font-size:12.5px;color:#CFC4F5;background:#221A45;display:flex;gap:16px;flex-wrap:wrap}
.adv-mus-aviso{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:#1B1338;border:2px solid #FFC928;
  padding:8px 16px;border-radius:12px;z-index:5;pointer-events:none;transition:opacity .3s}
`;

let aberto = null;

/**
 * Abre o Criador de Músicas.
 * @param {VirtualMachine} vm VM do Scratch (usa o áudio dela)
 * @param {string} [nomeInicial] música para abrir
 */
export const abrirCriadorDeMusicas = (vm, nomeInicial) => {
    if (aberto) return;
    if (!document.getElementById('adv-mus-css')) {
        const st = document.createElement('style');
        st.id = 'adv-mus-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const audio = vm.runtime.audioEngine;
    const ctx = () => audio.audioContext;
    const saida = () => audio.inputNode;
    const tocador = new Tocador(ctx, saida);
    tocador.repetir = true;

    let m;
    let nomeOriginal = null; // nome com que a música está gravada no projeto (null = nova)
    let alterado = false;
    let aba = 'melodia';
    let duracao = 2;
    let arrastando = null;

    const raiz = document.createElement('div');
    raiz.className = 'adv-mus';
    raiz.innerHTML = `
      <div class="adv-mus-topo">
        <h2>🎼 Criador de Músicas</h2>
        <select class="lista" title="Músicas deste projeto"></select>
        <label>Nome <input class="nome" maxlength="40" style="width:150px"></label>
        <label>BPM <input class="bpm" type="number" min="40" max="240" style="width:64px"></label>
        <label>Compassos <select class="compassos"></select></label>
        <button class="tocar" title="Tocar / pausar (Espaço)">▶ Tocar</button>
        <button class="parar" title="Parar e voltar ao começo">⏹</button>
        <button class="repetir ativo" title="Repetir">🔁</button>
        <span class="esp"></span>
        <label>Começar de <select class="modelo" style="max-width:190px"></select></label>
        <button class="perigo apagar">🗑 Apagar</button>
        <button class="salvar">✓ Salvar no projeto</button>
        <button class="fechar">✕ Fechar</button>
      </div>
      <div class="adv-mus-abas"></div>
      <div class="adv-mus-faixa"></div>
      <div class="adv-mus-grade"><div class="espaco"><canvas></canvas></div></div>
      <div class="adv-mus-rodape">
        <span>🖱️ Clique para pôr uma nota · clique numa nota para tirar · arraste para deixar mais longa</span>
        <span>Clique na régua para tocar dali · <b>Espaço</b> toca/pausa · teclado à esquerda toca a nota</span>
      </div>
      <div class="adv-mus-aviso" style="opacity:0"></div>`;
    document.body.appendChild(raiz);
    const $ = s => raiz.querySelector(s);
    const grade = $('.adv-mus-grade');
    const espaco = $('.espaco');
    const canvas = $('canvas');
    const g = canvas.getContext('2d');

    const aviso = txt => {
        const a = $('.adv-mus-aviso');
        a.textContent = txt;
        a.style.opacity = 1;
        clearTimeout(aviso.t);
        aviso.t = setTimeout(() => {
            a.style.opacity = 0;
        }, 1800);
    };

    const marcarAlterado = () => {
        alterado = true;
        $('.salvar').textContent = '✓ Salvar no projeto *';
    };

    const faixaAtual = () => m.faixas.find(f => f.id === aba);

    // ---------- interface ----------
    const preencherLista = () => {
        const sel = $('.lista');
        const nomes = nomesMusicas();
        sel.innerHTML = '';
        if (!nomeOriginal) sel.add(new Option(`${m.nome} (nova)`, ''));
        nomes.forEach(n => sel.add(new Option(`🎵 ${n}`, n)));
        sel.add(new Option('＋ Nova música', '__nova__'));
        sel.value = nomeOriginal || '';
    };

    const instrumentosOpcoes = atual => {
        const extras = instrumentosExtras();
        let html = INSTRUMENTOS.map(i => `<option value="${i.id}"${i.id === atual ? ' selected' : ''}>${i.nome}</option>`)
            .join('');
        if (extras.length) {
            html += '<optgroup label="SoundFont (.sf2)">' + extras.map(i =>
                `<option value="${i.id}"${i.id === atual ? ' selected' : ''}>🎚️ ${i.nome}</option>`).join('') + '</optgroup>';
        }
        html += '<option value="__importar__">📂 Importar instrumento .sf2…</option>';
        html += '<option value="__loja__">🛒 Loja de Instrumentos Virtuais…</option>';
        return html;
    };

    const montarAbas = () => {
        const abas = $('.adv-mus-abas');
        abas.innerHTML = '';
        [['melodia', '🎹 Melodia'], ['baixo', '🎸 Baixo'], ['acordes', '🎶 Acordes'], ['bateria', '🥁 Bateria']]
            .forEach(([id, txt]) => {
                const b = document.createElement('button');
                b.textContent = txt;
                b.style.setProperty('--cor', CORES[id]);
                if (id === aba) b.classList.add('ativo');
                b.addEventListener('click', () => {
                    aba = id;
                    montarAbas();
                    montarFaixa();
                    ajustarTamanho(true);
                });
                abas.appendChild(b);
            });
    };

    const montarFaixa = () => {
        const div = $('.adv-mus-faixa');
        if (aba === 'bateria') {
            div.innerHTML = `<label>Volume da bateria <input class="vol" type="range" min="0" max="1" step="0.05"
                value="${m.bateria.volume}"></label><button class="limpar">Limpar bateria</button>
                <span style="opacity:.8">Clique nos quadradinhos para ligar e desligar cada som.</span>`;
            div.querySelector('.vol').addEventListener('input', e => {
                m.bateria.volume = Number(e.target.value);
                marcarAlterado();
            });
            div.querySelector('.limpar').addEventListener('click', () => {
                LINHAS_BATERIA.forEach(l => {
                    m.bateria.linhas[l] = [];
                });
                marcarAlterado();
            });
            return;
        }
        const f = faixaAtual();
        div.innerHTML = `<label>Instrumento <select class="inst">${instrumentosOpcoes(f.instrumento)}</select></label>
            <label>Volume <input class="vol" type="range" min="0" max="1" step="0.05" value="${f.volume}"></label>
            <span>Tamanho da nota:</span>${DURACOES.map(d =>
        `<button class="dur${d.d === duracao ? ' ativo' : ''}" data-d="${d.d}">${d.txt}</button>`).join('')}
            <button class="limpar">Limpar faixa</button>`;
        div.querySelector('.inst').addEventListener('change', e => {
            const v = e.target.value;
            if (v === '__importar__' || v === '__loja__') {
                e.target.value = f.instrumento;
                const evento = v === '__importar__' ? 'adventiscratch-importar-sf2' : 'adventiscratch-loja-instrumentos';
                window.dispatchEvent(new CustomEvent(evento, {detail: {aoEscolher: id => {
                    f.instrumento = id;
                    marcarAlterado();
                    montarFaixa();
                }}}));
                return;
            }
            f.instrumento = v;
            marcarAlterado();
            tocarNota(ctx(), saida(), f.instrumento, aba === 'baixo' ? 43 : 67, ctx().currentTime + 0.01, 0.4, f.volume);
        });
        div.querySelector('.vol').addEventListener('input', e => {
            f.volume = Number(e.target.value);
            marcarAlterado();
        });
        div.querySelectorAll('.dur').forEach(b => b.addEventListener('click', () => {
            duracao = Number(b.dataset.d);
            montarFaixa();
        }));
        div.querySelector('.limpar').addEventListener('click', () => {
            f.notas = [];
            marcarAlterado();
        });
    };

    const preencherCampos = () => {
        $('.nome').value = m.nome;
        $('.bpm').value = m.bpm;
        const sc = $('.compassos');
        sc.innerHTML = '';
        for (let i = 1; i <= 32; i++) sc.add(new Option(String(i), String(i)));
        sc.value = String(m.compassos);
        const sm = $('.modelo');
        sm.innerHTML = '<option value="">—</option>' + MODELOS.map(x => `<option value="${x.id}">${x.nome}</option>`).join('');
        preencherLista();
        montarAbas();
        montarFaixa();
    };

    // ---------- tamanho e rolagem ----------
    const larguraMundo = () => TECLADO + (totalPassos(m) * CEL);
    const alturaMundo = () => REGUA + (aba === 'bateria' ? LINHAS_BATERIA.length * ALT_BAT : LINHAS * ALT);

    const ajustarTamanho = rolarParaNotas => {
        espaco.style.width = `${larguraMundo()}px`;
        espaco.style.height = `${alturaMundo()}px`;
        canvas.width = Math.max(100, grade.clientWidth);
        canvas.height = Math.max(100, grade.clientHeight);
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        canvas.style.marginBottom = `-${canvas.height}px`;
        if (rolarParaNotas && aba !== 'bateria') {
            const f = faixaAtual();
            const media = f.notas.length ? f.notas.reduce((s, n) => s + n.n, 0) / f.notas.length :
                (aba === 'baixo' ? 43 : 67);
            grade.scrollTop = Math.max(0, ((NOTA_MAX - media) * ALT) - (canvas.height / 2));
        }
    };

    // ---------- coordenadas ----------
    const paraPasso = x => Math.floor((x + grade.scrollLeft - TECLADO) / CEL);
    const paraNota = y => NOTA_MAX - Math.floor((y + grade.scrollTop - REGUA) / ALT);
    const paraLinhaBat = y => Math.floor((y + grade.scrollTop - REGUA) / ALT_BAT);

    const notaEm = (f, p, n) => f.notas.find(x => x.n === n && p >= x.p && p < x.p + x.d);

    const posMouse = ev => {
        const r = canvas.getBoundingClientRect();
        return {x: ev.clientX - r.left, y: ev.clientY - r.top};
    };

    canvas.addEventListener('mousedown', ev => {
        const {x, y} = posMouse(ev);
        if (y < REGUA && x >= TECLADO) {
            const p = Math.max(0, paraPasso(x));
            if (tocador.estado === 'parada') {
                tocador.tocar(m, p);
                atualizarBotaoTocar();
            } else {
                tocador.irPara(p);
            }
            return;
        }
        if (y < REGUA) return;
        if (aba === 'bateria') {
            if (x < TECLADO) {
                const l = LINHAS_BATERIA[paraLinhaBat(y)];
                if (l) tocarBateria(ctx(), saida(), l, ctx().currentTime + 0.01, m.bateria.volume);
                return;
            }
            const l = LINHAS_BATERIA[paraLinhaBat(y)];
            const p = paraPasso(x);
            if (!l || p < 0 || p >= totalPassos(m)) return;
            const lista = m.bateria.linhas[l];
            const i = lista.indexOf(p);
            if (i >= 0) {
                lista.splice(i, 1);
            } else {
                lista.push(p);
                tocarBateria(ctx(), saida(), l, ctx().currentTime + 0.01, m.bateria.volume);
            }
            arrastando = {bateria: true, linha: l, ligar: i < 0};
            marcarAlterado();
            return;
        }
        const n = paraNota(y);
        if (n < NOTA_MIN || n > NOTA_MAX) return;
        const f = faixaAtual();
        if (x < TECLADO) {
            tocarNota(ctx(), saida(), f.instrumento, n, ctx().currentTime + 0.01, 0.5, f.volume);
            return;
        }
        const p = paraPasso(x);
        if (p < 0 || p >= totalPassos(m)) return;
        const existente = notaEm(f, p, n);
        if (existente) {
            f.notas.splice(f.notas.indexOf(existente), 1);
            marcarAlterado();
            return;
        }
        const nova = {p, n, d: Math.min(duracao, totalPassos(m) - p)};
        f.notas.push(nova);
        tocarNota(ctx(), saida(), f.instrumento, n, ctx().currentTime + 0.01, Math.min(0.6, nova.d * 0.12), f.volume);
        arrastando = {nota: nova};
        marcarAlterado();
    });
    const aoMover = ev => {
        if (!arrastando) return;
        const {x, y} = posMouse(ev);
        const p = Math.max(0, Math.min(totalPassos(m) - 1, paraPasso(x)));
        if (arrastando.nota) {
            arrastando.nota.d = Math.max(1, p - arrastando.nota.p + 1);
        } else if (arrastando.bateria) {
            // arrastar na bateria liga (ou desliga) vários quadradinhos seguidos
            const l = LINHAS_BATERIA[paraLinhaBat(y)];
            if (l !== arrastando.linha) return;
            const lista = m.bateria.linhas[l];
            const i = lista.indexOf(p);
            if (arrastando.ligar && i < 0) lista.push(p);
            if (!arrastando.ligar && i >= 0) lista.splice(i, 1);
        }
    };
    const aoSoltar = () => {
        arrastando = null;
    };
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);

    // ---------- desenho ----------
    const desenhar = () => {
        const W = canvas.width;
        const H = canvas.height;
        const sx = grade.scrollLeft;
        const sy = grade.scrollTop;
        const total = totalPassos(m);
        g.fillStyle = '#120D26';
        g.fillRect(0, 0, W, H);
        const x0 = TECLADO - sx;
        const passoIni = Math.max(0, Math.floor(sx / CEL));
        const passoFim = Math.min(total, Math.ceil((sx + W) / CEL) + 1);

        if (aba === 'bateria') {
            LINHAS_BATERIA.forEach((l, i) => {
                const y = REGUA + (i * ALT_BAT) - sy;
                g.fillStyle = i % 2 ? '#1A1436' : '#1E1840';
                g.fillRect(TECLADO, y, W, ALT_BAT);
            });
        } else {
            for (let n = NOTA_MAX; n >= NOTA_MIN; n--) {
                const y = REGUA + ((NOTA_MAX - n) * ALT) - sy;
                if (y > H || y + ALT < REGUA) continue;
                g.fillStyle = PRETAS.has(n % 12) ? '#151030' : '#1C1640';
                g.fillRect(TECLADO, y, W, ALT);
                if (n % 12 === 0) {
                    g.fillStyle = 'rgba(255,255,255,.12)';
                    g.fillRect(TECLADO, y + ALT - 1, W, 1);
                }
            }
        }
        // linhas verticais
        for (let p = passoIni; p <= passoFim; p++) {
            const x = x0 + (p * CEL);
            if (x < TECLADO) continue;
            g.fillStyle = p % PASSOS_POR_COMPASSO === 0 ? 'rgba(255,255,255,.35)' :
                (p % PASSOS_POR_BATIDA === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)');
            g.fillRect(x, REGUA, 1, H);
        }
        g.save();
        g.beginPath();
        g.rect(TECLADO, REGUA, W, H);
        g.clip();
        if (aba === 'bateria') {
            LINHAS_BATERIA.forEach((l, i) => {
                const y = REGUA + (i * ALT_BAT) - sy;
                for (const p of m.bateria.linhas[l]) {
                    const x = x0 + (p * CEL);
                    if (x < TECLADO - CEL || x > W) continue;
                    g.fillStyle = CORES.bateria;
                    g.beginPath();
                    g.roundRect(x + 3, y + 6, CEL - 6, ALT_BAT - 12, 5);
                    g.fill();
                }
            });
        } else {
            // notas das outras faixas, bem clarinhas
            for (const f of m.faixas) {
                const atual = f.id === aba;
                g.fillStyle = atual ? CORES[f.id] : 'rgba(255,255,255,.12)';
                for (const n of f.notas) {
                    const x = x0 + (n.p * CEL);
                    const y = REGUA + ((NOTA_MAX - n.n) * ALT) - sy;
                    if (x > W || x + (n.d * CEL) < TECLADO || y > H || y + ALT < REGUA) continue;
                    if (atual) continue;
                    g.fillRect(x + 1, y + 2, (n.d * CEL) - 2, ALT - 4);
                }
            }
            const f = faixaAtual();
            for (const n of f.notas) {
                const x = x0 + (n.p * CEL);
                const y = REGUA + ((NOTA_MAX - n.n) * ALT) - sy;
                if (x > W || x + (n.d * CEL) < TECLADO || y > H || y + ALT < REGUA) continue;
                g.fillStyle = CORES[f.id];
                g.beginPath();
                g.roundRect(x + 1, y + 1, (n.d * CEL) - 2, ALT - 2, 4);
                g.fill();
                g.fillStyle = 'rgba(0,0,0,.25)';
                g.fillRect(x + (n.d * CEL) - 5, y + 3, 2, ALT - 6);
            }
        }
        g.restore();

        // teclado / nomes da bateria
        g.fillStyle = '#0D0920';
        g.fillRect(0, REGUA, TECLADO, H);
        g.font = 'bold 11px Helvetica, Arial, sans-serif';
        g.textBaseline = 'middle';
        if (aba === 'bateria') {
            LINHAS_BATERIA.forEach((l, i) => {
                const y = REGUA + (i * ALT_BAT) - sy;
                g.fillStyle = '#2E2560';
                g.fillRect(2, y + 2, TECLADO - 4, ALT_BAT - 4);
                g.fillStyle = '#fff';
                g.fillText(NOMES_BATERIA[l], 8, y + (ALT_BAT / 2));
            });
        } else {
            for (let n = NOTA_MAX; n >= NOTA_MIN; n--) {
                const y = REGUA + ((NOTA_MAX - n) * ALT) - sy;
                if (y > H || y + ALT < REGUA) continue;
                const preta = PRETAS.has(n % 12);
                g.fillStyle = preta ? '#222' : '#F4F1FF';
                g.fillRect(preta ? 0 : 0, y, preta ? TECLADO * 0.62 : TECLADO - 1, ALT - 1);
                if (n % 12 === 0) {
                    g.fillStyle = '#6D4FC2';
                    g.fillText(nomeNota(n), TECLADO - 34, y + (ALT / 2));
                }
            }
        }
        // régua
        g.fillStyle = '#2E2560';
        g.fillRect(0, 0, W, REGUA);
        for (let p = passoIni; p < passoFim; p++) {
            if (p % PASSOS_POR_BATIDA !== 0) continue;
            const x = x0 + (p * CEL);
            if (x < TECLADO - 4) continue;
            const batida = (p / PASSOS_POR_BATIDA) + 1;
            const compasso = p % PASSOS_POR_COMPASSO === 0;
            g.fillStyle = compasso ? '#FFC928' : 'rgba(255,255,255,.6)';
            g.fillText(compasso ? `${(p / PASSOS_POR_COMPASSO) + 1}` : `·${batida}`, x + 4, REGUA / 2);
        }
        g.fillStyle = '#1B1338';
        g.fillRect(0, 0, TECLADO, REGUA);
        g.fillStyle = '#CFC4F5';
        g.fillText('compasso', 4, REGUA / 2);
        // agulha
        if (tocador.estado !== 'parada') {
            const x = x0 + (tocador.passoAtual() * CEL);
            if (x >= TECLADO) {
                g.fillStyle = '#FF5A5A';
                g.fillRect(x - 1, 0, 3, H);
            }
        }
        // fim da música
        const xf = x0 + (total * CEL);
        if (xf < W) {
            g.fillStyle = 'rgba(0,0,0,.45)';
            g.fillRect(xf, 0, W - xf, H);
        }
    };

    let quadro = null;
    const laco = () => {
        desenhar();
        quadro = requestAnimationFrame(laco);
    };

    // ---------- controles ----------
    const atualizarBotaoTocar = () => {
        $('.tocar').textContent = tocador.estado === 'tocando' ? '⏸ Pausar' : '▶ Tocar';
    };
    const tocarPausar = () => {
        if (tocador.estado === 'tocando') tocador.pausar();
        else if (tocador.estado === 'pausada') tocador.continuar();
        else tocador.tocar(m, 0);
        atualizarBotaoTocar();
    };
    $('.tocar').addEventListener('click', tocarPausar);
    $('.parar').addEventListener('click', () => {
        tocador.parar();
        atualizarBotaoTocar();
    });
    $('.repetir').addEventListener('click', e => {
        tocador.repetir = !tocador.repetir;
        e.target.classList.toggle('ativo', tocador.repetir);
    });
    $('.nome').addEventListener('input', e => {
        m.nome = e.target.value;
        if (!nomeOriginal) $('.lista').options[0].text = `${m.nome} (nova)`;
        marcarAlterado();
    });
    $('.bpm').addEventListener('change', e => {
        m.bpm = Math.max(40, Math.min(240, Math.round(Number(e.target.value) || 110)));
        e.target.value = m.bpm;
        tocador.trocarMusica(m);
        marcarAlterado();
    });
    $('.compassos').addEventListener('change', e => {
        m.compassos = Number(e.target.value);
        const total = totalPassos(m);
        m.faixas.forEach(f => {
            f.notas = f.notas.filter(n => n.p < total);
            f.notas.forEach(n => {
                n.d = Math.min(n.d, total - n.p);
            });
        });
        LINHAS_BATERIA.forEach(l => {
            m.bateria.linhas[l] = m.bateria.linhas[l].filter(p => p < total);
        });
        ajustarTamanho();
        marcarAlterado();
    });
    $('.modelo').addEventListener('change', e => {
        const mod = MODELOS.find(x => x.id === e.target.value);
        e.target.value = '';
        if (!mod) return;
        if (alterado && !window.confirm('Trocar as notas desta música pelo modelo escolhido?')) return; // eslint-disable-line no-alert
        const nome = m.nome;
        m = mod.criar();
        m.nome = nome;
        tocador.trocarMusica(m);
        if (tocador.estado !== 'parada') tocador.tocar(m, 0);
        preencherCampos();
        ajustarTamanho(true);
        marcarAlterado();
        aviso(`Modelo "${mod.nome}" carregado. Mude o que quiser!`);
    });

    const carregar = nome => {
        tocador.parar();
        atualizarBotaoTocar();
        if (nome && obterMusica(nome)) {
            m = copiarMusica(obterMusica(nome));
            nomeOriginal = nome;
        } else {
            m = MODELOS[0].criar();
            m.nome = nomeLivre('minha música');
            nomeOriginal = null;
        }
        alterado = false;
        $('.salvar').textContent = '✓ Salvar no projeto';
        preencherCampos();
        ajustarTamanho(true);
    };

    const salvar = () => {
        const nome = (m.nome || '').trim() || 'minha música';
        if (nome !== nomeOriginal && obterMusica(nome)) {
            aviso(`Já existe uma música chamada "${nome}". Escolha outro nome.`);
            $('.nome').focus();
            return false;
        }
        m.nome = nome;
        gravarMusica(m, nomeOriginal);
        nomeOriginal = nome;
        alterado = false;
        $('.salvar').textContent = '✓ Salvo';
        preencherLista();
        aviso(`"${nome}" salva no projeto. Use os blocos de Músicas para tocar no jogo!`);
        return true;
    };
    $('.salvar').addEventListener('click', salvar);

    $('.lista').addEventListener('change', e => {
        const v = e.target.value;
        if (alterado && !window.confirm('Há mudanças não salvas nesta música. Trocar mesmo assim?')) { // eslint-disable-line no-alert
            preencherLista();
            return;
        }
        carregar(v === '__nova__' ? null : v);
    });
    $('.apagar').addEventListener('click', () => {
        if (!nomeOriginal) {
            carregar(null);
            return;
        }
        if (!window.confirm(`Apagar a música "${nomeOriginal}" do projeto?`)) return; // eslint-disable-line no-alert
        apagarMusica(nomeOriginal);
        const resto = nomesMusicas();
        carregar(resto[0] || null);
    });

    const aoTeclar = ev => {
        // teclas digitadas em outra janela aberta por cima (loja, escolher instrumento) ficam com ela
        const alvo = ev.target;
        if (alvo && alvo !== document.body && alvo !== document.documentElement && !raiz.contains(alvo)) return;
        const campo = alvo && /INPUT|SELECT|TEXTAREA/.test(alvo.tagName);
        if (ev.key === ' ' && !campo) {
            tocarPausar();
            ev.preventDefault();
        }
        if (ev.key === 'Escape') fechar();
        ev.stopPropagation(); // o palco do Scratch não recebe as teclas enquanto o editor está aberto
    };
    window.addEventListener('keydown', aoTeclar, true);
    const aoRedimensionar = () => ajustarTamanho();
    window.addEventListener('resize', aoRedimensionar);
    const pararInstrumentos = aoMudarInstrumentosExtras(() => montarFaixa());

    const fechar = () => {
        if (alterado) {
            const r = window.confirm('Salvar as mudanças desta música antes de fechar?'); // eslint-disable-line no-alert
            if (r && !salvar()) return;
        }
        tocador.parar();
        cancelAnimationFrame(quadro);
        window.removeEventListener('keydown', aoTeclar, true);
        window.removeEventListener('mousemove', aoMover);
        window.removeEventListener('mouseup', aoSoltar);
        window.removeEventListener('resize', aoRedimensionar);
        pararInstrumentos();
        raiz.remove();
        aberto = null;
    };
    $('.fechar').addEventListener('click', fechar);

    aberto = {fechar};
    carregar(nomeInicial && obterMusica(nomeInicial) ? nomeInicial : (nomesMusicas()[0] || null));
    laco();
};

export const criadorAberto = () => Boolean(aberto);
