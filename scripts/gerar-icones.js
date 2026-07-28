#!/usr/bin/env node
/**
 * Gera os ícones do app a partir de um PNG só.
 *
 * Existe porque o Android não aceita "uma imagem": o ícone adaptativo é feito de
 * CAMADAS separadas — fundo, frente e uma versão monocromática — e o sistema
 * recorta a frente com uma máscara que muda de aparelho para aparelho. Entregar
 * a arte inteira como frente faz o recorte comer as bordas do desenho em uns
 * celulares e não em outros.
 *
 * Feito com `pngjs` porque é o que existe aqui. Sem ImageMagick, sem sharp: a
 * redução é uma média de área escrita à mão, que para reduzir é melhor que
 * bilinear — cada pixel de saída é a média de todos os de entrada que caem
 * nele, em vez de uma amostra de quatro.
 *
 *   node scripts/gerar-icones.js assets/logo-fonte.png
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const entrada = process.argv[2] ?? 'assets/logo-fonte.png';
const destino = path.join(__dirname, '..', 'assets');

const origem = PNG.sync.read(fs.readFileSync(path.resolve(entrada)));

/* ------------------------------------------------------------- utilidades */

const criar = (l, a) => new PNG({ width: l, height: a });

function ler(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/**
 * Redução por média de área.
 *
 * Amostrar um pixel a cada N — que é o jeito ingênuo — descarta o resto e faz
 * as bordas do desenho virarem serrilha. A média usa todos os pixels de origem
 * que caem em cada pixel de destino, então a borda sai suave sozinha.
 *
 * A média é feita com o alfa PRÉ-MULTIPLICADO: sem isso, um pixel transparente
 * de cor preta puxaria a média das cores para o escuro mesmo sem aparecer, e o
 * desenho ganharia um contorno sujo.
 */
function reduzir(img, ladoDestino) {
  const saida = criar(ladoDestino, ladoDestino);
  const escala = img.width / ladoDestino;

  for (let y = 0; y < ladoDestino; y++) {
    const y0 = Math.floor(y * escala);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * escala));

    for (let x = 0; x < ladoDestino; x++) {
      const x0 = Math.floor(x * escala);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * escala));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < img.height; sy++) {
        for (let sx = x0; sx < x1 && sx < img.width; sx++) {
          const i = (sy * img.width + sx) * 4;
          const alfa = img.data[i + 3] / 255;
          r += img.data[i] * alfa;
          g += img.data[i + 1] * alfa;
          b += img.data[i + 2] * alfa;
          a += img.data[i + 3];
          n++;
        }
      }

      const j = (y * ladoDestino + x) * 4;
      const somaAlfa = a / 255;
      // Desfaz a pré-multiplicação. Se nada era opaco, a cor não importa.
      saida.data[j] = somaAlfa > 0 ? Math.round(r / somaAlfa) : 0;
      saida.data[j + 1] = somaAlfa > 0 ? Math.round(g / somaAlfa) : 0;
      saida.data[j + 2] = somaAlfa > 0 ? Math.round(b / somaAlfa) : 0;
      saida.data[j + 3] = Math.round(a / n);
    }
  }
  return saida;
}

/** Distância de cor simples. Suficiente para separar traço saturado de creme. */
const dist = (p, [r, g, b]) => Math.abs(p[0] - r) + Math.abs(p[1] - g) + Math.abs(p[2] - b);

/**
 * Recorta o desenho do fundo, com borda suave.
 *
 * Não é um corte seco: entre `perto` e `longe` o alfa é proporcional, o que
 * preserva a suavização que a arte já tinha. Corte seco devolveria o M com
 * degrau de serra em toda a diagonal — e as diagonais são metade deste desenho.
 */
function recortarFundo(img, fundo, perto = 40, longe = 110) {
  const saida = criar(img.width, img.height);
  img.data.copy(saida.data);

  for (let i = 0; i < saida.data.length; i += 4) {
    const d = dist([saida.data[i], saida.data[i + 1], saida.data[i + 2]], fundo);
    let alfa;
    if (d <= perto) alfa = 0;
    else if (d >= longe) alfa = 255;
    else alfa = Math.round(((d - perto) / (longe - perto)) * 255);
    saida.data[i + 3] = Math.min(saida.data[i + 3], alfa);
  }
  return saida;
}

/** Preenche tudo o que for quase branco com a cor do fundo. */
function preencherBordaBranca(img, fundo, limite = 24) {
  const saida = criar(img.width, img.height);
  img.data.copy(saida.data);
  for (let i = 0; i < saida.data.length; i += 4) {
    const quaseBranco = dist([saida.data[i], saida.data[i + 1], saida.data[i + 2]], [255, 255, 255]) <= limite;
    if (quaseBranco || saida.data[i + 3] < 250) {
      saida.data[i] = fundo[0];
      saida.data[i + 1] = fundo[1];
      saida.data[i + 2] = fundo[2];
      saida.data[i + 3] = 255;
    }
  }
  return saida;
}

/** Caixa do que não é transparente. */
function caixa(img) {
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Põe o desenho centrado numa tela quadrada, ocupando `fracao` dela.
 *
 * É aqui que mora a ZONA SEGURA do ícone adaptativo: o Android recorta a frente
 * com máscaras diferentes — círculo, quadrado arredondado, gota — e só o
 * miolo de 66% aparece em todas. O desenho é encaixado dentro disso.
 */
function encaixar(img, lado, fracao) {
  const c = caixa(img);
  const larg = c.x1 - c.x0 + 1;
  const alt = c.y1 - c.y0 + 1;

  const recortado = criar(larg, alt);
  for (let y = 0; y < alt; y++) {
    for (let x = 0; x < larg; x++) {
      const de = ((y + c.y0) * img.width + (x + c.x0)) * 4;
      const para = (y * larg + x) * 4;
      for (let k = 0; k < 4; k++) recortado.data[para + k] = img.data[de + k];
    }
  }

  // Quadrado, para a redução não distorcer o desenho.
  const ladoQuadrado = Math.max(larg, alt);
  const quadrado = criar(ladoQuadrado, ladoQuadrado);
  const dx = Math.floor((ladoQuadrado - larg) / 2);
  const dy = Math.floor((ladoQuadrado - alt) / 2);
  for (let y = 0; y < alt; y++) {
    for (let x = 0; x < larg; x++) {
      const de = (y * larg + x) * 4;
      const para = ((y + dy) * ladoQuadrado + (x + dx)) * 4;
      for (let k = 0; k < 4; k++) quadrado.data[para + k] = recortado.data[de + k];
    }
  }

  const alvo = Math.round(lado * fracao);
  const menor = reduzir(quadrado, alvo);

  const saida = criar(lado, lado);
  const off = Math.floor((lado - alvo) / 2);
  for (let y = 0; y < alvo; y++) {
    for (let x = 0; x < alvo; x++) {
      const de = (y * alvo + x) * 4;
      const para = ((y + off) * lado + (x + off)) * 4;
      for (let k = 0; k < 4; k++) saida.data[para + k] = menor.data[de + k];
    }
  }
  return saida;
}

/** Silhueta preta, para o ícone monocromático dos temas do Android 13+. */
function silhueta(img) {
  const saida = criar(img.width, img.height);
  for (let i = 0; i < img.data.length; i += 4) {
    saida.data[i] = 0;
    saida.data[i + 1] = 0;
    saida.data[i + 2] = 0;
    saida.data[i + 3] = img.data[i + 3];
  }
  return saida;
}

function solido(lado, [r, g, b]) {
  const img = criar(lado, lado);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  return img;
}

const gravar = (nome, img) => {
  const caminho = path.join(destino, nome);
  fs.writeFileSync(caminho, PNG.sync.write(img));
  console.log(`  ${nome.padEnd(32)} ${img.width}x${img.height}`);
};

/* --------------------------------------------------------------- gerar */

// A cor do fundo sai da própria arte, num ponto acima do desenho — assim ela
// acompanha a logo se a logo mudar, em vez de ficar escrita aqui.
const CREME = ler(origem, Math.round(origem.width * 0.5), Math.round(origem.height * 0.1)).slice(0, 3);
const hexCreme = '#' + CREME.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

console.log(`\nFonte: ${entrada}  (${origem.width}x${origem.height})`);
console.log(`Cor de fundo lida da arte: ${hexCreme}\n`);

const cheia = preencherBordaBranca(origem, CREME);
const soODesenho = recortarFundo(origem, CREME);

// Ícone geral: sangra até a borda. O sistema aplica o próprio arredondamento,
// e uma arte já arredondada ficaria com canto duplo.
gravar('icon.png', reduzir(cheia, 1024));
gravar('favicon.png', reduzir(cheia, 96));

// Adaptativo: fundo liso e frente encaixada na zona segura.
gravar('android-icon-background.png', solido(1024, CREME));
gravar('android-icon-foreground.png', encaixar(soODesenho, 1024, 0.6));
gravar('android-icon-monochrome.png', silhueta(encaixar(soODesenho, 1024, 0.6)));

// Abertura: só o desenho, sobre a cor que o app.json define.
gravar('splash-icon.png', encaixar(soODesenho, 512, 0.72));

console.log(`\nUse ${hexCreme} como backgroundColor do ícone adaptativo e da abertura.\n`);
