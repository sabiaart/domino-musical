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
- O computador joga uma peça válida por sorteio (sem níveis de dificuldade),
  esperando 5 s antes de jogar.
- Carroça liga sempre pelo meio e a cadeia nunca vira nela.
- Botões ⟲ ⟳ (ao lado do ▶) giram o desenho da mesa 90°, só na tela: a
  cadeia é montada na área com largura e altura trocadas e cada peça é girada
  (`girarRect` no Board); as letras ficam de pé e Horizontal/Vertical seguem a
  tela. O giro não fica salvo.
- Nomes das notas nas peças maiores (0,44 da unidade), em branco metálico com
  brilho (pedido do Pedro).
- Cadeia que passa da área da mesa (comum no celular) não rola: a mesa inteira
  encolhe junto até caber (zoom para longe, `zoomParaCaber` no Board). As peças
  não mudam de lugar entre si (pedido do Pedro).
- **Peça já posta nunca muda de lugar nem de forma.** A cadeia nasce da primeira
  peça, no centro, e cresce pelas pontas na ordem das jogadas (`seq`).
- Peça de notas diferentes: o jogador escolhe horizontal ou vertical, entre as
  posições que não encurralam a ponta.
- Sempre perguntar quando houver escolha (pedido do Pedro): peça que encaixa nas
  duas pontas pergunta Esquerda/Direita, mesmo com as duas pontas na mesma nota;
  e pergunta Horizontal/Vertical quando as duas posições servem.
- O fim de jogo não cobre a mesa: dá para continuar tocando a cadeia. O resultado
  ocupa o lugar da mão, sem tirar altura da mesa. Os ajustes de som ficam atrás
  do botão "Som", num painel por cima, pelo mesmo motivo (pedido do Pedro).

## Decisões de som

- Extensão: Sol 1 a Dó 5 **na numeração do Pedro, em que o Dó central é o Dó 3**
  (98 a 1046 Hz; no código, com Dó 4 central, G2 a C6). Ao falar de oitavas com
  ele, usar essa numeração. Dó, Sol, Lá e Si têm quatro alturas; Ré, Mi e Fá,
  três. Antes foi Sol 1 a Fá 4; Fá 2 a Mi 4 e Fá 2 a Si 4 estavam na numeração
  com Dó 4 central. Modos de intervalo: 1ª–4ª, 5ª–8ª e misto, trocáveis
  durante a partida.
- Prioridade: o intervalo entre as duas notas da mesma peça sempre segue o modo;
  entre peças, a oitava pode mudar para manter isso.
- Peça jogada: 2 s entre o começo de uma nota e o da seguinte (o Pedro já
  testou 1 s, 1,2 s, 1,5 s e 1,8 s); o computador espera 5 s antes da peça seguinte. A articulação decide quanto desse
  tempo a nota soa.
- Carroça toca a nota duas vezes.
- Pausar ou parar deixa a nota em curso terminar, para evitar estalo.
- Botões ▶/⏸, ⏹ e R sempre visíveis no canto superior esquerdo da mesa (pedido do
  Pedro; já estiveram no inferior esquerdo); parado, o ▶ toca a mesa inteira, como o Espaço. No celular são menores
  e mais discretos (24 px em vez de 34). O botão R repete o último trecho como a
  tecla R; antes só aparecia em telas de toque, hoje aparece também no computador.
- Teclado: Espaço pausa/continua a cadeia e, parada, toca a mesa inteira desde
  a primeira ponta. R repete do começo o último trecho tocado, depois de 1 s de
  silêncio (os dois toques no Espaço foram trocados pelo R a pedido do Pedro).
  Não agem dentro de campos de texto ou listas, nem com Ctrl/Alt; nas barras de
  velocidade e volume funcionam (elas ficam selecionadas depois de arrastar), e
  a lista de timbres solta a seleção depois da escolha.
- Velocidade de 0,05 s a 3,5 s (o Pedro já testou 3 s e 4 s), padrão 1,5 s quando a
  barra nunca foi mexida; pico das notas perto de 0 dB, com limitador.
- Articulação (pedido do Pedro): Staccato (no máximo 0,2 s), Desligado (padrão;
  50% do tempo até a seguinte, mais perto do staccato a pedido do Pedro; 80%
  ficou ligado demais, com decay suave: cai a 70% e some em até
  0,25 s) e Legato (ataques o mais emendados possível, pedido do Pedro: a nota segura o
  volume cheio até a seguinte e as duas trocam em 0,06 s, com a entrada da
  seguinte encurtada para caber nessa troca; antes durava o tempo até a seguinte
  mais 0,15 s, caindo a 70%). Vale para a peça jogada e a cadeia,
  não para a prévia do mouse. Já houve Normal (nota sumindo em até 1,2 s) e um
  Legato de 90%, retirados.
- Timbre: Clarinete (padrão), Violoncelo, Harpa celta (resgatada a
  pedido do Pedro), Órgão de igreja (`orgao`) e Piano de concerto (`piano`). A harpa e o piano não sustentam: vai morrendo desde o toque, e a
  articulação decide quando a corda é abafada (até 4 s no legato). No código, o id do
  clarinete continua `madeiras`, para não perder a escolha salva. São sintetizados, não gravações, e valem também para a prévia
  do mouse. Já foram testados e retirados a pedido do Pedro: Simples, cordas,
  guitarra elétrica, trompete, trombone, flautas de bambu e de
  madeira, marimba, violino e voz.

## Celular

- Deitado: layout próprio, com 48 px livres nas laterais e sem margem embaixo
  (pedido do Pedro). O Android foi aprovado.
- Para sobrar mesa (pedido do Pedro): sem a frase de instrução embaixo da mão,
  cabeçalho em pé numa linha só (o placar mostra só o monte), e o Sair fica
  pequeno no canto de cima à direita, fora da fila dos botões.
- Escolha Esquerda/Direita e Horizontal/Vertical: no meio da mesa e menor.
- O painel de Som fica preso logo acima dos botões (no tablet cobria a fila de
  cima); no celular deitado continua preso à coluna da direita.

## Pendências e limitações

- A correção da faixa vazia embaixo no iPhone deitado (`position: fixed` na tela
  de jogo) não teve retorno confirmado.
- A cadeia ainda pode se partir, raramente, no celular: costuma ser duas carroças
  seguidas perto da borda.
- O multiplayer não foi testado no navegador depois das últimas mudanças.
- O painel de navegador embutido no app não toca áudio: o som só pode ser
  conferido pelo Pedro, em um navegador normal.
