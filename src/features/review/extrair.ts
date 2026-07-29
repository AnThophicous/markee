/**
 * Tirar cartas de uma nota que já está escrita.
 *
 * Sem isto a revisão espaçada não sai do papel, e não é exagero: o motivo pelo
 * qual quase ninguém usa Anki não é o algoritmo, é que criar cartas dá um
 * trabalho enorme. Quem já escreveu a nota não vai reescrever tudo em forma de
 * pergunta — então o app tem que ler o que já está lá.
 *
 * Função pura sobre o texto, sem banco e sem IA. A IA custa crédito e depende
 * de internet; e a verdade é que a maior parte de um caderno de aula já vem em
 * formato de carta sem ninguém ter planejado isso. "Mitocôndria: organela da
 * respiração celular" É uma carta. Só falta alguém reparar.
 */

export type Sugestao = {
  frente: string;
  verso: string;
  /** De onde veio, para a tela agrupar e a pessoa entender o padrão. */
  origem: 'definicao' | 'titulo' | 'lista' | 'destaque';
};

/** Menor que isto não é resposta, é fragmento. */
const VERSO_MINIMO = 3;
/** Maior que isto não é carta, é parágrafo — ninguém memoriza um bloco. */
const VERSO_MAXIMO = 400;
const FRENTE_MAXIMA = 120;

/**
 * Os quatro padrões que valem a pena.
 *
 * Já tentei mais: pergunta terminada em "?", frase com "significa", parênteses
 * com sigla. Todos geravam mais lixo do que carta — e uma sugestão ruim custa
 * caro, porque a pessoa precisa LER para descartar. Quatro padrões precisos
 * valem mais que dez aproximados.
 */
export function sugerirCartas(markdown: string, limite = 40): Sugestao[] {
  const linhas = markdown.split('\n');
  const achadas: Sugestao[] = [];
  const jaVistas = new Set<string>();

  const guardar = (frente: string, verso: string, origem: Sugestao['origem']) => {
    const f = limpar(frente);
    const v = limpar(verso);
    if (!serve(f, v)) return;
    // A mesma frente duas vezes vira duas cartas que competem entre si: você
    // responde uma, a outra volta no mesmo dia e parece um defeito.
    const chave = f.toLowerCase();
    if (jaVistas.has(chave)) return;
    jaVistas.add(chave);
    achadas.push({ frente: f, verso: v, origem });
  };

  let dentroDeCodigo = false;

  for (let i = 0; i < linhas.length && achadas.length < limite; i += 1) {
    const linha = linhas[i];

    // Bloco de código não vira carta. É o único trecho da nota onde os dois
    // pontos quase sempre são sintaxe, não definição.
    if (linha.trim().startsWith('```')) {
      dentroDeCodigo = !dentroDeCodigo;
      continue;
    }
    if (dentroDeCodigo) continue;

    // 1. Título seguido de conteúdo: "## Fotossíntese" + o parágrafo abaixo.
    const titulo = linha.match(/^(#{1,6})\s+(.+)$/);
    if (titulo) {
      const corpo = primeiroParagrafo(linhas, i + 1);
      if (corpo) guardar(titulo[2], corpo, 'titulo');
      continue;
    }

    const item = linha.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);
    const conteudo = item ? item[1] : linha;

    // 2. Destaque no começo: "**Mitocôndria** é a organela..."
    const destaque = conteudo.match(/^\*\*(.+?)\*\*[\s:—-]*(.+)$/);
    if (destaque) {
      guardar(destaque[1], destaque[2], 'destaque');
      continue;
    }

    // 3. Definição com dois pontos ou travessão: "Mitocôndria: organela..."
    //    O limite de tamanho na frente é o que separa definição de frase comum
    //    — "Na aula de hoje o professor disse: ..." não é carta.
    const definicao = conteudo.match(/^([^:—]{2,80})\s*[:—]\s*(.+)$/);
    if (definicao && !pareceFrase(definicao[1])) {
      guardar(definicao[1], definicao[2], item ? 'lista' : 'definicao');
      continue;
    }
  }

  return achadas;
}

/** O parágrafo logo abaixo do título, parando no próximo título ou no vazio. */
function primeiroParagrafo(linhas: string[], inicio: number): string {
  const partes: string[] = [];
  for (let i = inicio; i < linhas.length; i += 1) {
    const l = linhas[i].trim();
    if (!l) break;
    if (/^#{1,6}\s/.test(l)) break;
    partes.push(l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''));
    if (partes.join(' ').length > VERSO_MAXIMO) break;
  }
  return partes.join(' ');
}

/**
 * Frase, e não termo.
 *
 * O que distingue "Mitocôndria" de "Então o professor falou" é o número de
 * palavras e a presença de verbo conjugado no começo. Sem esta peneira, toda
 * frase com dois pontos no meio da nota vira uma carta impossível de responder.
 */
function pareceFrase(texto: string): boolean {
  const palavras = texto.trim().split(/\s+/);
  if (palavras.length > 8) return true;
  return /^(e|mas|então|aí|porque|quando|se|que|para|com|no|na|em|de|do|da|os|as)\b/i.test(
    texto.trim()
  );
}

function limpar(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '');
}

function serve(frente: string, verso: string): boolean {
  if (frente.length < 2 || frente.length > FRENTE_MAXIMA) return false;
  if (verso.length < VERSO_MINIMO || verso.length > VERSO_MAXIMO) return false;
  // Frente igual ao verso é carta que se responde sozinha.
  if (frente.toLowerCase() === verso.toLowerCase()) return false;
  return true;
}

/**
 * As cartas que a aula transcrita rende.
 *
 * Só o que a IA marcou como conteúdo. "Tarefa" já virou lembrete e "ruído" é
 * chamada e conversa paralela — transformar isso em carta faria a pessoa
 * revisar, daqui a seis dias, que o professor mandou o Fulano calar a boca.
 */
export function sugerirDaAula(
  trechos: { texto: string; tipo: string }[],
  limite = 40
): Sugestao[] {
  const conteudo = trechos
    .filter((t) => t.tipo === 'conteudo')
    .map((t) => t.texto)
    .join('\n');
  return sugerirCartas(conteudo, limite);
}
