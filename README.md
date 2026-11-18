# 🦉 Adventiblocks

Editor de programação em blocos em português para aprender a criar jogos em sala de aula.
Projeto independente baseado no [editor Scratch de código aberto](https://github.com/scratchfoundation/scratch-gui).

## O que mudou em relação ao Scratch

| Recurso | Onde está no código |
|---|---|
| Nome, logo (coruja estudante) e favicon | `src/components/menu-bar/scratch-logo.svg`, `static/favicon.ico`, `static/adventiscratch/` |
| Página inicial em pt-BR (`index.html`) | `src/playground/home.html` |
| Editor movido para `editor.html` | `webpack.config.js` |
| Sempre abre em português (pt-BR) | `src/lib/detect-locale.js` |
| Sem "Meus projetos", mochila nem compartilhar do Scratch | `src/playground/render-gui.jsx` |
| Contas, moderação e telas de suspensão | `server/` (Django) e `src/lib/adventiscratch/conta/` |
| Detector de erros nos blocos | `src/lib/adventiscratch/detector-erros.js` |
| Logo do editor volta para a página inicial | `src/playground/render-gui.jsx` |
| Extensão **Extras Adventiblocks** (14 blocos novos) | `src/lib/adventiscratch/extras-extension.js` |
| Extensão **3D (Three.js)** com modelos 3D | `src/lib/adventiscratch/three-extension.js` e `three-engine.js` |
| Extensão **Plataforma 2D** (gravidade, pulo, chão, paredes) | `src/lib/adventiscratch/plataforma2d-extension.js` |
| **Criador de Músicas**, extensão **Músicas** e instrumentos **.sf2** | `src/lib/adventiscratch/musica/` |
| Extensão **Animações**: spritesheets (.png + .xml/.json) e **controlador de animação** | `src/lib/adventiscratch/spritesheet/` |
| Extensão **Jogo de Ritmo** (setas estilo FNF, círculos estilo osu!) e editor de mapas | `src/lib/adventiscratch/ritmo/` |
| **Loja de Instrumentos Virtuais** (.sf2) | `server/conteudo/` (`InstrumentoSF2`) e `src/lib/adventiscratch/conta/telas-nuvem.js` |
| Sons **.ogg** (Ogg Vorbis/Opus), convertidos em WAV ao enviar | `src/lib/adventiscratch/audio-ogg.js` e `src/lib/file-uploader.js` |
| Formato de projeto **.asp** (projeto Adventiblocks) | `src/lib/adventiscratch/asp-format.js`, `src/containers/sb3-downloader.jsx`, `src/lib/sb-file-uploader-hoc.jsx` |
| Registro das extensões na VM | `src/lib/adventiscratch/index.js` e `src/lib/libraries/extensions/index.jsx` |

### Blocos da extensão Extras Adventiblocks
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
para `.sb3`, ele abre no Scratch comum (só os blocos do Adventiblocks não funcionam lá).

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

## Nuvem, galeria e loja de modelos

- **☁ Salvar** (barra do editor): salva o projeto no servidor; depois, cada clique atualiza o mesmo projeto e o
  editor salva sozinho a cada 2 minutos. "Meus projetos na nuvem" abre, compartilha e apaga.
- **Explorar projetos**: projetos compartilhados por **todas as turmas**. Abrir o projeto de outra pessoa e
  salvar cria um **remix** (cópia sua, ligada ao original).
- **Loja de modelos** (menu da conta ou botão "🧩 Loja de modelos…" na categoria 3D): modelos 3D publicados por
  qualquer aluno, com texturas e miniatura. "Adicionar ao projeto" coloca o modelo no projeto atual.
  Para publicar: importe o modelo e use "Publicar modelo" (ou o botão na janela de importação). É obrigatório
  escolher a licença e confirmar autoria/permissão; modelos de jogos/filmes de outras empresas não são aceitos.
- Tudo exige login e só é visível para quem está logado neste servidor. Cartões mostram só o nome de exibição.
- **Moderação**: denúncias de projeto/modelo (inclui "direitos autorais"); no painel, "Projetos" e "Modelos 3D da
  loja" têm prévia, download para conferir e as ações Ocultar/Publicar (o dono vê a "nota da moderação").
  Conteúdo de contas com suspensão indefinida/permanente sai das listas automaticamente.
- Arquivos ficam em `server/dados/arquivos` (no Docker, no volume `dados`). Limites ajustáveis no `.env`:
  `ADVENTISCRATCH_MAX_PROJETO_MB` (50), `ADVENTISCRATCH_MAX_MODELO_MB` (40), `ADVENTISCRATCH_MAX_PROJETOS` (100 por
  aluno), `ADVENTISCRATCH_ENVIOS_POR_HORA` (60) e `ADVENTISCRATCH_APROVAR_MODELOS=true` (modelos novos só
  aparecem depois de aprovados).

## Extensão Plataforma 2D

Física para jogos de plataforma com atores comuns. Cada ator recebe um tipo com **tornar este ator [tipo]**:

- **personagem**: cai com a gravidade, anda, pula e colide. Ao virar personagem, o estilo de rotação passa para
  "esquerda-direita" (girar de ponta-cabeça atrapalharia a colisão).
- **sólido**: chão, paredes e blocos. Se ele se mover (deslizar, mudar x), quem está em cima anda junto.
- **plataforma**: atravessa por baixo e pousa em cima; com a seta para baixo o personagem desce.

O bloco **controlar com [setas e WASD] velocidade [5] pulo [13]** faz o controle completo (aceleração, pulo com
"tempo de coiote", pulo mais baixo ao soltar a tecla cedo, pulo duplo com **permitir [1] pulos no ar** e descer de
plataformas). Também há blocos de velocidade x/y, **pular com força**, **está [no chão / caindo / encostado numa
parede…]?**, **nome do que está embaixo**, o chapéu **quando este ator [aterrissar / pular / bater numa parede / bater
no teto]**, gravidade do mundo e de cada ator, queda máxima, caixa de colisão fixa e bordas do palco como chão/paredes.

Detalhes: a colisão usa a caixa (retângulo) de cada ator; atores escondidos não colidem (parede invisível = efeito
fantasma 100); clones herdam o tipo; a física roda uma vez por quadro, antes dos scripts, só com o projeto rodando.
Unidades em "passos por quadro", iguais às do "mude x por". No console (F12), `adventiscratchVM.runtime.adventiscratch2d`
dá acesso ao motor.

## Criador de Músicas e extensão Músicas

Extensão **Músicas** → botão **🎼 Criador de Músicas…** abre um editor em tela cheia: grade de piano para
**Melodia**, **Baixo** e **Acordes** (Dó2 a Dó7) e grade de **Bateria** (bumbo, caixa, chimbal, palmas, tom,
prato). BPM, 1 a 32 compassos (4/4, passos de semicolcheia), tocar/pausar/parar/repetir, modelos prontos (Aventura,
Calma, Chefe, Fase 8-bit) e 8 instrumentos sintetizados com Web Audio (piano, órgão, baixo, cordas, flauta, sinos,
sintetizador, 8-bit). As músicas ficam no `.asp` em `adventiscratch/musicas/<n>.json`.

Edição: ferramentas **✏️ Desenhar** (B) e **⬚ Selecionar** (V); caixa de seleção (ou Shift+arrastar), Ctrl+clique
soma à seleção; arrastar move (notas e batidas da bateria), puxar a ponta alonga; Ctrl+C/X/V (cola no marcador
amarelo), Ctrl+D duplica, Ctrl+A seleciona tudo, Delete apaga, setas movem (Shift = batida/oitava), botões de
transpor, e **desfazer/refazer** (Ctrl+Z / Ctrl+Y, até 100 passos).

Blocos: tocar música, tocar até o fim, pausar, continuar, parar, repetir sim/não, volume, velocidade, pular para a
batida, "música está tocando/pausada/parada?", batida da música, nome da música, **quando a música chegar na
batida N**, **a cada batida da música**, **quando a música terminar** e "tocar nota N com instrumento por B batidas".
O ritmo usa o relógio do áudio (as notas são agendadas com antecedência), então não atrasa com o jogo pesado.

### Instrumentos SoundFont (.sf2)

No menu **Instrumento** de cada faixa: **Importar instrumento .sf2…**. O arquivo é lido no navegador
(`musica/soundfont.js`: presets, zonas, faixas de notas e de força, afinação, loop e envelope); o aluno ouve e
escolhe um preset e **só as amostras daquele preset** vão para o projeto (`adventiscratch/instrumentos/<n>.json` +
`.pcm`, PCM 16 bits). Limite de leitura: 64 MB por .sf2. Amostras estéreo tocam em mono; moduladores e filtros do
SF2 são ignorados.

### Loja de Instrumentos Virtuais

Na Central (menu da conta → **🎹 Loja de Instrumentos Virtuais**, ou pelo Criador de Músicas → Instrumento →
**Loja de Instrumentos Virtuais…**): buscar, usar (escolhe o preset e já coloca na faixa), denunciar, **Meus
instrumentos** e **Publicar instrumento** (.sf2 com licença, crédito e confirmação, iguais aos da loja de modelos).
O servidor confere se o arquivo é um SoundFont de verdade e lista os presets. Tamanho máximo:
`ADVENTISCRATCH_MAX_SF2_MB` (padrão 50). O painel de moderação ganhou **Instrumentos (.sf2) da loja**, com download
para conferir e ação de ocultar. API: `GET/POST /api/instrumentos`, `/api/instrumentos/meus`,
`/api/instrumentos/<id>/arquivo`, `/api/instrumentos/<id>/apagar`; denúncias aceitam `{"instrumento": id}`.
Para testes, `python -m conteudo.sf2_teste saida.sf2` (dentro de `server/`) gera um .sf2 pequeno com 3 sons.

## Animações, spritesheets e controlador de animação

Extensão **Animações** → **🖼️ Importar spritesheet (.png + .xml)…**: aceita o XML "Sparrow" do FNF
(`<SubTexture name x y width height frameX frameY frameWidth frameHeight rotated>`, com recortes e quadros
girados, lidos como no Flixel), o JSON do TexturePacker (hash ou array) ou uma grade simples (colunas × linhas).
Mostra as animações (nome sem os números do fim: `BF idle dance0003` → `BF idle dance`) com prévia, e cria as
fantasias num **ator novo** (monta um `.sprite3`) ou no **ator atual**, com o quadro inteiro (o vazio em volta
fica, então a animação não "treme"), em resolução 2× e tamanho 100/75/50/25% ou "caber no palco". Quadros
repetidos usam a mesma imagem. Máximo de 600 quadros por vez.

Blocos: **tocar animação [nome] a [24] quadros por segundo [uma vez/em loop]**, tocar até o fim, parar, animação
tocando, "animação está tocando?", quadro da animação, quadros da animação. Qualquer fantasia com número no fim
(`andar1`, `andar2`…) forma uma animação.

**🎛️ Controlador de animação…** (máquina de estados, como o Animator da Unity), um por ator: estados (cada um
toca uma animação, com quadros por segundo e loop), estado inicial, **transições** puxadas no grafo com condições
sobre **parâmetros** (número com `> < = ≠ ≥ ≤`, sim/não, **gatilho**) e/ou "esperar a animação terminar", e o nó
**Qualquer estado**. Ao clicar na bandeira, cada ator (e cada clone) começa no estado inicial e troca sozinho.
Blocos: definir/mudar parâmetro, disparar gatilho, parâmetro, estado da animação, ir para o estado, **quando
entrar no estado**, ligar/desligar controlador. Fica no `.asp` em `adventiscratch/controladores.json` (pelo nome
do ator; renomear o ator leva o controlador junto).

## Jogo de Ritmo (setas estilo FNF e círculos estilo osu!)

Extensão **Jogo de Ritmo** → **🎯 Editor de mapas de ritmo…** (tela cheia):
- **Setas**: linha do tempo com as 4 pistas do oponente e as 4 do jogador; clique põe nota, clique na nota tira,
  arrastar move (tempo e pista), puxar a ponta faz **nota longa**; botão direito apaga. **Círculos**: clique no
  palco põe um círculo no marcador amarelo (que anda sozinho uma divisão), arrastar move; na faixa de baixo,
  arrastar muda o tempo.
- **Áudio**: uma música do Criador de Músicas, um **som do projeto** ou só o tempo. **🎵 Enviar áudio** põe a
  música (.ogg, .mp3 ou .wav) nos sons do Palco e já escolhe ela; escolhendo `Inst.ogg` e `Voices.ogg` juntos, as
  duas faixas são misturadas numa só;
  BPM, **ajuste (ms)** para sincronizar, velocidade, encaixe (1, 1/2, 1/4, 1/8, 1/3 de batida ou livre), zoom,
  "tique" quando a agulha passa por uma nota, desfazer/refazer.
- **⏺ Gravar**: com a música tocando, as setas / D F J K (ou cliques e Z/X nos círculos) viram notas; segurar
  faz nota longa. **✨ Gerar**: notas a partir da melodia da música (o oponente canta 2 compassos, você responde)
  ou pelo BPM. **📂 Importar**: `.osu` (círculos; osu!mania de 4 teclas vira setas, com notas longas) e `.json`
  do FNF (formato antigo/Psych, com `mustHitSection`, e o formato novo V-Slice).

**Itens** (notas especiais): no editor, escolha o **Item** antes de pôr as notas (ou **Shift+clique** numa nota
para aplicar/tirar). Funcionam nas setas e nos círculos:

| Item | O que faz |
|---|---|
| ❤ Vida | recupera 20% da vida; deixar passar não é erro |
| ⭐ Bônus | +500 pontos; deixar passar não é erro |
| ☠ Perigo | **não aperte!** Apertar conta como erro e tira 25% da vida; o oponente nunca aperta |
| 👻 Fantasma | nota comum que some antes de chegar (como o "Hidden" do osu!) |
| 🏷 personalizado | qualquer nome inventado (moeda, chave…): nota comum que dispara **quando pegar item [nome]** |

Blocos: **quando pegar item [item]**, **quando deixar passar item [item]**, **último item**, e "quantidade de
itens pegos / perigos apertados". Pele: fantasias `item perigo` (ou `item perigo esquerda` para cada seta),
`item vida`, `item moeda`… No `.json` do FNF, as notas "Hurt Note" (Psych) / `hurt` (V-Slice) viram ☠ perigo e os
outros tipos de nota viram itens personalizados com o mesmo nome.

Mapas ficam no `.asp` em `adventiscratch/mapas/<n>.json`. No jogo, o motor desenha numa camada por cima do palco
(e da camada 3D), usando o relógio do áudio. Avaliações: Perfeito (±45 ms), Bom (±90), Ok (±135), Errou;
círculos ±50/100/150. Vida (estilo FNF), combo, precisão, notas longas (soltar cedo conta como erro), oponente
automático, "ghost tapping" sem castigo e trava de ordem nos círculos (como no osu!).

Blocos: começar mapa (e esperar terminar), pausar, continuar, parar; **quando acertar [seta]**, **quando errar
[seta]**, **quando o oponente cantar [seta]**, quando o mapa terminar, quando a vida acabar; pontos, combo, maior
combo, precisão, vida, quantidade de perfeitos/bons/oks/erros, última avaliação, última seta, tempo do mapa,
"mapa tocando?", "seta apertada?"; e configuração: **usar as fantasias do ator [X] nas setas e círculos** (pele),
lado do jogador, mostrar oponente, **rolagem para cima/baixo (downscroll)**, velocidade das notas, teclas
(setas + DFJK / setas + WASD / só setas), posição das setas, tamanho, placar, pode perder.

**Pele**: as fantasias de um ator viram as setas, com nomes em português (`nota esquerda`, `receptor esquerda`,
`apertado esquerda`, `acerto esquerda`, `segurar esquerda`, `fim segurar esquerda`) ou os nomes do FNF
(`purple`, `arrowLEFT`, `left press`, `left confirm`, `purple hold piece`, `pruple end hold`…): importe o
`NOTE_assets.png` + `.xml` com a extensão Animações e use esse ator. Círculos: `circulo`/`hitcircle`,
`aproximacao`/`approachcircle`, `borda`/`hitcircleoverlay`.
A pele também troca o texto das **avaliações** (`perfeito`/`sick`, `bom`/`good`, `ok`/`bad`, `errou`/`miss`),
os **números do combo** (`num0`…`num9`, como no FNF, ou `numero 0`…`numero 9`) e a **contagem regressiva**
(`contagem 3`, `pronto`/`ready`, `prepara`/`set`, `vai`/`go`).

**Ícones da barra de vida** (estilo FNF): `ícone do [jogador/oponente] com as fantasias do ator [X]` usa as
fantasias `icone`, `icone perdendo` e `icone ganhando` (ou `normal`/`perdendo`/`ganhando`, `icon`/`losing`/
`winning`); sem esses nomes, usa a fantasia atual, e uma grade de ícones do FNF (`icon-bf.png`, 300×150 ou
450×150) é cortada sozinha em normal/perdendo/ganhando. O ícone pula na batida, troca para "perdendo" abaixo de 20%
de vida (e "ganhando" acima de 80%), e o do jogador fica espelhado, como no FNF. Sem ator, são emojis
(`ícone do [quem]: emoji [🦉]`); também dá para escolher as **cores da barra de vida** e esconder os ícones.

**Contagem regressiva**: `contagem regressiva (3, 2, 1, vai!) antes do mapa: sim` espera 4 batidas antes do
áudio (o tempo do mapa começa negativo) e dispara `quando a contagem mostrar [3/2/1/vai!]` (para tocar os sons).

## Marca e personagens

- Nas mensagens do editor, a palavra "Scratch" aparece como **Screate** (`src/lib/adventiscratch/marca.js`).
  "Scratch Link" continua com esse nome porque é o aplicativo que precisa ser instalado para micro:bit e LEGO.
- O gato, Gobo, Pico, Nano, Giga e Tera saíram das bibliotecas, e os tutoriais em cartões do Scratch (com as
  imagens e vídeos deles) foram removidos: o botão "Tutoriais" abre `tutoriais.html`.
- A mascote **Siom** e o **mioS** abrem a biblioteca de atores, seguidos da turma: Coruja Sabida, Bia Capivara,
  Theo Tartaruga, Lumi Vagalume, Pipo Pinguim, Tito Tucano e Nina Robô. Tudo é gerado por
  `scripts/personagens/gerar_personagens.py` (os desenhos da Siom e do mioS ficam em `scripts/personagens/*.svg`).
  As artes da marca (logo, ícone da aba, capa da extensão Extras e as versões da Siom usadas nas páginas)
  saem de `scripts/personagens/gerar_marca.py`.

## Extensão Tilemaps

Fases feitas de blocos numa grade (`src/lib/adventiscratch/tilemap/`), com o **🧱 Editor de tilemaps**:

- **Tileset**: as fantasias de um ator são os tiles (tile 1 = 1ª fantasia). **Criar tileset de uma imagem** corta uma
  imagem (ex.: pixel art de 16×16) em tiles e cria esse ator, escondido no palco.
- **Ferramentas**: lápis (P), borracha (E), balde (B), retângulo (R), conta-gotas (I ou Alt + clique), desfazer
  (Ctrl+Z); rodinha rola, Ctrl + rodinha dá zoom, botão direito arrasta. Camadas **principal** e **fundo** (enfeite).
- **Tipos**: cada tile tem um tipo (começa **sólido**): `sólido` e `plataforma` funcionam sozinhos com a
  **Plataforma 2D**; `perigo`, `moeda`, `escada`, `água`, `início`, `fim` ou qualquer nome servem para os blocos.
- **Importar do Tiled**: `.tmj`/`.json` ou `.tmx`, com tilesets embutidos ou `.tsx`/`.tsj` e as imagens escolhidas
  junto; camadas em CSV, lista ou base64 (sem compressão, zlib ou gzip). Camadas chamadas fundo/background vão para
  o fundo; uma camada colisão/collision vira tiles sólidos invisíveis; as propriedades `tipo`/`type`/`class` ou
  `solid`/`collides` dos tiles viram os tipos.

O mapa é desenhado dentro do renderizador do Scratch (atrás dos atores), então anda com a **Câmera** e conta para
"tocando na cor". Com um tilemap no palco, as bordas da Plataforma 2D passam a ser as bordas do mapa. Blocos:
`mostrar tilemap`, `tocando em tile [tipo]?`, `quando tocar em tile`, `apagar os tiles [moeda] que este ator toca`,
`tipo do tile embaixo deste ator`, `tile em x: y:`, `mudar tile em x: y: para`, `ir para o tile [início] número 1`,
`trocar cada tile [inimigo] por um clone deste ator`, `borda [direita] do tilemap`… O que o jogo muda volta ao
desenho do editor quando o projeto para ou recomeça. Fica no `.asp` em `adventiscratch/tilemaps.json`.

## Extensão Câmera

Mova, aproxime (zoom) e gire a visão do palco, siga um ator e treme a tela (`src/lib/adventiscratch/camera-extension.js`).
As posições dos atores continuam sendo as do "mundo": só o desenho muda. Quando a câmera está em uso:

- os atores podem sair da área do palco (o mundo pode ser maior que o palco);
- "tocando em ator/cor" funciona em qualquer lugar do mundo;
- cliques e "tocando no ponteiro do mouse" levam a câmera em conta (`x do mouse no mundo`, `y do mouse no mundo`);
- `câmera seguir [ator] com suavidade [80] %`, `olhar à frente do ator seguido`, `limitar a câmera entre x… y…`;
- `fixar este ator na tela: sim` deixa placar, vidas e botões parados na tela; `cenário anda com a câmera: não`
  (padrão) deixa o cenário parado como um céu.

A bandeira verde volta a câmera ao normal. Arrastar atores com o mouse com a câmera girada ou com zoom pode
ficar estranho.

## Servidor Multiplayer (só para membros)

Jogos online com os colegas, em salas (`src/lib/adventiscratch/multiplayer-extension.js` e `server/multiplayer/`).
Só funciona com conta (o aluno precisa ter entrado no editor) e não deixa entrar contas suspensas.

- `entrar na sala [nome] (até [8] jogadores)`, `sair da sala`, `quando um jogador entrar/sair`, `sou o anfitrião?`;
- `enviar mensagem [pulo] com [dado] para todos` (ou para um jogador) e `quando receber mensagem [pulo]`;
- `mudar variável da sala [placar] para [10]` (todos veem o mesmo valor) e `quando a variável da sala mudar`;
- `mudar meu [vida] para [3]` e `[vida] do jogador [id]`;
- `compartilhar a posição deste ator: sim` envia x, y, direção, fantasia, tamanho e visibilidade (até 20 vezes
  por segundo) e `ficar igual ao ator do jogador [id]` copia tudo isso para um clone.

O servidor é um WebSocket em `/api/multiplayer`, servido pelo **Daphne** (o `runserver` já usa ele, e o Docker e o
`publicar-na-internet.bat` também). As salas ficam na memória, por isso o servidor roda num processo só. Limites
no `.env`: `ADVENTISCRATCH_MULTI_MAX_JOGADORES`, `ADVENTISCRATCH_MULTI_MAX_SALAS`, `ADVENTISCRATCH_MULTI_MSG_SEG`
(mensagens por segundo de cada jogador); `ADVENTISCRATCH_MULTIPLAYER=0` desliga. Moderadores veem as salas abertas
em `GET /api/multiplayer/salas`. No GitHub Pages (sem servidor) o multiplayer não funciona.

## Tutoriais e exemplos

- **`tutoriais.html`**: 14 lições interativas em português (primeiros passos, jogo 2D, Extras, mundo 3D, modelos e
  texturas, Criador de Músicas, Animações e spritesheets, Jogo de Ritmo, jogo de plataforma 2D, jogo de plataforma 3D, nuvem, detector de erros, salvar/entregar, conta e regras). Desenhos dos blocos em HTML/CSS,
  progresso salvo no navegador, link direto para cada passo (`tutoriais.html#plataforma/3`). O botão "Tutoriais" do
  editor abre esta página. O conteúdo fica em `src/playground/tutoriais.html` (cada `<section>` é uma lição e cada
  `<article>` é um passo).
- **`exemplos.html`**: 8 projetos prontos que abrem no editor com um clique (`editor.html?exemplo=nome`):
  Coruja Coletora (2D), Calculadora da Coruja (Extras), Coruja Saltitante (Plataforma 2D), Show da Coruja (Músicas), Batalha da Coruja (Jogo de Ritmo), Mundo 3D, Visualizador de Modelos e Corrida 3D (plataforma
  com física, câmera em 3ª pessoa e animações por estado). A Corrida 3D e o Visualizador usam **o modelo que o
  aluno importar**.
- Os exemplos são gerados por `python scripts/exemplos/gerar_exemplos.py` (saem em `static/exemplos/*.asp`).
  Para mudar um exemplo, edite a função dele no script e rode de novo.

### Segredo (só para professores 🤫)

Digitar `EASTEREGGSEARCHING` na busca da biblioteca de **cenários** abre o **Fliperama Secreto da Coruja**, com 6
jogos originais feitos em canvas + Web Audio (nenhum conteúdo da internet nem de outras empresas): Batalha de Ritmo
(o Tucano DJ canta e o aluno responde com as setas; música composta na hora), Corrida Infinita, Mundo de Blocos
(construir e quebrar, salvo no navegador), Empilha Blocos, Minhoca Faminha e Pingue-Coruja. O código fica em
`src/lib/adventiscratch/fliperama/` e só é baixado quando alguém acha o segredo (chunk `adventiscratch-fliperama`).
Os recordes ficam no `localStorage` do navegador.

## Detector de erros

O editor analisa os blocos do ator em edição e marca os problemas: **vermelho** = erro, **laranja** = aviso,
com um **⚠** no bloco (passe o mouse para ler). O contador no canto da área de código lista tudo; clique num
item para ir até o bloco. Ele detecta: condição vazia em `se`/`até que`/`e`/`ou`, variável ou lista apagada,
bloco personalizado sem definição, divisão por zero, fantasia/cenário/som que não existe, modelo 3D não importado,
objeto 3D usado mas nunca criado, mensagem enviada que ninguém recebe (e vice-versa), script sem bloco de evento
e `se`/`sempre`/`repita` vazios. Para criar uma regra nova, edite `analisar()` em `detector-erros.js`.

## Contas e moderação

O servidor fica na pasta `server/` (Django). Ele guarda as contas e cuida da moderação; o editor continua
rodando no navegador e consulta a situação da conta a cada minuto.

- **Contas de aluno:** criadas com o **código da turma** (o professor cria os códigos no painel). Guardamos só
  usuário, nome de exibição e turma: sem e-mail e sem outros dados pessoais.
- **Painel de moderação:** `/moderacao/` (admin do Django em português). Denúncias, sanções, pedidos de revisão,
  códigos de turma e usuários.
- **Sanções:**

  | Tipo | O que o aluno vê |
  |---|---|
  | Advertência | Aviso azul "Li e entendi"; a conta continua funcionando |
  | Suspensão temporária | Tela laranja com motivo, mensagem e contagem regressiva até a data de fim |
  | Suspensão indefinida | Tela roxa: "até um moderador revisar o seu caso" |
  | Suspensão permanente | Tela vermelha: conta encerrada (o moderador decide se aceita pedido de revisão) |

  Quando há mais de uma, vale a mais grave. Ao aplicar uma suspensão, o aluno é desconectado na hora.
  Em todas as telas o aluno pode **baixar o projeto** (para não perder o trabalho) e, se permitido,
  **pedir revisão**. Denúncias são feitas pelo menu da conta (canto superior direito do editor).
- **Fluxo do moderador:** Denúncias → abrir → "Aplicar sanção ao denunciado" (formulário já preenchido) →
  escolher tipo, motivo e mensagem. Pedidos de revisão → aceitar (revoga) ou negar, com resposta ao aluno.

### Rodar o servidor no computador (desenvolvimento)

```bash
cd server
pip install -r requirements.txt
python manage.py migrate
python manage.py criar_moderador professor --admin      # pede a senha
python manage.py runserver                              # http://localhost:8000/moderacao/
```

Em outra janela, `npm start` (editor em http://localhost:8601). O editor encontra o servidor sozinho.
No painel, crie um **código de turma** antes de criar contas de aluno. Testes: `python manage.py test contas`.

A configuração do editor fica em `static/adventiscratch/config.js` (endereço da API e se o login é obrigatório).
Para usar o editor sem contas, coloque `api: 'desligado'`.

## Servidor com Docker Engine

A imagem junta tudo: editor compilado + API + painel de moderação, num endereço só.

```bash
cp .env.example .env          # edite: DJANGO_SECRET_KEY, moderador inicial, domínio
docker compose up -d --build  # http://SEU-SERVIDOR:8000
docker compose logs -f        # ver o que está acontecendo
```

- Os dados (banco SQLite) ficam no volume `dados`. Backup: `docker compose cp adventiscratch:/dados ./backup`.
- PostgreSQL (opcional): descomente as variáveis `POSTGRES_*` no `.env` e use `docker compose --profile postgres up -d`.
- Atualizar depois de mudar o código: `docker compose up -d --build`.

## Publicar na internet com Cloudflare Tunnel

Não precisa abrir portas no roteador nem ter IP fixo.

1. No painel da Cloudflare: **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**.
2. Copie o **token** (o texto longo depois de `--token` no comando de instalação) para `CLOUDFLARE_TUNNEL_TOKEN` no `.env`.
3. Em **Public Hostname**, adicione seu domínio (ex.: `adventiscratch.suaescola.com.br`) com **Service: HTTP** e
   **URL: `adventiscratch:8000`**.
4. No `.env`:
   ```
   DJANGO_ALLOWED_HOSTS=adventiscratch.suaescola.com.br
   DJANGO_CSRF_TRUSTED_ORIGINS=https://adventiscratch.suaescola.com.br
   ADVENTISCRATCH_ATRAS_DE_PROXY=1
   ENDERECO=127.0.0.1
   ```
5. `docker compose --profile cloudflare up -d --build`

O IP real do aluno (cabeçalho `CF-Connecting-IP`) é usado no limite de tentativas de login.

## Criar mais blocos

Para criar mais blocos, adicione um item em `blocks` dentro de `getInfo()` e um método com o mesmo nome do `opcode`.

## Jeito fácil no Windows

- **`iniciar.bat`** (dois cliques): instala o que falta, prepara o banco, abre o servidor e o editor
  e abre o navegador em http://localhost:8601.
- **`publicar-na-internet.bat`**: compila o editor, sobe o servidor em modo produção (Waitress) e cria um
  endereço público `https://….trycloudflare.com` com o Cloudflare (instala o `cloudflared` pelo winget se faltar).
  Funciona enquanto o computador e a janela ficarem ligados; o endereço muda a cada vez. Para um endereço fixo,
  use Docker + Cloudflare Tunnel com domínio próprio (seção abaixo). Nesse modo, entre no painel de moderação
  pelo endereço público (https), não pelo localhost.

## Implantação institucional em Docker

O Compose institucional executa o editor e a API Django com Daphne, PostgreSQL, Redis e Cloudflare Tunnel.
PostgreSQL e Redis ficam em uma rede interna. O acesso externo passa pelo túnel, sem portas
publicadas no host. O Redis mantém o cache e a contagem de tentativas de login entre processos.
As salas multiplayer ficam na memória do Daphne. Mantenha uma réplica da aplicação enquanto
essa implementação estiver ativa.

1. Copie `.env.institucional.example` para `.env.institucional`. Gere valores aleatórios distintos
   para a chave Django e as senhas do PostgreSQL e do Redis. Restrinja o acesso ao arquivo ao
   operador da implantação (`chmod 600 .env.institucional` em um host Linux).
2. No Cloudflare, crie um túnel gerenciado e uma rota para o domínio institucional com destino
   `http://adventiscratch:8000`. Preencha `ADVENTISCRATCH_DOMINIO` com o hostname e
   `CLOUDFLARE_TUNNEL_TOKEN` com o token do túnel.
3. Valide a configuração e suba a instância:

   ```sh
   docker compose --env-file .env.institucional -f compose.institucional.yml -p adventiscratch-institucional config --quiet
   docker compose --env-file .env.institucional -f compose.institucional.yml -p adventiscratch-institucional up -d --build
   docker compose --env-file .env.institucional -f compose.institucional.yml -p adventiscratch-institucional exec adventiscratch python manage.py createsuperuser
   ```

4. Verifique `https://<domínio>/api/saude` e o login no painel antes de cadastrar turmas.

O nome de projeto `adventiscratch-institucional` cria volumes próprios. Para migrar uma
instalação existente, faça backup do banco e dos arquivos enviados, migre os dados para o
PostgreSQL e restaure os arquivos no novo volume antes de direcionar os usuários ao novo ambiente.
Valide a abertura de projetos e a recuperação de contas na instância de destino.

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

## Versão de teste no GitHub Pages

O workflow `.github/workflows/pages.yml` gera o site (`BUILD_MODE=site`, só a pasta `build/`) e publica no GitHub
Pages a cada push na `main`. Essa versão é **só para testes**: não tem servidor, então contas, nuvem, loja e
moderação ficam desligadas (`config.js` com `api: 'desligado'`). O editor, a extensão 3D, a Plataforma 2D, os
exemplos, os tutoriais e o fliperama funcionam normalmente. Para usar contas, publique com Docker ou Cloudflare.

Para ligar: no repositório, **Settings → Pages → Source: GitHub Actions**. Em repositório privado, o GitHub Pages
precisa de um plano pago (GitHub Pro); no plano grátis, o repositório tem que ser público. O site publicado é
público mesmo com o repositório privado.

## Publicar no seu GitHub

```bash
git remote rename origin upstream
git remote add origin https://github.com/SEU_USUARIO/adventiscratch.git
git push -u origin adventiscratch
```

## Licença e marcas

O Adventiblocks é um projeto independente baseado no editor de código aberto Scratch. Não tem afiliação
nem endosso da Scratch Foundation. O Scratch é desenvolvido pela Scratch Foundation e seus parceiros e afiliados.

O [código desta base](LICENSE) está sob **AGPL-3.0-only**. A licença permite cobrar pelo serviço. Ao oferecer
uma versão modificada pela rede, ofereça aos usuários acesso ao **código-fonte correspondente da versão
implantada**, incluindo as alterações e os scripts necessários para gerar e instalar a versão. Preserve os
avisos de direitos autorais e licença e indique as alterações. Ao distribuir a imagem Docker ou outro
artefato, observe também as condições de distribuição da AGPL. O link no rodapé deve apontar para o fonte
efetivamente publicado.

As [diretrizes de marca](https://mitscratch.freshdesk.com/en/support/solutions/articles/4000232107-scratch-trademark-guidelines)
tratam separadamente o nome, os logos e os personagens protegidos. A Coruja Sabida é o ator padrão, e o
catálogo inclui a coruja, a estrela e o controle de jogo do próprio projeto. Projetos importados conservam
seus recursos. Antes de uma distribuição comercial, revise também as licenças dos demais recursos de
terceiros, inclusive sons, imagens, tutoriais, fontes e arquivos de exemplo.
