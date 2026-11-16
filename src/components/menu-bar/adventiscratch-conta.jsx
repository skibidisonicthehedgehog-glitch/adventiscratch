/**
 * Menu da conta do Adventiscratch na barra superior: nome do aluno, turma, denunciar, moderação e sair.
 */
import React from 'react';

import {abrirDenuncia, abrirLogin, aoMudar, obterEstado, sair} from '../../lib/adventiscratch/conta/conta.js';
import {painelModeracao} from '../../lib/adventiscratch/conta/api.js';
import {aoMudarNuvem, obterNuvem} from '../../lib/adventiscratch/conta/nuvem.js';
import {abrirCentral, salvarRapido} from '../../lib/adventiscratch/conta/telas-nuvem.js';

const horario = d => (d ? d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '');

const estilos = {
    raiz: {position: 'relative', display: 'flex', alignItems: 'center', height: '100%', padding: '0 0.5rem'},
    botao: {
        display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(255,255,255,0.15)', color: '#fff',
        border: 0, borderRadius: '999px', padding: '0.3rem 0.8rem 0.3rem 0.35rem', fontWeight: 700,
        cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', whiteSpace: 'nowrap'
    },
    avatar: {
        width: '1.6rem', height: '1.6rem', borderRadius: '50%', background: '#FFD54A', color: '#1E1B3A',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem'
    },
    salvar: {background: '#FFD54A', color: '#1E1B3A', padding: '0.3rem 0.8rem', marginRight: '0.4rem'},
    status: {color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', marginRight: '0.5rem', whiteSpace: 'nowrap'},
    menu: {
        position: 'absolute', top: '100%', right: '0.5rem', background: '#fff', color: '#1E1B3A',
        borderRadius: '12px', boxShadow: '0 12px 30px rgba(0,0,0,0.25)', minWidth: '14rem', padding: '0.4rem',
        zIndex: 1000, fontSize: '0.85rem'
    },
    info: {padding: '0.5rem 0.7rem 0.6rem', borderBottom: '1px solid #EEE', marginBottom: '0.3rem'},
    item: {
        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '0.55rem 0.7rem',
        borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#1E1B3A', fontFamily: 'inherit',
        textDecoration: 'none', boxSizing: 'border-box'
    }
};

class AdventiscratchConta extends React.Component {
    constructor (props) {
        super(props);
        this.state = {conta: obterEstado(), nuvem: obterNuvem(), aberto: false};
        this.fecharFora = this.fecharFora.bind(this);
        this.raiz = React.createRef();
    }
    componentDidMount () {
        this.desligar = aoMudar(conta => this.setState({conta: {...conta}}));
        this.desligarNuvem = aoMudarNuvem(nuvem => this.setState({nuvem}));
        document.addEventListener('mousedown', this.fecharFora);
    }
    componentWillUnmount () {
        if (this.desligar) this.desligar();
        if (this.desligarNuvem) this.desligarNuvem();
        document.removeEventListener('mousedown', this.fecharFora);
    }
    fecharFora (e) {
        if (this.state.aberto && this.raiz.current && !this.raiz.current.contains(e.target)) {
            this.setState({aberto: false});
        }
    }
    acao (fn) {
        return () => {
            this.setState({aberto: false});
            fn();
        };
    }
    render () {
        const {fase, situacao} = this.state.conta;
        if (fase === 'desligado' || fase === 'carregando') return null;
        if (!situacao) {
            return (
                <div style={estilos.raiz}>
                    <button
                        style={estilos.botao}
                        onClick={abrirLogin}
                    >{'Entrar'}</button>
                </div>
            );
        }
        const {conta} = situacao;
        const painel = painelModeracao();
        const n = this.state.nuvem;
        let status = '';
        if (n.salvando) status = 'Salvando…';
        else if (n.erro) status = 'Erro ao salvar';
        else if (n.projetoId && n.alterado) status = 'Alterações não salvas';
        else if (n.salvoEm) status = `Salvo às ${horario(n.salvoEm)}`;
        return (
            <div
                ref={this.raiz}
                style={estilos.raiz}
            >
                {status && <span style={estilos.status}>{status}</span>}
                <button
                    disabled={n.salvando}
                    style={{...estilos.botao, ...estilos.salvar}}
                    title={n.projetoId ? 'Salvar na nuvem' : 'Salvar este projeto na nuvem'}
                    onClick={salvarRapido}
                >{'☁ Salvar'}</button>
                <button
                    aria-expanded={this.state.aberto}
                    style={estilos.botao}
                    onClick={() => this.setState({aberto: !this.state.aberto})}
                >
                    <span style={estilos.avatar}>{(conta.nome || '?').charAt(0).toUpperCase()}</span>
                    {conta.nome}
                    <span aria-hidden="true">{'▾'}</span>
                </button>
                {this.state.aberto && (
                    <div
                        role="menu"
                        style={estilos.menu}
                    >
                        <div style={estilos.info}>
                            <b>{conta.nome}</b>
                            <div style={{color: '#6B7280'}}>{`@${conta.usuario}`}</div>
                            {conta.turma && <div style={{color: '#6B7280'}}>{`Turma: ${conta.turma}`}</div>}
                        </div>
                        <button
                            role="menuitem"
                            style={estilos.item}
                            onClick={this.acao(() => abrirCentral('meus'))}
                        >{'📁 Meus projetos na nuvem'}</button>
                        <button
                            role="menuitem"
                            style={estilos.item}
                            onClick={this.acao(() => abrirCentral('explorar'))}
                        >{'🌎 Explorar projetos'}</button>
                        <button
                            role="menuitem"
                            style={estilos.item}
                            onClick={this.acao(() => abrirCentral('loja'))}
                        >{'🧩 Loja de modelos'}</button>
                        <button
                            role="menuitem"
                            style={estilos.item}
                            onClick={this.acao(abrirDenuncia)}
                        >{'🚩 Denunciar um usuário…'}</button>
                        {conta.moderador && painel && (
                            <a
                                href={painel}
                                rel="noopener noreferrer"
                                role="menuitem"
                                style={estilos.item}
                                target="_blank"
                            >{'🛡️ Painel de moderação'}</a>
                        )}
                        <button
                            role="menuitem"
                            style={estilos.item}
                            onClick={this.acao(sair)}
                        >{'Sair da conta'}</button>
                    </div>
                )}
            </div>
        );
    }
}

export default AdventiscratchConta;
