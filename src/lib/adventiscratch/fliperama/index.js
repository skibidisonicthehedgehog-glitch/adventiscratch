/**
 * Fliperama secreto do Adventiscratch.
 * Abre quando alguém digita EASTEREGGSEARCHING na busca da biblioteca de cenários.
 *
 * Todos os jogos são originais, feitos só com <canvas> e Web Audio, sem nada da internet.
 * Cada jogo exporta {id, nome, descricao, emoji, cor, controles, iniciar(ctx, api)}.
 * iniciar devolve {parar()} e usa api.teclas, api.recorde(), api.fim(pontos) etc.
 */
import ritmo from './ritmo.js';
import corrida from './corrida.js';
import blocos from './mundo-blocos.js';
import empilha from './empilha.js';
import minhoca from './minhoca.js';
import pingue from './pingue.js';

const JOGOS = [ritmo, corrida, blocos, empilha, minhoca, pingue];
const LARGURA = 960;
const ALTURA = 540;
const CHAVE_RECORDES = 'adventiscratch-fliperama-recordes';

const lerRecordes = () => {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_RECORDES)) || {};
    } catch (e) {
        return {};
    }
};
const salvarRecorde = (id, pontos) => {
    const r = lerRecordes();
    if (pontos > (r[id] || 0)) {
        r[id] = pontos;
        try {
            localStorage.setItem(CHAVE_RECORDES, JSON.stringify(r));
        } catch (e) { /* navegador sem armazenamento */ }
        return true;
    }
    return false;
};

const CSS = `
.adv-fli{position:fixed;inset:0;z-index:100000;background:rgba(10,6,30,.82);display:flex;align-items:center;justify-content:center;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;animation:adv-fli-in .35s ease-out}
@keyframes adv-fli-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.adv-fli-caixa{width:min(96vw,1000px);background:#1B1338;border-radius:22px;box-shadow:0 0 0 4px #FFC928,0 0 60px rgba(255,201,40,.45);
  color:#fff;overflow:hidden;display:flex;flex-direction:column;max-height:96vh}
.adv-fli-topo{display:flex;align-items:center;gap:12px;padding:12px 18px;background:linear-gradient(90deg,#6D4FC2,#E8742C)}
.adv-fli-topo h2{margin:0;font-size:22px;flex:1;letter-spacing:.5px}
.adv-fli-topo button{background:rgba(255,255,255,.2);border:0;color:#fff;font-weight:700;border-radius:10px;padding:7px 12px;cursor:pointer;font-size:14px}
.adv-fli-topo button:hover{background:rgba(255,255,255,.35)}
.adv-fli-menu{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;overflow:auto}
.adv-fli-card{border-radius:16px;padding:16px;cursor:pointer;border:0;text-align:left;color:#fff;display:flex;flex-direction:column;gap:6px;
  transition:transform .12s, box-shadow .12s;font-family:inherit}
.adv-fli-card:hover,.adv-fli-card:focus{transform:translateY(-3px);box-shadow:0 8px 0 rgba(0,0,0,.25);outline:none}
.adv-fli-card .e{font-size:38px;line-height:1}
.adv-fli-card b{font-size:19px}
.adv-fli-card span{font-size:13.5px;opacity:.92}
.adv-fli-card i{font-style:normal;font-size:12.5px;background:rgba(0,0,0,.22);border-radius:8px;padding:3px 8px;align-self:flex-start;margin-top:4px}
.adv-fli-intro{padding:16px 20px 0;color:#D9CCFF;font-size:14.5px;margin:0}
.adv-fli-palco{position:relative;background:#000;display:flex;align-items:center;justify-content:center}
.adv-fli-palco canvas{width:100%;height:auto;max-height:calc(96vh - 110px);aspect-ratio:16/9;display:block;image-rendering:auto}
.adv-fli-rodape{padding:8px 18px;font-size:13px;color:#CFC4F5;display:flex;gap:14px;flex-wrap:wrap}
.adv-fli-rodape kbd{background:#3A2C70;border-radius:5px;padding:1px 6px;font-family:inherit}
`;

let aberto = null;

const abrirFliperama = () => {
    if (aberto) return;
    if (!document.getElementById('adv-fli-css')) {
        const st = document.createElement('style');
        st.id = 'adv-fli-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const raiz = document.createElement('div');
    raiz.className = 'adv-fli';
    raiz.innerHTML = `
      <div class="adv-fli-caixa" role="dialog" aria-label="Fliperama secreto">
        <div class="adv-fli-topo">
          <h2>🕹️ Fliperama Secreto da Coruja</h2>
          <button class="adv-fli-voltar" hidden>← Jogos</button>
          <button class="adv-fli-fechar">✕ Fechar</button>
        </div>
        <div class="adv-fli-conteudo"></div>
      </div>`;
    document.body.appendChild(raiz);
    const conteudo = raiz.querySelector('.adv-fli-conteudo');
    const btVoltar = raiz.querySelector('.adv-fli-voltar');

    const teclas = new Set();
    let jogoAtual = null;
    let audio = null;
    const pegarAudio = () => {
        if (!audio) {
            const AC = window.AudioContext || window.webkitAudioContext;
            audio = AC ? new AC() : null;
        }
        if (audio && audio.state === 'suspended') audio.resume();
        return audio;
    };

    // o teclado fica só com o fliperama: o editor e o palco do Scratch não recebem as teclas
    const PREVINE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab']);
    const aoDescer = ev => {
        if (ev.key === 'Escape') {
            if (jogoAtual) mostrarMenu();
            else fechar();
        } else {
            teclas.add(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key);
            if (jogoAtual && jogoAtual.tecla) jogoAtual.tecla(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key);
        }
        if (PREVINE.has(ev.key) || jogoAtual) ev.preventDefault();
        ev.stopPropagation();
    };
    const aoSubir = ev => {
        teclas.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key);
        ev.stopPropagation();
    };
    const aoPerderFoco = () => teclas.clear();
    window.addEventListener('keydown', aoDescer, true);
    window.addEventListener('keyup', aoSubir, true);
    window.addEventListener('blur', aoPerderFoco);

    const pararJogo = () => {
        if (jogoAtual) {
            try {
                jogoAtual.parar();
            } catch (e) { /* ignora */ }
            jogoAtual = null;
        }
        teclas.clear();
    };

    const mostrarMenu = () => {
        pararJogo();
        btVoltar.hidden = true;
        const rec = lerRecordes();
        conteudo.innerHTML = `<p class="adv-fli-intro">Você achou o fliperama secreto! 🎉 Todos estes jogos foram feitos ` +
            `com código, igual aos seus projetos. Escolha um:</p><div class="adv-fli-menu"></div>`;
        const menu = conteudo.querySelector('.adv-fli-menu');
        JOGOS.forEach(j => {
            const b = document.createElement('button');
            b.className = 'adv-fli-card';
            b.style.background = j.cor;
            b.innerHTML = `<div class="e">${j.emoji}</div><b>${j.nome}</b><span>${j.descricao}</span>` +
                `<i>🏆 Recorde: ${rec[j.id] || 0}</i>`;
            b.addEventListener('click', () => abrirJogo(j));
            menu.appendChild(b);
        });
        const primeiro = menu.querySelector('button');
        if (primeiro) primeiro.focus();
    };

    const abrirJogo = jogo => {
        pararJogo();
        btVoltar.hidden = false;
        conteudo.innerHTML = `<div class="adv-fli-palco"><canvas width="${LARGURA}" height="${ALTURA}"></canvas></div>` +
            `<div class="adv-fli-rodape">${jogo.controles} <span>· <kbd>Esc</kbd> volta aos jogos</span></div>`;
        const canvas = conteudo.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        let rodando = true;
        let quadro = null;
        let ultimo = performance.now();
        const api = {
            largura: LARGURA,
            altura: ALTURA,
            canvas,
            teclas,
            apertada: (...lista) => lista.some(k => teclas.has(k)),
            audio: pegarAudio,
            recorde: () => lerRecordes()[jogo.id] || 0,
            registrar: pontos => salvarRecorde(jogo.id, Math.floor(pontos)),
            // laço de animação: fn(dt em segundos, agora em ms)
            laco: fn => {
                const passo = agora => {
                    if (!rodando) return;
                    const dt = Math.min(0.05, (agora - ultimo) / 1000);
                    ultimo = agora;
                    fn(dt, agora);
                    quadro = requestAnimationFrame(passo);
                };
                quadro = requestAnimationFrame(passo);
            }
        };
        const instancia = jogo.iniciar(ctx, api) || {};
        jogoAtual = {
            tecla: instancia.tecla,
            parar: () => {
                rodando = false;
                if (quadro) cancelAnimationFrame(quadro);
                if (instancia.parar) instancia.parar();
            }
        };
        canvas.addEventListener('contextmenu', ev => ev.preventDefault());
    };

    const fechar = () => {
        pararJogo();
        window.removeEventListener('keydown', aoDescer, true);
        window.removeEventListener('keyup', aoSubir, true);
        window.removeEventListener('blur', aoPerderFoco);
        if (audio) audio.close().catch(() => {});
        raiz.remove();
        aberto = null;
    };

    raiz.querySelector('.adv-fli-fechar').addEventListener('click', fechar);
    btVoltar.addEventListener('click', mostrarMenu);
    raiz.addEventListener('mousedown', ev => {
        if (ev.target === raiz) fechar();
    });
    aberto = {fechar};
    mostrarMenu();
};

export {abrirFliperama, JOGOS};
