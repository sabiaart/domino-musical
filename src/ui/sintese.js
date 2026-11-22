// Peças de síntese usadas pelos timbres (ver VOZES em sound.js).
//
// - Harpa e piano digital são calculados amostra por amostra uma vez por nota
//   e guardados: a harpa é uma corda simulada (Karplus-Strong) e o piano
//   digital é FM, como nos teclados elétricos clássicos.
// - Sala: um eco curto, comum a todas as notas, para o som não ficar "seco".
// - Ruído: sopro do clarinete, arco do violoncelo e o "chiff" dos tubos.

const porContexto = new WeakMap();

function cacheDe(audio) {
  let c = porContexto.get(audio);
  if (!c) {
    c = { ondas: new Map(), cordas: new Map(), salas: new Map(), ruido: null };
    porContexto.set(audio, c);
  }
  return c;
}

// Onda com os harmônicos pedidos (amplitude de cada múltiplo da nota).
export function ondaPeriodica(audio, nome, harmonicos) {
  const c = cacheDe(audio);
  let onda = c.ondas.get(nome);
  if (!onda) {
    const real = new Float32Array(harmonicos.length + 1);
    const imag = new Float32Array(harmonicos.length + 1);
    harmonicos.forEach((a, i) => {
      imag[i + 1] = a;
    });
    onda = audio.createPeriodicWave(real, imag);
    c.ondas.set(nome, onda);
  }
  return onda;
}

// Dois segundos de ruído branco, tocados em laço quando preciso.
export function ruido(audio) {
  const c = cacheDe(audio);
  if (!c.ruido) {
    const n = Math.floor(audio.sampleRate * 2);
    c.ruido = audio.createBuffer(1, n, audio.sampleRate);
    const d = c.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return c.ruido;
}

// Resposta de uma sala: ruído que some em `t60` segundos, perdendo os agudos
// mais depressa que os graves, com alguns reflexos logo no começo.
export function respostaDaSala(sr, segundos = 2.4, t60 = 2) {
  const n = Math.floor(sr * segundos);
  const pre = Math.floor(0.015 * sr);
  const canais = [new Float32Array(n), new Float32Array(n)];
  const reflexos = [0.011, 0.019, 0.027, 0.037, 0.049, 0.063];
  canais.forEach((d, ch) => {
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const a = 0.8 * Math.exp(-t * 2.2) + 0.08;
      lp += a * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.exp((-6.91 * t) / t60);
    }
    reflexos.forEach((r, k) => {
      const i = pre + Math.floor((r + ch * 0.003 * (k % 2 ? 1 : -1)) * sr);
      if (i > 0 && i < n) d[i] += (k % 2 ? -0.5 : 0.5) * (1 - k * 0.1);
    });
  });
  return canais;
}

// Entrada do eco da sala que sai em `destino` (uma por destino).
export function sala(audio, destino) {
  const c = cacheDe(audio);
  let entrada = c.salas.get(destino);
  if (!entrada) {
    const canais = respostaDaSala(audio.sampleRate);
    const ir = audio.createBuffer(2, canais[0].length, audio.sampleRate);
    canais.forEach((d, ch) => ir.getChannelData(ch).set(d));
    const conv = audio.createConvolver();
    conv.buffer = ir;
    entrada = audio.createGain();
    entrada.connect(conv).connect(destino);
    c.salas.set(destino, entrada);
  }
  return entrada;
}

function normalizar(out) {
  let pico = 0;
  for (let i = 0; i < out.length; i++) pico = Math.max(pico, Math.abs(out[i]));
  if (pico > 0) for (let i = 0; i < out.length; i++) out[i] /= pico;
  return out;
}

// Corda de harpa (Karplus-Strong): um pulso de ruído suave circula numa linha
// de atraso do tamanho de um período e perde um pouco de agudo a cada volta.
// Graves soam por mais tempo que agudos, como numa harpa de verdade.
export function renderHarpa(sr, freq, segundos) {
  const t60 = 6 * Math.pow(98 / freq, 0.6); // ~6 s no Sol 1, ~1,4 s no Dó 5
  const n = Math.ceil(sr * Math.min(segundos, t60 * 1.1));
  const out = new Float32Array(n);
  const P = sr / freq;
  // Atraso total = N (linha) + 0,5 (média de duas amostras) + fração (passa-tudo).
  let N = Math.floor(P - 0.5);
  let frac = P - 0.5 - N;
  if (frac < 0.2) {
    N -= 1;
    frac += 1;
  }
  const C = (1 - frac) / (1 + frac);
  const perda = Math.pow(10, -3 / (freq * t60)) / Math.cos((Math.PI * freq) / sr);
  const g = Math.min(0.99995, perda);

  // Dedo: ruído suavizado, pinçado a ~28% do comprimento da corda.
  const pulso = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += 0.45 * (Math.random() * 2 - 1 - lp);
    pulso[i] = lp;
  }
  const linha = new Float32Array(N);
  const ponto = Math.max(1, Math.round(N * 0.28));
  let media = 0;
  for (let i = 0; i < N; i++) {
    linha[i] = pulso[i] - 0.9 * (i >= ponto ? pulso[i - ponto] : 0);
    media += linha[i];
  }
  media /= N;
  for (let i = 0; i < N; i++) linha[i] -= media;

  let idx = 0;
  let anterior = 0;
  let apEntrada = 0;
  let apSaida = 0;
  for (let i = 0; i < n; i++) {
    const y = linha[idx];
    out[i] = y;
    const m = g * 0.5 * (y + anterior);
    anterior = y;
    const ap = C * m + apEntrada - C * apSaida;
    apEntrada = m;
    apSaida = ap;
    linha[idx] = ap;
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  return normalizar(out);
}

// Piano digital: o som dos teclados elétricos clássicos, feito por FM (uma
// onda modulando a frequência da outra). O corpo é uma portadora na nota com
// um modulador na mesma frequência: o brilho (índice) começa alto e vai
// fechando, e o som fica redondo. Um segundo modulador, bem agudo e curto, dá
// o "plim" metálico do ataque. Graves duram mais que agudos.
export function renderPianoDigital(sr, freq, segundos) {
  const t60 = 7 * Math.pow(98 / freq, 0.45); // ~7 s no Sol 1, ~2,4 s no Dó 5
  const n = Math.ceil(sr * Math.min(segundos, t60 * 0.9));
  const out = new Float32Array(n);
  const dt = 1 / sr;
  const tauAmp = t60 / 6.91;
  // Brilho menor nos agudos, para não ficar estridente.
  const brilho = 1.6 * Math.pow(98 / freq, 0.15);
  const tauBrilho = 0.35;
  const plimHz = Math.min(freq * 14, sr * 0.4);
  const tauPlim = 0.02;
  let fase = 0;
  let faseMod = 0;
  let fasePlim = 0;
  const w = 2 * Math.PI * freq * dt;
  const wPlim = 2 * Math.PI * plimHz * dt;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const indice = 0.25 + brilho * Math.exp(-t / tauBrilho);
    const plim = 0.9 * Math.exp(-t / tauPlim);
    const mod = indice * Math.sin(faseMod) + plim * Math.sin(fasePlim);
    // Entrada de 2 ms, para o toque não estalar.
    const entrada = Math.min(1, t / 0.002);
    out[i] = entrada * Math.exp(-t / tauAmp) * Math.sin(fase + mod);
    fase += w;
    faseMod += w;
    fasePlim += wPlim;
  }
  return normalizar(out);
}

const RENDER = { harpa: renderHarpa, pianoDigital: renderPianoDigital };

// Corda já calculada para esta nota (calcula e guarda na primeira vez).
export function corda(audio, tipo, freq, segundos) {
  const c = cacheDe(audio);
  const chave = `${tipo}:${freq.toFixed(2)}`;
  let buf = c.cordas.get(chave);
  if (!buf) {
    const dados = RENDER[tipo](audio.sampleRate, freq, segundos);
    buf = audio.createBuffer(1, dados.length, audio.sampleRate);
    buf.getChannelData(0).set(dados);
    c.cordas.set(chave, buf);
  }
  return buf;
}

// Calcula aos poucos, sem travar a tela, as cordas de todas as notas.
export function aquecerCordas(audio, tipo, freqs, segundos) {
  const c = cacheDe(audio);
  const faltam = freqs.filter((f) => !c.cordas.has(`${tipo}:${f.toFixed(2)}`));
  const passo = () => {
    const f = faltam.shift();
    if (f === undefined) return;
    corda(audio, tipo, f, segundos);
    setTimeout(passo, 15);
  };
  setTimeout(passo, 50);
}
