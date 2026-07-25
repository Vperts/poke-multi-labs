// PORTEIRO DA RELEASE — roda no fim do build OFICIAL e reprova o que nao pode ir pro ar.
//
// Existe porque ja subiu coisa errada mais de uma vez e o estrago foi no cliente:
//  - v0.4.2 chegou no Victor com o updater quebrado (ele deu nota 4 numa versao que nao devia sair);
//  - v0.2.0 foi publicada SEM asset e o link de download virou 404;
//  - o link do site apontou por dias pra um arquivo que nao existia mais.
// Nenhum desses erros aparece "olhando o codigo" — todos aparecem conferindo o ARTEFATO.
//
// Uso: node build/verifica-release.js [--dist dist]
// Sai 0 = liberado pra publicar. Sai 1 = NAO publique (lista o que esta errado).
const fs = require('fs')
const path = require('path')
const { execFileSync, execSync } = require('child_process')
const yaml = require('js-yaml')

const raiz = path.join(__dirname, '..')
const dist = path.join(raiz, 'dist')
const erros = []
const avisos = []
const ok = []

const cfg = yaml.load(fs.readFileSync(path.join(raiz, 'electron-builder-lite.yml'), 'utf8'))
const versao = String(cfg.extraMetadata && cfg.extraMetadata.version || '')

// ---- 1. o build OFICIAL nao pode carregar marca de teste ----
// (o canal de teste e' ativado por `name`/appId; se vazarem pro oficial, o app instala com
// userData e porta de teste na maquina do usuario final)
if (/teste/i.test(cfg.appId || '')) erros.push(`appId do oficial contem "teste": ${cfg.appId}`)
if (/teste/i.test((cfg.extraMetadata && cfg.extraMetadata.name) || '')) erros.push('extraMetadata.name do oficial contem "teste"')
if (/teste/i.test(cfg.productName || '')) erros.push(`productName do oficial contem "teste": ${cfg.productName}`)
if (!erros.length) ok.push('config oficial sem marca de teste')

// ---- 2. canal de auto-update tem que apontar pro repo oficial ----
const pub = cfg.publish || {}
if (pub.owner !== 'Vperts' || pub.repo !== 'poke-multi-labs') {
  erros.push(`publish aponta pra ${pub.owner}/${pub.repo} — o oficial e' Vperts/poke-multi-labs`)
} else ok.push('publish = Vperts/poke-multi-labs')

const appUpd = path.join(dist, 'win-unpacked', 'resources', 'app-update.yml')
if (!fs.existsSync(appUpd)) {
  erros.push('app-update.yml nao existe no pacote — o app instalado nao vai achar update NENHUM')
} else {
  const u = yaml.load(fs.readFileSync(appUpd, 'utf8'))
  if (u.owner !== 'Vperts' || u.repo !== 'poke-multi-labs') {
    erros.push(`app-update.yml embutido aponta pra ${u.owner}/${u.repo} (fica DENTRO do exe: quem instalar assim nunca mais migra de canal sozinho)`)
  } else ok.push('app-update.yml embutido = Vperts/poke-multi-labs')
}

// ---- 3. os 4 assets da release ----
const setup = `VpertsMultiLeve-Setup-${versao}.exe`
const obrigatorios = [setup, `${setup}.blockmap`, 'latest.yml', 'VpertsMultiLeve-Setup.exe']
for (const f of obrigatorios) {
  if (!fs.existsSync(path.join(dist, f))) erros.push(`asset faltando em dist/: ${f}` + (f === 'latest.yml' ? ' (sem ele o botao Atualizar fica cego pra sempre)' : ''))
}
if (!erros.some(e => e.includes('asset faltando'))) ok.push(`4 assets presentes (v${versao})`)

// ---- 4. o latest.yml tem que falar da MESMA versao (ja descasou antes) ----
const lyPath = path.join(dist, 'latest.yml')
if (fs.existsSync(lyPath)) {
  const ly = yaml.load(fs.readFileSync(lyPath, 'utf8'))
  if (String(ly.version) !== versao) erros.push(`latest.yml diz v${ly.version} mas o build e' v${versao}`)
  else ok.push(`latest.yml casa com a versao (${versao})`)
}

// ---- 5. a copia de nome fixo tem que ser BYTE-IDENTICA ao instalador versionado ----
// (e' o arquivo que o site entrega; se ficar velha, o site distribui versao antiga calada)
const a = path.join(dist, setup), b = path.join(dist, 'VpertsMultiLeve-Setup.exe')
if (fs.existsSync(a) && fs.existsSync(b)) {
  const crypto = require('crypto')
  const h = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  if (h(a) !== h(b)) erros.push('VpertsMultiLeve-Setup.exe (a copia que o SITE baixa) nao e o mesmo binario do instalador desta versao')
  else ok.push('copia de nome fixo identica ao instalador')
}

// ---- 6. metadados do exe (prova de que o rcedit rodou e que nao e' build de teste) ----
const exe = path.join(dist, 'win-unpacked', 'VpertsMultiLeve.exe')
const rcedit = path.join(__dirname, 'rcedit-x64.exe')
if (fs.existsSync(exe) && fs.existsSync(rcedit)) {
  const ler = (k) => execFileSync(rcedit, [exe, '--get-version-string', k]).toString().trim()
  const pv = ler('ProductVersion'), pn = ler('ProductName')
  if (pv !== versao) erros.push(`ProductVersion do exe = ${pv} (esperado ${versao}) — o rcedit nao rodou, o icone tambem nao entrou`)
  else ok.push(`exe com ProductVersion ${pv}`)
  if (/teste/i.test(pn)) erros.push(`ProductName do exe diz "${pn}" — isso e um build de TESTE`)
}

// ---- 7. arvore git limpa: nao publicar binario que nao corresponde a commit nenhum ----
try {
  const sujo = execSync('git status --porcelain', { cwd: raiz }).toString().trim()
  if (sujo) avisos.push('git com alteracoes nao commitadas — o que voce esta publicando nao existe em commit nenhum:\n    ' + sujo.split('\n').slice(0, 8).join('\n    '))
  else ok.push('git limpo')
  const naoPush = execSync('git log --oneline @{u}..HEAD 2>/dev/null || true', { cwd: raiz, shell: 'bash' }).toString().trim()
  if (naoPush) avisos.push('commits ainda nao pushados:\n    ' + naoPush.split('\n').join('\n    '))
} catch (e) { avisos.push('nao consegui checar o git: ' + e.message) }

// ---- 8. a tag nao pode existir (reusar release ja quebrou o updater) ----
try {
  const tags = execSync(`gh release list --repo Vperts/poke-multi-labs --limit 30`, { cwd: raiz }).toString()
  if (new RegExp(`\\bv${versao.replace(/\./g, '\\.')}\\b`).test(tags)) {
    erros.push(`a release v${versao} JA EXISTE no Vperts — suba a versao (nunca reaproveitar tag)`)
  } else ok.push(`v${versao} ainda nao publicada`)
} catch (e) { avisos.push('nao consegui consultar as releases (gh indisponivel?) — confira na mao se a v' + versao + ' ja existe') }

// ---- relatorio ----
console.log('\n=== PORTEIRO DA RELEASE (canal OFICIAL, v' + versao + ') ===')
ok.forEach(m => console.log('  [ok]    ' + m))
avisos.forEach(m => console.log('  [aviso] ' + m))
erros.forEach(m => console.log('  [ERRO]  ' + m))
if (erros.length) {
  console.log(`\nNAO PUBLIQUE: ${erros.length} problema(s) acima.\n`)
  process.exit(1)
}
console.log(avisos.length ? '\nLiberado, mas leia os avisos acima.\n' : '\nLiberado pra publicar.\n')
