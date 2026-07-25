#!/usr/bin/env bash
# Build da versao LEVE (main-lite.js) + geracao do asset de nome FIXO pro link do site.
#
# Uso:  bash build-lite.sh
#
# Sai em dist/:
#   VpertsMultiLeve-Setup-<v>.exe(+.blockmap) e latest.yml  -> assets do AUTO-UPDATE
#   VpertsMultiLeve-Setup.exe                               -> copia de nome fixo, so pro SITE
#
# POR QUE A COPIA: o link do site aponta pra /releases/latest/download/<nome>. Se o nome carrega a
# versao, ele quebra a cada release nova (foi exatamente o que aconteceu com o PokeMultiLabs-Test.zip,
# que virou 404 quando a distribuicao mudou). Com um nome fixo, o site e' configurado UMA vez.
# O updater continua usando o nome versionado que consta no latest.yml — nao mexer nisso.
set -euo pipefail
cd "$(dirname "$0")"

VER=$(sed -n 's/^  version: *//p' electron-builder-lite.yml | head -1)
[ -n "$VER" ] || { echo "ERRO: nao achei a versao em electron-builder-lite.yml (extraMetadata.version)"; exit 1; }

echo ">> build da versao leve $VER"
npx electron-builder --win -c electron-builder-lite.yml -p never

SETUP="dist/VpertsMultiLeve-Setup-$VER.exe"
[ -f "$SETUP" ] || { echo "ERRO: instalador nao gerado: $SETUP"; exit 1; }

echo ">> copia de nome fixo pro link do site"
cp -f "$SETUP" "dist/VpertsMultiLeve-Setup.exe"

echo
echo "OK — versao $VER pronta em dist/:"
ls -la "$SETUP" "$SETUP.blockmap" dist/latest.yml dist/VpertsMultiLeve-Setup.exe 2>/dev/null || true
echo
echo "PUBLICAR (rodar na mao; upload de ~86MB pode passar do timeout de 2min e ir pro background):"
echo "  gh release create v$VER \\"
echo "    \"$SETUP\" \"$SETUP.blockmap\" dist/latest.yml dist/VpertsMultiLeve-Setup.exe \\"
echo "    --repo Vperts/poke-multi-labs --title \"Vperts Multi v$VER\" --notes \"...\""
echo
echo "ATENCAO: o latest.yml e' OBRIGATORIO na release — sem ele o auto-update dos clientes nao acha versao nova."
