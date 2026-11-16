"""
Configurações do servidor do Adventiscratch.

Tudo que muda entre o computador de desenvolvimento e o servidor de verdade vem de variáveis de ambiente
(veja server/.env.example). Sem nenhuma variável, roda em modo de desenvolvimento com SQLite.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ('1', 'true', 'sim', 'yes', 'on')


def env_list(name, default=''):
    return [v.strip() for v in os.environ.get(name, default).split(',') if v.strip()]


DEBUG = env_bool('DJANGO_DEBUG', True)

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError('Defina DJANGO_SECRET_KEY no ambiente (veja server/.env.example).')
    SECRET_KEY = 'somente-para-desenvolvimento-troque-em-producao'

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]')

# Endereços (origens) de onde o editor pode chamar a API. Ex.: http://localhost:8601
ADVENTISCRATCH_ORIGENS = env_list('ADVENTISCRATCH_ORIGENS', 'http://localhost:8601,http://127.0.0.1:8601')
CSRF_TRUSTED_ORIGINS = env_list('DJANGO_CSRF_TRUSTED_ORIGINS', '')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'contas',
    'conteudo',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'contas.middleware.CorsApiMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# WhiteNoise (se instalado) serve os arquivos estáticos e o editor compilado em produção (Docker)
try:
    import whitenoise  # noqa: F401
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
except ImportError:
    pass

ROOT_URLCONF = 'adventiscratch_server.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'adventiscratch_server.wsgi.application'

# Banco de dados: SQLite por padrão; PostgreSQL se POSTGRES_DB estiver definido
DATA_DIR = Path(os.environ.get('ADVENTISCRATCH_DATA_DIR', BASE_DIR / 'dados'))
DATA_DIR.mkdir(parents=True, exist_ok=True)
if os.environ.get('POSTGRES_DB'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ['POSTGRES_DB'],
            'USER': os.environ.get('POSTGRES_USER', 'adventiscratch'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
            'HOST': os.environ.get('POSTGRES_HOST', 'db'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': DATA_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = os.environ.get('TZ', 'America/Sao_Paulo')
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static-servidor/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Editor compilado (pasta build/ do scratch-gui). Em Docker, é copiado para cá e servido na raiz do site.
EDITOR_BUILD_DIR = Path(os.environ.get('ADVENTISCRATCH_EDITOR_DIR', BASE_DIR.parent / 'build'))
if EDITOR_BUILD_DIR.exists():
    WHITENOISE_ROOT = EDITOR_BUILD_DIR
    WHITENOISE_INDEX_FILE = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Arquivos enviados pelos alunos (projetos na nuvem, modelos da loja, miniaturas). Não são públicos:
# só saem pela API, para quem está logado.
MEDIA_ROOT = DATA_DIR / 'arquivos'
MEDIA_URL = '/arquivos-internos/'
FILE_UPLOAD_PERMISSIONS = 0o640
ADVENTISCRATCH_MAX_PROJETO_MB = int(os.environ.get('ADVENTISCRATCH_MAX_PROJETO_MB', '50'))
ADVENTISCRATCH_MAX_MODELO_MB = int(os.environ.get('ADVENTISCRATCH_MAX_MODELO_MB', '40'))
ADVENTISCRATCH_MAX_PROJETOS = int(os.environ.get('ADVENTISCRATCH_MAX_PROJETOS', '100'))
ADVENTISCRATCH_ENVIOS_POR_HORA = int(os.environ.get('ADVENTISCRATCH_ENVIOS_POR_HORA', '60'))
# true = modelos novos da loja só aparecem depois que um moderador aprova
ADVENTISCRATCH_APROVAR_MODELOS = env_bool('ADVENTISCRATCH_APROVAR_MODELOS', False)
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# Atrás do Cloudflare Tunnel / proxy: confiar no cabeçalho de HTTPS
if env_bool('ADVENTISCRATCH_ATRAS_DE_PROXY', False):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# cache em arquivo: o limite de tentativas de login vale para todos os processos do gunicorn
CACHES = {'default': {
    'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
    'LOCATION': DATA_DIR / 'cache',
}}

# Proteção contra adivinhar senha: bloqueia por alguns minutos após várias tentativas erradas
ADVENTISCRATCH_LOGIN_TENTATIVAS = int(os.environ.get('ADVENTISCRATCH_LOGIN_TENTATIVAS', '8'))
ADVENTISCRATCH_LOGIN_BLOQUEIO_SEGUNDOS = int(os.environ.get('ADVENTISCRATCH_LOGIN_BLOQUEIO_SEGUNDOS', '300'))
# Validade do login no editor (dias)
ADVENTISCRATCH_TOKEN_DIAS = int(os.environ.get('ADVENTISCRATCH_TOKEN_DIAS', '30'))

LOGGING = {
    'version': 1,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO')},
}
