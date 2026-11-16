"""Validação dos arquivos enviados (projetos .asp, pacotes de modelos e miniaturas)."""
import json
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
