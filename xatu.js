#!/usr/bin/env node
// XATU — o sentinela do protocolo do Poke Idle World.
// (Xatu #178: passa o dia parado olhando o horizonte e enxerga o que vem. É a função exata.)
//
// Este arquivo é o CORPO do Xatu — o processo que fica de prontidão. O que ele sabe interpretar
// está na skill `xatu`, e o que ele descobre é entregue ao `delibird`, que distribui pro time
// (slowking, porygon, magneton, alakazam).
//
// Fica plugado no app (oficial 9333 e/ou TESTE 9433) enquanto ele estiver aberto e observa os
// frames do WebSocket do jogo pelo DevTools Protocol. Não injeta nada na página, não altera nada,
// não automatiza: é o mesmo que deixar o DevTools aberto na aba Network olhando o socket.
//
// PRA QUE: atualização do jogo quebra nossa leitura EM SILÊNCIO (em 22/07/2026 a mensagem
// `poke-delta` sumiu, as capturas pararam de contar e o Profit saiu ~18k errado sem um erro no
// console). O Xatu existe pra que a próxima mudança seja detectada no mesmo dia, sozinha.
//
// O QUE ELE GRAVA (e o que NUNCA grava):
//   grava  -> tipo da mensagem, as CHAVES de cada mensagem, contagem, e o "shape" (chave -> tipo do
//             valor). Só metadado estrutural.
//   NUNCA  -> payload cru, valor de campo, nome de jogador, e principalmente o TOKEN. O JWT
//             identifica a conta; nada que possa contê-lo entra em arquivo.
//
// Uso:
//   node xatu.js                  # observa o que estiver aberto (9333 e 9433), Ctrl+C encerra
//   node xatu.js --once 120       # observa por 120s e sai (bom pra checagem pontual)
//
// Saída em _coleta/xatu/ (fora do git):
//   catalogo.json   estado acumulado: cada type visto, quando, com quais chaves
//   alertas.jsonl   só o que É novidade — é este arquivo que a skill XATU lê
'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require('ws')

const PORTAS = [
  { porta: 9333, canal: 'oficial' },
  { porta: 9433, canal: 'teste' },
]

// Tipos conhecidos = os documentados na skill PORYGON. Qualquer coisa fora daqui é NOVIDADE e
// vira alerta. Ao promover um tipo novo pra documentado, acrescentar nesta lista.
const CONHECIDOS = new Set([
  // do schema público (AntonioFleck, 18/07/2026)
  'field', 'chat', 'analyzer', 'balls', 'field-kill', 'poke-xp', 'catch-result', 'inventory',
  'events', 'pokes', 'poke-delta', 'field-init', 'shiny-global', 'session-replaced',
  // achados do proprio Xatu no censo de 25/07/2026 (documentados na skill porygon). Entram aqui
  // pra ele parar de alertar o mesmo — o alerta serve pra NOVIDADE, nao pra repetir o sabido.
  'auto-heal', 'announce', 'boosts', 'joy-healed', 'pending', 'history', 'mail-badge',
])

const DIR = path.join(__dirname, '_coleta', 'xatu')
const CATALOGO = path.join(DIR, 'catalogo.json')
const ALERTAS = path.join(DIR, 'alertas.jsonl')
fs.mkdirSync(DIR, { recursive: true })

const catalogo = fs.existsSync(CATALOGO) ? JSON.parse(fs.readFileSync(CATALOGO, 'utf8')) : {}
let sujo = false

const agora = () => new Date().toISOString()

function alerta(tipo, dados) {
  const linha = JSON.stringify(Object.assign({ quando: agora(), alerta: tipo }, dados))
  fs.appendFileSync(ALERTAS, linha + '\n')
  console.log('🔔', tipo, JSON.stringify(dados))
}

// "shape" = chave -> tipo do valor. É o que denuncia campo que sumiu ou mudou de formato,
// sem guardar nenhum valor.
function shapeDe(obj) {
  const s = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    s[k] = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
  }
  return s
}

function registra(msg, canal) {
  const tipo = msg && msg.type
  if (!tipo) return
  const shape = shapeDe(msg)
  const ja = catalogo[tipo]

  if (!ja) {
    catalogo[tipo] = { visto1: agora(), ultimo: agora(), n: 1, canal, shape }
    sujo = true
    if (!CONHECIDOS.has(tipo)) {
      alerta('TIPO_NOVO', { tipo, canal, chaves: Object.keys(shape) })
    } else {
      console.log('•', tipo, '(conhecido, primeira vez nesta sessão)')
    }
    return
  }

  ja.n++; ja.ultimo = agora()
  // campo que SUMIU de um tipo conhecido: o sintoma clássico de att que quebra leitura
  const sumiram = Object.keys(ja.shape).filter(k => !(k in shape))
  const novos = Object.keys(shape).filter(k => !(k in ja.shape))
  const mudaram = Object.keys(shape).filter(k => k in ja.shape && ja.shape[k] !== shape[k] && shape[k] !== 'null' && ja.shape[k] !== 'null')

  if (sumiram.length || novos.length || mudaram.length) {
    // só alerta uma vez por combinação, senão vira spam a 3x/s
    const chave = tipo + '|' + sumiram.join(',') + '|' + novos.join(',') + '|' + mudaram.join(',')
    if (!registra._vistos) registra._vistos = new Set()
    if (!registra._vistos.has(chave)) {
      registra._vistos.add(chave)
      alerta('SHAPE_MUDOU', { tipo, canal, sumiram, novos, mudaram })
    }
    Object.assign(ja.shape, shape)
    sujo = true
  }
}

function salva() {
  if (!sujo) return
  fs.writeFileSync(CATALOGO, JSON.stringify(catalogo, null, 2))
  sujo = false
}

const getJSON = (url) => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)) } catch (e) { rej(e) } }) })
    .on('error', rej)
})

const ligados = new Map()   // id da tela -> ws do CDP

async function pluga({ porta, canal }) {
  let telas
  try { telas = await getJSON(`http://127.0.0.1:${porta}/json/list`) } catch { return }  // app fechado
  const jogos = telas.filter(t => t.type === 'page' && /idleworld/.test(t.url || ''))
  for (const t of jogos) {
    if (ligados.has(t.id)) continue
    const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
    ligados.set(t.id, ws)
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }))
      console.log(`👁  ligado: ${canal} :${porta} tela ${t.id.slice(0, 8)}`)
    })
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw) } catch { return }
      if (m.method !== 'Network.webSocketFrameReceived') return
      const p = m.params && m.params.response && m.params.response.payloadData
      if (!p || p[0] !== '{') return
      let msg; try { msg = JSON.parse(p) } catch { return }
      registra(msg, canal)
    })
    ws.on('close', () => { ligados.delete(t.id); console.log(`   desligou: tela ${t.id.slice(0, 8)}`) })
    ws.on('error', () => { ligados.delete(t.id) })
  }
}

async function ciclo() {
  for (const alvo of PORTAS) await pluga(alvo)
  salva()
}

const argOnce = process.argv.indexOf('--once')
const limiteSeg = argOnce > -1 ? parseInt(process.argv[argOnce + 1] || '120', 10) : 0

console.log('XATU de prontidão — observando (oficial :9333 / teste :9433)')
console.log('tipos conhecidos:', CONHECIDOS.size, '| saída:', DIR)
if (limiteSeg) console.log(`modo --once: ${limiteSeg}s`)

ciclo()
const timer = setInterval(ciclo, 15000)   // reconecta quando você abre/fecha tela
process.on('SIGINT', () => { salva(); console.log('\nxatu encerrado; catálogo salvo.'); process.exit(0) })
if (limiteSeg) setTimeout(() => { salva(); clearInterval(timer); console.log('fim do --once; catálogo salvo.'); process.exit(0) }, limiteSeg * 1000)
