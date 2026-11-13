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
- O fim de jogo não cobre a mesa: dá para continuar tocando a cadeia. O resultado
  ocupa o lugar da mão, sem tirar altura da mesa. Os ajustes de som ficam atrás
  do botão "Som", num painel por cima, pelo mesmo motivo (pedido do Pedro).

## Decisões de som

- Extensão: Fá 2 a Si 4 (ampliada do Mi 4 a pedido do Pedro). Modos de intervalo: 1ª–4ª, 5ª–8ª e misto, trocáveis
  durante a partida.
- Prioridade: o intervalo entre as duas notas da mesma peça sempre segue o modo;
  entre peças, a oitava pode mudar para manter isso.
- Carroça toca a nota duas vezes.
- Pausar ou parar deixa a nota em curso terminar, para evitar estalo.
- Botões ▶/⏸ e ⏹ sempre visíveis no canto inferior esquerdo da mesa (pedido do
  Pedro); parado, o ▶ toca a mesa inteira, como o Espaço. No celular são menores
  e mais discretos (24 px em vez de 34).
- Teclado: Espaço pausa/continua a cadeia e, parada, toca a mesa inteira desde
  a primeira ponta. R repete do começo o último trecho tocado, depois de 1 s de
  silêncio (os dois toques no Espaço foram trocados pelo R a pedido do Pedro).
  Não agem dentro de campos de texto ou listas, nem com Ctrl/Alt; nas barras de
  velocidade e volume funcionam (elas ficam selecionadas depois de arrastar), e
  a lista de timbres solta a seleção depois da escolha.
- Velocidade de 0,1 s a 3 s; pico das notas perto de 0 dB, com limitador.
- Articulação: Normal (padrão, o som de antes) e Legato; o staccato foi retirado
  a pedido do Pedro. Vale para as
  notas da peça jogada e da cadeia, não para a prévia do mouse. No legato a nota
  dura 90% do tempo até a seguinte (o Pedro achou que emendar era legato demais),
  com decay suave (cai a 70% e some em até 0,25 s), então é a única forma de a
  nota passar de 1,2 s.
- Timbre: Clarinete (padrão), Trombone, Violoncelo e Harpa celta (resgatada a
  pedido do Pedro; morre sozinha: no legato não sustenta e dura até 1,5 s). No código, os ids do
  clarinete e do trombone continuam `madeiras` e `metais`, para não perder a
  escolha salva. São sintetizados, não gravações, e valem também para a prévia
  do mouse. Já foram testados e retirados a pedido do Pedro: Simples, cordas,
  guitarra elétrica, trompete, flautas de bambu e de madeira,
  marimba, violino e voz.

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
