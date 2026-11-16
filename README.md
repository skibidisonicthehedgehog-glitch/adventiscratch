# 🦉 Adventiscratch

Uma versão mais avançada do Scratch 3.0, toda em português, feita para estudantes Adventistas.
Fork do [scratch-gui oficial](https://github.com/scratchfoundation/scratch-gui) da Scratch Foundation.

## O que mudou em relação ao Scratch

| Recurso | Onde está no código |
|---|---|
| Nome, logo (coruja estudante) e favicon | `src/components/menu-bar/scratch-logo.svg`, `static/favicon.ico`, `static/adventiscratch/` |
| Página inicial em pt-BR (`index.html`) | `src/playground/home.html` |
| Editor movido para `editor.html` | `webpack.config.js` |
| Sempre abre em português (pt-BR) | `src/lib/detect-locale.js` |
| Sem contas, "Meus projetos", mochila nem compartilhar | `src/playground/render-gui.jsx` |
| Logo do editor volta para a página inicial | `src/playground/render-gui.jsx` |
| Extensão **Extras Adventiscratch** (14 blocos novos) | `src/lib/adventiscratch/extras-extension.js` |
| Extensão **3D (Three.js)** com modelos 3D | `src/lib/adventiscratch/three-extension.js` e `three-engine.js` |
| Formato de projeto **.asp** (AdventiScratch Project) | `src/lib/adventiscratch/asp-format.js`, `src/containers/sb3-downloader.jsx`, `src/lib/sb-file-uploader-hoc.jsx` |
| Registro das extensões na VM | `src/lib/adventiscratch/index.js` e `src/lib/libraries/extensions/index.jsx` |

### Blocos da extensão Extras Adventiscratch
`[A] elevado a [B]` · `raiz [N] de [X]` · `verdadeiro` · `falso` · `[A] ≠ [B]` · `[A] ≥ [B]` · `[A] ≤ [B]` ·
`se <cond> então [A] senão [B]` · `[texto] em MAIÚSCULAS/minúsculas/Título` · `substitua [de] por [para] em [texto]` ·
`repita [texto] [N] vezes` · `[texto] começa com [parte]?` · `milissegundos desde 1970` · `data de hoje`

## Formato .asp

Um `.asp` é um `.sb3` (zip com `project.json`, fantasias e sons) com uma pasta a mais:

```
adventiscratch/manifest.json      -> {"format": "asp", "version": 1, "models": [...]}
adventiscratch/models/<arquivo>   -> modelos 3D importados no projeto
```

O editor salva sempre em `.asp` e abre `.asp`, `.sb3`, `.sb2` e `.sb`. Se um `.asp` for renomeado
para `.sb3`, ele abre no Scratch comum (só os blocos do Adventiscratch não funcionam lá).

## Extensão 3D (Three.js)

Clique no botão de extensões (canto inferior esquerdo) e escolha **3D (Three.js)**.

- **Importar modelo 3D…** (botão no topo da paleta): aceita `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`, `.dae` e `.ply`.
  Você pode selecionar o modelo **junto com as texturas** (Ctrl+clique).
- **Importar pasta do modelo (com texturas)…**: escolhe a pasta inteira; só os arquivos que o modelo usa são guardados.
- **Detecção de texturas:** ao importar, o editor lê o modelo e descobre quais texturas (`.png`, `.jpg`, `.tga`…),
  materiais (`.mtl`) e buffers (`.bin`) ele pede, inclusive caminhos absolutos gravados dentro do `.fbx`
  (ex.: `C:\artista\texturas\pele.png` → procura `pele.png`). Se faltar algum, aparece uma janela listando o que
  falta, com botões para escolher os arquivos ou a pasta. O navegador não lê arquivos do computador sozinho,
  por isso o aluno precisa selecioná-los.
- **Texturas por material:** muitos `.fbx` (principalmente de jogos) não dizem quais imagens usam. Nesse caso
  aparece a janela "Texturas por material", que já sugere a imagem de cada material pelo nome do arquivo
  (ex.: material `chr_sonic_body` → `chr_sonic_body_dif.png`, e `..._nrm.png` vira normal map). Dá para corrigir
  à mão e adicionar mais imagens.
- Reimportar o mesmo arquivo de modelo **substitui** o anterior (útil para adicionar texturas depois).
- Modelo e texturas ficam salvos dentro do `.asp`.
- Cena: ligar/desligar 3D, cor de fundo ou fundo transparente, apagar tudo.
- Objetos: cubo, esfera, cilindro, cone, plano, rosca, cápsula ou um modelo importado (ou baixado de uma URL);
  mover, girar, apontar, tamanho, cor, mostrar/esconder, consultar x/y/z/giro/tamanho, tocando, distância e
  "objeto 3D sob o mouse".
- Animações de modelos `.glb`/`.fbx`: tocar animação (por número ou nome), parar, quantidade/nomes.
- Bloco `[texturas / texturas faltando] do modelo [ ]` para conferir o que foi importado.
- **Física para jogos de plataforma:** `física de [objeto]: corpo / sólido / terreno / sem física`, gravidade,
  `andar [objeto] pela câmera: lado [] frente [] velocidade []` (o personagem vira para onde anda),
  `pular [objeto] com força []`, `[objeto] está no chão?`, velocidade, e `câmera seguir [objeto] distância [] altura []`
  (terceira pessoa) com `girar câmera em volta do jogador`. Sólidos usam caixa de colisão; "terreno" usa a superfície
  real do modelo (rampas). A física roda enquanto o projeto está rodando (bandeira verde).
- Câmera (posição, apontar, campo de visão) e luzes (sol e ambiente: intensidade, cor, posição).

A cena 3D é desenhada por cima do palco do Scratch. Com fundo transparente, os atores 2D aparecem atrás
dos objetos 3D. Modelos são ajustados automaticamente para caber em ~2 unidades e ficar com a base no chão.
O Three.js é carregado só quando um bloco 3D é usado, então o editor não fica mais lento.

## Criar mais blocos

Para criar mais blocos, adicione um item em `blocks` dentro de `getInfo()` e um método com o mesmo nome do `opcode`.

## Como rodar

Pré-requisitos: **Node.js 20** (veja `.nvmrc`) e Git.

```bash
npm install        # baixa as dependências (também baixa o arquivo do micro:bit)
npm start          # servidor de desenvolvimento em http://localhost:8601
```

- Página inicial: http://localhost:8601/
- Editor: http://localhost:8601/editor.html

### Gerar a versão para publicar

```bash
npm run build
```

O site pronto fica na pasta `build/`. É só subir essa pasta em qualquer hospedagem estática
(GitHub Pages, Netlify, Vercel, servidor da escola…). Ela não funciona abrindo o arquivo direto
com duplo clique: precisa ser servida por um servidor web (ex.: `npx serve build`).

## Publicar no seu GitHub

```bash
git remote rename origin upstream
git remote add origin https://github.com/SEU_USUARIO/adventiscratch.git
git push -u origin adventiscratch
```

## Licença e marcas

O código é baseado no scratch-gui, distribuído sob **AGPL-3.0** (veja `LICENSE`). Se você publicar o
Adventiscratch na internet, a AGPL exige que o código-fonte, com as suas alterações, fique disponível
para quem usa (um repositório público no GitHub resolve).

"Scratch", o logo e o Gato do Scratch são marcas do MIT (veja `TRADEMARK`). Eles não podem ser usados
para promover projetos derivados. Por isso, o Adventiscratch usa mascote e logo próprios. O ator padrão
de um projeto novo ainda é o gato, que vem da biblioteca do Scratch. Se quiser trocar, edite o projeto
padrão em `src/lib/default-project/`.
