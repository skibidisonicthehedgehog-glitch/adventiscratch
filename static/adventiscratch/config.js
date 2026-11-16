/*
 * Configuração do Adventiscratch (pode ser editada sem recompilar o editor).
 *
 * api:
 *   - '' (vazio)  -> descobre sozinho: '/api' quando o editor é servido pelo servidor (Docker/Cloudflare),
 *                    'http://localhost:8000/api' quando está em desenvolvimento (npm start, porta 8601).
 *   - 'desligado' -> sem contas (editor livre, sem moderação).
 *   - ou o endereço completo, ex.: 'https://adventiscratch.minhaescola.com.br/api'
 * exigirLogin: true = o editor só abre depois de entrar numa conta.
 */
window.ADVENTISCRATCH_CONFIG = {
    api: '',
    exigirLogin: true
};
