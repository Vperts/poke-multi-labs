// Gera a config do build de TESTE a partir da config OFICIAL, mudando so o que precisa.
//
// POR QUE DERIVAR em vez de manter dois .yml: a lista de `files` do lite e' longa e ja quebrou o
// app quando ficou incompleta (v0.8.0 nao empacotou as deps do electron-updater e o app travava
// no boot). Dois arquivos manuais divergem com o tempo — este script garante que o teste sempre
// empacota EXATAMENTE o que o oficial empacota.
//
// Uso: node build/gen-yml-teste.js  ->  escreve build/electron-builder-teste.gen.yml
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const raiz = path.join(__dirname, '..')
const cfg = yaml.load(fs.readFileSync(path.join(raiz, 'electron-builder-lite.yml'), 'utf8'))

// identidade PROPRIA: e' isso que faz o Windows tratar como outro app e instalar LADO A LADO
cfg.appId = 'com.vperts.multileve.teste'
cfg.productName = 'VpertsMultiLeveTeste'
cfg.extraMetadata = cfg.extraMetadata || {}
// `name` e' o que o main-lite le (app.getName()) pra ativar o canal de teste: userData e porta
// de debug proprias. Sem isso os dois apps brigam pelo mesmo perfil e pela porta 9333.
cfg.extraMetadata.name = 'vperts-multi-teste'

cfg.nsis = Object.assign({}, cfg.nsis, {
  shortcutName: 'Vperts Multi (TESTE)',
  artifactName: 'VpertsMultiTeste-Setup-${version}.exe',
})

// SEM publish: o canal de teste nunca pode virar update de ninguem. Tambem evita gerar um
// latest.yml de teste que, subido por engano numa release, se passaria pela versao oficial.
// (Sem `publish`, o electron-builder INFERE o repo do remote git — ja saiu app-update.yml
// apontando pro ekooll por causa disso. Por isso o updater tambem e' desligado em runtime
// quando o canal e' teste, la no main-lite.js.)
delete cfg.publish

// PASTA DE SAIDA PROPRIA: com os dois builds no mesmo dist/, o win-unpacked do ultimo build
// sobrescrevia o do outro e a conferencia da release lia o artefato ERRADO. Separado, dist/ e'
// so oficial e dist-teste/ e' so teste — impossivel publicar um achando que e' o outro.
cfg.directories = Object.assign({}, cfg.directories, { output: 'dist-teste' })

const saida = path.join(__dirname, 'electron-builder-teste.gen.yml')
fs.writeFileSync(saida, yaml.dump(cfg, { lineWidth: 200 }))
console.log('config de teste gerada:', saida)
console.log('  appId      :', cfg.appId)
console.log('  productName:', cfg.productName)
console.log('  name       :', cfg.extraMetadata.name, '(ativa o canal de teste no main-lite)')
console.log('  publish    : (removido)')
