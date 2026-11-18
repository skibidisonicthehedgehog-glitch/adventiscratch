#!/usr/bin/env python3
"""Gera as artes da marca do Adventiblocks a partir dos desenhos da Siom.

Usa scripts/personagens/siom.svg e siom-tenso.svg (desenhos do Rene) e cria:

  static/adventiscratch/siom-cabeca.svg   cabeça da Siom com capelo de formatura
  static/adventiscratch/siom-feliz.svg    Siom de corpo inteiro, sorrindo, com capelo
  static/adventiscratch/siom-tensa.svg    Siom tensa (telas de erro)
  static/adventiscratch/logo.svg          logo das páginas (cabeça + "Adventiblocks")
  src/components/menu-bar/scratch-logo.svg  o mesmo logo no editor
  static/adventiscratch/mascote-512.png   ícone grande (512 px)
  static/favicon.ico                      ícone da aba (16, 32 e 48 px)
  src/lib/adventiscratch/icone.svg        ícone dos blocos da extensão Extras
  src/lib/adventiscratch/capa.png         capa da extensão Extras na biblioteca

Precisa de rsvg-convert e do ImageMagick (convert) para os PNG/ICO.
Rode da raiz do projeto:  python3 scripts/personagens/gerar_marca.py
"""
import os
import re
import subprocess
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..'))
ESTATICO = os.path.join(RAIZ, 'static', 'adventiscratch')


def caminhos(arquivo):
    """Lista os <path> do desenho (na ordem em que são pintados) e o translate do grupo."""
    s = open(os.path.join(AQUI, arquivo), encoding='utf-8').read()
    dx, dy = re.search(r'translate\(([-\d.]+),([-\d.]+)\)', s).groups()
    return re.findall(r'<path [^>]*/>', s), float(dx), float(dy)


SIOM, SX, SY = caminhos('siom.svg')
TENSA, _, _ = caminhos('siom-tenso.svg')

# Índices dos pedaços do desenho calm (ver a ordem em siom.svg).
CORPO = SIOM[0:6]        # cauda, pernas, roupa, pé, listra
CABECA = SIOM[6]         # cabeça com orelhas
OLHOS = SIOM[7:11]
NARIZ = SIOM[11:13]
BOCA = SIOM[13]

# Sorriso no lugar da boca ondulada.
SORRISO = ('<path d="M214.5,125c3,4.2 6.6,6.1 10,6.1c3.6,0 7.4,-2 10.8,-6.3" '
           'fill="none" stroke="#000000" stroke-width="2.4" stroke-linecap="round"/>')

# Capelo de formatura (desenhado nas mesmas coordenadas da cabeça).
CAPELO = '''<g>
  <path d="M211,64.5c0,-3 7.5,-5.2 17,-5.2c9.5,0 17,2.2 17,5.2v8.2c-4.6,2.6 -10.5,3.6 -17,3.6c-6.5,0 -12.4,-1 -17,-3.6z" fill="#1E1B3A"/>
  <path d="M228,46l38,13.5l-38,13.5l-38,-13.5z" fill="#2A2650"/>
  <path d="M228,48.6l31,10.9l-31,10.9l-31,-10.9z" fill="#1E1B3A"/>
  <path d="M228,59.5l26,5.5v17" fill="none" stroke="#FACC15" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M251.4,81l2.6,-1.4l2.6,1.4l-0.6,8.6h-4z" fill="#FACC15"/>
  <circle cx="228" cy="59.5" r="2.6" fill="#FACC15"/>
</g>'''


def icone_extensao():
    """Só a cabeça, centralizada num quadrado 100x100 (ícone de bloco)."""
    return (f'<g transform="translate(50 52) scale(0.88) translate(-228 -90)">\n'
            f'{cabeca()}\n</g>')


def svg(largura, altura, vx, vy, conteudo, extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{largura:g}" height="{altura:g}" '
            f'viewBox="{vx:g} {vy:g} {largura:g} {altura:g}"{extra}>\n{conteudo}\n</svg>\n')


def cabeca(feliz=True, capelo=True):
    partes = [CABECA] + OLHOS + NARIZ + [SORRISO if feliz else BOCA]
    if capelo:
        partes.append(CAPELO)
    return '\n'.join(partes)


def escrever(caminho, texto):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)
    print('escrito', os.path.relpath(caminho, RAIZ))


def logo():
    # Cabeça (x 186..270, y 38..140) dentro de um círculo branco de raio 21 em (22,22).
    escala = 0.335
    cx, cy = 228, 90
    g = (f'<g transform="translate(22 23.5) scale({escala}) translate({-cx} {-cy})">\n'
         f'{cabeca()}\n</g>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 236 44">\n'
            '  <circle cx="22" cy="22" r="21" fill="#fff"/>\n'
            f'  {g}\n'
            '  <text x="50" y="30.5" font-family="\'Helvetica Neue\', Helvetica, Arial, sans-serif" '
            'font-weight="700" font-size="23" fill="#fff" letter-spacing="-0.3">'
            'Adventi<tspan fill="#FFE27A">blocks</tspan></text>\n</svg>\n')


def icone(tamanho_base=100):
    """Ícone quadrado: círculo roxo com a cabeça da Siom."""
    escala = 0.78
    g = (f'<g transform="translate(50 51) scale({escala}) translate(-228 -90)">\n'
         f'{cabeca()}\n</g>')
    return svg(100, 100, 0, 0,
               '<circle cx="50" cy="50" r="49" fill="#7C5CDB"/>\n'
               '<circle cx="50" cy="50" r="44" fill="#FFE27A"/>\n' + g)


def capa():
    """Capa 600x372 da extensão Extras: degradê, símbolos de matemática e a Siom de capelo."""
    simbolo = ('<text x="{x}" y="{y}" font-family="Helvetica, Arial, sans-serif" font-weight="700" '
               'font-size="{t}" fill="#fff" fill-opacity=".22">{c}</text>')
    simbolos = ''.join(simbolo.format(x=x, y=y, t=t, c=c) for x, y, t, c in (
        (40, 90, 54, 'x²'), (465, 105, 54, '≠'), (70, 320, 54, '≥'), (455, 325, 54, 'Aa'),
        (525, 215, 34, '√'), (370, 300, 34, '≤')))
    siom = (f'<g transform="translate(300 182) scale(1.02) translate(-284.7 -177.5)">\n'
            + '\n'.join(CORPO + [cabeca()]) + '\n</g>')
    return svg(600, 372, 0, 0,
               '<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1">'
               '<stop offset="0" stop-color="#7C4FCC"/><stop offset="1" stop-color="#4F9BFF"/>'
               '</linearGradient></defs>\n<rect width="600" height="372" fill="url(#f)"/>\n'
               '<ellipse cx="270" cy="330" rx="110" ry="11" fill="#000" fill-opacity=".15"/>\n'
               + simbolos + '\n' + siom)


def main():
    escrever(os.path.join(ESTATICO, 'siom-cabeca.svg'), svg(88, 106, 184, 36, cabeca()))
    escrever(os.path.join(ESTATICO, 'siom-feliz.svg'),
             svg(202, 286, 184, 34.5, '\n'.join(CORPO + [cabeca()])))
    tensa = open(os.path.join(AQUI, 'siom-tenso.svg'), encoding='utf-8').read()
    escrever(os.path.join(ESTATICO, 'siom-tensa.svg'), tensa)
    texto_logo = logo()
    escrever(os.path.join(ESTATICO, 'logo.svg'), texto_logo)
    escrever(os.path.join(RAIZ, 'src', 'components', 'menu-bar', 'scratch-logo.svg'), texto_logo)

    escrever(os.path.join(RAIZ, 'src', 'lib', 'adventiscratch', 'icone.svg'),
             svg(100, 100, 0, 0, icone_extensao()))

    with tempfile.TemporaryDirectory() as tmp:
        fonte_capa = os.path.join(tmp, 'capa.svg')
        open(fonte_capa, 'w', encoding='utf-8').write(capa())
        destino = os.path.join(RAIZ, 'src', 'lib', 'adventiscratch', 'capa.png')
        subprocess.run(['rsvg-convert', '-w', '600', '-h', '372', fonte_capa, '-o', destino], check=True)
        print('escrito', os.path.relpath(destino, RAIZ))
        fonte = os.path.join(tmp, 'icone.svg')
        open(fonte, 'w', encoding='utf-8').write(icone())
        grande = os.path.join(ESTATICO, 'mascote-512.png')
        subprocess.run(['rsvg-convert', '-w', '512', '-h', '512', fonte, '-o', grande], check=True)
        print('escrito', os.path.relpath(grande, RAIZ))
        pngs = []
        for t in (16, 32, 48):
            p = os.path.join(tmp, f'{t}.png')
            subprocess.run(['rsvg-convert', '-w', str(t), '-h', str(t), fonte, '-o', p], check=True)
            pngs.append(p)
        ico = os.path.join(RAIZ, 'static', 'favicon.ico')
        subprocess.run(['convert'] + pngs + [ico], check=True)
        print('escrito', os.path.relpath(ico, RAIZ))


if __name__ == '__main__':
    main()
