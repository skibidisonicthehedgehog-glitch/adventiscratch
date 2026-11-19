/**
 * Leitor do data.win (GameMaker: Studio 1.4, GameMaker Studio 2 e GameMaker 2022+).
 *
 * O arquivo é um "FORM" com blocos (GEN8, STRG, TXTR, TPAG, SPRT, BGND, OBJT, ROOM, CODE, VARI, FUNC…).
 * Todos os ponteiros são posições absolutas no arquivo. Como o formato muda muito entre versões e o
 * GEN8 quase sempre diz "2.0.0.0", várias partes usam o tamanho real das entradas para descobrir
 * quais campos existem.
 */
import {tipoDeTextura} from './texturas.js';

export class ErroDataWin extends Error {}

export const lerDataWin = buffer => {
    const d = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    const tam = d.length;
    const u8 = p => d[p];
    const u16 = p => dv.getUint16(p, true);
    const i16 = p => dv.getInt16(p, true);
    const u32 = p => dv.getUint32(p, true);
    const i32 = p => dv.getInt32(p, true);
    const f32 = p => dv.getFloat32(p, true);
    const tag = p => String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]);
    const dentro = p => p > 0 && p < tam;
    const decoder = new TextDecoder('utf-8');
    const cacheStr = new Map();
    // ponteiros de texto apontam direto para o conteúdo (o tamanho fica 4 bytes antes)
    const str = p => {
        if (!p || !dentro(p)) return '';
        let s = cacheStr.get(p);
        if (s === undefined) {
            let len = p >= 4 ? u32(p - 4) : -1;
            if (len < 0 || p + len > tam || d[p + len] !== 0) {
                len = 0;
                while (p + len < tam && d[p + len] !== 0) len++;
            }
            s = decoder.decode(d.subarray(p, p + len));
            cacheStr.set(p, s);
        }
        return s;
    };
    const lista = p => {
        if (!dentro(p)) return [];
        const n = u32(p);
        if (n > 1000000 || p + 4 + (n * 4) > tam) return [];
        const r = new Array(n);
        for (let i = 0; i < n; i++) r[i] = u32(p + 4 + (i * 4));
        return r;
    };

    if (tam < 16 || tag(0) !== 'FORM') throw new ErroDataWin('Este arquivo não é um data.win do GameMaker.');
    const blocos = {};
    let p = 8;
    const fimForm = Math.min(tam, 8 + u32(4));
    while (p + 8 <= fimForm) {
        const nome = tag(p);
        const t = u32(p + 4);
        blocos[nome] = {ini: p + 8, fim: Math.min(tam, p + 8 + t), tam: t};
        p += 8 + t;
    }
    if (!blocos.GEN8) throw new ErroDataWin('O data.win não tem o bloco GEN8.');
    const chunk = n => blocos[n] || null;
    const listaDoBloco = n => (chunk(n) && chunk(n).tam >= 4 ? lista(chunk(n).ini) : []);

    // ---------------------------------------------------------------- GEN8
    const g = chunk('GEN8').ini;
    const bytecode = u8(g + 1);
    const info = {
        bytecode,
        arquivo: str(u32(g + 4)),
        nome: str(u32(g + 40)),
        versao: [u32(g + 44), u32(g + 48), u32(g + 52), u32(g + 56)],
        largura: u32(g + 60),
        altura: u32(g + 64),
        nomeExibido: str(u32(g + 100)),
        fps: 0
    };
    const gms2 = info.versao[0] >= 2;
    const v23 = Boolean(chunk('SEQN') || chunk('TAGS') || chunk('FEAT'));
    const posOrdem = g + (bytecode >= 14 ? 128 : 124);
    const ordemSalas = lista(posOrdem);
    if (gms2) {
        const depois = posOrdem + 4 + (ordemSalas.length * 4) + 40;
        if (depois + 4 <= chunk('GEN8').fim) info.fps = f32(depois);
    }
    info.gms2 = gms2;
    info.v23 = v23;

    // ---------------------------------------------------------------- textos
    const textos = listaDoBloco('STRG').map(q => str(q + 4));

    // ---------------------------------------------------------------- texturas
    const texturas = listaDoBloco('TXTR').map((q, i, todos) => {
        const prox = i + 1 < todos.length ? todos[i + 1] : q + 32;
        // procura, entre os campos da entrada, o ponteiro que leva a uma imagem
        let dados = 0;
        for (let k = q; k < Math.min(prox, q + 40); k += 4) {
            const v = u32(k);
            if (tipoDeTextura(d, v)) dados = v;
        }
        return {dados, imagem: null};
    });

    const paginas = new Map(); // endereço → item de página de textura
    const itemPagina = q => {
        if (!q || !dentro(q)) return null;
        let it = paginas.get(q);
        if (!it) {
            it = {
                sx: u16(q),
                sy: u16(q + 2),
                sw: u16(q + 4),
                sh: u16(q + 6),
                tx: u16(q + 8),
                ty: u16(q + 10),
                tw: u16(q + 12),
                th: u16(q + 14),
                bw: u16(q + 16),
                bh: u16(q + 18),
                textura: i16(q + 20)
            };
            paginas.set(q, it);
        }
        return it;
    };

    // ---------------------------------------------------------------- sprites
    const sprites = listaDoBloco('SPRT').map(q => {
        const s = {
            nome: str(u32(q)),
            largura: u32(q + 4),
            altura: u32(q + 8),
            margemEsq: i32(q + 12),
            margemDir: i32(q + 16),
            margemBaixo: i32(q + 20),
            margemCima: i32(q + 24),
            origemX: i32(q + 48),
            origemY: i32(q + 52),
            quadros: [],
            velocidade: 1,
            tipoVelocidade: 0
        };
        let k = q + 56;
        if (i32(k) === -1) {
            const versao = u32(k + 4);
            const tipo = u32(k + 8);
            k += 12;
            if (gms2) {
                s.velocidade = f32(k);
                s.tipoVelocidade = u32(k + 4);
                k += 8;
            }
            if (versao >= 2) k += 4;
            if (versao >= 3) k += 4;
            if (tipo !== 0) return s; // SWF/Spine/vetor: sem suporte
        }
        s.quadros = lista(k).map(itemPagina)
            .filter(Boolean);
        return s;
    });

    // ---------------------------------------------------------------- fundos e tilesets
    const listaFundos = listaDoBloco('BGND');
    const fimBgnd = chunk('BGND') ? chunk('BGND').fim : 0;
    const fundos = listaFundos.map((q, i) => {
        const b = {nome: str(u32(q)), pagina: itemPagina(u32(q + 16))};
        if (gms2) {
            const fim = i + 1 < listaFundos.length ? listaFundos[i + 1] : fimBgnd;
            // descobre se existem os campos de separação (2024.14.1) e o id extra (2023.8)
            for (const [sep, extra] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
                let k = q + 24;
                const tw = u32(k);
                const th = u32(k + 4);
                k += 8;
                const sx = sep ? u32(k) : 0;
                const sy = sep ? u32(k + 4) : 0;
                if (sep) k += 8;
                const bx = u32(k);
                const by = u32(k + 4);
                const colunas = u32(k + 8);
                const itens = u32(k + 12);
                const total = u32(k + 16);
                k += 20 + (extra * 4) + 8;
                const fimCalc = k + (total * itens * 4);
                if (tw > 0 && th > 0 && tw < 4096 && th < 4096 && colunas > 0 && colunas < 10000 &&
                    fimCalc <= fim && fim - fimCalc < 16) {
                    Object.assign(b, {tw, th, sx, sy, bx, by, colunas});
                    break;
                }
            }
        }
        return b;
    });

    // ---------------------------------------------------------------- objetos
    const objetos = listaDoBloco('OBJT').map(q => {
        const tentar = gerenciado => {
            let k = q + 8;
            const visivel = u32(k);
            k += 4;
            if (gerenciado) k += 4;
            const solido = u32(k);
            const prof = i32(k + 4);
            const persistente = u32(k + 8);
            const pai = i32(k + 12);
            const mascara = i32(k + 16);
            k += 20 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4; // física
            const nVert = i32(k);
            k += 4 + 4 + 4 + 4;
            if (nVert < 0 || nVert > 4096) return null;
            k += nVert * 8;
            const eventos = lista(k);
            if (visivel > 1 || solido > 1 || persistente > 1 || eventos.length < 12 || eventos.length > 20) return null;
            return {visivel, solido, prof, persistente, pai, mascara, eventos};
        };
        const r = tentar(false) || tentar(true);
        if (!r) throw new ErroDataWin('Não consegui ler os objetos deste data.win (versão do GameMaker não suportada).');
        const eventos = r.eventos.map(lt => lista(lt).map(ev => ({
            sub: u32(ev),
            codigos: lista(ev + 4).map(ac => i32(ac + 32))
                .filter(c => c >= 0)
        })));
        return {
            nome: str(u32(q)),
            sprite: i32(q + 4),
            visivel: Boolean(r.visivel),
            solido: Boolean(r.solido),
            prof: r.prof,
            persistente: Boolean(r.persistente),
            pai: r.pai,
            mascara: r.mascara,
            eventos
        };
    });

    // ---------------------------------------------------------------- salas
    // camadas (GMS2): no 2022.1+ há campos de efeito antes dos dados; testamos as duas formas
    let camadasComEfeito = null;
    let tilesComprimidos = null;
    const validaDados = (tipo, k, fim) => {
        if (tipo === 1) {
            const spr = i32(k + 8);
            return u32(k) <= 1 && u32(k + 4) <= 1 && spr >= -1 && spr < sprites.length && u32(k + 12) <= 1 &&
                u32(k + 16) <= 1 && u32(k + 20) <= 1;
        }
        if (tipo === 2) {
            const n = u32(k);
            if (n > 100000) return false;
            if (fim) return k + 4 + (n * 4) === fim;
            return n === 0 || u32(k + 4) >= 100000;
        }
        if (tipo === 3) return dentro(u32(k)) && dentro(u32(k + 4)) && u32(k) < tam && u32(k + 4) < tam;
        if (tipo === 4) {
            const f = i32(k);
            return f >= -1 && f < fundos.length && u32(k + 4) < 100000 && u32(k + 8) < 100000;
        }
        return true;
    };
    const lerCamada = (c, fimProx, lerTile) => {
        const camada = {
            nome: str(u32(c)),
            id: u32(c + 4),
            tipo: u32(c + 8),
            prof: i32(c + 12),
            dx: f32(c + 16),
            dy: f32(c + 20),
            vx: f32(c + 24),
            vy: f32(c + 28),
            visivel: Boolean(u32(c + 32))
        };
        const base = c + 36;
        const comEfeito = base + 12 + (Math.min(u32(base + 8), 4096) * 12);
        let k2 = base;
        if (camada.tipo === 6 || camada.tipo === 0 || camada.tipo === 7) return camada;
        if (camadasComEfeito === true) {
            k2 = comEfeito;
        } else if (camadasComEfeito === null) {
            const sem = validaDados(camada.tipo, base, fimProx);
            const com = u32(base) <= 1 && validaDados(camada.tipo, comEfeito, fimProx);
            if (com && !sem) camadasComEfeito = true;
            else if (sem && !com) camadasComEfeito = false;
            if (camadasComEfeito) k2 = comEfeito;
        }
        if (camada.tipo === 1) {
            camada.fundo = {
                visivel: Boolean(u32(k2)),
                frente: Boolean(u32(k2 + 4)),
                sprite: i32(k2 + 8),
                repeteX: Boolean(u32(k2 + 12)),
                repeteY: Boolean(u32(k2 + 16)),
                esticar: Boolean(u32(k2 + 20)),
                cor: u32(k2 + 24),
                quadro: f32(k2 + 28),
                vel: f32(k2 + 32),
                tipoVel: u32(k2 + 36)
            };
        } else if (camada.tipo === 2) {
            const n = Math.min(u32(k2), 100000);
            camada.instancias = [];
            for (let i = 0; i < n; i++) camada.instancias.push(u32(k2 + 4 + (i * 4)));
        } else if (camada.tipo === 3) {
            camada.tiles = lista(u32(k2)).map(lerTile);
            camada.sprites = lista(u32(k2 + 4)).map(s => ({
                sprite: i32(s + 4),
                x: i32(s + 8),
                y: i32(s + 12),
                escalaX: f32(s + 16),
                escalaY: f32(s + 20),
                cor: u32(s + 24),
                vel: f32(s + 28),
                tipoVel: u32(s + 32),
                quadro: f32(s + 36),
                angulo: f32(s + 40)
            }));
        } else if (camada.tipo === 4) {
            const fundo = i32(k2);
            const tx = u32(k2 + 4);
            const ty = u32(k2 + 8);
            const n = tx * ty;
            const dados = new Uint32Array(n);
            let k3 = k2 + 12;
            let comprimido = tilesComprimidos;
            if (fimProx) {
                comprimido = !(k3 + (n * 4) <= fimProx && fimProx - (k3 + (n * 4)) < 16);
                tilesComprimidos = comprimido;
            }
            if (!comprimido) {
                for (let i = 0; i < n; i++) dados[i] = u32(k3 + (i * 4));
            } else {
                let i = 0;
                while (i < n && k3 < tam) {
                    const m = d[k3++];
                    if (m >= 128) {
                        const v = u32(k3);
                        k3 += 4;
                        for (let r = 0; r < (m & 0x7f) + 1 && i < n; r++) dados[i++] = v;
                    } else {
                        for (let r = 0; r < m && i < n; r++) {
                            dados[i++] = u32(k3);
                            k3 += 4;
                        }
                    }
                }
            }
            camada.mapa = {fundo, tx, ty, dados};
        }
        return camada;
    };

    // tamanho das instâncias nas salas (depende da versão): usa a primeira sala com 2 ou mais
    let tamInstancia = 0;
    for (const q of listaDoBloco('ROOM')) {
        const objs = lista(u32(q + 48));
        if (objs.length > 1) {
            tamInstancia = objs[1] - objs[0];
            break;
        }
    }
    if (!tamInstancia) tamInstancia = bytecode >= 16 ? 40 : 36;

    const salas = listaDoBloco('ROOM').map(q => {
        const sala = {
            nome: str(u32(q)),
            titulo: str(u32(q + 4)),
            largura: u32(q + 8),
            altura: u32(q + 12),
            velocidade: u32(q + 16),
            persistente: Boolean(u32(q + 20)),
            cor: u32(q + 24) & 0xffffff,
            mostrarCor: Boolean(u32(q + 28)),
            codigoCriacao: i32(q + 32),
            flags: u32(q + 36),
            fundos: [],
            vistas: [],
            instancias: [],
            tiles: [],
            camadas: []
        };
        const pFundos = u32(q + 40);
        const pVistas = u32(q + 44);
        const pObjs = u32(q + 48);
        const pTiles = u32(q + 52);
        let k = q + 56;
        // 2024.13: ponteiro extra (ordem de criação) antes de "World"
        if (u32(k) > 1 && dentro(u32(k))) k += 4;
        k += 32;
        const pCamadas = gms2 ? u32(k) : 0;
        sala.fundos = lista(pFundos).map(b => ({
            ativo: Boolean(u32(b)),
            frente: Boolean(u32(b + 4)),
            fundo: i32(b + 8),
            x: i32(b + 12),
            y: i32(b + 16),
            repeteX: Boolean(i32(b + 20)),
            repeteY: Boolean(i32(b + 24)),
            vx: i32(b + 28),
            vy: i32(b + 32),
            esticar: Boolean(u32(b + 36))
        }));
        sala.vistas = lista(pVistas).map(v => ({
            ativa: Boolean(u32(v)),
            x: i32(v + 4),
            y: i32(v + 8),
            w: i32(v + 12),
            h: i32(v + 16),
            px: i32(v + 20),
            py: i32(v + 24),
            pw: i32(v + 28),
            ph: i32(v + 32),
            bx: u32(v + 36),
            by: u32(v + 40),
            vx: i32(v + 44),
            vy: i32(v + 48),
            seguir: i32(v + 52)
        }));
        const objs = lista(pObjs);
        const comImagem = tamInstancia >= 48;
        sala.instancias = objs.map(o => {
            const inst = {
                x: i32(o),
                y: i32(o + 4),
                objeto: i32(o + 8),
                id: u32(o + 12),
                codigo: i32(o + 16),
                escalaX: f32(o + 20),
                escalaY: f32(o + 24),
                velImagem: 1,
                indiceImagem: 0
            };
            let k2 = o + 28;
            if (comImagem) {
                inst.velImagem = f32(k2);
                inst.indiceImagem = i32(k2 + 4);
                k2 += 8;
            }
            inst.cor = u32(k2);
            inst.angulo = f32(k2 + 4);
            inst.preCriacao = bytecode >= 16 ? i32(k2 + 8) : -1;
            return inst;
        });
        const lerTile = t => ({
            x: i32(t),
            y: i32(t + 4),
            fundo: i32(t + 8),
            sx: i32(t + 12),
            sy: i32(t + 16),
            w: u32(t + 20),
            h: u32(t + 24),
            prof: i32(t + 28),
            id: u32(t + 32),
            escalaX: f32(t + 36),
            escalaY: f32(t + 40),
            cor: u32(t + 44)
        });
        sala.tiles = lista(pTiles).map(lerTile);
        if (pCamadas && dentro(pCamadas)) {
            const ptrs = lista(pCamadas);
            sala.camadas = ptrs.map((c, idx) => lerCamada(c, idx + 1 < ptrs.length ? ptrs[idx + 1] : 0, lerTile));
        }
        return sala;
    });

    // ---------------------------------------------------------------- código
    const antigo = bytecode <= 14;
    const codigos = listaDoBloco('CODE').map(q => {
        const c = {nome: str(u32(q)), tamanho: u32(q + 4), locais: 0, args: 0, blob: 0, inicio: 0};
        if (antigo) {
            c.blob = q + 8;
            c.inicio = 0;
        } else {
            c.locais = u16(q + 8);
            c.args = u16(q + 10) & 0x7fff;
            c.blob = q + 12 + i32(q + 12);
            c.inicio = u32(q + 16);
        }
        return c;
    });
    // tamanho real do blob (entradas filhas do 2.3 dividem o blob com a entrada "pai")
    const tamBlob = new Map();
    codigos.forEach(c => {
        tamBlob.set(c.blob, Math.max(tamBlob.get(c.blob) || 0, c.tamanho));
    });
    codigos.forEach(c => {
        c.tamBlob = tamBlob.get(c.blob);
    });

    const refVariavel = new Map(); // endereço da instrução → índice da variável
    const refFuncao = new Map();
    const percorrer = (primeiro, vezes, mapa, valor) => {
        let a = primeiro;
        for (let i = 0; i < vezes && dentro(a); i++) {
            mapa.set(a, valor);
            const prox = u32(a + 4) & 0x07ffffff;
            if (!prox) break;
            a += prox;
        }
    };
    const variaveis = [];
    if (chunk('VARI') && chunk('VARI').tam) {
        const {ini, fim} = chunk('VARI');
        let k = antigo ? ini : ini + 12;
        const passo = antigo ? 12 : 20;
        while (k + passo <= fim) {
            const v = {nome: str(u32(k)), tipoInst: antigo ? 0 : i32(k + 4), id: antigo ? 0 : i32(k + 8)};
            const occ = u32(k + (antigo ? 4 : 12));
            const prim = i32(k + (antigo ? 8 : 16));
            variaveis.push(v);
            if (occ > 0 && prim > 0) percorrer(prim, occ, refVariavel, variaveis.length - 1);
            k += passo;
        }
    }
    const funcoes = [];
    if (chunk('FUNC') && chunk('FUNC').tam) {
        const {ini, fim} = chunk('FUNC');
        let k = ini;
        let n = Infinity;
        if (!antigo) {
            n = u32(k);
            k += 4;
        }
        for (let i = 0; i < n && k + 12 <= fim; i++) {
            const f = {nome: str(u32(k))};
            const occ = u32(k + 4);
            const prim = i32(k + 8);
            funcoes.push(f);
            // GMS 2.3+: o primeiro endereço aponta para o operando (4 bytes depois da instrução)
            if (occ > 0 && prim > 0) percorrer(v23 ? prim - 4 : prim, occ, refFuncao, funcoes.length - 1);
            k += 12;
        }
    }

    // caminhos (paths): pontos com velocidade (%), suave ou reto, aberto ou fechado
    const caminhos = listaDoBloco('PATH').map(q => {
        const n = u32(q + 16);
        const pontos = [];
        for (let i = 0; i < n && i < 100000; i++) {
            const k = q + 20 + (i * 12);
            pontos.push({x: f32(k), y: f32(k + 4), v: f32(k + 8)});
        }
        return {nome: str(u32(q)), suave: Boolean(u32(q + 4)), fechado: Boolean(u32(q + 8)), precisao: u32(q + 12), pontos};
    });

    const scripts = listaDoBloco('SCPT').map(q => {
        let id = i32(q + 4);
        if (id < -1) id &= 0x7fffffff;
        return {nome: str(u32(q)), codigo: id};
    });
    const iniciaisGlobais = chunk('GLOB') && chunk('GLOB').tam >= 4 ? lista(chunk('GLOB').ini) : [];

    // ---------------------------------------------------------------- sons
    const audios = listaDoBloco('AUDO').map(q => ({ini: q + 4, tam: u32(q)}));
    const sons = listaDoBloco('SOND').map(q => {
        const flags = u32(q + 4);
        const s = {
            nome: str(u32(q)),
            flags,
            tipo: str(u32(q + 8)),
            arquivo: str(u32(q + 12)),
            volume: f32(q + 20),
            tom: f32(q + 24),
            grupo: 0,
            audio: -1
        };
        if ((flags & 0x64) === 0x64 && bytecode >= 14) {
            s.grupo = i32(q + 28);
            s.audio = i32(q + 32);
        } else {
            s.audio = i32(q + 32);
        }
        return s;
    });
    const gruposAudio = listaDoBloco('AGRP').map(q => str(u32(q)));

    // ---------------------------------------------------------------- fontes
    const fimFont = chunk('FONT') ? chunk('FONT').fim : 0;
    const fontes = listaDoBloco('FONT').map(q => {
        const f = {
            nome: str(u32(q)),
            exibido: str(u32(q + 4)),
            tamanho: u32(q + 8),
            primeiro: u16(q + 20),
            pagina: itemPagina(u32(q + 28)),
            escalaX: f32(q + 32),
            escalaY: f32(q + 36),
            glifos: new Map(),
            altura: 0
        };
        if (f.tamanho & 0x80000000) f.tamanho = dv.getFloat32(q + 8, true);
        // a lista de glifos vem depois de 0 a 5 campos opcionais: acha pela forma dela
        for (let k = q + 40; k <= q + 64; k += 4) {
            const n = u32(k);
            if (n === 0 || n > 70000 || k + 4 + (n * 4) > fimFont) continue;
            const p0 = u32(k + 4);
            if (p0 !== k + 4 + (n * 4) && !(p0 > k && p0 < k + 4 + (n * 4) + 8)) continue;
            let ok = true;
            for (let i = 1; i < Math.min(n, 8); i++) {
                if (u32(k + 4 + (i * 4)) <= u32(k + (i * 4))) ok = false;
            }
            if (!ok) continue;
            for (let i = 0; i < n; i++) {
                const gp = u32(k + 4 + (i * 4));
                const gl = {
                    c: u16(gp),
                    x: u16(gp + 2),
                    y: u16(gp + 4),
                    w: u16(gp + 6),
                    h: u16(gp + 8),
                    avanco: i16(gp + 10),
                    desloc: i16(gp + 12)
                };
                f.glifos.set(gl.c, gl);
                f.altura = Math.max(f.altura, gl.h);
            }
            break;
        }
        return f;
    });

    return {
        bytes: d,
        dv,
        info,
        blocos,
        textos,
        texturas,
        sprites,
        fundos,
        objetos,
        salas,
        codigos,
        variaveis,
        funcoes,
        refVariavel,
        refFuncao,
        scripts,
        caminhos,
        iniciaisGlobais,
        sons,
        audios,
        gruposAudio,
        fontes,
        ordemSalas: ordemSalas.length ? ordemSalas : salas.map((s, i) => i)
    };
};
