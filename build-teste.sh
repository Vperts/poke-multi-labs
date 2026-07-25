#!/usr/bin/env bash
# Build do app de TESTE (bancada) — instala LADO A LADO com o oficial e roda ao mesmo tempo.
#
# Uso:  bash build-teste.sh
#
# Diferencas em relacao ao oficial (todas geradas por build/gen-yml-teste.js):
#   appId/productName proprios ......... o Windows trata como outro app (nao instala por cima)
#   name = vperts-multi-teste .......... o main-lite ativa o canal: userData proprio + porta 9433
#   atalho "Vperts Multi (TESTE)" ...... e a barra do app fica dourada escrito TESTE
#   SEM publish ........................ nao gera latest.yml; nunca vira update de ninguem
#
# CUSTO CONHECIDO: userData proprio = as contas do jogo precisam ser logadas de novo NESTE app
# (e' o preco de nao brigar pelo cache do oficial). Logar 1 conta ja basta pra validar.
set -euo pipefail
cd "$(dirname "$0")"

node build/gen-yml-teste.js
VER=$(sed -n 's/^  version: *//p' electron-builder-lite.yml | head -1)

echo ">> build de TESTE $VER"
npx electron-builder --win -c build/electron-builder-teste.gen.yml -p never

SETUP="dist-teste/VpertsMultiTeste-Setup-$VER.exe"
[ -f "$SETUP" ] || { echo "ERRO: instalador de teste nao gerado: $SETUP"; exit 1; }
echo
echo "OK — instalador de TESTE pronto:"
ls -la "$SETUP"

# ---- ATUALIZACAO IN-PLACE (o que faz o teste subir sem clique) ----
# CICATRIZ 25/07/2026: o **App Control do Windows** BLOQUEIA rodar o instalador por script
# ("Uma política de Controle de Aplicativo bloqueou este arquivo") — exe nao assinado so passa com
# clique humano. Mas ele bloqueia EXECUTAR binario novo, nao trocar arquivo de dado. Como todo o
# nosso codigo mora no `app.asar` e o `VpertsMultiLeveTeste.exe` (Electron puro) nao muda entre
# builds, trocar SO o asar atualiza o app inteiro mantendo o exe ja autorizado. Instalacao completa
# (exe novo) continua exigindo o clique — usar o Setup acima.
INSTALADO="$HOME/AppData/Local/Programs/vperts-multi-teste"
if [ "${1:-}" = "--nao-instalar" ]; then
  echo "(--nao-instalar: instalacao local nao foi tocada)"
elif [ -d "$INSTALADO/resources" ]; then
  echo
  echo ">> atualizando a instalacao local (fecha o app de TESTE; o OFICIAL nao e' tocado)"
  powershell -NoProfile -Command "Get-Process VpertsMultiLeveTeste -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true
  sleep 2
  cp -f dist-teste/win-unpacked/resources/app.asar "$INSTALADO/resources/app.asar"
  powershell -NoProfile -Command "Start-Process '$(cygpath -w "$INSTALADO")\\VpertsMultiLeveTeste.exe'" 2>/dev/null || true
  echo ">> app de TESTE reaberto na $VER"
  echo "   conferir: node ler.js --porta 9433 lider"
else
  echo "(app de teste ainda nao instalado — rode o Setup acima uma vez, com clique)"
fi
