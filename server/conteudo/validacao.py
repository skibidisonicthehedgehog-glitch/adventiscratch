"""Validação dos arquivos enviados (projetos .asp, pacotes de modelos, SoundFonts .sf2 e miniaturas)."""
import json
import struct
import zipfile

from django.conf import settings

MB = 1024 * 1024
EXT_MODELO = {'glb', 'gltf', 'fbx', 'obj', 'stl', 'dae', 'ply'}
EXT_RECURSO = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tga', 'mtl', 'bin'}
# protege contra "zip bomba" (arquivo pequeno que vira gigabytes ao descompactar)
LIMITE_DESCOMPACTADO = 300 * MB


class ArquivoInvalido(Exception):
    pass


def _abrir_zip(arquivo, limite_mb, rotulo):
    if arquivo.size > limite_mb * MB:
        raise ArquivoInvalido(f'{rotulo} grande demais (máximo {limite_mb} MB).')
    try:
        z = zipfile.ZipFile(arquivo)
    except zipfile.BadZipFile:
        raise ArquivoInvalido(f'{rotulo} inválido ou corrompido.')
    total = sum(i.file_size for i in z.infolist())
    if total > LIMITE_DESCOMPACTADO:
        raise ArquivoInvalido(f'{rotulo} grande demais depois de descompactado.')
    for info in z.infolist():
        nome = info.filename
        if nome.startswith('/') or '..' in nome.split('/'):
            raise ArquivoInvalido(f'{rotulo} contém um caminho inválido.')
    return z


def validar_projeto(arquivo):
    z = _abrir_zip(arquivo, settings.ADVENTISCRATCH_MAX_PROJETO_MB, 'Projeto')
    if 'project.json' not in z.namelist():
        raise ArquivoInvalido('Isso não parece um projeto do Adventiscratch (.asp ou .sb3).')
    try:
        json.loads(z.read('project.json'))
    except (ValueError, UnicodeDecodeError):
        raise ArquivoInvalido('O projeto está corrompido (project.json inválido).')
    arquivo.seek(0)


def validar_pacote_modelo(arquivo):
    """
    Pacote de modelo = zip com:
      manifest.json  {"modelo": "nome.fbx", "recursos": ["pele.png", ...], "materialMaps": {...}}
      o arquivo do modelo e os arquivos de textura/material listados.
    Devolve o manifesto.
    """
    z = _abrir_zip(arquivo, settings.ADVENTISCRATCH_MAX_MODELO_MB, 'Modelo')
    nomes = set(z.namelist())
    if 'manifest.json' not in nomes:
        raise ArquivoInvalido('Pacote de modelo sem manifest.json.')
    try:
        manifesto = json.loads(z.read('manifest.json'))
    except (ValueError, UnicodeDecodeError):
        raise ArquivoInvalido('manifest.json inválido.')
    modelo = str(manifesto.get('modelo', ''))
    ext = modelo.rsplit('.', 1)[-1].lower() if '.' in modelo else ''
    if ext not in EXT_MODELO or modelo not in nomes:
        raise ArquivoInvalido('O pacote não tem um arquivo de modelo válido (.glb, .fbx, .obj…).')
    for nome in nomes - {'manifest.json', modelo}:
        if nome.endswith('/'):
            continue
        ext_r = nome.rsplit('.', 1)[-1].lower() if '.' in nome else ''
        if ext_r not in EXT_RECURSO:
            raise ArquivoInvalido(f'Tipo de arquivo não permitido no pacote: {nome}')
    arquivo.seek(0)
    manifesto['ext'] = ext
    return manifesto


def validar_miniatura(arquivo):
    if arquivo is None:
        return
    if arquivo.size > 400 * 1024:
        raise ArquivoInvalido('Miniatura grande demais.')
    if arquivo.read(8) != b'\x89PNG\r\n\x1a\n':
        raise ArquivoInvalido('A miniatura precisa ser PNG.')
    arquivo.seek(0)


def _blocos_riff(dados, pos, fim):
    blocos = {}
    while pos + 8 <= fim:
        ident = dados[pos:pos + 4]
        tam = struct.unpack_from('<I', dados, pos + 4)[0]
        if ident == b'LIST':
            blocos['LIST:' + dados[pos + 8:pos + 12].decode('latin-1')] = (pos + 12, tam - 4)
        else:
            blocos[ident.decode('latin-1')] = (pos + 8, tam)
        pos += 8 + tam + (tam % 2)
    return blocos


def _nome(b):
    return b.split(b'\0', 1)[0].decode('latin-1', 'replace').strip()


def validar_sf2(arquivo):
    """
    Confere se é um SoundFont 2 de verdade e lê os nomes dos instrumentos (presets).
    Devolve {"nome": ..., "presets": [(banco, programa, nome), ...]}.
    """
    limite = settings.ADVENTISCRATCH_MAX_SF2_MB
    if arquivo.size > limite * MB:
        raise ArquivoInvalido(f'Arquivo .sf2 grande demais (máximo {limite} MB).')
    dados = arquivo.read()
    arquivo.seek(0)
    if len(dados) < 12 or dados[:4] != b'RIFF' or dados[8:12] != b'sfbk':
        raise ArquivoInvalido('Isso não é um arquivo .sf2 (SoundFont 2).')
    try:
        topo = _blocos_riff(dados, 12, min(len(dados), 8 + struct.unpack_from('<I', dados, 4)[0]))
        if 'LIST:pdta' not in topo or 'LIST:sdta' not in topo:
            raise ArquivoInvalido('Arquivo .sf2 incompleto ou danificado.')
        info = _blocos_riff(dados, topo['LIST:INFO'][0], sum(topo['LIST:INFO'])) if 'LIST:INFO' in topo else {}
        sdta = _blocos_riff(dados, topo['LIST:sdta'][0], sum(topo['LIST:sdta']))
        pdta = _blocos_riff(dados, topo['LIST:pdta'][0], sum(topo['LIST:pdta']))
        if 'smpl' not in sdta or 'phdr' not in pdta:
            raise ArquivoInvalido('Arquivo .sf2 sem sons ou sem instrumentos.')
        pos, tam = pdta['phdr']
        presets = []
        for i in range(tam // 38 - 1):
            p = pos + i * 38
            programa, banco = struct.unpack_from('<HH', dados, p + 20)
            presets.append((banco, programa, _nome(dados[p:p + 20]) or f'Preset {i + 1}'))
    except (struct.error, UnicodeDecodeError):
        raise ArquivoInvalido('Arquivo .sf2 incompleto ou danificado.')
    if not presets:
        raise ArquivoInvalido('Este .sf2 não tem nenhum instrumento.')
    nome = _nome(dados[info['INAM'][0]:sum(info['INAM'])]) if 'INAM' in info else ''
    return {'nome': nome, 'presets': sorted(presets)}
