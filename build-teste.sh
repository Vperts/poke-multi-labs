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
