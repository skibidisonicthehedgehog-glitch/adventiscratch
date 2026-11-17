@echo off
chcp 65001 >nul
title Adventiscratch
cd /d "%~dp0"
echo.
echo  ==============================================
echo     Adventiscratch - iniciando no seu computador
echo  ==============================================
echo.

where python >nul 2>nul || (
    echo [ERRO] Python nao encontrado. Instale em https://www.python.org/downloads/
    echo        e marque "Add python.exe to PATH" na instalacao.
    pause & exit /b 1
)
where npm >nul 2>nul || (
    echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/
    pause & exit /b 1
)

if not exist node_modules (
    echo Instalando as dependencias do editor (so na primeira vez, demora alguns minutos^)...
    call npm install || goto erro
)
if not exist src\generated\microbit-hex-url.cjs (
    call node scripts\prepublish.mjs || goto erro
)

python -c "import django, daphne" 2>nul || (
    echo Instalando as dependencias do servidor...
    python -m pip install -r server\requirements.txt || goto erro
)

echo Preparando o banco de dados...
pushd server
python manage.py migrate --noinput || (popd & goto erro)
popd

echo Abrindo o servidor e o editor em duas janelas (deixe as duas abertas^)...
start "Adventiscratch - servidor (porta 8000)" /d "%~dp0server" cmd /k python manage.py runserver 8000
start "Adventiscratch - editor (porta 8601)" /d "%~dp0" cmd /k npm start

echo Esperando o editor compilar...
timeout /t 30 /nobreak >nul
start "" http://localhost:8601/
echo.
echo Pronto! Editor: http://localhost:8601   Moderacao: http://localhost:8000/moderacao/
echo Para parar, feche as janelas "servidor" e "editor".
echo.
pause
exit /b 0

:erro
echo.
echo [ERRO] Alguma etapa falhou. Leia a mensagem acima.
pause
exit /b 1
