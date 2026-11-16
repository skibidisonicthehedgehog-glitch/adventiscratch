#!/bin/sh
# Prepara o banco e inicia o servidor do Adventiscratch.
set -e
# espera o banco (PostgreSQL pode demorar alguns segundos para subir)
tentativa=1
until python manage.py migrate --noinput; do
    if [ "$tentativa" -ge 10 ]; then echo "Banco de dados não respondeu."; exit 1; fi
    echo "Banco ainda não está pronto, tentando de novo ($tentativa/10)..."
    tentativa=$((tentativa + 1)); sleep 3
done
python manage.py collectstatic --noinput -v 0

# cria o primeiro moderador (só se as variáveis existirem e ele ainda não existir)
if [ -n "$ADVENTISCRATCH_MODERADOR" ] && [ -n "$ADVENTISCRATCH_MODERADOR_SENHA" ]; then
    python manage.py criar_moderador "$ADVENTISCRATCH_MODERADOR" --senha "$ADVENTISCRATCH_MODERADOR_SENHA" --admin \
        || echo "Aviso: não foi possível criar o moderador inicial."
fi

exec gunicorn adventiscratch_server.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --access-logfile - \
    --forwarded-allow-ips="*"
