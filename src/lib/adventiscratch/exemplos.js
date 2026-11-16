/**
 * Abre um projeto de exemplo pela URL: editor.html?exemplo=corrida-3d
 * carrega static/exemplos/corrida-3d.asp depois que o editor terminar de abrir o projeto padrão.
 */
const NOME_VALIDO = /^[a-z0-9-]{1,60}$/;

export const iniciarExemplos = vm => {
    const nome = new URLSearchParams(window.location.search).get('exemplo');
    if (!nome || !NOME_VALIDO.test(nome)) return;
    let carregado = false;
    const carregar = async () => {
        if (carregado) return;
        carregado = true;
        try {
            const resposta = await fetch(`static/exemplos/${nome}.asp`);
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            await vm.loadProject(await resposta.arrayBuffer());
            // mostra o código: seleciona o ator (ou o palco) que tem mais blocos
            setTimeout(() => {
                const alvos = vm.runtime.targets.filter(t => t.isOriginal);
                const maior = alvos.reduce((a, t) => (Object.keys(t.blocks._blocks).length >
                    Object.keys(a.blocks._blocks).length ? t : a), alvos[0]);
                if (maior && vm.editingTarget !== maior) vm.setEditingTarget(maior.id);
            }, 400);
            document.title = `Adventiscratch – Exemplo: ${nome.replace(/-/g, ' ')}`;
        } catch (e) {
            // eslint-disable-next-line no-alert
            alert(`Não foi possível abrir o exemplo "${nome}". (${e.message})`);
        }
    };
    // espera o editor carregar o projeto padrão (senão ele substituiria o exemplo)
    vm.on('workspaceUpdate', () => setTimeout(carregar, 300));
};
