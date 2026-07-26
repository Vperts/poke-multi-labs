# Contribuindo com o Vperts Multi

Obrigado por querer ajudar. O projeto é da comunidade do Poke Idle World e melhora com quem joga.

## Antes de qualquer coisa: as três regras

1. **Nada de automação de jogo.** A ferramenta lê, soma e avisa — nunca joga por você. PR que
   automatize captura, movimento, combate ou compra **não será aceito**, mesmo que funcione bem.
   Isso não é preferência técnica: é o que mantém a ferramenta aceita pela comunidade e pelos donos
   do jogo.
2. **Nunca commite token.** O JWT do jogo (`sessionStorage['pokeweb:tokens']`) identifica a conta.
   Ele não pode aparecer em código, log, print, teste ou arquivo de coleta. O mesmo vale para
   e-mail e senha de qualquer pessoa.
3. **O limite de 4 contas por jogador é do jogo** — não mexa em nada que contorne isso.

## Como rodar

```bash
npm install
npx electron main-lite.js
```

Windows é necessário: o encaixe das janelas usa API nativa do sistema.

## Como testar antes de propor

Existe um canal de **teste** que instala lado a lado com o app oficial, com dados e porta próprios —
dá pra experimentar sem arriscar o app que você usa pra jogar:

```bash
bash build-teste.sh
```

Coisas que só valem no app empacotado (não funcionam rodando do fonte): auto-update e qualquer
mudança em `vperts-ext/content.js` ou no processo principal.

Para conferir o efeito de uma mudança no estado ao vivo:

```bash
node ler.js            # líder, treinador, HP, hunt de cada tela aberta
node ler.js chaves     # que campos existem hoje no estado
```

## Mexendo na leitura do jogo

O jogo muda sem avisar, e quando muda **a leitura quebra em silêncio** — o campo some, o valor vira
nulo, o painel mostra zero e ninguém vê erro nenhum. Por isso:

- **Não invente nome de campo.** Meça antes, com `node ler.js` ou `node xatu.js --once 300`.
- **Não raspe o DOM** quando existe WebSocket ou API: metade do que parece texto está dentro do
  `<canvas>` e não existe no DOM.
- Se descobrir campo ou mensagem nova, diga **como reproduziu** (o que estava fazendo no jogo).
  Achado sem gatilho conhecido é palpite.

## Pull requests

- Um assunto por PR — é mais fácil revisar e reverter.
- Explique **o problema**, não só a solução: o que acontecia antes, o que passa a acontecer.
- Se corrigiu um bug, conte como reproduzir. Se não dá pra reproduzir, diga isso também.
- Comentário no código é bem-vindo quando explica **por que** algo é daquele jeito — sobretudo
  quando o óbvio está errado (aqui tem bastante disso, e cada um custou uma sessão inteira).

## Licença

Ao contribuir, você concorda que sua contribuição entra sob a **PolyForm Noncommercial 1.0.0**
(veja [`LICENSE.md`](LICENSE.md)): livre para uso não comercial, sem exploração comercial.
