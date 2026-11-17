# Adventiblocks: editor + servidor de contas/moderação numa imagem só.
#
#   docker compose up -d --build
#
# Etapa 1: compila o editor (scratch-gui)
FROM node:20-bookworm-slim AS editor
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# baixa o arquivo do micro:bit (o npm ci roda isso, mas garantimos aqui) e compila
RUN node scripts/prepublish.mjs && npm run build

# Etapa 2: servidor Django (API + painel de moderação + editor compilado)
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=0 \
    ADVENTISCRATCH_DATA_DIR=/dados \
    ADVENTISCRATCH_EDITOR_DIR=/app/editor
WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./
COPY --from=editor /app/build /app/editor
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 1000 adventiscratch \
    && mkdir -p /dados && chown -R adventiscratch /dados /app
USER adventiscratch
VOLUME ["/dados"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/saude', timeout=4)" || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
