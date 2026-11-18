/**
 * Tileset pronto do Adventiblocks (o mesmo do exemplo "Fase de Blocos"): 12 tiles de 32 px desenhados em SVG,
 * já com os tipos (grama/terra/tijolo/pedra sólidos, madeira plataforma, moeda, espinhos, bandeira, início…).
 */
const svg = conteudo => `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${conteudo}</svg>`;

export const TILESET_PRONTO = [
    {nome: 'grama', tipo: 'solido', svg: svg('<rect width="32" height="32" fill="#9A5B2C"/><rect width="32" height="10" fill="#5BBF4A"/><path d="M0 10 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 V10z" fill="#5BBF4A"/><circle cx="8" cy="22" r="2" fill="#7A4420"/><circle cx="23" cy="26" r="2" fill="#7A4420"/>')},
    {nome: 'terra', tipo: 'solido', svg: svg('<rect width="32" height="32" fill="#9A5B2C"/><circle cx="7" cy="8" r="2" fill="#7A4420"/><circle cx="22" cy="14" r="2.5" fill="#7A4420"/><circle cx="12" cy="25" r="2" fill="#7A4420"/>')},
    {nome: 'tijolo', tipo: 'solido', svg: svg('<rect width="32" height="32" fill="#C94A3A"/><g stroke="#8E2E22" stroke-width="2"><path d="M0 8H32M0 16H32M0 24H32M16 0V8M8 8V16M24 8V16M16 16V24M8 24V32M24 24V32"/></g><rect width="32" height="32" fill="none" stroke="#8E2E22" stroke-width="2"/>')},
    {nome: 'madeira', tipo: 'plataforma', svg: svg('<rect y="0" width="32" height="10" rx="2" fill="#C98A4B"/><rect y="7" width="32" height="3" fill="#8C5426"/><circle cx="5" cy="4" r="1.5" fill="#8C5426"/><circle cx="27" cy="4" r="1.5" fill="#8C5426"/>')},
    {nome: 'moeda', tipo: 'moeda', svg: svg('<circle cx="16" cy="16" r="10" fill="#FDD835" stroke="#C49A0E" stroke-width="2.5"/><rect x="14" y="10" width="4" height="12" rx="2" fill="#C49A0E"/>')},
    {nome: 'espinhos', tipo: 'perigo', svg: svg('<path d="M0 32 L5 14 L10 32 L16 12 L22 32 L27 14 L32 32 Z" fill="#B0BEC5" stroke="#546E7A" stroke-width="1.5"/><path d="M3.5 19 L5 14 L6.5 19Z M14.5 17 L16 12 L17.5 17Z M25.5 19 L27 14 L28.5 19Z" fill="#E53935"/>')},
    {nome: 'bandeira', tipo: 'fim', svg: svg('<rect x="6" y="2" width="3" height="30" fill="#616161"/><path d="M9 3 L28 9 L9 16 Z" fill="#2CB24A"/>')},
    {nome: 'nuvem', tipo: 'nada', svg: svg('<g fill="#FFFFFF" opacity=".95"><circle cx="10" cy="19" r="7"/><circle cx="18" cy="14" r="9"/><circle cx="25" cy="20" r="6"/><rect x="8" y="19" width="19" height="7" rx="3"/></g>')},
    {nome: 'arbusto', tipo: 'nada', svg: svg('<g fill="#3E9C35"><circle cx="9" cy="24" r="8"/><circle cx="18" cy="20" r="10"/><circle cx="25" cy="25" r="7"/></g><rect x="2" y="28" width="28" height="4" fill="#3E9C35"/>')},
    {nome: 'início', tipo: 'inicio', svg: svg('')},
    {nome: 'inimigo', tipo: 'inimigo', svg: svg('<path d="M4 30 Q4 10 16 10 Q28 10 28 30 Z" fill="#9C4DCC"/><circle cx="12" cy="20" r="3" fill="#fff"/><circle cx="21" cy="20" r="3" fill="#fff"/><circle cx="12" cy="21" r="1.5"/><circle cx="21" cy="21" r="1.5"/>')},
    {nome: 'pedra', tipo: 'solido', svg: svg('<rect width="32" height="32" rx="4" fill="#90A4AE"/><path d="M4 10 L12 6 M18 24 L28 20" stroke="#607D8B" stroke-width="2"/><rect width="32" height="32" rx="4" fill="none" stroke="#607D8B" stroke-width="2"/>')},
];
