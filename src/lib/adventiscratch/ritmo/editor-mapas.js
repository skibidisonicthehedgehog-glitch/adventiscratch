/**
 * Editor de mapas de ritmo (tela cheia).
 *  - Setas (estilo FNF): linha do tempo com as pistas do oponente e do jogador. Clique põe nota, clique numa nota
 *    tira, arraste move, puxe a ponta para fazer nota longa.
 *  - Círculos (estilo osu!): clique no palco para pôr um círculo no tempo do marcador (o marcador anda sozinho),
 *    arraste para mover; na faixa de baixo, arraste para mudar o tempo.
 *  - ⏺ Gravar: com a música tocando, as teclas (setas, D F J K) ou cliques viram notas.
 *  - ✨ Gerar: cria notas a partir da melodia de uma música do Criador (ou pelo BPM).
 *  - 📂 Importar: .osu (osu!) e .json (Friday Night Funkin').
 */
import {
    SIMBOLOS, mapaVazio, normalizarMapa, nomesMapas, obterMapa, copiarMapa, gravarMapa, apagarMapa,
    nomeLivreMapa, fimDasNotas
} from './dados.js';
import {RelogioDoMapa, sonsDoProjeto} from './audio.js';
import {lerArquivoDeMapa} from './importar-mapas.js';
import {nomesMusicas, obterMusica, PASSOS_POR_BATIDA} from '../musica/dados.js';

const ESQ = 70; // coluna dos nomes das pistas
const REGUA = 26;
const LINHA = 42;
const CORES = ['#C24BCF', '#00C4E8', '#12C805', '#F9393F'];
const ESCALA_PALCO = 1.15;
const TECLAS = {ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, d: 0, f: 1, j: 2, k: 3};
const MAX_HIST = 80;

const CSS = `
.adv-mapa{position:fixed;inset:0;z-index:15000;background:#17112E;color:#fff;display:flex;flex-direction:column;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px}
.adv-mapa-topo{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:9px 14px;background:linear-gradient(90deg,#E0457B,#6D4FC2)}
.adv-mapa-topo h2{margin:0 6px 0 0;font-size:18px;white-space:nowrap}
.adv-mapa input,.adv-mapa select{font:inherit;border-radius:8px;border:0;padding:5px 7px;background:#fff;color:#1B1338}
.adv-mapa button{font:inherit;font-weight:700;border:0;border-radius:9px;padding:6px 11px;cursor:pointer;background:rgba(255,255,255,.18);color:#fff}
.adv-mapa button:hover{background:rgba(255,255,255,.3)}
.adv-mapa button.ativo{background:#FFC928;color:#1B1338}
.adv-mapa button.gravando{background:#FF3B3B;color:#fff;animation:adv-pisca 1s infinite}
@keyframes adv-pisca{50%{opacity:.6}}
.adv-mapa button.salvar{background:#5BBF4A}
.adv-mapa button.perigo{background:rgba(255,90,90,.4)}
.adv-mapa label{display:flex;align-items:center;gap:5px;white-space:nowrap}
.adv-mapa .esp{flex:1}
.adv-mapa-barra{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:7px 14px;background:#3A2F78}
.adv-mapa-barra .info{color:#E3DAFF;font-size:13px}
.adv-mapa-centro{flex:1;display:flex;flex-direction:column;min-height:0}
.adv-mapa-palco{display:flex;justify-content:center;align-items:center;padding:10px;background:#0D0920}
.adv-mapa-palco[hidden]{display:none}
.adv-mapa-palco canvas{border-radius:10px;box-shadow:0 0 0 2px #3A2F78;cursor:crosshair}
.adv-mapa-grade{flex:1;overflow:auto;position:relative;background:#120D26;min-height:110px}
.adv-mapa-grade .espaco{position:relative}
.adv-mapa-grade canvas{position:sticky;top:0;left:0;display:block}
.adv-mapa-rodape{padding:6px 14px;font-size:12.5px;color:#CFC4F5;background:#221A45;display:flex;gap:14px;flex-wrap:wrap}
.adv-mapa-rodape kbd{background:#3A2F78;border-radius:4px;padding:0 5px;font-family:inherit}
.adv-mapa-aviso{position:absolute;left:50%;top:72px;transform:translateX(-50%);background:#1B1338;border:2px solid #FFC928;
  padding:8px 16px;border-radius:12px;z-index:5;pointer-events:none;transition:opacity .3s}
`;

const dentro = (v, a, b) => Math.max(a, Math.min(b, v));

let aberto = null;

/**
 * Abre o editor de mapas.
 * @param {VirtualMachine} vm VM
 */
export const abrirEditorMapas = vm => {
    if (aberto) return;
    if (!document.getElementById('adv-mapa-css')) {
        const st = document.createElement('style');
        st.id = 'adv-mapa-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const relogio = new RelogioDoMapa(vm.runtime);
    let m;
    let nomeOriginal = null;
    let alterado = false;
    let historico = [];
    let futuro = [];
    let cursor = 0; // ms do mapa (onde começa a tocar e onde entram as notas/círculos)
    let encaixe = 4; // divisões por batida (0 = livre)
    let zoom = 0.25; // px por ms
    let gravando = false;
    let gravarEm = 'eu';
    let selecionado = null;
    let arraste = null;
    let ultimoTique = -1;
    const gravandoTeclas = {};

    const raiz = document.createElement('div');
    raiz.className = 'adv-mapa';
    raiz.innerHTML = `
      <div class="adv-mapa-topo">
        <h2>🎯 Editor de mapas de ritmo</h2>
        <select class="lista" title="Mapas deste projeto"></select>
        <label>Nome <input class="nome" maxlength="40" style="width:130px"></label>
        <label>Tipo <select class="modo"><option value="setas">⬅ Setas (FNF)</option><option value="circulos">⭕ Círculos (osu!)</option></select></label>
        <label>Áudio <select class="audio" style="max-width:180px"></select></label>
        <label>BPM <input class="bpm" type="number" min="20" max="400" step="any" style="width:62px"></label>
        <label title="Atraso do áudio em relação às notas, em milissegundos">Ajuste (ms) <input class="offset" type="number" step="5" style="width:62px"></label>
        <label>Velocidade <input class="vel" type="number" min="0.2" max="5" step="0.1" style="width:52px"></label>
        <label class="soSetas"><input type="checkbox" class="oponente"> Oponente</label>
        <span class="esp"></span>
        <button class="perigo apagar">🗑</button>
        <button class="salvar">✓ Salvar no projeto</button>
        <button class="fechar">✕ Fechar</button>
      </div>
      <div class="adv-mapa-barra">
        <button class="tocar" title="Tocar / pausar (Espaço)">▶ Tocar</button>
        <button class="parar" title="Voltar ao começo">⏮</button>
        <button class="gravar" title="Gravar tocando: as teclas viram notas">⏺ Gravar</button>
        <label class="soSetas">no lado do <select class="gravarEm"><option value="eu">jogador</option><option value="op">oponente</option></select></label>
        <label>Encaixe <select class="encaixe"><option value="1">1 batida</option><option value="2">1/2</option>
          <option value="4" selected>1/4</option><option value="8">1/8</option><option value="3">1/3</option><option value="0">livre</option></select></label>
        <label>Zoom <input class="zoom" type="range" min="0.06" max="0.8" step="0.01" value="0.25" style="width:110px"></label>
        <button class="gerar" title="Criar notas a partir da música">✨ Gerar</button>
        <button class="importar" title="Importar .osu ou .json do FNF">📂 Importar .osu / .json</button>
        <input type="file" class="arquivo" accept=".osu,.json" hidden>
        <button class="desfazer" title="Desfazer (Ctrl+Z)">↶</button>
        <button class="refazer" title="Refazer (Ctrl+Y)">↷</button>
        <span class="info"></span>
      </div>
      <div class="adv-mapa-centro">
        <div class="adv-mapa-palco" hidden><canvas></canvas></div>
        <div class="adv-mapa-grade"><div class="espaco"><canvas></canvas></div></div>
      </div>
      <div class="adv-mapa-rodape"></div>
      <div class="adv-mapa-aviso" style="opacity:0"></div>`;
    document.body.appendChild(raiz);
    const $ = s => raiz.querySelector(s);
    const grade = $('.adv-mapa-grade');
    const espaco = $('.espaco');
    const cv = $('.adv-mapa-grade canvas');
    const g = cv.getContext('2d');
    const palco = $('.adv-mapa-palco canvas');
    const gp = palco.getContext('2d');
    palco.width = Math.round(480 * ESCALA_PALCO);
    palco.height = Math.round(360 * ESCALA_PALCO);
    raiz.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (b) b.blur();
    });

    const aviso = txt => {
        const a = $('.adv-mapa-aviso');
        a.textContent = txt;
        a.style.opacity = 1;
        clearTimeout(aviso.t);
        aviso.t = setTimeout(() => {
            a.style.opacity = 0;
        }, 2200);
    };
    const marcar = () => {
        alterado = true;
        $('.salvar').textContent = '✓ Salvar no projeto *';
    };
    const registrar = () => {
        historico.push(JSON.stringify(m));
        if (historico.length > MAX_HIST) historico.shift();
        futuro = [];
        marcar();
    };
    const restaurar = json => {
        const nome = m.nome;
        m = JSON.parse(json);
        m.nome = nome;
        selecionado = null;
        preencher(); // eslint-disable-line no-use-before-define
    };
    const desfazer = () => {
        if (!historico.length) return aviso('Nada para desfazer');
        futuro.push(JSON.stringify(m));
        restaurar(historico.pop());
    };
    const refazer = () => {
        if (!futuro.length) return aviso('Nada para refazer');
        historico.push(JSON.stringify(m));
        restaurar(futuro.pop());
    };

    const circulos = () => m.modo === 'circulos';
    const msPorBatida = () => 60000 / m.bpm;
    const passoEncaixe = () => (encaixe ? msPorBatida() / encaixe : 0);
    const encaixar = t => {
        const p = passoEncaixe();
        return Math.max(0, p ? Math.round(t / p) * p : Math.round(t));
    };
    const tempoAgora = () => (relogio.estado === 'tocando' ? relogio.tempo() : cursor);
    const duracaoAudio = () => {
        const r = new RelogioDoMapa(vm.runtime);
        return r.preparar(m);
    };
    const duracaoTotal = () => Math.max(20000, fimDasNotas(m) + 4000, duracaoAudio() - m.offset + 1000);

    // ---------------------------------------------------------------- interface
    const preencherAudio = () => {
        const s = $('.audio');
        const musicas = nomesMusicas();
        const sons = sonsDoProjeto(vm.runtime);
        s.innerHTML = '<option value="nenhum:">(sem áudio, só o tempo)</option>' +
            (musicas.length ? `<optgroup label="🎼 Músicas do Criador">${musicas.map(n =>
                `<option value="musica:${n.replace(/"/g, '&quot;')}">${n.replace(/</g, '&lt;')}</option>`).join('')}</optgroup>` : '') +
            (sons.length ? `<optgroup label="🔊 Sons do projeto">${sons.map(x =>
                `<option value="som:${x.nome.replace(/"/g, '&quot;')}">${x.nome.replace(/</g, '&lt;')} (${x.ator
                    .replace(/</g, '&lt;')})</option>`).join('')}</optgroup>` : '');
        s.value = `${m.audio.tipo}:${m.audio.nome}`;
        if (s.value !== `${m.audio.tipo}:${m.audio.nome}`) s.value = 'nenhum:';
    };

    const preencherLista = () => {
        const s = $('.lista');
        s.innerHTML = '';
        if (!nomeOriginal) s.add(new Option(`${m.nome} (novo)`, ''));
        nomesMapas().forEach(n => s.add(new Option(`🎯 ${n}`, n)));
        s.add(new Option('＋ Novo mapa', '__novo__'));
        s.value = nomeOriginal || '';
    };

    const atualizarRodape = () => {
        $('.adv-mapa-rodape').innerHTML = circulos() ?
            `<span>⭕ Clique no palco para pôr um círculo no marcador amarelo (ele anda sozinho) · arraste para mover</span>
             <span>Na faixa de baixo: clique para mover o marcador, arraste um círculo para mudar o tempo · <kbd>Delete</kbd> apaga</span>
             <span>⏺ Gravar: clique ou aperte <kbd>Z</kbd>/<kbd>X</kbd> no palco com a música tocando</span>` :
            `<span>Clique para pôr nota · clique na nota para tirar · arraste para mover · puxe a ponta para nota longa</span>
             <span>⏺ Gravar: aperte as setas ou <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd> com a música tocando</span>
             <span><kbd>Espaço</kbd> toca/pausa · <kbd>Ctrl+Z</kbd> desfaz · clique na régua para mover o marcador</span>`;
    };

    const atualizarInfo = () => {
        const qtd = circulos() ? m.circulos.length : m.notas.length;
        const meu = m.notas.filter(n => n.quem === 'eu').length;
        $('.info').textContent = circulos() ? `${qtd} círculos` :
            `${qtd} notas (${meu} do jogador, ${qtd - meu} do oponente)`;
    };

    const ajustarTamanho = () => {
        const linhas = circulos() ? 1 : (m.oponente ? 9 : 4);
        const alturaGrade = REGUA + (linhas * LINHA) + (circulos() ? 30 : 0);
        espaco.style.width = `${ESQ + (duracaoTotal() * zoom) + 200}px`;
        espaco.style.height = `${alturaGrade}px`;
        grade.style.flex = circulos() ? `0 0 ${alturaGrade + 18}px` : '1';
        cv.width = Math.max(100, grade.clientWidth);
        cv.height = Math.max(60, Math.min(grade.clientHeight, alturaGrade + 4));
        cv.style.width = `${cv.width}px`;
        cv.style.height = `${cv.height}px`;
        cv.style.marginBottom = `-${cv.height}px`;
    };

    function preencher () {
        $('.nome').value = m.nome;
        $('.modo').value = m.modo;
        $('.bpm').value = m.bpm;
        $('.offset').value = m.offset;
        $('.vel').value = m.velocidade;
        $('.oponente').checked = m.oponente;
        raiz.querySelectorAll('.soSetas').forEach(e => {
            e.style.display = circulos() ? 'none' : '';
        });
        $('.adv-mapa-palco').hidden = !circulos();
        preencherAudio();
        preencherLista();
        atualizarRodape();
        atualizarInfo();
        ajustarTamanho();
    }

    // ---------------------------------------------------------------- coordenadas da linha do tempo
    const linhas = () => {
        // [{quem, pista, y}] de cima para baixo
        if (circulos()) return [];
        const r = [];
        let y = REGUA;
        if (m.oponente) {
            for (let p = 0; p < 4; p++) {
                r.push({quem: 'op', pista: p, y});
                y += LINHA;
            }
            y += LINHA; // separação
        }
        for (let p = 0; p < 4; p++) {
            r.push({quem: 'eu', pista: p, y});
            y += LINHA;
        }
        return r;
    };
    const xDoTempo = t => ESQ + (t * zoom) - grade.scrollLeft;
    const tempoDoX = x => (x + grade.scrollLeft - ESQ) / zoom;
    const linhaDoY = y => linhas().find(l => y >= l.y && y < l.y + LINHA) || null;
    const pos = (ev, el) => {
        const r = el.getBoundingClientRect();
        return {x: ev.clientX - r.left, y: ev.clientY - r.top};
    };

    // ---------------------------------------------------------------- desenho da linha do tempo
    const tique = () => {
        const c = relogio.ctx;
        const o = c.createOscillator();
        const gg = c.createGain();
        o.frequency.value = 1500;
        gg.gain.setValueAtTime(0.06, c.currentTime);
        gg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.04);
        o.connect(gg).connect(vm.runtime.audioEngine.inputNode);
        o.start();
        o.stop(c.currentTime + 0.05);
    };

    const desenharLinhaTempo = () => {
        const W = cv.width;
        const H = cv.height;
        g.fillStyle = '#120D26';
        g.fillRect(0, 0, W, H);
        const agora = tempoAgora();
        const t0 = Math.max(0, tempoDoX(ESQ));
        const t1 = tempoDoX(W);
        // linhas das batidas
        const mb = msPorBatida();
        const sub = passoEncaixe();
        if (sub && sub * zoom > 6) {
            g.fillStyle = 'rgba(255,255,255,.04)';
            for (let t = Math.floor(t0 / sub) * sub; t < t1; t += sub) g.fillRect(xDoTempo(t), REGUA, 1, H);
        }
        for (let b = Math.floor(t0 / mb); b * mb < t1; b++) {
            const x = xDoTempo(b * mb);
            g.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.12)';
            g.fillRect(x, REGUA, 1, H);
        }
        if (circulos()) {
            const y = REGUA + 6;
            g.fillStyle = '#1C1640';
            g.fillRect(ESQ, y, W, LINHA + 10);
            m.circulos.forEach((c, i) => {
                const x = xDoTempo(c.t);
                if (x < ESQ - 20 || x > W + 20) return;
                const sel = selecionado === c;
                g.beginPath();
                g.arc(x, y + 26, 14, 0, Math.PI * 2);
                g.fillStyle = CORES[i % 4];
                g.fill();
                g.lineWidth = sel ? 3 : 2;
                g.strokeStyle = sel ? '#FFC928' : '#fff';
                g.stroke();
                g.fillStyle = '#fff';
                g.font = 'bold 11px Helvetica, Arial, sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.fillText(String((i % 8) + 1), x, y + 26);
            });
            g.textAlign = 'left';
            g.fillStyle = '#0D0920';
            g.fillRect(0, REGUA, ESQ, H);
            g.fillStyle = '#CFC4F5';
            g.font = 'bold 12px Helvetica, Arial, sans-serif';
            g.fillText('círculos', 8, REGUA + 32);
        } else {
            for (const l of linhas()) {
                g.fillStyle = l.pista % 2 ? '#1A1436' : '#1E1840';
                g.fillRect(ESQ, l.y, W, LINHA);
            }
            if (m.oponente) {
                g.fillStyle = '#0D0920';
                g.fillRect(ESQ, REGUA + (4 * LINHA), W, LINHA);
            }
            // notas
            for (const n of m.notas) {
                const l = linhas().find(x => x.quem === n.quem && x.pista === n.pista);
                if (!l) continue;
                const x = xDoTempo(n.t);
                const x2 = xDoTempo(n.t + n.dur);
                if (x2 < ESQ - 20 || x > W + 20) continue;
                const cy = l.y + (LINHA / 2);
                if (n.dur > 0) {
                    g.fillStyle = CORES[n.pista];
                    g.globalAlpha = 0.55;
                    g.fillRect(x, cy - 6, x2 - x, 12);
                    g.globalAlpha = 1;
                    g.fillStyle = '#fff';
                    g.fillRect(x2 - 3, cy - 9, 3, 18);
                }
                const sel = selecionado === n;
                g.beginPath();
                g.arc(x, cy, 13, 0, Math.PI * 2);
                g.fillStyle = CORES[n.pista];
                g.fill();
                g.lineWidth = sel ? 3 : 1.5;
                g.strokeStyle = sel ? '#FFC928' : '#1B1338';
                g.stroke();
                g.fillStyle = '#fff';
                g.font = 'bold 14px Helvetica, Arial, sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.fillText(SIMBOLOS[n.pista], x, cy + 1);
            }
            g.textAlign = 'left';
            g.fillStyle = '#0D0920';
            g.fillRect(0, REGUA, ESQ, H);
            g.font = 'bold 12px Helvetica, Arial, sans-serif';
            for (const l of linhas()) {
                g.fillStyle = CORES[l.pista];
                g.fillText(`${l.quem === 'op' ? 'Op' : 'Você'} ${SIMBOLOS[l.pista]}`, 8, l.y + (LINHA / 2) + 1);
            }
        }
        // régua
        g.fillStyle = '#2E2560';
        g.fillRect(0, 0, W, REGUA);
        g.font = 'bold 11px Helvetica, Arial, sans-serif';
        g.textBaseline = 'middle';
        g.textAlign = 'left';
        for (let b = Math.floor(t0 / mb); b * mb < t1; b++) {
            if (b % 4 !== 0 && mb * zoom < 40) continue;
            const x = xDoTempo(b * mb);
            if (x < ESQ - 2) continue;
            g.fillStyle = b % 4 === 0 ? '#FFC928' : 'rgba(255,255,255,.6)';
            g.fillText(b % 4 === 0 ? `${(b / 4) + 1}` : `·${(b % 4) + 1}`, x + 4, REGUA / 2);
        }
        g.fillStyle = '#1B1338';
        g.fillRect(0, 0, ESQ, REGUA);
        g.fillStyle = '#CFC4F5';
        const s = Math.max(0, agora / 1000);
        g.fillText(`${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`, 6, REGUA / 2);
        // marcador (amarelo) e agulha (vermelha)
        const xc = xDoTempo(cursor);
        if (xc >= ESQ) {
            g.fillStyle = 'rgba(255,201,40,.5)';
            g.fillRect(xc, REGUA, 2, H);
            g.fillStyle = '#FFC928';
            g.beginPath();
            g.moveTo(xc - 6, REGUA - 9);
            g.lineTo(xc + 6, REGUA - 9);
            g.lineTo(xc, REGUA);
            g.fill();
        }
        if (relogio.estado === 'tocando') {
            const xa = xDoTempo(agora);
            g.fillStyle = '#FF5A5A';
            g.fillRect(xa - 1, 0, 3, H);
        }
    };

    // ---------------------------------------------------------------- palco (modo círculos)
    const px = x => (x + 240) * ESCALA_PALCO;
    const py = y => (180 - y) * ESCALA_PALCO;
    const doPalco = (x, y) => ({x: Math.round((x / ESCALA_PALCO) - 240), y: Math.round(180 - (y / ESCALA_PALCO))});
    const R = 30;
    const APROX = 900;

    const desenharPalco = () => {
        const W = palco.width;
        const H = palco.height;
        gp.fillStyle = '#1B1338';
        gp.fillRect(0, 0, W, H);
        gp.strokeStyle = 'rgba(255,255,255,.06)';
        for (let x = 0; x <= 480; x += 40) {
            gp.beginPath();
            gp.moveTo(px(x - 240), 0);
            gp.lineTo(px(x - 240), H);
            gp.stroke();
        }
        for (let y = 0; y <= 360; y += 40) {
            gp.beginPath();
            gp.moveTo(0, py(y - 180));
            gp.lineTo(W, py(y - 180));
            gp.stroke();
        }
        const agora = tempoAgora();
        // caminho entre os círculos próximos (ajuda a ver o "fluxo")
        const perto = m.circulos.map((c, i) => ({c, i})).filter(({c}) => c.t >= agora - 400 && c.t <= agora + APROX);
        gp.strokeStyle = 'rgba(255,255,255,.18)';
        gp.lineWidth = 2;
        gp.beginPath();
        perto.forEach(({c}, k) => {
            if (k === 0) gp.moveTo(px(c.x), py(c.y));
            else gp.lineTo(px(c.x), py(c.y));
        });
        gp.stroke();
        for (let k = perto.length - 1; k >= 0; k--) {
            const {c, i} = perto[k];
            const falta = c.t - agora;
            const alfa = falta < -150 ? 0.25 : Math.max(0.25, Math.min(1, (APROX - falta) / (APROX / 3)));
            gp.globalAlpha = alfa;
            gp.beginPath();
            gp.arc(px(c.x), py(c.y), R * ESCALA_PALCO, 0, Math.PI * 2);
            gp.fillStyle = CORES[i % 4];
            gp.fill();
            gp.lineWidth = selecionado === c ? 5 : 3;
            gp.strokeStyle = selecionado === c ? '#FFC928' : '#fff';
            gp.stroke();
            gp.fillStyle = '#fff';
            gp.font = `bold ${Math.round(R * 0.9 * ESCALA_PALCO)}px Helvetica, Arial, sans-serif`;
            gp.textAlign = 'center';
            gp.textBaseline = 'middle';
            gp.fillText(String((i % 8) + 1), px(c.x), py(c.y));
            if (falta > 0) {
                gp.beginPath();
                gp.arc(px(c.x), py(c.y), R * (1 + (2.2 * falta / APROX)) * ESCALA_PALCO, 0, Math.PI * 2);
                gp.lineWidth = 2.5;
                gp.strokeStyle = CORES[i % 4];
                gp.stroke();
            }
            gp.globalAlpha = 1;
        }
        gp.fillStyle = 'rgba(255,255,255,.55)';
        gp.font = '12px Helvetica, Arial, sans-serif';
        gp.textAlign = 'left';
        gp.fillText(`marcador: ${(cursor / 1000).toFixed(2)} s`, 8, H - 10);
    };

    const circuloNoPalco = (x, y) => {
        const agora = tempoAgora();
        const lista = m.circulos.filter(c => c.t >= agora - 400 && c.t <= agora + APROX);
        for (const c of lista) {
            if (Math.hypot(px(c.x) - x, py(c.y) - y) <= R * ESCALA_PALCO) return c;
        }
        return null;
    };

    palco.addEventListener('mousedown', ev => {
        const {x, y} = pos(ev, palco);
        const c = circuloNoPalco(x, y);
        if (c) {
            selecionado = c;
            arraste = {tipo: 'moverCirculo', c, moveu: false};
            return;
        }
        const p = doPalco(x, y);
        registrar();
        const t = relogio.estado === 'tocando' ? encaixar(relogio.tempo()) : encaixar(cursor);
        const novo = {t, x: dentro(p.x, -240, 240), y: dentro(p.y, -180, 180)};
        m.circulos.push(novo);
        m.circulos.sort((a, b) => a.t - b.t);
        selecionado = novo;
        if (relogio.estado !== 'tocando') cursor = encaixar(cursor + (passoEncaixe() || msPorBatida() / 2));
        rolarAteCursor(); // eslint-disable-line no-use-before-define
        atualizarInfo();
    });

    // ---------------------------------------------------------------- mouse na linha do tempo
    const notaEm = (x, y) => {
        const l = linhaDoY(y);
        if (!l) return null;
        for (let i = m.notas.length - 1; i >= 0; i--) {
            const n = m.notas[i];
            if (n.quem !== l.quem || n.pista !== l.pista) continue;
            const xn = xDoTempo(n.t);
            const xf = xDoTempo(n.t + n.dur);
            if (Math.abs(x - xn) <= 13) return {n, ponta: false};
            if (n.dur > 0 && Math.abs(x - xf) <= 7) return {n, ponta: true};
            if (n.dur > 0 && x > xn && x < xf) return {n, ponta: false};
        }
        return null;
    };
    const circuloNaFaixa = x => {
        for (const c of m.circulos) if (Math.abs(xDoTempo(c.t) - x) <= 14) return c;
        return null;
    };

    cv.addEventListener('mousedown', ev => {
        const {x, y} = pos(ev, cv);
        if (y < REGUA) {
            cursor = encaixar(Math.max(0, tempoDoX(x)));
            if (relogio.estado === 'tocando') relogio.tocar(cursor + m.offset);
            return;
        }
        if (x < ESQ) return;
        if (circulos()) {
            const c = circuloNaFaixa(x);
            if (c) {
                selecionado = c;
                arraste = {tipo: 'tempoCirculo', c, moveu: false};
            } else {
                cursor = encaixar(Math.max(0, tempoDoX(x)));
                selecionado = null;
            }
            return;
        }
        const achou = notaEm(x, y);
        if (achou) {
            selecionado = achou.n;
            arraste = {tipo: achou.ponta ? 'ponta' : 'nota', n: achou.n, x0: x, y0: y, t0: achou.n.t, moveu: false};
            return;
        }
        const l = linhaDoY(y);
        if (!l) return;
        registrar();
        const nova = {t: encaixar(tempoDoX(x)), pista: l.pista, quem: l.quem, dur: 0};
        m.notas.push(nova);
        selecionado = nova;
        cursor = nova.t;
        arraste = {tipo: 'nova', n: nova};
        atualizarInfo();
    });
    cv.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        const {x, y} = pos(ev, cv);
        const achou = !circulos() && notaEm(x, y);
        if (achou) {
            registrar();
            m.notas.splice(m.notas.indexOf(achou.n), 1);
            selecionado = null;
            atualizarInfo();
        }
    });

    const aoMover = ev => {
        if (!arraste) return;
        const a = arraste;
        if (a.tipo === 'moverCirculo') {
            const {x, y} = pos(ev, palco);
            if (!a.moveu) {
                registrar();
                a.moveu = true;
            }
            const p = doPalco(x, y);
            a.c.x = dentro(p.x, -240, 240);
            a.c.y = dentro(p.y, -180, 180);
            return;
        }
        const {x, y} = pos(ev, cv);
        if (a.tipo === 'tempoCirculo') {
            if (!a.moveu) {
                registrar();
                a.moveu = true;
            }
            a.c.t = encaixar(Math.max(0, tempoDoX(x)));
            m.circulos.sort((p, q) => p.t - q.t);
        } else if (a.tipo === 'nova' || a.tipo === 'ponta') {
            if (a.tipo === 'ponta' && !a.moveu) {
                registrar();
                a.moveu = true;
            }
            const fim = encaixar(tempoDoX(x));
            a.n.dur = fim - a.n.t > (passoEncaixe() || 60) * 0.9 ? fim - a.n.t : 0;
        } else if (a.tipo === 'nota') {
            if (!a.moveu && Math.hypot(x - a.x0, y - a.y0) < 5) return;
            if (!a.moveu) {
                registrar();
                a.moveu = true;
            }
            a.n.t = encaixar(a.t0 + ((x - a.x0) / zoom));
            const l = linhaDoY(y);
            if (l) {
                a.n.pista = l.pista;
                a.n.quem = l.quem;
            }
        }
    };
    const aoSoltar = () => {
        const a = arraste;
        arraste = null;
        if (!a) return;
        if (a.tipo === 'nota' && !a.moveu) {
            // clique simples na nota: tira
            registrar();
            m.notas.splice(m.notas.indexOf(a.n), 1);
            selecionado = null;
        }
        m.notas.sort((p, q) => p.t - q.t);
        atualizarInfo();
    };
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);

    // ---------------------------------------------------------------- tocar e gravar
    const atualizarBotoes = () => {
        $('.tocar').textContent = relogio.estado === 'tocando' ? '⏸ Pausar' : '▶ Tocar';
        $('.gravar').classList.toggle('gravando', gravando);
    };
    const tocarPausar = () => {
        if (relogio.estado === 'tocando') {
            cursor = encaixar(relogio.tempo());
            relogio.parar();
        } else {
            relogio.preparar(m);
            relogio.tocar(Math.max(0, cursor + m.offset));
            ultimoTique = cursor;
        }
        atualizarBotoes();
    };
    function rolarAteCursor (t = cursor) {
        const x = ESQ + (t * zoom);
        if (x < grade.scrollLeft + ESQ + 20 || x > grade.scrollLeft + cv.width - 80) {
            grade.scrollLeft = Math.max(0, x - (cv.width * 0.3));
        }
    }

    const gravarTecla = (pista, desceu) => {
        const t = relogio.tempo();
        if (desceu) {
            registrar();
            const n = {t: encaixar(t), pista, quem: gravarEm, dur: 0};
            m.notas.push(n);
            gravandoTeclas[pista] = {n, t};
            atualizarInfo();
        } else if (gravandoTeclas[pista]) {
            const {n, t: ini} = gravandoTeclas[pista];
            if (t - ini > 220) n.dur = Math.max(0, encaixar(t) - n.t);
            delete gravandoTeclas[pista];
            m.notas.sort((p, q) => p.t - q.t);
        }
    };

    // ---------------------------------------------------------------- gerar notas
    const gerar = () => {
        const temNotas = circulos() ? m.circulos.length : m.notas.length;
        if (temNotas && !window.confirm('Gerar vai trocar as notas deste mapa. Continuar?')) return; // eslint-disable-line no-alert
        registrar();
        const musica = m.audio.tipo === 'musica' ? obterMusica(m.audio.nome) : null;
        let base = []; // {t, n (altura), d (ms)}
        if (musica) {
            const msPasso = 60000 / musica.bpm / PASSOS_POR_BATIDA;
            const mel = musica.faixas.find(f => f.id === 'melodia');
            const fonte = mel && mel.notas.length ? mel : musica.faixas.find(f => f.notas.length);
            if (fonte) {
                base = fonte.notas.slice().sort((a, b) => a.p - b.p)
                    .filter((x, i, arr) => i === 0 || x.p !== arr[i - 1].p)
                    .map(x => ({t: Math.round(x.p * msPasso), n: x.n, d: x.d * msPasso}));
            }
            m.bpm = musica.bpm;
        }
        if (!base.length) {
            const fim = Math.max(16000, duracaoAudio() - m.offset);
            const mb = msPorBatida();
            for (let t = mb * 4; t < fim - mb; t += mb) base.push({t: Math.round(t), n: 60 + ((t / mb) * 5 % 12), d: 0});
        }
        if (circulos()) {
            let x = 0;
            let y = 0;
            let ang = 0;
            m.circulos = base.map((b, i) => {
                if (i > 0) {
                    const gap = b.t - base[i - 1].t;
                    const dist = dentro(gap * 0.22, 50, 170);
                    ang += 2.1 + (((b.n % 5) - 2) * 0.35);
                    x = dentro(x + (Math.cos(ang) * dist), -200, 200);
                    y = dentro(y + (Math.sin(ang) * dist), -140, 140);
                }
                return {t: b.t, x: Math.round(x), y: Math.round(y)};
            });
        } else {
            const compasso = msPorBatida() * 4;
            m.notas = base.map(b => ({
                t: b.t,
                pista: ((b.n % 4) + 4) % 4,
                // com oponente: ele canta 2 compassos, você responde nos 2 seguintes
                quem: m.oponente && Math.floor(b.t / (compasso * 2)) % 2 === 0 ? 'op' : 'eu',
                dur: b.d >= msPorBatida() ? Math.round(b.d - 40) : 0
            }));
        }
        selecionado = null;
        atualizarInfo();
        ajustarTamanho();
        aviso(musica ? `Notas geradas a partir da melodia de "${musica.nome}". Ajuste do seu jeito!` :
            'Notas geradas pelo BPM (uma por batida). Escolha uma música do Criador para gerar pela melodia.');
    };

    // ---------------------------------------------------------------- importar
    $('.importar').onclick = () => $('.arquivo').click();
    $('.arquivo').onchange = async () => {
        const f = $('.arquivo').files[0];
        $('.arquivo').value = '';
        if (!f) return;
        try {
            const novo = lerArquivoDeMapa(await f.text(), f.name);
            const temNotas = m.notas.length || m.circulos.length;
            if (temNotas && !window.confirm(`Trocar o conteúdo deste mapa pelo de "${f.name}"?`)) return; // eslint-disable-line no-alert
            registrar();
            const audio = m.audio;
            // mapa vazio e ainda não salvo: fica com o nome que veio no arquivo
            const nome = !temNotas && !nomeOriginal ? nomeLivreMapa(novo.nome) : m.nome;
            m = novo;
            m.audio = audio;
            m.nome = nome;
            if (!nomeOriginal) $('.nome').value = nome;
            selecionado = null;
            preencher();
            aviso(`${f.name}: ${m.modo === 'circulos' ? `${m.circulos.length} círculos` : `${m.notas.length} notas`}. ` +
                'Escolha o áudio (importe a música como som do projeto) e ajuste o "Ajuste (ms)" se precisar.');
        } catch (e) {
            aviso(`⚠ ${e.message}`);
        }
    };

    // ---------------------------------------------------------------- campos do topo
    $('.nome').oninput = e => {
        m.nome = e.target.value;
        if (!nomeOriginal) $('.lista').options[0].text = `${m.nome} (novo)`;
        marcar();
    };
    $('.modo').onchange = e => {
        registrar();
        m.modo = e.target.value;
        selecionado = null;
        preencher();
    };
    $('.audio').onchange = e => {
        registrar();
        const [tipo, ...resto] = e.target.value.split(':');
        m.audio = {tipo, nome: resto.join(':')};
        if (tipo === 'musica') {
            const mu = obterMusica(m.audio.nome);
            if (mu) m.bpm = mu.bpm;
        }
        relogio.parar();
        atualizarBotoes();
        preencher();
    };
    $('.bpm').onchange = e => {
        registrar();
        m.bpm = dentro(Number(e.target.value) || 120, 20, 400);
        e.target.value = m.bpm;
    };
    $('.offset').onchange = e => {
        registrar();
        m.offset = dentro(Math.round(Number(e.target.value) || 0), -5000, 5000);
        e.target.value = m.offset;
    };
    $('.vel').onchange = e => {
        registrar();
        m.velocidade = dentro(Number(e.target.value) || 1, 0.2, 5);
        e.target.value = m.velocidade;
    };
    $('.oponente').onchange = e => {
        registrar();
        m.oponente = e.target.checked;
        if (!m.oponente) m.notas.forEach(n => {
            n.quem = 'eu';
        });
        preencher();
    };
    $('.encaixe').onchange = e => {
        encaixe = Number(e.target.value);
    };
    $('.zoom').oninput = e => {
        const meio = tempoDoX(cv.width / 2);
        zoom = Number(e.target.value);
        ajustarTamanho();
        grade.scrollLeft = Math.max(0, ESQ + (meio * zoom) - (cv.width / 2));
    };
    $('.gravarEm').onchange = e => {
        gravarEm = e.target.value;
    };
    $('.tocar').onclick = tocarPausar;
    $('.parar').onclick = () => {
        relogio.parar();
        cursor = 0;
        grade.scrollLeft = 0;
        atualizarBotoes();
    };
    $('.gravar').onclick = () => {
        gravando = !gravando;
        atualizarBotoes();
        aviso(gravando ? (circulos() ? 'Gravando: toque a música e clique no palco (ou Z/X) no ritmo!' :
            'Gravando: toque a música e aperte as setas (ou D F J K) no ritmo!') : 'Gravação desligada');
    };
    $('.gerar').onclick = gerar;
    $('.desfazer').onclick = desfazer;
    $('.refazer').onclick = refazer;

    // ---------------------------------------------------------------- carregar, salvar, fechar
    const carregar = nome => {
        relogio.parar();
        if (nome && obterMapa(nome)) {
            m = copiarMapa(obterMapa(nome));
            nomeOriginal = nome;
        } else {
            m = mapaVazio(nomeLivreMapa('meu mapa'));
            const mus = nomesMusicas();
            if (mus.length) {
                m.audio = {tipo: 'musica', nome: mus[0]};
                m.bpm = obterMusica(mus[0]).bpm;
            }
            nomeOriginal = null;
        }
        alterado = false;
        historico = [];
        futuro = [];
        cursor = 0;
        selecionado = null;
        $('.salvar').textContent = '✓ Salvar no projeto';
        grade.scrollLeft = 0;
        atualizarBotoes();
        preencher();
    };
    const salvar = () => {
        const nome = (m.nome || '').trim() || 'meu mapa';
        if (nome !== nomeOriginal && obterMapa(nome)) {
            aviso(`Já existe um mapa chamado "${nome}". Escolha outro nome.`);
            return false;
        }
        m.nome = nome;
        m.notas.sort((a, b) => a.t - b.t);
        m.circulos.sort((a, b) => a.t - b.t);
        gravarMapa(normalizarMapa(m), nomeOriginal);
        nomeOriginal = nome;
        alterado = false;
        $('.salvar').textContent = '✓ Salvo';
        preencherLista();
        aviso(`"${nome}" salvo. Use "começar mapa" (Jogo de Ritmo) para jogar!`);
        return true;
    };
    $('.salvar').onclick = salvar;
    $('.lista').onchange = e => {
        const v = e.target.value;
        if (alterado && !window.confirm('Há mudanças não salvas neste mapa. Trocar mesmo assim?')) { // eslint-disable-line no-alert
            preencherLista();
            return;
        }
        carregar(v === '__novo__' ? null : v);
    };
    $('.apagar').onclick = () => {
        if (!nomeOriginal) {
            carregar(null);
            return;
        }
        if (!window.confirm(`Apagar o mapa "${nomeOriginal}" do projeto?`)) return; // eslint-disable-line no-alert
        apagarMapa(nomeOriginal);
        carregar(nomesMapas()[0] || null);
    };

    // ---------------------------------------------------------------- teclado
    const aoTeclar = ev => {
        const alvo = ev.target;
        if (alvo && alvo !== document.body && alvo !== document.documentElement && !raiz.contains(alvo)) return;
        ev.stopPropagation();
        if (alvo && /INPUT|SELECT|TEXTAREA/.test(alvo.tagName)) return;
        const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
        const ctrl = ev.ctrlKey || ev.metaKey;
        let feito = true;
        if (ctrl && k === 'z') {
            if (ev.shiftKey) refazer();
            else desfazer();
        } else if (ctrl && k === 'y') {
            refazer();
        } else if (k === ' ') {
            tocarPausar();
        } else if (gravando && relogio.estado === 'tocando' && !ev.repeat && !circulos() && TECLAS[k] !== undefined) {
            gravarTecla(TECLAS[k], true);
        } else if (gravando && relogio.estado === 'tocando' && !ev.repeat && circulos() && (k === 'z' || k === 'x')) {
            const r = palco.getBoundingClientRect();
            const mouse = raiz.ultimoMouse || {x: r.left + (r.width / 2), y: r.top + (r.height / 2)};
            const p = doPalco(mouse.x - r.left, mouse.y - r.top);
            registrar();
            m.circulos.push({t: encaixar(relogio.tempo()), x: dentro(p.x, -240, 240), y: dentro(p.y, -180, 180)});
            m.circulos.sort((a, b) => a.t - b.t);
            atualizarInfo();
        } else if ((k === 'Delete' || k === 'Backspace') && selecionado) {
            registrar();
            if (circulos()) m.circulos.splice(m.circulos.indexOf(selecionado), 1);
            else m.notas.splice(m.notas.indexOf(selecionado), 1);
            selecionado = null;
            atualizarInfo();
        } else if (k === 'ArrowLeft' && relogio.estado !== 'tocando') {
            cursor = encaixar(Math.max(0, cursor - (passoEncaixe() || 100)));
            rolarAteCursor();
        } else if (k === 'ArrowRight' && relogio.estado !== 'tocando') {
            cursor = encaixar(cursor + (passoEncaixe() || 100));
            rolarAteCursor();
        } else if (k === 'Escape') {
            selecionado = null;
        } else {
            feito = false;
        }
        if (feito) ev.preventDefault();
    };
    const aoSoltarTecla = ev => {
        const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
        if (gravando && !circulos() && TECLAS[k] !== undefined) gravarTecla(TECLAS[k], false);
    };
    const aoMoverMouse = ev => {
        raiz.ultimoMouse = {x: ev.clientX, y: ev.clientY};
    };
    window.addEventListener('keydown', aoTeclar, true);
    window.addEventListener('keyup', aoSoltarTecla, true);
    window.addEventListener('mousemove', aoMoverMouse);
    const aoRedimensionar = () => ajustarTamanho();
    window.addEventListener('resize', aoRedimensionar);

    // ---------------------------------------------------------------- laço
    let quadro = null;
    const laco = () => {
        if (relogio.estado === 'tocando') {
            const agora = relogio.tempo();
            // "tique" quando a agulha passa por uma nota/círculo
            const lista = circulos() ? m.circulos : m.notas;
            if (lista.some(n => n.t > ultimoTique && n.t <= agora)) tique();
            ultimoTique = agora;
            const xa = ESQ + (agora * zoom);
            if (xa > grade.scrollLeft + cv.width - 120 || xa < grade.scrollLeft + ESQ) {
                grade.scrollLeft = Math.max(0, xa - (cv.width * 0.25));
            }
            if (agora > duracaoTotal()) {
                relogio.parar();
                atualizarBotoes();
            }
        }
        desenharLinhaTempo();
        if (circulos()) desenharPalco();
        quadro = requestAnimationFrame(laco);
    };

    const fechar = () => {
        if (alterado) {
            const r = window.confirm('Salvar as mudanças deste mapa antes de fechar?'); // eslint-disable-line no-alert
            if (r && !salvar()) return;
        }
        relogio.parar();
        cancelAnimationFrame(quadro);
        window.removeEventListener('keydown', aoTeclar, true);
        window.removeEventListener('keyup', aoSoltarTecla, true);
        window.removeEventListener('mousemove', aoMover);
        window.removeEventListener('mousemove', aoMoverMouse);
        window.removeEventListener('mouseup', aoSoltar);
        window.removeEventListener('resize', aoRedimensionar);
        raiz.remove();
        aberto = null;
        delete window.adventiscratchEditorMapas;
    };
    $('.fechar').onclick = fechar;
    aberto = {fechar};
    // para depurar pelo console (F12)
    window.adventiscratchEditorMapas = {mapa: () => m, cursor: () => cursor, relogio};
    carregar(nomesMapas()[0] || null);
    laco();
};
