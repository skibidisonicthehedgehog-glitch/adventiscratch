/**
 * Janela "Importar spritesheet": imagem (.png) + mapa (.xml Sparrow / .json TexturePacker) ou grade simples.
 * Cada quadro vira uma fantasia chamada como no mapa (ex.: "BF idle dance0003"), e o bloco
 * "tocar animação [BF idle dance]" da extensão Animações toca a sequência.
 */
import JSZip from 'jszip';
import {
    lerSparrowXML, lerTexturePackerJSON, quadrosEmGrade, agruparAnimacoes, desenharQuadro, carregarImagem,
    canvasParaPng
} from './spritesheet.js';

const MAX_QUADROS = 600;

const CSS = `
.adv-ss{position:fixed;inset:0;z-index:21000;background:rgba(15,8,40,.72);display:flex;align-items:center;justify-content:center;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1B1338}
.adv-ss .caixa{background:#fff;border-radius:18px;width:min(820px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 20px 60px rgba(0,0,0,.45)}
.adv-ss header{background:linear-gradient(90deg,#1E9C8A,#6D4FC2);color:#fff;padding:14px 18px}
.adv-ss header h3{margin:0;font-size:19px}
.adv-ss header p{margin:4px 0 0;font-size:13px;opacity:.92}
.adv-ss .corpo{padding:14px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.adv-ss .soltar{border:3px dashed #C9B6F0;border-radius:14px;padding:18px;text-align:center;background:#FAF7FF}
.adv-ss .soltar.sobre{background:#EFE7FF;border-color:#6D4FC2}
.adv-ss .linha{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.adv-ss label{display:flex;align-items:center;gap:6px;font-size:14px}
.adv-ss input,.adv-ss select{font:inherit;border:2px solid #E3DAFF;border-radius:9px;padding:5px 8px}
.adv-ss input[type=number]{width:70px}
.adv-ss button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;background:#E3DAFF;color:#3A2C70}
.adv-ss button.prim{background:#6D4FC2;color:#fff}
.adv-ss button:disabled{opacity:.45;cursor:default}
.adv-ss .anims{display:grid;grid-template-columns:1fr 220px;gap:12px;min-height:220px}
.adv-ss ul{list-style:none;margin:0;padding:0;border:2px solid #F0EAFF;border-radius:12px;overflow:auto;max-height:300px}
.adv-ss li{display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-bottom:1px solid #F4F0FF}
.adv-ss li.ativa{background:#EFE7FF}
.adv-ss li span{flex:1;font-weight:600}
.adv-ss li small{color:#6B5FA0}
.adv-ss .previa{border:2px solid #F0EAFF;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:repeating-conic-gradient(#f3f0fa 0 25%,#fff 0 50%) 0 0/16px 16px;padding:8px;gap:6px}
.adv-ss .previa canvas{max-width:200px;max-height:200px}
.adv-ss .previa small{font-size:12px;color:#6B5FA0;background:#fff;border-radius:6px;padding:1px 6px}
.adv-ss footer{padding:12px 18px;border-top:1px solid #eee;display:flex;gap:10px;align-items:center;justify-content:flex-end}
.adv-ss footer .msg{flex:1;font-size:13px;color:#6B5FA0}
.adv-ss .erro{color:#B91C1C;font-weight:600}
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const semExtensao = n => n.replace(/\.[^.]+$/, '');

/**
 * Cria as fantasias no projeto.
 * @param {VirtualMachine} vm VM
 * @param {HTMLImageElement} img imagem da folha
 * @param {Array} animacoes animações escolhidas ({nome, quadros})
 * @param {object} opcoes {escala, destino: 'novo'|'atual', nomeAtor, aoProgredir(n, total)}
 */
export const criarFantasias = async (vm, img, animacoes, opcoes) => {
    const storage = vm.runtime.storage;
    const quadros = animacoes.flatMap(a => a.quadros);
    const cache = new Map(); // quadros repetidos (mesma região) usam a mesma imagem
    const fantasias = [];
    let feitos = 0;
    for (const q of quadros) {
        const chave = [q.x, q.y, q.aw, q.ah, q.rotacionado, q.fx, q.fy, q.fw, q.fh].join(',');
        if (!cache.has(chave)) {
            // desenha com o dobro da resolução (bitmapResolution 2), como o editor de pintura do Scratch
            const c = desenharQuadro(img, q, opcoes.escala * 2);
            const png = await canvasParaPng(c);
            const asset = storage.createAsset(storage.AssetType.ImageBitmap, storage.DataFormat.PNG, png, null, true);
            cache.set(chave, {asset, png, w: c.width, h: c.height});
        }
        const {asset, png, w, h} = cache.get(chave);
        fantasias.push({
            name: q.nome,
            dataFormat: 'png',
            asset,
            png,
            md5: `${asset.assetId}.png`,
            assetId: asset.assetId,
            bitmapResolution: 2,
            rotationCenterX: Math.round(w / 2),
            rotationCenterY: Math.round(h / 2)
        });
        feitos++;
        if (opcoes.aoProgredir && feitos % 4 === 0) {
            opcoes.aoProgredir(feitos, quadros.length);
            await new Promise(r => setTimeout(r, 0));
        }
    }

    if (opcoes.destino === 'novo') {
        // monta um .sprite3 e adiciona como ator novo
        const zip = new JSZip();
        const json = {
            isStage: false, name: opcoes.nomeAtor || 'Spritesheet', variables: {}, lists: {}, broadcasts: {}, blocks: {},
            comments: {}, currentCostume: 0, sounds: [], volume: 100, visible: true, x: 0, y: 0, size: 100,
            direction: 90, draggable: false, rotationStyle: 'left-right',
            costumes: fantasias.map(f => ({name: f.name, bitmapResolution: 2, dataFormat: 'png', assetId: f.assetId,
                md5ext: f.md5, rotationCenterX: f.rotationCenterX, rotationCenterY: f.rotationCenterY}))
        };
        zip.file('sprite.json', JSON.stringify(json));
        const ja = new Set();
        fantasias.forEach(f => {
            if (ja.has(f.md5)) return;
            ja.add(f.md5);
            zip.file(f.md5, f.png);
        });
        const buf = await zip.generateAsync({type: 'arraybuffer'});
        await vm.addSprite(buf);
        return fantasias.length;
    }
    const alvo = vm.editingTarget;
    if (!alvo || alvo.isStage) throw new Error('Escolha um ator (não o Palco) para receber as fantasias.');
    for (const f of fantasias) {
        const {png, ...fantasia} = f; // eslint-disable-line no-unused-vars
        await vm.addCostume(fantasia.md5, fantasia, alvo.id);
    }
    return fantasias.length;
};

/**
 * Abre a janela de importação.
 * @param {VirtualMachine} vm VM do Scratch
 */
export const abrirImportadorSpritesheet = vm => {
    if (document.querySelector('.adv-ss')) return;
    if (!document.getElementById('adv-ss-css')) {
        const st = document.createElement('style');
        st.id = 'adv-ss-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const alvoAtual = vm.editingTarget && !vm.editingTarget.isStage ? vm.editingTarget : null;
    const tela = document.createElement('div');
    tela.className = 'adv-ss';
    tela.innerHTML = `<div class="caixa" role="dialog" aria-label="Importar spritesheet">
      <header><h3>🖼️ Importar spritesheet</h3>
        <p>Imagem (.png) + mapa .xml (formato do FNF / Sparrow) ou .json (TexturePacker). Sem mapa? Use uma grade.</p></header>
      <div class="corpo">
        <div class="soltar"><b>Arraste a imagem e o .xml/.json para cá</b> ou
          <button type="button" class="escolher">Escolher arquivos…</button>
          <input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.xml,.json" hidden>
          <div class="arquivos" style="margin-top:8px;font-size:13px;color:#6B5FA0">Nenhum arquivo escolhido.</div></div>
        <div class="linha grade" hidden>
          <b>Sem mapa: dividir em grade</b>
          <label>Colunas <input type="number" class="cols" min="1" value="4"></label>
          <label>Linhas <input type="number" class="lins" min="1" value="1"></label>
          <label>Quadros <input type="number" class="tot" min="0" value="0" title="0 = todos"></label>
          <label>Nome <input class="nomeGrade" value="andar" style="width:120px"></label>
        </div>
        <div class="erro" hidden></div>
        <div class="anims" hidden>
          <div><div class="linha" style="margin-bottom:6px"><b style="flex:1">Animações</b>
            <button type="button" class="todas">Marcar todas</button></div><ul></ul></div>
          <div class="previa"><canvas width="200" height="200"></canvas><small class="info">—</small></div>
        </div>
        <div class="linha opcoes" hidden>
          <label>Tamanho <select class="escala">
            <option value="auto">Caber no palco</option><option value="1">100%</option><option value="0.75">75%</option>
            <option value="0.5">50%</option><option value="0.25">25%</option></select></label>
          <label>Colocar em <select class="destino"><option value="novo">um ator novo</option>
            ${alvoAtual ? `<option value="atual">${esc(alvoAtual.getName())} (ator atual)</option>` : ''}</select></label>
          <label class="nomeNovo">Nome do ator <input class="nomeAtor" style="width:150px"></label>
        </div>
      </div>
      <footer><span class="msg"></span><button type="button" class="cancelar">Cancelar</button>
        <button type="button" class="prim importar" disabled>Importar</button></footer></div>`;
    document.body.appendChild(tela);
    tela.addEventListener('keydown', e => e.stopPropagation());
    const $ = s => tela.querySelector(s);
    const input = $('input[type=file]');
    let img = null;
    let nomeImagem = '';
    let mapa = null; // {nome, texto}
    let animacoes = [];
    let marcadas = new Set();
    let ativa = null;
    let quadroPrevia = 0;
    let timer = null;

    const erro = msg => {
        const e = $('.erro');
        e.hidden = !msg;
        e.textContent = msg ? `⚠ ${msg}` : '';
    };
    const fechar = () => {
        clearInterval(timer);
        tela.remove();
    };
    $('.cancelar').onclick = fechar;
    tela.addEventListener('mousedown', e => {
        if (e.target === tela) fechar();
    });

    const atualizarRodape = () => {
        const qtd = animacoes.filter(a => marcadas.has(a.nome)).reduce((s, a) => s + a.quadros.length, 0);
        $('.importar').disabled = !qtd || qtd > MAX_QUADROS;
        $('.msg').textContent = qtd > MAX_QUADROS ? `São ${qtd} quadros: o máximo é ${MAX_QUADROS}. Desmarque algumas animações.` :
            (qtd ? `${qtd} fantasia(s) serão criadas` : 'Marque pelo menos uma animação');
        $('.nomeNovo').style.display = $('.destino').value === 'novo' ? '' : 'none';
    };

    const desenharPrevia = () => {
        const c = $('.previa canvas');
        const g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height);
        const a = animacoes.find(x => x.nome === ativa);
        if (!a || !img) return;
        const q = a.quadros[quadroPrevia % a.quadros.length];
        const maior = Math.max(...a.quadros.map(x => Math.max(x.fw, x.fh)));
        const escala = Math.min(1, 196 / maior);
        const fc = desenharQuadro(img, q, escala);
        g.drawImage(fc, (c.width - fc.width) / 2, (c.height - fc.height) / 2);
        $('.previa .info').textContent = `${a.nome} · quadro ${(quadroPrevia % a.quadros.length) + 1}/${a.quadros.length} · ${
            a.quadros[0].fw}×${a.quadros[0].fh}`;
    };

    const montarLista = () => {
        const ul = $('ul');
        ul.innerHTML = '';
        animacoes.forEach(a => {
            const li = document.createElement('li');
            if (a.nome === ativa) li.className = 'ativa';
            li.innerHTML = `<input type="checkbox" ${marcadas.has(a.nome) ? 'checked' : ''}><span>${esc(a.nome)}</span>
              <small>${a.quadros.length} quadro${a.quadros.length === 1 ? '' : 's'}</small>`;
            li.querySelector('input').onclick = e => {
                e.stopPropagation();
                if (e.target.checked) marcadas.add(a.nome);
                else marcadas.delete(a.nome);
                atualizarRodape();
            };
            li.onclick = () => {
                ativa = a.nome;
                quadroPrevia = 0;
                montarLista();
                desenharPrevia();
            };
            ul.appendChild(li);
        });
    };

    const processar = () => {
        erro('');
        animacoes = [];
        if (!img) {
            $('.anims').hidden = true;
            $('.opcoes').hidden = true;
            $('.grade').hidden = true;
            atualizarRodape();
            return;
        }
        try {
            let quadros;
            if (mapa) {
                quadros = /\.json$/i.test(mapa.nome) ? lerTexturePackerJSON(mapa.texto) : lerSparrowXML(mapa.texto);
                const fora = quadros.filter(q => q.x + (q.rotacionado ? q.ah : q.aw) > img.naturalWidth + 1 ||
                    q.y + (q.rotacionado ? q.aw : q.ah) > img.naturalHeight + 1);
                if (fora.length > quadros.length / 2) {
                    throw new Error('O mapa não combina com essa imagem (os quadros saem para fora dela). ' +
                        'Confira se escolheu o .xml/.json certo.');
                }
            } else {
                quadros = quadrosEmGrade(img.naturalWidth, img.naturalHeight, Number($('.cols').value),
                    Number($('.lins').value), $('.nomeGrade').value.trim() || 'quadro', Number($('.tot').value));
            }
            animacoes = agruparAnimacoes(quadros);
        } catch (e) {
            erro(e.message);
        }
        $('.grade').hidden = Boolean(mapa);
        $('.anims').hidden = !animacoes.length;
        $('.opcoes').hidden = !animacoes.length;
        marcadas = new Set(animacoes.map(a => a.nome));
        ativa = animacoes.length ? animacoes[0].nome : null;
        quadroPrevia = 0;
        if (!$('.nomeAtor').value) $('.nomeAtor').value = semExtensao(nomeImagem).slice(0, 40) || 'Spritesheet';
        montarLista();
        desenharPrevia();
        atualizarRodape();
    };

    const receberArquivos = async lista => {
        erro('');
        for (const f of Array.from(lista)) {
            if (/\.(png|jpe?g|webp)$/i.test(f.name)) {
                try {
                    img = await carregarImagem(f);
                    nomeImagem = f.name;
                } catch (e) {
                    erro(e.message);
                }
            } else if (/\.(xml|json)$/i.test(f.name)) {
                mapa = {nome: f.name, texto: await f.text()};
            }
        }
        $('.arquivos').innerHTML = `${img ? `🖼️ ${esc(nomeImagem)} (${img.naturalWidth}×${img.naturalHeight})` :
            '🖼️ falta a imagem'} · ${mapa ? `🗺️ ${esc(mapa.nome)}` : '🗺️ sem mapa (grade)'}`;
        processar();
    };

    $('.escolher').onclick = () => input.click();
    input.onchange = () => receberArquivos(input.files);
    const soltar = $('.soltar');
    soltar.addEventListener('dragover', e => {
        e.preventDefault();
        soltar.classList.add('sobre');
    });
    soltar.addEventListener('dragleave', () => soltar.classList.remove('sobre'));
    soltar.addEventListener('drop', e => {
        e.preventDefault();
        soltar.classList.remove('sobre');
        receberArquivos(e.dataTransfer.files);
    });
    ['.cols', '.lins', '.tot', '.nomeGrade'].forEach(s => $(s).addEventListener('change', processar));
    $('.destino').onchange = atualizarRodape;
    $('.todas').onclick = () => {
        marcadas = marcadas.size === animacoes.length ? new Set() : new Set(animacoes.map(a => a.nome));
        montarLista();
        atualizarRodape();
    };

    timer = setInterval(() => {
        quadroPrevia++;
        desenharPrevia();
    }, 1000 / 24);

    $('.importar').onclick = async () => {
        const escolhidas = animacoes.filter(a => marcadas.has(a.nome));
        let escala = $('.escala').value;
        if (escala === 'auto') {
            const maior = Math.max(...escolhidas.flatMap(a => a.quadros.map(q => Math.max(q.fw, q.fh * 1.2))));
            escala = Math.min(1, 300 / maior);
        }
        $('.importar').disabled = true;
        $('.cancelar').disabled = true;
        try {
            const n = await criarFantasias(vm, img, escolhidas, {
                escala: Number(escala),
                destino: $('.destino').value,
                nomeAtor: $('.nomeAtor').value.trim(),
                aoProgredir: (feitos, total) => {
                    $('.msg').textContent = `Criando fantasias… ${feitos}/${total}`;
                }
            });
            fechar();
            window.dispatchEvent(new CustomEvent('adventiscratch-aviso', {detail: {texto:
                `${n} fantasias criadas! Use "tocar animação" (extensão Animações) para animar.`}}));
        } catch (e) {
            erro(e.message || 'Não deu para criar as fantasias.');
            $('.importar').disabled = false;
            $('.cancelar').disabled = false;
        }
    };
    atualizarRodape();
};
