/**
 * Janela "⚙️ Opções do projeto" (menu Editar): por enquanto, o tamanho do palco.
 */
import {PREDEFINIDOS, tamanhoPalco, aplicarTamanhoPalco} from './palco.js';

const CSS = `
.adv-opcoes-fundo{position:fixed;inset:0;background:rgba(20,10,40,.55);z-index:600;display:flex;align-items:center;
  justify-content:center;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
.adv-opcoes{background:#fff;border-radius:16px;width:min(560px,94vw);box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden}
.adv-opcoes header{background:linear-gradient(135deg,#7C4FCC,#4F9BFF);color:#fff;padding:16px 20px;font-size:1.2rem;
  font-weight:700;display:flex;justify-content:space-between;align-items:center}
.adv-opcoes header button{background:rgba(255,255,255,.2);border:0;color:#fff;border-radius:8px;padding:4px 10px;
  font-size:1rem;cursor:pointer}
.adv-opcoes section{padding:16px 20px}
.adv-opcoes h3{margin:0 0 10px;font-size:1rem;color:#3B2A6B}
.adv-opcoes .grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.adv-opcoes .pre{border:2px solid #E3DCF5;border-radius:10px;padding:8px;background:#FAF8FF;cursor:pointer;text-align:left;
  display:flex;gap:10px;align-items:center;font-size:.85rem;color:#3B2A6B}
.adv-opcoes .pre:hover{border-color:#B9A6EC}
.adv-opcoes .pre.sel{border-color:#7C4FCC;background:#EFE8FF}
.adv-opcoes .pre i{display:block;background:#7C4FCC;border-radius:3px;flex:none}
.adv-opcoes .pre small{display:block;color:#7A6E99}
.adv-opcoes .custom{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap;color:#3B2A6B}
.adv-opcoes .custom input{width:84px;padding:6px 8px;border:2px solid #E3DCF5;border-radius:8px;font-size:1rem}
.adv-opcoes .dica{font-size:.8rem;color:#7A6E99;margin-top:10px;line-height:1.4}
.adv-opcoes footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;background:#F6F3FD}
.adv-opcoes footer button{border:0;border-radius:10px;padding:9px 16px;font-weight:700;cursor:pointer;font-size:.95rem}
.adv-opcoes .ok{background:#7C4FCC;color:#fff}
.adv-opcoes .cancelar{background:#E3DCF5;color:#3B2A6B}
`;

let estilo = null;

export const abrirOpcoesDoProjeto = vm => {
    if (!estilo) {
        estilo = document.createElement('style');
        estilo.textContent = CSS;
        document.head.appendChild(estilo);
    }
    const atual = tamanhoPalco();
    let escolha = {...atual};
    const fundo = document.createElement('div');
    fundo.className = 'adv-opcoes-fundo';
    const miniatura = (w, h) => {
        const k = 34 / Math.max(w, h);
        return `<i style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px"></i>`;
    };
    fundo.innerHTML = `
      <div class="adv-opcoes" role="dialog" aria-label="Opções do projeto">
        <header>⚙️ Opções do projeto <button class="fechar" title="Fechar">✕</button></header>
        <section>
          <h3>Tamanho do palco</h3>
          <div class="grade">${PREDEFINIDOS.map((p, i) => `
            <button class="pre" data-i="${i}">${miniatura(p.largura, p.altura)}
              <span>${p.nome}<small>${p.largura} × ${p.altura}</small></span></button>`).join('')}
          </div>
          <div class="custom">Personalizado:
            <input type="number" class="w" min="120" max="1920" value="${atual.largura}"> ×
            <input type="number" class="h" min="90" max="1080" value="${atual.altura}"> pixels
          </div>
          <p class="dica">As coordenadas do palco vão de −largura/2 a +largura/2 (e o mesmo na altura).
            O tamanho fica salvo no projeto (.asp). Jogos 16:9, como o Pizza Tower, ficam melhores em 960 × 540.</p>
        </section>
        <footer><button class="cancelar">Cancelar</button><button class="ok">Aplicar</button></footer>
      </div>`;
    document.body.appendChild(fundo);
    const $ = s => fundo.querySelector(s);
    const marcar = () => {
        fundo.querySelectorAll('.pre').forEach(b => {
            const p = PREDEFINIDOS[Number(b.dataset.i)];
            b.classList.toggle('sel', p.largura === escolha.largura && p.altura === escolha.altura);
        });
        $('.w').value = escolha.largura;
        $('.h').value = escolha.altura;
    };
    marcar();
    fundo.querySelectorAll('.pre').forEach(b => b.addEventListener('click', () => {
        const p = PREDEFINIDOS[Number(b.dataset.i)];
        escolha = {largura: p.largura, altura: p.altura};
        marcar();
    }));
    const lerCampos = () => {
        escolha = {largura: Number($('.w').value) || atual.largura, altura: Number($('.h').value) || atual.altura};
        marcar();
    };
    $('.w').addEventListener('change', lerCampos);
    $('.h').addEventListener('change', lerCampos);
    const fechar = () => {
        fundo.remove();
        document.removeEventListener('keydown', tecla, true);
    };
    const aplicar = () => {
        lerCampos();
        aplicarTamanhoPalco(vm, escolha.largura, escolha.altura);
        fechar();
    };
    const tecla = e => {
        if (e.key === 'Escape') fechar();
        if (e.key === 'Enter') aplicar();
    };
    document.addEventListener('keydown', tecla, true);
    $('.fechar').addEventListener('click', fechar);
    $('.cancelar').addEventListener('click', fechar);
    $('.ok').addEventListener('click', aplicar);
    fundo.addEventListener('mousedown', e => {
        if (e.target === fundo) fechar();
    });
};
