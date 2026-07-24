# Handoff — camada de dados + painéis (card · dashboard · stats)

> Para o **Gabriel**. Resume o que foi construído no ciclo de 24/07/2026: a leitura de dados do
> jogo (WS + REST), como ela chega na UI, e o que cada arquivo faz. O `README.md` cobre o app
> multi-conta em si (janela, layouts, workspaces); **este doc é sobre os DADOS e os painéis**.

---

## 1. Visão geral

O app roda em **Electron** (`main-lite.js`). Cada conta é uma `WebContentsView` isolada carregando
`https://poke.idleworld.online/play`. Por cima, três superfícies mostram métricas **lendo só o que o
jogo já emite** (nada de automação): o **card** (overlay por conta), o **dashboard** (painel
completo) e o **stats** (4 telas de canto com a Pokébola no meio).

**Princípio:** o disco/WS/REST do jogo é a verdade. Nunca adivinhar campo, nunca raspar DOM quando o
WS/REST entrega. Todo número exibido tem que ser rastreável à fonte.

---

## 2. Fluxo de dados (a pipeline)

```
 [página do jogo]                         [main Electron]              [UI]
 WebContentsView                          main-lite.js                 renderer/*.html
 preload = vperts-ext/content.js
   │  (roda no MAIN WORLD: contextIsolation:false)
   │
   ├─ wrap do window.WebSocket ──► lê os frames do jogo (field-kill, poke-xp,
   │                                catch-result, analyzer, pokes, …) e acumula em V
   ├─ fetch REST autenticado ────► /api/game/{profile,streak,professions} ──► V.api
   │                                (boot + a cada 45s, Bearer do sessionStorage)
   └─ flush() a cada ~1s ────────► localStorage['__vperts'] = JSON(V)
                                          │
   read-dashboard (ipc) ──────────────────┤ main-lite.js roda cdp.STATE_EXPR
   window.ml.readDashboard()               │ via executeJavaScript em CADA view
   (host-preload.js expõe)                 │ → _stateFn lê localStorage.__vperts
                                           │   e normaliza tudo num objeto `st`
                                           │   (cacheado 800ms). Ver cdp.js.
                                           ▼
                              render() nos 3 renderers consome `st`
```

- **`st`** é o objeto normalizado que TODA a UI recebe (card, dashboard, stats leem o mesmo).
  Campos principais: `st.live` (dado cru do WS: kills/xp/caught/shinies/bolas/loot…),
  `st.taxa` (xp/h, kills/h), `st.fin` (saldo loot/capturas/supply), `st.hero` (HP/XP/level do
  líder em tempo real + curva de XP), `st.hunt`, `st.ballList`/`st.ballAtiva`, `st.cura`,
  `st.drops`, `st.lider`, e **`st.api`** (`{profile, streak, professions, ts}` — a camada REST).
- A **lista-branca** em `cdp.js` (`_stateFn`, ~linha 94) decide o que de `V` chega na UI. **Campo
  novo no bridge NÃO aparece na UI até ser adicionado nessa lista + no `return` final.** (Cicatriz
  recorrente — se um número "não atualiza", é quase sempre isso.)

---

## 3. Camada REST do jogo (a parte nova mais reusável)

Endpoints autoritativos, todos **GET**, auth por **`Authorization: Bearer <accessToken>`** (NÃO
cookie — cookie dá 401). O token vive em `sessionStorage['pokeweb:tokens'].accessToken`. Rodados
**dentro da página** (mesma origem). Referência do catálogo: base MIT `AntonioFleck/poke-idle-launcher`.

| Endpoint | Traz |
|---|---|
| `/api/game/profile` | level, xp (`xpInLevel`/`xpForNext`), gold, diamonds, **rank global**, pokedexCount/Total, totalCatches, vip, clan |
| `/api/game/streak` | totalKills (vida), earned/available/spent, toNext, killsPerPoint, bonusPct{exp,loot,shiny}, kills[] por espécie |
| `/api/game/professions` | rank/rankName/maxRank, catchBonusPct, nextStep{species, pictures, kills[] por tipo have/need} |
| `/api/game/pokedex` | espécies + tipos + kill counts *(ainda não consumido — destrava motor de eficiência)* |
| `/api/game/all-pokes` | coleção com IV/quality *(não consumido)* |
| `/api/game/balls` · `/used-balls` | catálogo+contagem · uso autoritativo *(não consumido — bolas por captura)* |
| `POST /api/auth/refresh` | token novo no 401 *(hoje confiamos no refresh que o próprio jogo faz no sessionStorage)* |

Hoje consumimos os 3 primeiros em `content.js` → `puxaApi()`. Adicionar um endpoint = mais um
`getApi()` no `Promise.all`, guardar em `V.api.*`, e (se for pra UI) incluir na lista-branca do `cdp.js`.

---

## 4. Arquivos-chave

| Arquivo | Papel |
|---|---|
| `main-lite.js` | **Main Electron** (o que roda: `npx electron main-lite.js`). Cria as views, layout/grade, atalhos (Ctrl+1..4 foca a conta), modos Eco/FPS/Stats/Cards, `read-dashboard` (agrega o `st` de todas as contas, cache 800ms). Expõe a porta `--remote-debugging-port=9333` (debug). |
| `vperts-ext/content.js` | **Bridge** (preload, main world). Wrap do WebSocket → `V`; `puxaApi()` REST → `V.api`; `flush()` → `localStorage.__vperts`. |
| `cdp.js` | **Leitor**: `_stateFn`/`STATE_EXPR` = a função que lê `__vperts` e normaliza no `st` (lista-branca + `return`). Usado por `main-lite` (executeJavaScript) e `host-main` (CDP). |
| `host-preload.js` | expõe `window.ml` (`readDashboard`, `cardReset`, …) pra sidebar/dashboard/stats. |
| `renderer/overlay.html` | **Card** por conta (barras HP/XP, bolas, derrotados, shiny, lendária, profit). |
| `renderer/dashboard-lite.html` | **Dashboard** completo: Treinador (profile) + Streak + Prestígio (professions) + Sessão/Saldo/Shiny/HP/Bolas/Cura/Drops/Capturas. |
| `renderer/stats-grid.html` | **Stats** 4-up (espelha o card, Pokébola central com o total). |
| `docs/UI_ICONES.md` | **Padrão de ícone** das 3 telas — ler antes de mexer em ícone. |
| `host-main.js` | versão paga (Chrome real via Win32). **Não é a que roda** hoje; compartilha `content.js`/`cdp.js`/renderers. |

---

## 5. Rodar / depurar

```powershell
cd C:\dev\pokemon\labs
npx electron main-lite.js      # o app que está em uso (Electron-lite)
```

- Debug/inspeção: o processo expõe `http://127.0.0.1:9333/json` (todas as views + as páginas do
  jogo). Dá pra rodar um `Runtime.evaluate` autenticado pra bater qualquer endpoint/estado ao vivo.
- Ver os números do bridge de uma conta: no console da página, `JSON.parse(localStorage.__vperts)`.

---

## 6. Convenções (não repetir cicatrizes)

- **Ícones**: `docs/UI_ICONES.md` — caixa manda, emoji ≈ caixa, sprite de bola leva `.z`.
- **Lista-branca**: campo novo do bridge só chega na UI se entrar em `cdp.js` (`_stateFn` + `return`).
- **Sessão vs vida**: `V.*` zera na troca de hunt/lixeira; `V.tot.*` e `V.api.*` são de vida.
- **Sem restart pra tocar renderer**: `renderer/*.html` recarrega sozinho; mas **preload
  (`content.js`) só vale reiniciando o app**.
- **Fonte de captura**: shiny selvagem = `field-kill.shiny`; shiny capturado = `poke-delta.shiny`.

---

## 7. Estado e próximos passos

**Pronto e no ar (`main`):** card, dashboard e stats consumindo WS + REST; atalho de foco; padrão de
ícone documentado.

**Barato de destravar (a base já está posta):**
- `/api/game/pokedex` → tipos + base stats por espécie ⇒ **motor de eficiência de hunt**.
- `/api/game/used-balls` + `/balls` ⇒ **bolas por captura por hunt** (com barra de erro).
- Aggregate "Todas" no dashboard poderia virar tabela por conta (level/gold/h/kills/h/…) no estilo
  do launcher do Fleck.

Qualquer dúvida do fluxo, começar pelo `st` (seção 2) e pela lista-branca do `cdp.js`.
