"""
Gera um SoundFont 2 (.sf2) pequeno, com sons sintetizados, para testes.
Uso pela linha de comando:  python -m conteudo.sf2_teste saida.sf2
"""
import math
import struct
import sys


def _bloco(ident, dados):
    pad = b'\0' if len(dados) % 2 else b''
    return ident + struct.pack('<I', len(dados)) + dados + pad


def _lista(tipo, *blocos):
    corpo = tipo + b''.join(blocos)
    return b'LIST' + struct.pack('<I', len(corpo)) + corpo


def _nome(texto, tam=20):
    return texto.encode('latin-1')[:tam - 1].ljust(tam, b'\0')


def _onda(forma, taxa=22050, freq=261.63, ciclos=40):
    """Uma amostra curta em Dó4 (nota 60), feita para tocar em loop."""
    n = int(round(taxa / freq * ciclos))
    pcm = []
    for i in range(n):
        f = (i * freq / taxa) % 1.0
        if forma == 'quadrada':
            v = 0.5 if f < 0.5 else -0.5
        elif forma == 'serra':
            v = (2 * f - 1) * 0.5
        else:
            v = math.sin(2 * math.pi * f) * 0.7
        pcm.append(int(v * 32767))
    return pcm


def gerar_sf2(nome='Teste Adventiscratch', instrumentos=(('Seno', 'seno'), ('Quadrada', 'quadrada'), ('Serra', 'serra'))):
    taxa = 22050
    smpl = b''
    shdr = b''
    pos = 0
    for nome_i, forma in instrumentos:
        pcm = _onda(forma, taxa)
        dados = struct.pack(f'<{len(pcm)}h', *pcm) + b'\0\0' * 46
        smpl += dados
        ini, fim = pos, pos + len(pcm)
        shdr += _nome(nome_i) + struct.pack('<IIIIIBbHH', ini, fim, ini, fim, taxa, 60, 0, 0, 1)
        pos += len(pcm) + 46
    shdr += _nome('EOS') + b'\0' * 26

    inst = ibag = igen = phdr = pbag = pgen = b''
    for i, (nome_i, _) in enumerate(instrumentos):
        inst += _nome(nome_i) + struct.pack('<H', i)
        ibag += struct.pack('<HH', i * 4, 0)
        igen += struct.pack('<HBB', 43, 0, 127)          # keyRange 0-127
        igen += struct.pack('<Hh', 54, 1)                # sampleModes: loop
        igen += struct.pack('<Hh', 38, -3000)            # releaseVolEnv (~0,18 s)
        igen += struct.pack('<HH', 53, i)                # sampleID
        phdr += _nome(nome_i) + struct.pack('<HHHIII', i, 0, i, 0, 0, 0)
        pbag += struct.pack('<HH', i, 0)
        pgen += struct.pack('<HH', 41, i)                # instrument
    n = len(instrumentos)
    inst += _nome('EOI') + struct.pack('<H', n)
    ibag += struct.pack('<HH', n * 4, 0)
    igen += b'\0' * 4
    phdr += _nome('EOP') + struct.pack('<HHHIII', 0, 0, n, 0, 0, 0)
    pbag += struct.pack('<HH', n, 0)
    pgen += b'\0' * 4
    mod = b'\0' * 10

    info = _lista(b'INFO', _bloco(b'ifil', struct.pack('<HH', 2, 1)), _bloco(b'isng', b'EMU8000\0'),
                  _bloco(b'INAM', nome.encode('latin-1') + b'\0'))
    sdta = _lista(b'sdta', _bloco(b'smpl', smpl))
    pdta = _lista(b'pdta', _bloco(b'phdr', phdr), _bloco(b'pbag', pbag), _bloco(b'pmod', mod),
                  _bloco(b'pgen', pgen), _bloco(b'inst', inst), _bloco(b'ibag', ibag), _bloco(b'imod', mod),
                  _bloco(b'igen', igen), _bloco(b'shdr', shdr))
    corpo = b'sfbk' + info + sdta + pdta
    return b'RIFF' + struct.pack('<I', len(corpo)) + corpo


if __name__ == '__main__':
    with open(sys.argv[1] if len(sys.argv) > 1 else 'teste.sf2', 'wb') as f:
        f.write(gerar_sf2())
