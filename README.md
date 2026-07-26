# Vperts Multi

Ferramenta oficial da **VP Store** para o [Poke Idle World](https://poke.idleworld.online):
até **4 contas** do jogo abertas numa janela só, com painel de status por conta, alerta de bolas e
poções acabando, e o loot de todas somado.

**Baixar (Windows):** <https://vperts.com.br/multi>

> ⚠️ O jogo permite até 4 contas por jogador (comunicado oficial no Discord, 15/07/2026), e a
> ferramenta **respeita esse limite** — ela facilita o que já é permitido. **Não há automação de
> jogo aqui**: só leitura, alerta e soma do que o próprio jogo já mostra na tela.

## O que ele faz

- **4 contas, 1 janela** — cada conta roda isolada (sessão e login próprios), encaixadas em grade,
  colunas ou linhas; dá pra focar uma e esconder as outras (que continuam progredindo).
- **Card por conta** — nível do treinador, Pokémon líder, HP e EXP ao vivo, bolas, poções,
  derrotados, capturas, shiny e lucro da sessão.
- **Alertas** — som e notificação do Windows quando bola ou poção está acabando, com o nome da conta.
- **Painel geral** — todas as contas lado a lado, com loot por hora e totais.
- **Atualização em 1 clique** — o botão *Atualizar* baixa a versão nova e reinicia já atualizado.

## Rodar do código-fonte

Requisitos: **Node.js 18+** e Windows (o encaixe das janelas usa API do Windows).

```bash
git clone https://github.com/Vperts/poke-multi-labs
cd poke-multi-labs
npm install
npx electron main-lite.js     # abre o app a partir do fonte
```

O app distribuído hoje é o **`main-lite.js`** (versão leve, com o jogo dentro do próprio Electron).
O `host-main.js` é a geração anterior — mantido no repo porque contém a camada de login e licença,
mas **não é o que roda**.

## Gerar instalador

```bash
bash build-lite.sh      # canal OFICIAL  -> dist/
bash build-teste.sh     # canal TESTE    -> dist-teste/
```

Os dois canais **instalam lado a lado e podem rodar ao mesmo tempo**: o de teste tem `appId`, pasta
de dados, porta de depuração e atalho próprios, e a barra dele fica dourada escrito TESTE. O canal
de teste **nunca** é publicado e não tem auto-update.

O `build-lite.sh` roda um porteiro (`build/verifica-release.js`) que **reprova o build** se faltar
algum dos 4 assets da release, se o canal de atualização estiver errado, se o `latest.yml` não casar
com a versão ou se o executável estiver com marca de teste.

Detalhes de publicação: [`docs/RELEASE.md`](docs/RELEASE.md).

## Ferramentas de desenvolvimento

```bash
node ler.js                  # estado ao vivo das telas abertas (líder, treinador, HP…)
node ler.js profile          # dados do treinador vindos da API do jogo
node xatu.js --once 300      # observa o WebSocket por 5 min e aponta o que mudou no protocolo
```

O `xatu.js` existe porque atualização do jogo quebra a leitura **em silêncio**: ele registra tipo de
mensagem nunca visto, campo que sumiu e formato que mudou — guardando só metadado estrutural,
**nunca** conteúdo de mensagem e **nunca** token.

## Estrutura

```
main-lite.js           processo principal: janelas das contas, layout, alertas, auto-update
vperts-ext/content.js  ponte de cada tela: lê o WebSocket do jogo e agrega o estado
cdp.js                 leitura das telas pelo DevTools Protocol
renderer/              telas: barra de título, sidebar, cards (overlay), painel, stats
build/                 afterPack (ícone/metadados do exe), config do canal de teste, porteiro
docs/RELEASE.md        como publicar e o que o site consome
```

## Contribuir

Bugs, ideias e melhorias são bem-vindos — veja [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licença

**PolyForm Noncommercial 1.0.0** — veja [`LICENSE.md`](LICENSE.md).

Em português claro: você pode **ler, estudar, modificar e compartilhar** o código à vontade para uso
**não comercial**. O que não pode é vender, cobrar por ele ou usá-lo como produto comercial.
Contribuições são muito bem-vindas dentro dessas regras.
