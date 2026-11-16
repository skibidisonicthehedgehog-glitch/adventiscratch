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
| Extensão **Extras Adventiscratch** (17 blocos novos) | `src/lib/adventiscratch/extras-extension.js` e `src/lib/libraries/extensions/index.jsx` |

### Blocos da extensão Extras Adventiscratch
`[A] elevado a [B]` · `raiz [N] de [X]` · `verdadeiro` · `falso` · `[A] ≠ [B]` · `[A] ≥ [B]` · `[A] ≤ [B]` ·
`se <cond> então [A] senão [B]` · `[texto] em MAIÚSCULAS/minúsculas/Título` · `substitua [de] por [para] em [texto]` ·
`repita [texto] [N] vezes` · `[texto] começa com [parte]?` · `milissegundos desde 1970` · `data de hoje`

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
