# Como publicar o Vperts Multi (e como o site pega o download)

## OS DOIS CANAIS — leia antes de qualquer build

| | **OFICIAL** (o que o usuário joga) | **TESTE** (bancada) |
|---|---|---|
| config | `electron-builder-lite.yml` | `build/gen-yml-teste.js` (derivada da oficial) |
| build | `bash build-lite.sh` | `bash build-teste.sh` |
| sai em | `dist/` | `dist-teste/` |
| instalador | `VpertsMultiLeve-Setup-<v>.exe` | `VpertsMultiTeste-Setup-<v>.exe` |
| appId | `com.vperts.multileve` | `com.vperts.multileve.teste` |
| atalho | Vperts Multi (Leve) | **Vperts Multi (TESTE)** |
| na tela | barra normal | **barra dourada escrito TESTE** |
| dados/login | `%APPDATA%\VpertsMultiLite` | `%APPDATA%\VpertsMultiLiteTeste` |
| porta debug | 9333 | 9433 |
| auto-update | sim | **desligado no código** (`CANAL_TESTE` em `main-lite.js`) |
| publicar release | sim | **NUNCA** |

Os dois **instalam lado a lado e rodam ao mesmo tempo** — por isso userData e porta de debug são
diferentes: no mesmo perfil, duas instâncias brigam pelo cache ("Unable to move the cache") e isso
já derrubou login de conta. Custo: as contas do jogo precisam ser logadas de novo no app de teste.

O canal é decidido pelo `name` do pacote (`app.getName()`), setado por `extraMetadata.name` só na
config de teste. Em dev dá pra forçar com `PMLABS_CANAL=teste`.

**Porteiro:** `node build/verifica-release.js` roda automático no fim do `build-lite.sh` e **reprova
o build** se o canal de update estiver errado, faltar algum dos 4 assets, o `latest.yml` descasar da
versão, a cópia de nome fixo estiver velha, o exe tiver marca de TESTE ou a tag já existir. Se ele
reprovar, o comando de release nem é impresso.


Fonte oficial a partir da v0.9.4: **`Vperts/poke-multi-labs`**.
Antes disso as releases saiam de `ekooll/poke-multi-labs` (conta pessoal) — ver "Migracao" no fim.

---

## 1. Gerar a versao

```bash
cd /c/dev/pokemon/labs
# subir a versao em electron-builder-lite.yml -> extraMetadata.version
bash build-lite.sh
```

Sai em `dist/`:

| arquivo | pra que serve |
|---|---|
| `VpertsMultiLeve-Setup-<v>.exe` | o instalador |
| `VpertsMultiLeve-Setup-<v>.exe.blockmap` | download diferencial do auto-update |
| `latest.yml` | **manifesto do auto-update** — sem ele o app instalado nunca acha versao nova |
| `VpertsMultiLeve-Setup.exe` | copia de nome fixo, e' **so pra isso que o site aponta** |

O build falha de proposito se o `afterPack` nao conseguir gravar o icone/versao no exe.
Conferir no log: `afterPack: ok — ProductVersion do exe = <v>`.

## 2. Publicar a release

```bash
gh release create v<v> \
  "dist/VpertsMultiLeve-Setup-<v>.exe" \
  "dist/VpertsMultiLeve-Setup-<v>.exe.blockmap" \
  dist/latest.yml \
  dist/VpertsMultiLeve-Setup.exe \
  --repo Vperts/poke-multi-labs \
  --title "Vperts Multi v<v>" --notes "o que mudou"
```

Regras que ja custaram caro:

- **Os 4 assets, sempre.** Faltou `latest.yml` = auto-update morto pra quem ja instalou.
- **Release normal, nunca pre-release.** O updater le `/releases/latest`, e o GitHub nao
  considera pre-release como "latest".
- **Nunca reaproveitar uma tag/release antiga** — sempre uma tag nova.
- Upload de ~86MB pode passar de 2 min; se o terminal cortar, esperar terminar em background.

## 3. O que o site usa (parte do Gabriel)

Uma linha no `vercel.json` do `Vperts/vp-store`:

```json
{ "source": "/multi", "destination": "https://github.com/Vperts/poke-multi-labs/releases/latest/download/VpertsMultiLeve-Setup.exe", "permanent": false }
```

Como o nome do asset e' fixo e o caminho e' `/releases/latest/`, **isso e' configurado uma vez
e nunca mais** — toda release nova ja sai por `vperts.com.br/multi` sozinha.

> O redirect atual aponta pro `PokeMultiLabs-Test.zip`, que nao existe mais: **hoje o link da 404.**
> Trocar por essa linha resolve.
>
> No vp-store, quem faz o merge do PR no `main` tem que ser a conta **Vperts** — se outra conta
> mesclar, o deploy da Vercel fica "Blocked" (limitacao do plano Hobby com repo privado).

**Na pagina de download, avisar sobre o SmartScreen.** O instalador nao e' assinado (certificado
exige CNPJ e custa), entao o Windows mostra "O Windows protegeu o seu computador". O usuario
precisa clicar em **Mais informacoes -> Executar assim mesmo**. Sem esse aviso na pagina, boa
parte das pessoas desiste achando que e' virus.

## 4. Como o usuario atualiza

Ele nao baixa de novo: o botao **Atualizar** dentro do app le o `latest.yml` da release mais nova
do `Vperts/poke-multi-labs`, baixa o instalador e reinicia ja atualizado.

---

## Migracao ekooll -> Vperts (v0.9.4, 25/07/2026)

O canal de update fica **embutido no exe instalado** (`resources/app-update.yml`), entao quem
instalou uma versao antiga continua olhando pro repo antigo pra sempre. Por isso a migracao foi
feita com o parque instalado ainda em 1 maquina.

Para nao deixar essa maquina pra tras, a v0.9.4 e' publicada **tambem** em
`ekooll/poke-multi-labs`, uma ultima vez (mesmos assets). Quem estava na 0.9.2/0.9.3 clica em
Atualizar, recebe a 0.9.4 e a partir dai ja aponta pro Vperts.

Depois disso o repo antigo pode ser arquivado — **mas so depois** dessa release-ponte existir.

Detalhe da ponte: o `appId` mudou (`com.vperslab.*` -> `com.vperts.*`), entao o Windows trata a
0.9.4 como um app novo e ela **instala do lado** da antiga em vez de por cima. E' uma vez so:
desinstalar "Vperts Multi (Leve)" antigo pelo Painel de Controle. As sessoes das contas nao se
perdem (dependem do `productName`, que nao mudou).
