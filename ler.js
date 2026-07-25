#!/usr/bin/env node
// LER — leitor de estado ao vivo das telas do jogo, sem inferno de escaping.
//
// POR QUE EXISTE: ler o estado exige avaliar JS dentro da página via CDP. Montar essa expressão
// na mão dentro de `node -e "..."` no shell falha por aspas escapadas — aconteceu duas vezes em
// 25/07/2026, silenciosamente (o retorno vinha `undefined` e parecia que o dado não existia,
// quando existia). As expressões agora moram AQUI, testadas, e o shell só escolhe o atalho.
//
// Uso:
//   node ler.js                 # resumo de todas as telas (oficial 9333 + teste 9433)
//   node ler.js lider           # líder de cada tela: nome, nível do roster, nível ao vivo, HP
//   node ler.js profile         # treinador (REST /api/game/profile): nome, nível, rank, clã
//   node ler.js chaves          # que chaves existem no estado da ponte (pra investigar campo novo)
//   node ler.js --porta 9433 lider
//   node ler.js --js caminho.js # avalia um arquivo .js seu na página (sem escaping nenhum)
//
// Só LEITURA. Nada aqui escreve na página, no jogo ou no servidor.
'use strict'

const fs = require('fs')
const http = require('http')
const cdp = require('./cdp.js')

const ATALHOS = {
  // estado do líder: junta as duas fontes que já se contradisseram (roster x ao vivo)
  lider: `(function () {
    var v = {}; try { v = JSON.parse(localStorage.getItem('__vperts') || '{}') } catch (e) {}
    var l = v.lider || null;
    return JSON.stringify({
      nome: l && l.name, nivelRoster: l && l.level, nivelAoVivo: v.liderLevel,
      idRoster: l && l.id, hpRoster: l && l.hp, hpAoVivo: v.heroHp, hpMaxAoVivo: v.heroMaxHp,
      bate: !!(l && l.level === v.liderLevel)
    })
  })()`,

  // treinador — fonte autoritativa REST; o WS não manda e o DOM só tem no canvas
  profile: `(function () {
    var v = {}; try { v = JSON.parse(localStorage.getItem('__vperts') || '{}') } catch (e) {}
    var p = v.api && v.api.profile;
    return JSON.stringify(p ? {
      nome: p.name, nivel: p.level, rank: p.rank, clan: p.clan && p.clan.name, vip: !!p.vip,
      xpInLevel: p.xpInLevel, xpForNext: p.xpForNext
    } : { erro: 'sem api.profile (a ponte ainda não puxou a REST?)' })
  })()`,

  // HP/XP da chave rápida (a que o card lê a 150ms)
  hero: `(function () {
    var h = {}; try { h = JSON.parse(localStorage.getItem('__vpHero') || '{}') } catch (e) {}
    return JSON.stringify(h)
  })()`,

  // o que existe no estado — use pra descobrir campo novo sem adivinhar nome
  chaves: `(function () {
    var v = {}; try { v = JSON.parse(localStorage.getItem('__vperts') || '{}') } catch (e) {}
    var out = {};
    Object.keys(v).forEach(function (k) {
      var x = v[k];
      out[k] = x === null ? 'null' : Array.isArray(x) ? ('array[' + x.length + ']') : typeof x;
    });
    return JSON.stringify(out)
  })()`,

  resumo: `(function () {
    var v = {}; try { v = JSON.parse(localStorage.getItem('__vperts') || '{}') } catch (e) {}
    var p = v.api && v.api.profile, l = v.lider;
    return JSON.stringify({
      conta: p && p.name, nivelTreinador: p && p.level,
      lider: l && l.name, nivelLiderRoster: l && l.level, nivelLiderAoVivo: v.liderLevel,
      hp: v.heroHp, hpMax: v.heroMaxHp,
      kills: v.kills, capturas: v.caught, hunt: v.hunt && v.hunt.slug
    })
  })()`,
}

const argv = process.argv.slice(2)
const pega = (flag) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null }
const portaArg = pega('--porta')
const arqJs = pega('--js')
const atalho = argv.find(a => !a.startsWith('--') && a !== portaArg && a !== arqJs) || 'resumo'

let EXPR
if (arqJs) {
  EXPR = fs.readFileSync(arqJs, 'utf8')
} else if (ATALHOS[atalho]) {
  EXPR = ATALHOS[atalho]
} else {
  console.error(`atalho desconhecido: ${atalho}\ndisponíveis: ${Object.keys(ATALHOS).join(', ')} (ou --js arquivo.js)`)
  process.exit(1)
}

const PORTAS = portaArg ? [{ porta: +portaArg, canal: 'escolhida' }]
  : [{ porta: 9333, canal: 'oficial' }, { porta: 9433, canal: 'teste' }]

const getJSON = (u) => new Promise((res, rej) => {
  http.get(u, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)) } catch (e) { rej(e) } }) }).on('error', rej)
})

;(async () => {
  let achou = 0
  for (const { porta, canal } of PORTAS) {
    let telas
    try { telas = await getJSON(`http://127.0.0.1:${porta}/json/list`) } catch { continue }
    const jogos = telas.filter(t => t.type === 'page' && /idleworld/.test(t.url || ''))
    if (!jogos.length) continue
    achou += jogos.length
    console.log(`\n=== ${canal} :${porta} — ${jogos.length} tela(s) — atalho "${arqJs || atalho}" ===`)
    for (const t of jogos) {
      let r
      try { r = await cdp.evaluate(t.webSocketDebuggerUrl, EXPR) } catch (e) { console.log(' ', t.id.slice(0, 8), 'ERRO:', e.message); continue }
      // cdp.evaluate devolve {value} quando dá certo; qualquer outra coisa é sintoma, mostre cru
      const v = r && r.value !== undefined ? r.value : JSON.stringify(r)
      let bonito = v
      try { bonito = JSON.stringify(JSON.parse(v), null, 2).replace(/\n/g, '\n    ') } catch (e) {}
      console.log(`  [${t.id.slice(0, 8)}] ${bonito}`)
    }
  }
  if (!achou) console.log('nenhuma tela do jogo aberta (app fechado?) — portas checadas: ' + PORTAS.map(p => p.porta).join(', '))
})()
