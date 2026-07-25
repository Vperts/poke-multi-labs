// Hook do electron-builder: roda DEPOIS de empacotar e ANTES do NSIS.
//
// POR QUE EXISTE: `win.signAndEditExecutable: false` no electron-builder-lite.yml desliga o
// rcedit interno — que e' o passo que injeta icone e metadados no exe. Sem isso o app fica com
// o icone generico do Electron (atomo) e ProductVersion 33.x (a do Electron). Nao da pra por
// `true` porque ai o electron-builder extrai o pacote `winCodeSign`, que tem symlinks de macOS
// (.dylib), e a extracao FALHA no Windows sem Modo de Desenvolvedor/admin — o build nem sai.
//
// SOLUCAO: chamar o rcedit avulso (build/rcedit-x64.exe, copiado do cache do electron-builder),
// que faz o mesmo trabalho SEM depender do winCodeSign. Self-contained: funciona na maquina de
// quem clonar o repo, sem ligar Modo de Desenvolvedor.
//
// Ver memoria: cicatriz-icone-exe-signandedit-wincodesign.

const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const rcedit = path.join(__dirname, 'rcedit-x64.exe')
  const icon = path.join(__dirname, '..', 'renderer', 'logo-vp.ico')
  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const exe = path.join(context.appOutDir, exeName)

  for (const [label, p] of [['rcedit', rcedit], ['icone', icon], ['exe', exe]]) {
    if (!fs.existsSync(p)) throw new Error(`afterPack: ${label} nao encontrado em ${p}`)
  }

  const version = context.packager.appInfo.version          // ex: 0.9.4
  const fileVersion = `${version}.0`                        // FileVersion quer 4 campos

  const args = [
    exe,
    '--set-icon', icon,
    '--set-file-version', fileVersion,
    '--set-product-version', version,
    '--set-version-string', 'ProductName', 'Vperts Multi',
    // so ASCII aqui: o rcedit v0.2.0 grava acentuado/travessao como "?" nas Propriedades do exe
    '--set-version-string', 'FileDescription', 'Vperts Multi - painel multi-conta',
    '--set-version-string', 'CompanyName', 'Vperts',
    '--set-version-string', 'LegalCopyright', 'Vperts',
    '--set-version-string', 'OriginalFilename', exeName,
  ]

  console.log(`  • afterPack: rcedit em ${exeName} (icone Vperts + versao ${version})`)
  execFileSync(rcedit, args, { stdio: 'inherit' })

  // Prova de que rodou: se o ProductVersion do exe ainda for o do Electron (33.x), o build
  // saiu com o icone errado e nao adianta publicar.
  const lido = execFileSync(rcedit, [exe, '--get-version-string', 'ProductVersion']).toString().trim()
  if (lido !== version) throw new Error(`afterPack: ProductVersion ficou "${lido}", esperado "${version}"`)
  console.log(`  • afterPack: ok — ProductVersion do exe = ${lido}`)
}
