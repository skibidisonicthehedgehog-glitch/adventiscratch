#!/usr/bin/env python3
"""
Personagens originais do Adventiblocks (a turma da Coruja Sabida), no lugar dos personagens do Scratch.

    python scripts/personagens/gerar_personagens.py

Gera os .svg em static/adventiscratch/atores/ (o nome é o md5 do arquivo, como no Scratch) e coloca os
atores no começo da biblioteca de atores (sprites.json) e as fantasias na biblioteca de fantasias
(costumes.json). Para pôr outro personagem (ex.: a mascote Siom), acrescente na lista PERSONAGENS:
um .svg pode vir de um arquivo com ('arquivo', 'caminho/do/arquivo.svg').
"""
import hashlib
import json
import os
import re

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ATORES = os.path.join(RAIZ, 'static', 'adventiscratch', 'atores')
LIB = os.path.join(RAIZ, 'src', 'lib', 'libraries')
CONTORNO = '#3B2A50'


def svg(l, a, corpo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{l}" height="{a}" viewBox="0 0 {l} {a}">'
            f'<g stroke="{CONTORNO}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">{corpo}</g></svg>')


def olhos(x1, x2, y, r=6, piscando=False, cor='#fff'):
    if piscando:
        return (f'<path d="M{x1 - r} {y} Q{x1} {y + r * 0.8} {x1 + r} {y}" fill="none"/>'
                f'<path d="M{x2 - r} {y} Q{x2} {y + r * 0.8} {x2 + r} {y}" fill="none"/>')
    p = r * 0.5
    return (f'<circle cx="{x1}" cy="{y}" r="{r}" fill="{cor}"/><circle cx="{x2}" cy="{y}" r="{r}" fill="{cor}"/>'
            f'<circle cx="{x1 + 1}" cy="{y + 1}" r="{p}" fill="{CONTORNO}" stroke="none"/>'
            f'<circle cx="{x2 + 1}" cy="{y + 1}" r="{p}" fill="{CONTORNO}" stroke="none"/>'
            f'<circle cx="{x1 + 2}" cy="{y - 1}" r="{p * 0.35}" fill="#fff" stroke="none"/>'
            f'<circle cx="{x2 + 2}" cy="{y - 1}" r="{p * 0.35}" fill="#fff" stroke="none"/>')


# ---------------------------------------------------------------- Bia Capivara
def capivara(pose):
    pe = ('<rect x="22" y="70" width="12" height="14" rx="5" fill="#8A5A35"/><rect x="62" y="70" width="12" height="14" rx="5" fill="#8A5A35"/>'
          if pose == 'a' else
          '<rect x="18" y="68" width="12" height="14" rx="5" fill="#8A5A35" transform="rotate(-12 24 75)"/>'
          '<rect x="64" y="68" width="12" height="14" rx="5" fill="#8A5A35" transform="rotate(12 70 75)"/>')
    return svg(100, 88, pe +
               '<ellipse cx="50" cy="52" rx="40" ry="26" fill="#B07A4A"/>'
               '<ellipse cx="50" cy="60" rx="24" ry="13" fill="#D2A272" stroke="none"/>'
               '<rect x="58" y="16" width="34" height="34" rx="14" fill="#B07A4A"/>'
               '<ellipse cx="86" cy="38" rx="8" ry="7" fill="#8A5A35"/>'
               '<circle cx="64" cy="14" r="6" fill="#8A5A35"/>' +
               olhos(70, 82, 28, 4.5, piscando=(pose == 'b')) +
               '<path d="M83 44 Q87 47 91 44" fill="none"/>'
               '<path d="M18 40 Q20 30 30 34" fill="none" stroke="#8A5A35"/>')


# ---------------------------------------------------------------- Theo Tartaruga
def tartaruga(pose):
    cab = ('<circle cx="80" cy="40" r="15" fill="#7ACB6A"/>' if pose == 'a' else
           '<circle cx="84" cy="34" r="15" fill="#7ACB6A"/>')
    olho = olhos(76, 86, 36, 4.5) if pose == 'a' else olhos(80, 90, 30, 4.5)
    boca = ('<path d="M78 46 Q83 50 88 46" fill="none"/>' if pose == 'a' else
            '<path d="M82 40 Q87 46 92 40" fill="#E85D75"/>')
    return svg(104, 80,
               '<rect x="24" y="56" width="14" height="16" rx="6" fill="#7ACB6A"/>'
               '<rect x="58" y="56" width="14" height="16" rx="6" fill="#7ACB6A"/>' + cab +
               '<path d="M14 58 Q14 18 48 18 Q82 18 82 58 Z" fill="#3F9D57"/>'
               '<path d="M30 30 L48 24 L66 30 L66 48 L48 54 L30 48 Z" fill="#5DBB6E"/>'
               '<path d="M12 58 H84" fill="none"/>' + olho + boca)


# ---------------------------------------------------------------- Lumi Vagalume
def vagalume(pose):
    luz = ('<circle cx="34" cy="62" r="22" fill="#FFF59D" stroke="none" opacity=".55"/>'
           '<circle cx="34" cy="62" r="13" fill="#FFEB3B"/>' if pose == 'a' else
           '<circle cx="34" cy="62" r="13" fill="#E0D47A"/>')
    asas = ('<ellipse cx="42" cy="22" rx="16" ry="10" fill="#E3F2FD" opacity=".9" transform="rotate(-25 42 22)"/>'
            '<ellipse cx="58" cy="20" rx="16" ry="10" fill="#E3F2FD" opacity=".9" transform="rotate(20 58 20)"/>'
            if pose == 'a' else
            '<ellipse cx="40" cy="28" rx="16" ry="9" fill="#E3F2FD" opacity=".9" transform="rotate(10 40 28)"/>'
            '<ellipse cx="60" cy="28" rx="16" ry="9" fill="#E3F2FD" opacity=".9" transform="rotate(-10 60 28)"/>')
    return svg(90, 90, luz + asas +
               '<ellipse cx="50" cy="48" rx="20" ry="16" fill="#5C6BC0"/>'
               '<circle cx="66" cy="38" r="14" fill="#7986CB"/>'
               '<path d="M70 25 Q74 12 82 12 M62 25 Q60 12 66 8" fill="none"/>' +
               olhos(62, 72, 37, 4) + '<path d="M63 45 Q67 48 71 45" fill="none"/>')


# ---------------------------------------------------------------- Pipo Pinguim
def pinguim(pose):
    asa_e = ('<path d="M18 46 Q8 62 16 74 Q22 62 24 50 Z" fill="#37474F"/>' if pose == 'a' else
             '<path d="M20 44 Q4 34 6 22 Q18 30 26 42 Z" fill="#37474F"/>')
    asa_d = ('<path d="M66 46 Q76 62 68 74 Q62 62 60 50 Z" fill="#37474F"/>' if pose == 'a' else
             '<path d="M64 44 Q80 34 78 22 Q66 30 58 42 Z" fill="#37474F"/>')
    return svg(84, 104, asa_e + asa_d +
               '<ellipse cx="30" cy="96" rx="10" ry="5" fill="#FF9800"/><ellipse cx="54" cy="96" rx="10" ry="5" fill="#FF9800"/>'
               '<ellipse cx="42" cy="56" rx="26" ry="38" fill="#455A64"/>'
               '<ellipse cx="42" cy="64" rx="17" ry="27" fill="#FFFFFF"/>' +
               olhos(34, 50, 34, 5.5) +
               '<path d="M37 42 L47 42 L42 49 Z" fill="#FF9800"/>'
               '<path d="M24 22 Q42 4 60 22" fill="#E53935"/><circle cx="42" cy="9" r="5" fill="#fff"/>')


# ---------------------------------------------------------------- Tito Tucano
def tucano(pose):
    bico = ('<path d="M54 26 Q86 22 94 34 Q80 44 54 40 Z" fill="#FF9800"/><path d="M54 33 Q80 34 92 36" fill="none"/>'
            if pose == 'a' else
            '<path d="M54 24 Q86 14 94 24 Q80 32 56 32 Z" fill="#FF9800"/>'
            '<path d="M56 36 Q80 40 90 48 Q74 50 54 42 Z" fill="#FFB74D"/>')
    return svg(100, 100,
               '<path d="M40 86 L36 98 M50 86 L54 98" fill="none" stroke="#5D4037"/>'
               '<ellipse cx="42" cy="58" rx="24" ry="32" fill="#263238"/>'
               '<ellipse cx="48" cy="46" rx="12" ry="14" fill="#FFF8E1"/>'
               '<path d="M22 56 Q10 76 26 86 Q30 70 34 60 Z" fill="#37474F"/>'
               '<circle cx="46" cy="30" r="20" fill="#263238"/>' + bico +
               '<circle cx="47" cy="27" r="7" fill="#81D4FA"/><circle cx="48" cy="28" r="3" fill="#263238" stroke="none"/>')


# ---------------------------------------------------------------- Nina Robô
def robo(pose):
    braco_e = ('<path d="M18 54 Q6 62 10 76" fill="none" stroke-width="5" stroke="#78909C"/>' if pose == 'a' else
               '<path d="M18 54 Q4 44 8 28" fill="none" stroke-width="5" stroke="#78909C"/>')
    tela = ('<rect x="30" y="58" width="28" height="16" rx="4" fill="#80DEEA"/>'
            '<path d="M35 66 H40 L43 61 L47 71 L50 66 H54" fill="none" stroke="#00838F" stroke-width="2"/>')
    return svg(90, 104, braco_e +
               '<path d="M72 54 Q84 62 80 76" fill="none" stroke-width="5" stroke="#78909C"/>'
               '<rect x="30" y="86" width="10" height="14" rx="3" fill="#78909C"/><rect x="50" y="86" width="10" height="14" rx="3" fill="#78909C"/>'
               '<rect x="18" y="46" width="54" height="42" rx="12" fill="#B0BEC5"/>' + tela +
               '<rect x="16" y="8" width="58" height="38" rx="14" fill="#CFD8DC"/>'
               '<rect x="24" y="16" width="42" height="22" rx="10" fill="#263238"/>'
               '<circle cx="36" cy="27" r="5" fill="#4DD0E1" stroke="none"/><circle cx="54" cy="27" r="5" fill="#4DD0E1" stroke="none"/>'
               '<path d="M45 8 V0" fill="none"/><circle cx="45" cy="0" r="3" fill="#E53935"/>'
               + ('<path d="M39 33 Q45 36 51 33" fill="none" stroke="#4DD0E1" stroke-width="2"/>' if pose == 'b' else ''))


# nome, tags, [(nome da fantasia, svg, centro x, centro y)]
PERSONAGENS = [
    ('Bia Capivara', ['animals'], [('bia-a', capivara('a'), 50, 50), ('bia-b', capivara('b'), 50, 50)]),
    ('Theo Tartaruga', ['animals'], [('theo-a', tartaruga('a'), 52, 46), ('theo-b', tartaruga('b'), 52, 46)]),
    ('Lumi Vagalume', ['animals', 'fantasy'], [('lumi-a', vagalume('a'), 50, 48), ('lumi-b', vagalume('b'), 50, 48)]),
    ('Pipo Pinguim', ['animals'], [('pipo-a', pinguim('a'), 42, 56), ('pipo-b', pinguim('b'), 42, 56)]),
    ('Tito Tucano', ['animals'], [('tito-a', tucano('a'), 46, 52), ('tito-b', tucano('b'), 46, 52)]),
    ('Nina Robô', ['people', 'fantasy'], [('nina-a', robo('a'), 45, 54), ('nina-b', robo('b'), 45, 54)]),
]

# Siom, a mascote: quando o .svg chegar, ponha o arquivo em scripts/personagens/siom.svg (e siom-*.svg para
# mais fantasias) e rode este script de novo.
SIOM = os.path.join(os.path.dirname(__file__), 'siom.svg')


def tamanho_svg(dados):
    m = re.search(rb'viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)', dados)
    if m:
        return float(m.group(3)), float(m.group(4))
    w = re.search(rb'width="([\d.]+)', dados)
    h = re.search(rb'height="([\d.]+)', dados)
    return (float(w.group(1)) if w else 100), (float(h.group(1)) if h else 100)


def main():
    personagens = list(PERSONAGENS)
    if os.path.exists(SIOM):
        fantasias = []
        base = os.path.dirname(SIOM)
        arquivos = ['siom.svg'] + sorted(f for f in os.listdir(base) if re.match(r'siom-.+\.svg$', f))
        for i, f in enumerate(arquivos):
            dados = open(os.path.join(base, f), 'rb').read()
            w, h = tamanho_svg(dados)
            fantasias.append((f'siom-{chr(97 + i)}', dados, round(w / 2), round(h / 2)))
        personagens.insert(0, ('Siom', ['fantasy', 'people'], fantasias))

    os.makedirs(ATORES, exist_ok=True)
    caminho_lista = os.path.join(LIB, 'adventiblocks-assets.json')
    lista = json.load(open(caminho_lista))
    sprites = json.load(open(os.path.join(LIB, 'sprites.json')))
    costumes = json.load(open(os.path.join(LIB, 'costumes.json')))
    nomes = {p[0] for p in personagens}
    nomes_fantasias = {f[0] for p in personagens for f in p[2]}
    sprites = [s for s in sprites if s['name'] not in nomes]
    costumes = [c for c in costumes if c['name'] not in nomes_fantasias]
    novos_sprites = []
    novas_fantasias = []
    for nome, tags, fantasias in personagens:
        fs = []
        for fnome, dados, cx, cy in fantasias:
            if isinstance(dados, str):
                dados = dados.encode('utf-8')
            h = hashlib.md5(dados).hexdigest()
            arquivo = f'{h}.svg'
            with open(os.path.join(ATORES, arquivo), 'wb') as f:
                f.write(dados)
            if arquivo not in lista:
                lista.append(arquivo)
            c = {'assetId': h, 'name': fnome, 'bitmapResolution': 1, 'md5ext': arquivo, 'dataFormat': 'svg',
                 'rotationCenterX': cx, 'rotationCenterY': cy}
            fs.append(c)
            novas_fantasias.append(dict(c, tags=tags))
        novos_sprites.append({
            'name': nome, 'tags': tags, 'isStage': False, 'variables': {}, 'costumes': fs, 'sounds': [],
            'blocks': {}, 'currentCostume': 0, 'x': 0, 'y': 0, 'size': 100, 'direction': 90, 'draggable': False,
            'rotationStyle': 'all around', 'visible': True})
    # a turma fica logo depois da Coruja Sabida
    pos = 1 if sprites and sprites[0]['name'] == 'Coruja Sabida' else 0
    sprites[pos:pos] = novos_sprites
    pos = 1 if costumes and costumes[0]['name'] == 'Coruja Sabida' else 0
    costumes[pos:pos] = novas_fantasias
    for nome_arq, dados in (('sprites.json', sprites), ('costumes.json', costumes),
                            ('adventiblocks-assets.json', lista)):
        with open(os.path.join(LIB, nome_arq), 'w', encoding='utf-8') as f:
            f.write(json.dumps(dados, indent=4, ensure_ascii=False) + '\n')
    print(f'{len(personagens)} personagens, {len(novas_fantasias)} fantasias')


if __name__ == '__main__':
    main()
