# 🎵 Dominó Musical

Dominó clássico ("Draw" / com compra) em versão musical: no lugar dos números,
as peças usam as **7 notas** — Dó, Ré, Mi, Fá, Sol, Lá, Si — cada uma com sua
cor, e nota encaixa com nota igual.

A cadeia anda pela mesa em quatro direções: segue reto ou **vira para cima ou
para baixo por sorteio**, como numa mesa de verdade, e fica sempre centralizada
na área de jogo. O sorteio é fixo por rodada — a mesma mesa desenha sempre
igual, então as peças não pulam de lugar.

O tabuleiro soa: ao entrar na mesa, a peça **toca as suas notas** — primeiro a
que encaixou na ponta, depois a que ficou de fora como nova ponta, com um
segundo entre elas (carroça toca uma vez só). **Passar o mouse** sobre metade
de uma peça toca aquela nota, então dá para "tocar" a cadeia correndo o mouse
por ela. O botão 🔊 silencia tudo.

Modos de jogo:

- **Single-player** — você contra o computador, com 3 níveis de dificuldade
- **Multiplayer online** — 2 a 4 jogadores em salas com código compartilhável (Socket.io)

## Stack

- **Frontend:** React + Vite, CSS puro
- **Backend (multiplayer):** Node.js + Socket.io — salas em memória, sem banco de dados
- **Testes:** Vitest (lógica do jogo em módulos puros, `src/game/`)

## Instalação

```bash
npm install
```

## Como rodar

### Single-player (só o cliente)

```bash
npm run dev
```

Abra o endereço mostrado (geralmente `http://localhost:5173`).

### Multiplayer

Suba também o servidor de tempo real, em outro terminal:

```bash
npm run server
```

O servidor ouve na porta **3210** (configurável via variável `PORT`). O cliente
se conecta por padrão a `http://<host-da-página>:3210`; para apontar para outro
endereço, defina `VITE_SERVER_URL` (por exemplo, num arquivo `.env`):

```
VITE_SERVER_URL=http://meu-servidor:3210
```

Para jogar em rede local, os outros jogadores acessam o Vite pelo IP da sua
máquina (`npm run dev -- --host`) e o cliente achará o servidor no mesmo IP.

### Hospedagem

- **Cliente:** GitHub Pages, com deploy automático a cada push na `main`
  (`.github/workflows/deploy.yml`). O build lê a variável de repositório
  `VITE_SERVER_URL` para apontar ao servidor multiplayer publicado.
- **Servidor multiplayer:** Render (`render.yaml`, plano gratuito). Atenção:
  no plano gratuito o serviço hiberna após ~15 min sem uso e a primeira
  conexão pode levar até 1 minuto para acordá-lo.

### Testes

```bash
npm test
```

## Regras implementadas

- 28 peças (Dó-Dó a Si-Si); cada jogador começa com **7 peças**; o resto vai para o monte.
- Cada nota vale pontos na contagem: **Dó=0, Ré=1, Mi=2, Fá=3, Sol=4, Lá=5, Si=6**
  (a mesma escala do dominó tradicional, 0 a 6).
- Começa quem tiver a **maior carroça** (dupla); sem carroças, a peça de maior soma.
  A peça inicial é jogada automaticamente.
- Joga-se encaixando peças nas **duas pontas** da mesa — Dó com Dó, Ré com Ré, etc.
- Para jogar uma peça destacada: **arraste-a** até a zona de encaixe que aparece
  na ponta da mesa, ou dê **dois cliques** para ela ir sozinha (se encaixar nas
  duas pontas, o jogo pergunta qual).
- Sem jogada possível: **compra** do monte até conseguir; monte vazio: **passa** a vez.
- A rodada termina quando alguém **bate** (fica sem peças) ou quando o jogo
  **fecha** (ninguém consegue jogar e o monte acabou) — nesse caso vence a menor
  mão; empate na menor mão: ninguém pontua.
- O vencedor da rodada soma os **pontos das mãos dos perdedores**.
- A partida vai até **100 pontos**.

## Multiplayer — detalhes

- **Criar sala** gera um código de 5 letras/números (sem caracteres ambíguos).
- Até **4 jogadores** por sala; o anfitrião (👑) inicia a partida com 2+.
- Se um jogador **cair**, o jogo pausa por **60 segundos** aguardando reconexão
  (a sessão fica no navegador — basta reabrir a página). Se não voltar:
  - sala com 2 jogadores → a partida é encerrada;
  - sala com 3–4 → as peças dele voltam ao monte e o jogo continua.

## Estrutura

```
src/game/       lógica pura e testável (peças, mesa, regras, pontuação, motor, IA)
src/components/ interface React (mesa em serpentina, mão, placar, lobby…)
src/hooks/      integração UI ↔ motor (single-player) e UI ↔ socket (multiplayer)
server/         servidor Socket.io autoritativo com salas em memória
```
