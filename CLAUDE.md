# Dominó Musical — contexto para o Claude

Regras do jogo, stack e comandos estão no `README.md`. Aqui ficam as combinações
de trabalho e as decisões que não dá para deduzir do código.

## Como trabalhar com o Pedro

- Responder em português do Brasil, em linguagem simples.
- **Não commitar nem publicar sem o Pedro pedir.** Ele costuma testar em
  localhost antes; push na `main` publica o site (GitHub Pages).
- Rodar `npm test` e `npm run build` antes de publicar.
- Conta do GitHub: **sabiaart** (repo `sabiaart/domino-musical`). Erro 403 citando
  `tieart` é credencial errada em cache: rodar `gh auth login` e `gh auth setup-git`.
- Site: https://sabiaart.github.io/domino-musical/
- Mudanças em `server/` ou no motor do jogo também afetam o servidor multiplayer
  no Render; confirmar se o deploy de lá rodou.

## Decisões do jogo

- Cada partida é um jogo isolado: sem pontos e sem rodadas. Quem bate vence; jogo
  fechado: vence quem tem menos peças; empate se igual.
- Começa a carroça mais grave (Dó-Dó, Ré-Ré…). Ninguém com carroça: compram do
  monte, um de cada vez, até aparecer uma.
- O computador joga uma peça válida por sorteio (sem níveis de dificuldade).
- Carroça liga sempre pelo meio e a cadeia nunca vira nela.
- **Peça já posta nunca muda de lugar nem de forma.** A cadeia nasce da primeira
  peça, no centro, e cresce pelas pontas na ordem das jogadas (`seq`).
- Peça de notas diferentes: o jogador escolhe horizontal ou vertical, entre as
  posições que não encurralam a ponta.
- O fim de jogo não cobre a mesa: dá para continuar tocando a cadeia.

## Decisões de som

- Extensão: Fá 2 a Mi 4. Modos de intervalo: 1ª–4ª, 5ª–8ª e misto, trocáveis
  durante a partida.
- Prioridade: o intervalo entre as duas notas da mesma peça sempre segue o modo;
  entre peças, a oitava pode mudar para manter isso.
- Carroça toca a nota duas vezes.
- Pausar ou parar deixa a nota em curso terminar, para evitar estalo.
- Velocidade de 0,1 s a 3 s; pico das notas perto de 0 dB, com limitador.

## Celular

- Deitado: layout próprio, com 48 px livres nas laterais e sem margem embaixo
  (pedido do Pedro). O Android foi aprovado.

## Pendências e limitações

- A correção da faixa vazia embaixo no iPhone deitado (`position: fixed` na tela
  de jogo) não teve retorno confirmado.
- A cadeia ainda pode se partir, raramente, no celular: costuma ser duas carroças
  seguidas perto da borda.
- O multiplayer não foi testado no navegador depois das últimas mudanças.
- O painel de navegador embutido no app não toca áudio: o som só pode ser
  conferido pelo Pedro, em um navegador normal.
