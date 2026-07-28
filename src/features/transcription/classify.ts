/**
 * Separar, numa aula transcrita, o que vira nota do que é ruído.
 *
 * Uma aula de cinquenta minutos transcrita crua é inútil: vem com chamada,
 * "abram o caderno", conversa paralela, piada e repetição. O que a pessoa quer
 * é a explicação, e principalmente a TAREFA — "prova dia 12", "entregar o
 * relatório na sexta" —, que é o que ela mais perde quando não anota.
 *
 * A REGRA QUE MANDA EM TUDO AQUI: nunca perder o que foi dito. A classificação
 * é um palpite de um modelo, e palpite erra. Se ele devolver lixo, devolver
 * metade, ou não devolver nada, o texto original volta inteiro — marcado como
 * conteúdo, que é o palpite seguro. Um app que engole trinta minutos de aula
 * porque a classificação falhou é pior do que um app que não classifica.
 */

export type TipoDeTrecho =
  /** Explicação, definição, matéria. Vira o corpo da nota. */
  | 'conteudo'
  /** Prazo, prova, entrega. Vira destaque e pode virar lembrete. */
  | 'tarefa'
  /** Chamada, conversa paralela, repetição. Fica escondido, mas não some. */
  | 'ruido';

export type Trecho = {
  texto: string;
  tipo: TipoDeTrecho;
  /** Data que o modelo reconheceu na tarefa, em ISO. Ausente se não houver. */
  prazo?: string;
};

const TIPOS: TipoDeTrecho[] = ['conteudo', 'tarefa', 'ruido'];

/**
 * A instrução mandada ao modelo.
 *
 * Três decisões que mudam o resultado:
 *
 * PEDE PARA COPIAR, não resumir. Resumo perde o jeito de falar do professor e
 * inventa o que não foi dito. Quem quiser resumo pede depois, em cima da nota
 * já limpa.
 *
 * PROÍBE DESCARTAR. O modelo não escolhe o que apagar; ele ROTULA tudo. O que
 * for ruído continua no arquivo, apenas recolhido. Deixar o modelo decidir o
 * que sumir é dar a ele o poder de apagar a aula de alguém.
 *
 * MANDA O JSON SOZINHO. Sem isto os modelos embrulham em cerca de markdown e
 * escrevem "Claro! Aqui está:" na frente — o que o leitor daqui aguenta, mas
 * cada palavra a mais é um token pago à toa.
 */
export function promptDeClassificacao(texto: string, hoje = new Date()): string {
  const data = hoje.toISOString().slice(0, 10);

  return [
    'Você recebe a transcrição bruta de uma aula, em português.',
    'Separe o texto em trechos consecutivos e rotule cada um:',
    '',
    '- "conteudo": explicação, definição, matéria, exemplo resolvido.',
    '- "tarefa": prova, prazo, entrega, trabalho, página do livro para estudar.',
    '- "ruido": chamada, conversa paralela, piada, repetição, organização da sala.',
    '',
    'Regras:',
    '1. COPIE o texto original em cada trecho. Não resuma, não reescreva, não corrija.',
    '2. Não descarte nada. Todo o texto tem de aparecer em algum trecho.',
    '3. Junte falas seguidas do mesmo tipo num trecho só.',
    `4. Em "tarefa", se houver data, inclua "prazo" no formato AAAA-MM-DD. Hoje é ${data}.`,
    '5. Responda SOMENTE o JSON, sem cercas de código e sem texto antes ou depois.',
    '',
    'Formato: {"trechos":[{"texto":"...","tipo":"conteudo"},{"texto":"...","tipo":"tarefa","prazo":"2026-08-12"}]}',
    '',
    'Transcrição:',
    texto,
  ].join('\n');
}

/**
 * Acha o JSON dentro da resposta.
 *
 * Modelos embrulham em cerca de markdown, escrevem uma saudação antes, ou as
 * duas coisas. Pedir para não fazer isso reduz, não elimina — e uma resposta
 * boa perdida por causa de três crases seria um erro caro e invisível.
 *
 * Procura do primeiro `{` ao último `}`: é o recorte que sobrevive a saudação
 * na frente, cerca em volta e comentário no fim, tudo ao mesmo tempo.
 */
function recortarJson(bruto: string): string | null {
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;
  return bruto.slice(inicio, fim + 1);
}

/**
 * Reduz o texto ao que importa para comparar cobertura: só letras e números,
 * minúsculos, separados por um espaço.
 *
 * A pontuação SAI porque o modelo a reescreve — ele junta falas e conserta
 * vírgula. Mantendo-a, "celular." e "celular" contariam como palavras
 * diferentes, e uma resposta que preservou tudo apareceria como se tivesse
 * perdido metade. O alarme dispararia em toda resposta boa, e um alarme que
 * sempre toca é um alarme que se aprende a ignorar.
 */
const normalizar = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Lê a resposta do modelo. NUNCA lança, NUNCA perde texto.
 *
 * Devolve sempre algo utilizável:
 *   - resposta boa      -> os trechos classificados
 *   - resposta quebrada -> o texto original inteiro, como conteúdo
 *   - cobertura parcial -> os trechos, MAIS o que ficou de fora
 *
 * O terceiro caso é o perigoso e o mais difícil de notar. Uma resposta que
 * parece perfeita mas cobre 60% do que foi dito passa em qualquer conferência
 * de formato — e a pessoa só descobre semanas depois, quando procura na nota
 * algo que o professor falou e não está lá.
 */
export function lerClassificacao(resposta: string, textoOriginal: string): Trecho[] {
  const inteiro = (): Trecho[] =>
    textoOriginal.trim() ? [{ texto: textoOriginal.trim(), tipo: 'conteudo' }] : [];

  const recorte = recortarJson(resposta ?? '');
  if (!recorte) return inteiro();

  let dados: unknown;
  try {
    dados = JSON.parse(recorte);
  } catch {
    return inteiro();
  }

  const lista = (dados as { trechos?: unknown })?.trechos;
  if (!Array.isArray(lista)) return inteiro();

  const trechos: Trecho[] = [];
  for (const bruto of lista) {
    const item = bruto as { texto?: unknown; tipo?: unknown; prazo?: unknown };
    const texto = typeof item?.texto === 'string' ? item.texto.trim() : '';
    if (!texto) continue;

    // Tipo desconhecido vira conteúdo, e não descarte: um rótulo errado deixa
    // o trecho no lugar errado da nota; descartar tira a fala da pessoa.
    const tipo = TIPOS.includes(item?.tipo as TipoDeTrecho)
      ? (item.tipo as TipoDeTrecho)
      : 'conteudo';

    const prazo =
      typeof item?.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.prazo)
        ? item.prazo
        : undefined;

    trechos.push(prazo ? { texto, tipo, prazo } : { texto, tipo });
  }

  if (trechos.length === 0) return inteiro();

  const faltando = oQueFicouDeFora(trechos, textoOriginal);
  if (faltando) trechos.push({ texto: faltando, tipo: 'conteudo' });

  return trechos;
}

/**
 * O que do original não apareceu em trecho nenhum.
 *
 * Compara por PALAVRA, e não por posição: o modelo junta falas, corta pontuação
 * e às vezes troca a ordem de dois trechos vizinhos. Cobrar posição exata
 * acusaria perda em toda resposta boa, e o aviso viraria ruído que se aprende a
 * ignorar.
 *
 * Devolve nulo quando a cobertura está boa. O corte é de 15%: abaixo disso é
 * diferença de pontuação e junção de fala, não conteúdo sumido.
 */
export function oQueFicouDeFora(trechos: Trecho[], textoOriginal: string): string | null {
  const original = normalizar(textoOriginal);
  if (!original) return null;

  const cobertas = new Set(normalizar(trechos.map((t) => t.texto).join(' ')).split(' '));
  const palavras = original.split(' ');
  const ausentes = palavras.filter((p) => p && !cobertas.has(p));

  if (ausentes.length / palavras.length < 0.15) return null;

  // Devolve o TRECHO ORIGINAL inteiro, e não as palavras soltas que faltaram:
  // uma lista de palavras fora de ordem não é aproveitável por ninguém. Perder
  // a organização é aceitável; perder o texto não.
  return textoOriginal.trim();
}

/**
 * Vira o markdown que entra na nota.
 *
 * O conteúdo vem primeiro e limpo, porque é o que se lê. As tarefas viram uma
 * lista de caixas no topo — é o que a pessoa procura primeiro e o que ela mais
 * perde. O ruído vai para o fim, dentro de um bloco recolhido: continua no
 * arquivo para quem quiser conferir, sem atrapalhar quem quer estudar.
 */
export function paraMarkdown(trechos: Trecho[]): string {
  const tarefas = trechos.filter((t) => t.tipo === 'tarefa');
  const conteudo = trechos.filter((t) => t.tipo === 'conteudo');
  const ruido = trechos.filter((t) => t.tipo === 'ruido');

  const partes: string[] = [];

  if (tarefas.length > 0) {
    partes.push('## Para fazer');
    for (const t of tarefas) {
      const quando = t.prazo ? ` _(${t.prazo})_` : '';
      partes.push(`- [ ] ${t.texto}${quando}`);
    }
    partes.push('');
  }

  if (conteudo.length > 0) {
    partes.push('## Aula');
    for (const t of conteudo) partes.push(t.texto, '');
  }

  if (ruido.length > 0) {
    partes.push('---', '_Trechos que pareceram fora da aula:_', '');
    for (const t of ruido) partes.push(`> ${t.texto}`);
  }

  return partes.join('\n').trim();
}
