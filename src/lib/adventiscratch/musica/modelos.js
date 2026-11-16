/**
 * Músicas prontas para começar no Criador de Músicas (todas compostas aqui, originais).
 */
import {musicaVazia, PASSOS_POR_COMPASSO} from './dados.js';

// notas MIDI
const N = {C2: 36, D2: 38, E2: 40, F2: 41, G2: 43, A2: 45, B2: 47, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57,
    B3: 59, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, G5: 79};

/** frase: lista de [nota, duração em passos] (null = pausa), a partir do passo inicial */
const frase = (lista, inicio = 0) => {
    const notas = [];
    let p = inicio;
    for (const [n, d] of lista) {
        if (n !== null) notas.push({p, n, d});
        p += d;
    }
    return notas;
};

const acordesPorCompasso = (acordes, d = PASSOS_POR_COMPASSO) => {
    const notas = [];
    acordes.forEach((ac, i) => ac.forEach(n => notas.push({p: i * PASSOS_POR_COMPASSO, n, d})));
    return notas;
};

const baixoPorCompasso = (raizes, padrao) => {
    const notas = [];
    raizes.forEach((r, i) => padrao.forEach(([p, oit, d]) => notas.push({p: (i * PASSOS_POR_COMPASSO) + p,
        n: r + (oit * 12), d})));
    return notas;
};

const repetirPorCompasso = (passos, compassos) => {
    const r = [];
    for (let c = 0; c < compassos; c++) passos.forEach(p => r.push((c * PASSOS_POR_COMPASSO) + p));
    return r;
};

const aventura = () => {
    const m = musicaVazia('Aventura');
    m.bpm = 120;
    m.compassos = 4;
    m.faixas[0].instrumento = 'piano';
    m.faixas[0].notas = frase([
        [N.E4, 2], [N.G4, 2], [N.C5, 4], [N.B4, 2], [N.G4, 2], [N.A4, 4],
        [N.F4, 2], [N.A4, 2], [N.C5, 4], [N.D5, 4], [N.B4, 4],
        [N.E5, 2], [N.D5, 2], [N.C5, 4], [N.A4, 2], [N.C5, 2], [N.B4, 4],
        [N.G4, 2], [N.A4, 2], [N.B4, 2], [N.D5, 2], [N.C5, 8]
    ]);
    m.faixas[1].notas = baixoPorCompasso([N.C2, N.F2, N.A2, N.G2], [[0, 0, 3], [4, 1, 2], [8, 0, 3], [12, 1, 2]]);
    m.faixas[2].notas = acordesPorCompasso([[N.C4, N.E4, N.G4], [N.F3, N.A3, N.C4], [N.A3, N.C4, N.E4],
        [N.G3, N.B3, N.D4]]);
    m.bateria.linhas.bumbo = repetirPorCompasso([0, 8, 10], 4);
    m.bateria.linhas.caixa = repetirPorCompasso([4, 12], 4);
    m.bateria.linhas.chimbal = repetirPorCompasso([0, 2, 4, 6, 8, 10, 12, 14], 4);
    m.bateria.linhas.prato = [0];
    return m;
};

const calma = () => {
    const m = musicaVazia('Calma');
    m.bpm = 84;
    m.compassos = 4;
    m.faixas[0].instrumento = 'flauta';
    m.faixas[0].notas = frase([
        [N.A4, 6], [N.G4, 2], [N.E4, 8],
        [N.F4, 4], [N.A4, 4], [N.C5, 8],
        [N.E5, 6], [N.D5, 2], [N.C5, 4], [N.A4, 4],
        [N.B4, 4], [N.G4, 4], [N.A4, 8]
    ]);
    m.faixas[1].notas = baixoPorCompasso([N.A2, N.F2, N.C3, N.G2], [[0, 0, 8], [8, 0, 8]]);
    m.faixas[2].instrumento = 'cordas';
    m.faixas[2].notas = acordesPorCompasso([[N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.G3, N.C4, N.E4],
        [N.G3, N.B3, N.D4]]);
    m.bateria.volume = 0.5;
    m.bateria.linhas.bumbo = repetirPorCompasso([0, 10], 4);
    m.bateria.linhas.palmas = repetirPorCompasso([8], 4);
    return m;
};

const chefe = () => {
    const m = musicaVazia('Chefe');
    m.bpm = 150;
    m.compassos = 4;
    m.faixas[0].instrumento = 'synth';
    const riff = [[N.A4, 2], [N.A4, 1], [N.C5, 1], [N.A4, 2], [N.E5, 2], [N.D5, 2], [N.C5, 2], [N.B4, 2], [N.G4, 2]];
    m.faixas[0].notas = [
        ...frase(riff, 0), ...frase(riff, 16),
        ...frase([[N.F4, 2], [N.A4, 2], [N.C5, 2], [N.F4, 2], [N.E4, 4], [N.G4, 4]], 32),
        ...frase([[N.A4, 4], [N.C5, 2], [N.E5, 2], [N.D5, 4], [N.B4, 4]], 48)
    ];
    m.faixas[1].notas = baixoPorCompasso([N.A2, N.A2, N.F2, N.E2],
        [0, 2, 4, 6, 8, 10, 12, 14].map(p => [p, p % 4 === 2 ? 1 : 0, 2]));
    m.faixas[2].instrumento = 'cordas';
    m.faixas[2].volume = 0.35;
    m.faixas[2].notas = acordesPorCompasso([[N.A3, N.C4, N.E4], [N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4],
        [N.E3, N.G3, N.B3]]);
    m.bateria.linhas.bumbo = repetirPorCompasso([0, 4, 8, 12], 4);
    m.bateria.linhas.caixa = repetirPorCompasso([4, 12], 4);
    m.bateria.linhas.chimbal = repetirPorCompasso([2, 6, 10, 14], 4);
    m.bateria.linhas.tom = [56, 58, 60, 62];
    m.bateria.linhas.prato = [0, 32];
    return m;
};

const bit8 = () => {
    const m = musicaVazia('Fase 8-bit');
    m.bpm = 140;
    m.compassos = 4;
    m.faixas[0].instrumento = 'bit8';
    m.faixas[0].volume = 0.6;
    m.faixas[0].notas = frase([
        [N.C5, 1], [N.E5, 1], [N.G5, 2], [N.E5, 2], [N.C5, 2], [N.D5, 2], [N.E5, 2], [N.C5, 4],
        [N.A4, 2], [N.C5, 2], [N.E5, 2], [N.D5, 2], [N.C5, 2], [N.A4, 2], [N.G4, 4],
        [N.F4, 2], [N.A4, 2], [N.C5, 2], [N.F4, 2], [N.G4, 2], [N.B4, 2], [N.D5, 4],
        [N.E5, 2], [N.D5, 2], [N.C5, 2], [N.B4, 2], [N.C5, 8]
    ]);
    m.faixas[1].instrumento = 'bit8';
    m.faixas[1].volume = 0.5;
    m.faixas[1].notas = baixoPorCompasso([N.C3, N.A2, N.F2, N.G2], [0, 2, 4, 6, 8, 10, 12, 14]
        .map(p => [p, p % 4 === 2 ? 1 : 0, 1]));
    m.faixas[2].notas = [];
    m.bateria.linhas.bumbo = repetirPorCompasso([0, 8], 4);
    m.bateria.linhas.caixa = repetirPorCompasso([4, 12], 4);
    m.bateria.linhas.chimbal = repetirPorCompasso([0, 2, 4, 6, 8, 10, 12, 14], 4);
    return m;
};

export const MODELOS = [
    {id: 'vazia', nome: 'Em branco', criar: () => musicaVazia('minha música')},
    {id: 'aventura', nome: '🗺️ Aventura (alegre)', criar: aventura},
    {id: 'calma', nome: '🌙 Calma (tranquila)', criar: calma},
    {id: 'chefe', nome: '🐉 Chefe (batalha)', criar: chefe},
    {id: 'bit8', nome: '👾 Fase 8-bit', criar: bit8}
];
