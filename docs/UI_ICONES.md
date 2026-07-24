# Padrão de ÍCONES de linha — card · dashboard · stats

> Fonte de verdade pra tamanho/proporção de ícone nas 3 telas do Vperts Multi.
> Escrito depois de errar isso mais de uma vez (23–24/07/2026). **Ler ANTES de mexer em
> ícone de qualquer renderer.** Ver cicatriz [[vperts-card-icone-padrao-19px]].

## A REGRA (invariável)

**A CAIXA manda. Todo ícone de linha — sprite (`<img>`) OU emoji/texto (`<span>`) — enche a MESMA
caixa e lê como o MESMO tamanho visual.** Nunca criar tamanho por linha, nunca deixar emoji menor
que sprite, nunca deixar um sprite dominar o outro.

Três peças, sempre juntas:
1. **Caixa fixa** com `overflow:hidden` e `place-items:center`.
2. **`<img>`** = `width/height:100%` + `object-fit:contain` + `image-rendering:pixelated`.
3. **`<span>` (emoji/texto)** = `font-size` ≈ tamanho da caixa (NÃO menor).
4. **Sprite com padding transparente interno** (as BOLAS do jogo desenham a bola pequena num
   canvas grande) → recebe a classe `.z` via `onload` e é **ampliado + recortado** pela caixa,
   pra bater com os que não têm padding (potion/revive/pokémon).

O `onload` que decide o zoom (idêntico nos 3 renderers):
```js
onload="if(this.naturalWidth>=24)this.classList.add('z')"
```
E o `.z` só ganha CSS de zoom no contexto da BOLA (senão potion/pokémon, que já enchem, ficariam
gigantes). No card: `.r .i.ball img.z`. No stats: `.r.ball .ri img.z`.

## Valores por renderer (mantêm a MESMA proporção, só muda a unidade)

| Renderer | Arquivo | Caixa | img | emoji `<span>` | zoom da bola (`.z`) |
|---|---|---|---|---|---|
| **Card**      | `renderer/overlay.html`      | `.r .i` 19×19px      | 19px contain | `font-size:19px` (= caixa) | `.i.ball img.z` 40px, `margin:-10px` |
| **Stats**     | `renderer/stats-grid.html`   | `.ri` 2.7×2.7vmin    | 100% contain | `font-size:2.6vmin` (≈ caixa) | `.r.ball .ri img.z` 200%, `margin:-50%` |
| **Dashboard** | `renderer/dashboard-lite.html` | tiles `.tile .ic` / itens `.item img` | conferir antes de mexer | — | — |

Proporções (todas ≈ iguais): img/caixa = 1.0 · emoji/caixa ≈ 1.0 · bola_zoom/caixa ≈ 2.1 ·
bola_margin/caixa ≈ −0.53. Ao criar caixa nova, derive o zoom dessa razão (≈2×, margin ≈ −50%).

## Onde está o código

- **Card**: `linha(src,lbl,val,cls,icls)` monta `.r > .i > (img|span)`. O `img` sempre leva o
  `onload` (`ZOOM`), e `.i.ball` é marcado via `icls`. CSS em `.r .i` / `.r .i img` / `.r .i span`.
- **Stats**: `ico(s)` decide img×span e injeta o `onload`. A LINHA da bola passa a classe `ball`
  em `linha(...,'ball'+...)` pra ativar `.r.ball .ri img.z`. CSS em `.ri` / `.ri img` / `.ri span`.
- **Dashboard**: `tile()` usa SVG inline OU img; itens via `item()`. Se for padronizar aqui,
  aplicar as MESMAS 4 peças acima.

## Cicatrizes (não repetir)

- **Emoji encolhendo**: `.r .i span` já foi pra 13px e os ícones de baixo (Derrotados/Lendária/
  Profit) SUMIAM. Emoji ≈ caixa, sempre.
- **Bola sem `.z`**: sprite da bola tem ~35–50% de padding → aparece pequena e desproporcional ao
  lado da potion (que enche). Sem o zoom+recorte, o print fica "tudo desproporcional" (24/07).
- **Não confiar em `object-fit:contain` sozinho**: contain resolve overflow, mas NÃO resolve
  padding INTERNO do sprite — isso é o zoom `.z` que resolve.
