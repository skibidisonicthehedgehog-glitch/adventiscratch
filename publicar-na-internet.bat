@echo off
chcp 65001 >nul
title Adventiscratch - publicar na internet
cd /d "%~dp0"
echo.
echo  ======================================================
echo     Adventiscratch - publicar na internet (Cloudflare)
echo  ======================================================
echo.
echo  Isto cria um endereco publico https://....trycloudflare.com
echo  que funciona enquanto ESTA janela e o computador ficarem ligados.
echo  O endereco muda toda vez que voce abrir de novo.
echo.

where python >nul 2>nul || (echo [ERRO] Python nao encontrado. & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERRO] Node.js nao encontrado. & pause & exit /b 1)

where cloudflared >nul 2>nul || (
    echo O programa "cloudflared" da Cloudflare nao esta instalado. Instalando com o winget...
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements || (
        echo [ERRO] Nao consegui instalar. Baixe em:
        echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
        pause & exit /b 1
    )
    echo.
    echo Instalado! Feche esta janela e abra o publicar-na-internet.bat de novo.
    pause & exit /b 0
)

echo [1/4] Instalando dependencias...
python -m pip install -q -r server\requirements.txt || goto erro
if not exist node_modules (call npm install || goto erro)
if not exist src\generated\microbit-hex-url.cjs (call node scripts\prepublish.mjs || goto erro)

echo [2/4] Compilando o editor (1 ou 2 minutos)...
call npm run build || goto erro

echo [3/4] Preparando o servidor...
pushd server
if not exist dados mkdir dados
if not exist dados\chave-secreta.txt (
    python -c "import secrets; print(secrets.token_urlsafe(50))" > dados\chave-secreta.txt
)
set /p DJANGO_SECRET_KEY=<dados\chave-secreta.txt
set DJANGO_DEBUG=0
set DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,.trycloudflare.com
set DJANGO_CSRF_TRUSTED_ORIGINS=https://*.trycloudflare.com
set ADVENTISCRATCH_ATRAS_DE_PROXY=1
python manage.py migrate --noinput || (popd & goto erro)
python manage.py collectstatic --noinput -v 0 || (popd & goto erro)
start "Adventiscratch - servidor publico" /min cmd /k python -m daphne -b 127.0.0.1 -p 8000 --proxy-headers adventiscratch_server.asgi:application
popd
timeout /t 4 /nobreak >nul

echo [4/4] Criando o endereco publico...
echo.
echo  Procure abaixo uma linha com  https://ALGUMA-COISA.trycloudflare.com
echo  - Editor:     esse endereco + /editor.html
echo  - Moderacao:  esse endereco + /moderacao/
echo  Para tirar do ar, feche esta janela e a janela "servidor publico".
echo.
cloudflared tunnel --url http://127.0.0.1:8000
pause
exit /b 0

:erro
echo.
echo [ERRO] Alguma etapa falhou. Leia a mensagem acima.
pause
exit /b 1
